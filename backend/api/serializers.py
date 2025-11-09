# api/serializers.py
from rest_framework import serializers
from django.contrib.auth import get_user_model
from . import models

User = get_user_model()

#
# Basic serializers
#
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        # expose only safe fields
        fields = ('id', 'username', 'full_name', 'email', 'role', 'is_active')
        read_only_fields = ('id',)


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Supplier
        fields = '__all__'
        read_only_fields = ('id', 'created_at')


class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Customer
        # name and phone are required by model; expose credited_amount
        fields = ('id', 'name', 'phone', 'email', 'address', 'notes', 'credited_amount', 'is_active', 'created_at')
        read_only_fields = ('id', 'created_at')


#
# Product serializer - hide cost_price for non-admins
#
class ProductSerializer(serializers.ModelSerializer):
    # Example: show a bool if product is low/out of stock
    is_out_of_stock = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = models.Product
        # include cost_price but we may remove it in to_representation
        fields = (
            'id', 'sku', 'name', 'description', 'cost_price', 'selling_price',
            'minimum_selling_price', 'quantity_in_stock',
            'is_active', 'created_at', 'updated_at', 'is_out_of_stock'
        )
        read_only_fields = ('id', 'created_at', 'updated_at', 'is_out_of_stock')

    def get_is_out_of_stock(self, obj):
        return (obj.quantity_in_stock or 0) <= 0

    def to_representation(self, instance):
        """
        Remove cost_price from the serialized output if the request user is staff.
        We rely on serializer context: view should pass request via `context={'request': request}`.
        """
        ret = super().to_representation(instance)
        request = self.context.get('request')
        # If no request available, optionally check context role override
        role = None
        if request and hasattr(request, "user") and request.user.is_authenticated:
            role = getattr(request.user, 'role', None)
        else:
            # allow tests to inject context['role']
            role = self.context.get('role')

        # If role is staff (not admin), remove cost_price
        if role and role == 'staff':
            ret.pop('cost_price', None)
        return ret

    def validate_minimum_selling_price(self, value):
        # Basic validation: min price cannot be negative
        if value is not None and value < 0:
            raise serializers.ValidationError("minimum_selling_price cannot be negative.")
        return value


#
# Sale lines & Sale (nested)
#
class SaleLineSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = models.SaleLine
        fields = ('id', 'product', 'product_name', 'sku', 'quantity', 'unit_price', 'original_unit_price', 'line_total', 'created_at')
        read_only_fields = ('id', 'line_total', 'created_at')

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError("Quantity must be at least 1.")
        return value


class SaleSerializer(serializers.ModelSerializer):
    lines = SaleLineSerializer(many=True)
    created_by = UserSerializer(read_only=True)

    class Meta:
        model = models.Sale
        fields = ('id', 'sale_no', 'date', 'customer', 'employee', 'subtotal', 'tax', 'discount',
                  'total_amount', 'payment_method', 'is_credit', 'created_by', 'created_at', 'lines')
        read_only_fields = ('id', 'date', 'created_at', 'created_by')

    def validate(self, data):
        # Basic check: lines must be present
        lines = data.get('lines') or []
        if not lines:
            raise serializers.ValidationError("Sale must have at least one line.")
        return data

    def create(self, validated_data):
        lines_data = validated_data.pop('lines', [])
        # Optionally set created_by from context
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        sale = models.Sale.objects.create(created_by=user, **validated_data)

        subtotal = 0
        for line in lines_data:
            qty = line.get('quantity', 0)
            unit = line.get('unit_price', 0)
            product = line.get('product')
            product_name = line.get('product_name') or (product.name if product else '')
            line_total = qty * float(unit)
            subtotal += line_total
            sl = models.SaleLine.objects.create(
                sale=sale,
                product=product,
                product_name=product_name,
                sku=getattr(product, 'sku', None),
                quantity=qty,
                unit_price=unit,
                original_unit_price=line.get('original_unit_price', unit),
                line_total=line_total
            )
            # reduce stock if product exists
            if product:
                product.quantity_in_stock = max(0, (product.quantity_in_stock or 0) - qty)
                product.save(update_fields=['quantity_in_stock'])

        # finalize totals
        sale.subtotal = subtotal
        sale.total_amount = validated_data.get('total_amount', subtotal)
        sale.save(update_fields=['subtotal', 'total_amount'])
        return sale


#
# PurchaseOrder + POLine nested serializer (support nested create)
#
class POLineSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = models.POLine
        fields = ('id', 'product', 'product_name', 'description', 'qty_ordered', 'qty_received', 'unit_cost', 'line_total', 'created_at')
        read_only_fields = ('id', 'line_total', 'created_at')

    def validate_qty_ordered(self, value):
        if value <= 0:
            raise serializers.ValidationError("Quantity ordered must be at least 1.")
        return value


class PurchaseOrderSerializer(serializers.ModelSerializer):
    lines = POLineSerializer(many=True)
    created_by = UserSerializer(read_only=True)
    supplier = SupplierSerializer(read_only=False)

    class Meta:
        model = models.PurchaseOrder
        fields = ('id', 'po_no', 'supplier', 'created_by', 'date', 'expected_date', 'status', 'total_amount', 'amount_paid', 'notes', 'created_at', 'lines')
        read_only_fields = ('id', 'created_at')

    def create(self, validated_data):
        lines_data = validated_data.pop('lines', [])
        request = self.context.get('request')
        user = getattr(request, 'user', None)

        # If supplier is supplied as a nested dict (or supplier id), handle both
        supplier_data = validated_data.pop('supplier', None)
        supplier_obj = None
        if isinstance(supplier_data, dict) and supplier_data.get('id') is None:
            # create supplier if payload contains supplier details (optional)
            supplier_obj = models.Supplier.objects.create(**supplier_data)
        elif isinstance(supplier_data, dict) and supplier_data.get('id'):
            supplier_obj = models.Supplier.objects.get(id=supplier_data['id'])
        else:
            supplier_obj = supplier_data  # or None

        po = models.PurchaseOrder.objects.create(created_by=user, supplier=supplier_obj, **validated_data)

        total = 0
        for line in lines_data:
            qty = line.get('qty_ordered', 0)
            unit_cost = line.get('unit_cost', 0)
            line_total = qty * float(unit_cost)
            total += line_total
            models.POLine.objects.create(
                purchase_order=po,
                product=line.get('product'),
                description=line.get('description'),
                qty_ordered=qty,
                qty_received=line.get('qty_received', 0),
                unit_cost=unit_cost,
                line_total=line_total
            )

        # update PO total
        po.total_amount = total
        po.save(update_fields=['total_amount'])
        return po


#
# Inquiry + payments
#
class InquiryPaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.InquiryPayment
        fields = ('id', 'inquiry', 'amount', 'payment_date', 'payment_method', 'reference', 'created_by', 'created_at')
        read_only_fields = ('id', 'payment_date', 'created_by', 'created_at')


class InquirySerializer(serializers.ModelSerializer):
    payments = InquiryPaymentSerializer(many=True, read_only=True)

    class Meta:
        model = models.Inquiry
        fields = ('id', 'inquiry_no', 'customer', 'contact_name', 'contact_phone', 'product_description',
                  'expected_price', 'advance_amount', 'advance_received', 'status', 'assigned_to', 'notes', 'created_at', 'payments')
        read_only_fields = ('id', 'created_at', 'payments')

#
# Attendance, Expense, InventoryMovement, SupplierPayment, Audit
#
class AttendanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Attendance
        fields = ('id', 'employee', 'date', 'status', 'checked_in_at', 'checked_out_at', 'notes', 'daily_salary_applied', 'recorded_by', 'created_at')
        read_only_fields = ('id', 'created_at')

    def validate(self, data):
        # Example: ensure unique employee+date is respected (DB constraint exists)
        # You can add logic to fill daily_salary_applied from employee if missing
        if 'daily_salary_applied' not in data or data.get('daily_salary_applied') in (None, ''):
            emp = data.get('employee')
            if emp and getattr(emp, 'daily_salary', None):
                data['daily_salary_applied'] = emp.daily_salary
        return data


class ExpenseSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Expense
        fields = ('id', 'date', 'category', 'amount', 'paid_by', 'notes', 'receipt_url', 'created_by', 'created_at')
        read_only_fields = ('id', 'date', 'created_at', 'created_by')


class SupplierPaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.SupplierPayment
        fields = ('id', 'supplier', 'purchase_order', 'amount', 'payment_date', 'payment_method', 'reference', 'created_by', 'notes', 'created_at')
        read_only_fields = ('id', 'payment_date', 'created_at', 'created_by')


class InventoryMovementSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.InventoryMovement
        fields = ('id', 'product', 'change_qty', 'reason', 'reference', 'performed_by', 'notes', 'created_at')
        read_only_fields = ('id', 'created_at')


class PriceOverrideSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.PriceOverride
        fields = ('id', 'sale', 'sale_line', 'overridden_by', 'original_unit_price', 'final_unit_price', 'reason', 'created_at')
        read_only_fields = ('id', 'created_at')


class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.AuditLog
        fields = ('id', 'actor', 'action', 'entity_type', 'entity_id', 'changes', 'created_at')
        read_only_fields = ('id', 'created_at')


class EmployeeSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Employee
        fields = [
            'id',
            'employee_code',
            'name',
            'department',
            'phone',
            'nic',
            'hire_date',
            'daily_salary',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def create(self, validated_data):
        # Auto-generate a simple employee_code if not supplied: EMP + timestamp
        if not validated_data.get('employee_code'):
            import time
            validated_data['employee_code'] = f"EMP{int(time.time())}"
        return super().create(validated_data)