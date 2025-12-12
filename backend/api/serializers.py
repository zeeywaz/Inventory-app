# api/serializers.py
from rest_framework import serializers
from django.contrib.auth import get_user_model
from . import models
from django.db import transaction
User = get_user_model()
import logging
logger = logging.getLogger(__name__)

#
# Basic serializers
#


class UserSerializer(serializers.ModelSerializer):
    # expose a computed full_name so serializers referencing "full_name" keep working
    full_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = User
        # include first_name/last_name as well if you need them
        fields = ('id', 'username', 'full_name', 'first_name', 'last_name', 'email', 'role', 'is_active')
        read_only_fields = ('id',)

    def get_full_name(self, obj):
        # AbstractUser defines get_full_name(), which joins first_name + last_name.
        # Fall back to username if both are blank.
        name = obj.get_full_name() if hasattr(obj, 'get_full_name') else None
        if name:
            name = name.strip()
        if not name:
            # try concatenating fields manually, or fall back to username
            parts = filter(None, [getattr(obj, 'first_name', ''), getattr(obj, 'last_name', '')])
            name = " ".join(parts).strip() or getattr(obj, 'username', '')
        return name

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
            'is_active', 'created_at', 'updated_at', 'is_out_of_stock', 'vehicle'
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

    # ensure prices are validated as decimals and original_unit_price is optional
    unit_price = serializers.DecimalField(max_digits=12, decimal_places=2)
    original_unit_price = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, allow_null=True
    )

    class Meta:
        model = models.SaleLine
        fields = ('id', 'product', 'product_name', 'sku', 'quantity',
                  'unit_price', 'original_unit_price', 'line_total', 'created_at')
        read_only_fields = ('id', 'line_total', 'created_at')

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError("Quantity must be at least 1.")
        return value

    def validate(self, data):
        """
        Ensure original_unit_price defaults to unit_price when not provided.
        This runs during serializer validation (so nested create won't fail).
        """
        unit = data.get('unit_price') or 0
        if data.get('original_unit_price') in (None, ''):
            data['original_unit_price'] = unit
        return data


# api/serializers.py

class SaleSerializer(serializers.ModelSerializer):
    lines = SaleLineSerializer(many=True)
    created_by = UserSerializer(read_only=True)

    class Meta:
        model = models.Sale
        fields = ('id', 'sale_no', 'date', 'customer', 'employee', 'subtotal', 'tax', 'discount',
                  'total_amount', 'payment_method', 'is_credit', 'created_by', 'created_at', 'lines', 'vehicle_number')
        read_only_fields = ('id', 'date', 'created_at', 'created_by')

    # --- DELETE THE validate METHOD THAT WAS HERE ---
    # We removed it to allow empty lines (Full Returns)

    def create(self, validated_data):
        # ... (Keep your existing create logic exactly as is) ...
        lines_data = validated_data.pop('lines', [])
        request = self.context.get('request')
        created_by = getattr(request, 'user', None)

        sale = models.Sale.objects.create(created_by=created_by, **validated_data)

        subtotal = 0
        for line in lines_data:
            qty = line.get('quantity', 0)
            unit = line.get('unit_price', 0)
            product = line.get('product')
            product_name = line.get('product_name') or (product.name if product else '')
            line_total = float(qty) * float(unit)
            subtotal += line_total

            models.SaleLine.objects.create(
                sale=sale,
                product=product,
                product_name=product_name,
                sku=getattr(product, 'sku', None),
                quantity=qty,
                unit_price=unit,
                original_unit_price=line.get('original_unit_price', unit),
                line_total=line_total
            )

            # Deduct stock
            if product:
                models.Product.objects.filter(pk=product.pk).update(quantity_in_stock=F('quantity_in_stock') - qty)

        sale.subtotal = subtotal
        sale.total_amount = validated_data.get('total_amount', subtotal)
        sale.save(update_fields=['subtotal', 'total_amount'])
        return sale

    def update(self, instance, validated_data):
        # ... (Keep your existing update logic exactly as is) ...
        # ... The logic we wrote earlier handles empty lines correctly 
        # ... by deleting the old lines and restoring stock.
        lines_data = validated_data.pop('lines', None)
        
        # 1. Update main fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # 2. Sync Lines if provided
        if lines_data is not None:
            with transaction.atomic():
                # Map existing lines by ID
                existing_lines = {line.id: line for line in instance.lines.all()}
                posted_line_ids = set()
                
                current_subtotal = 0

                for line_item in lines_data:
                    line_id = line_item.get('id') # Passed if editing an existing line
                    
                    qty = line_item.get('quantity', 0)
                    unit_price = line_item.get('unit_price', 0)
                    product = line_item.get('product')
                    product_name = line_item.get('product_name') or (product.name if product else '')
                    line_total = float(qty) * float(unit_price)
                    current_subtotal += line_total

                    if line_id and line_id in existing_lines:
                        # --- UPDATE EXISTING LINE ---
                        line_obj = existing_lines[line_id]
                        posted_line_ids.add(line_id)
                        
                        # Adjust Stock: Revert old qty, apply new qty
                        old_qty = line_obj.quantity
                        old_prod = line_obj.product
                        
                        # 1. Revert old
                        if old_prod:
                            models.Product.objects.filter(pk=old_prod.pk).update(quantity_in_stock=F('quantity_in_stock') + old_qty)
                        
                        # 2. Update line fields
                        line_obj.product = product
                        line_obj.product_name = product_name
                        line_obj.quantity = qty
                        line_obj.unit_price = unit_price
                        line_obj.line_total = line_total
                        line_obj.save()

                        # 3. Deduct new (if product exists)
                        if product:
                            models.Product.objects.filter(pk=product.pk).update(quantity_in_stock=F('quantity_in_stock') - qty)

                    else:
                        # --- CREATE NEW LINE ---
                        models.SaleLine.objects.create(
                            sale=instance,
                            product=product,
                            product_name=product_name,
                            sku=getattr(product, 'sku', None),
                            quantity=qty,
                            unit_price=unit_price,
                            original_unit_price=unit_price,
                            line_total=line_total
                        )
                        # Deduct stock
                        if product:
                            models.Product.objects.filter(pk=product.pk).update(quantity_in_stock=F('quantity_in_stock') - qty)

                # 3. Delete removed lines
                for old_id, old_line in existing_lines.items():
                    if old_id not in posted_line_ids:
                        # Restore stock before deleting
                        if old_line.product:
                            models.Product.objects.filter(pk=old_line.product.pk).update(quantity_in_stock=F('quantity_in_stock') + old_line.quantity)
                        old_line.delete()

                # Update totals
                instance.subtotal = current_subtotal
                instance.total_amount = current_subtotal  # adjust for tax/discount if you implement them
                instance.save()

        return instance

#
# PurchaseOrder + POLine nested serializer (support nested create)
#
# api/serializers.py
# api/serializers.py (purchase order + poline parts)
# purchase-order / POLine section of api/serializers.py
import logging
from decimal import Decimal

from django.db import transaction
from django.db.models import F
from rest_framework import serializers

from . import models

logger = logging.getLogger(__name__)


class POLineSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = models.POLine
        fields = (
            'id', 'product', 'product_name', 'description',
            'qty_ordered', 'qty_received', 'unit_cost', 'line_total', 'created_at'
        )
        read_only_fields = ('id', 'line_total', 'created_at')

    def validate_qty_ordered(self, value):
        if value <= 0:
            raise serializers.ValidationError("Quantity ordered must be at least 1.")
        return value


class PurchaseOrderSerializer(serializers.ModelSerializer):
    lines = POLineSerializer(many=True)
    created_by = serializers.SerializerMethodField(read_only=True)

    supplier = serializers.SerializerMethodField(read_only=True)
    supplier_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        required=False,
        allow_null=True,
        source='supplier',
        queryset=models.Supplier.objects.all(),
    )

    class Meta:
        model = models.PurchaseOrder
        fields = (
            'id', 'po_no', 'supplier', 'supplier_id', 'created_by', 'date',
            'expected_date', 'status', 'total_amount', 'amount_paid', 'notes', 'created_at', 'lines'
        )
        read_only_fields = ('id', 'created_at')

    def get_created_by(self, obj):
        user = getattr(obj, 'created_by', None)
        if not user:
            return None
        return {'id': user.id, 'username': getattr(user, 'username', '')}

    def get_supplier(self, obj):
        sup = getattr(obj, 'supplier', None)
        if not sup:
            return None
        return {'id': sup.id, 'name': getattr(sup, 'name', '')}

    # -------------------------
    # CREATE (unchanged semantics: require valid product ids)
    # -------------------------
    def create(self, validated_data):
        lines_data = validated_data.pop('lines', [])
        supplier_data = validated_data.pop('supplier', None)
        request = self.context.get('request')
        request_user = getattr(request, 'user', None)
        created_by = validated_data.pop('created_by', None)
        user = created_by or request_user

        # resolve supplier
        supplier_obj = None
        if supplier_data is None:
            supplier_obj = None
        elif isinstance(supplier_data, models.Supplier):
            supplier_obj = supplier_data
        elif isinstance(supplier_data, dict):
            sid = supplier_data.get('id')
            if sid:
                try:
                    supplier_obj = models.Supplier.objects.filter(id=int(sid)).first()
                except Exception:
                    supplier_obj = None
            else:
                supplier_obj = models.Supplier.objects.create(**supplier_data)
        else:
            try:
                supplier_obj = models.Supplier.objects.filter(id=int(supplier_data)).first()
            except Exception:
                supplier_obj = None

        po = models.PurchaseOrder.objects.create(created_by=user, supplier=supplier_obj, **validated_data)

        total = Decimal('0.00')
        for idx, line in enumerate(lines_data):
            try:
                qty = int(line.get('qty_ordered', 0) or 0)
            except Exception:
                raise serializers.ValidationError({"lines": f"Invalid qty_ordered in line index {idx}"})
            try:
                unit_cost = Decimal(str(line.get('unit_cost', 0) or 0))
            except Exception:
                raise serializers.ValidationError({"lines": f"Invalid unit_cost in line index {idx}"})
            line_total = (Decimal(qty) * unit_cost)
            total += line_total

            # resolve product from several possible shapes
            product_val = line.get('product') or line.get('product_id') or line.get('productId')
            product_obj = None
            if isinstance(product_val, models.Product):
                product_obj = product_val
            elif isinstance(product_val, dict):
                pid = product_val.get('id') or product_val.get('pk')
                try:
                    pid = int(pid)
                except Exception:
                    pid = None
                if pid is not None:
                    product_obj = models.Product.objects.filter(id=pid).first()
            else:
                try:
                    pid = int(product_val) if product_val is not None and str(product_val).strip() != '' else None
                except Exception:
                    pid = None
                if pid is not None:
                    product_obj = models.Product.objects.filter(id=pid).first()

            if product_obj is None:
                raise serializers.ValidationError({"lines": f"Product not found or invalid for line index {idx}: product={product_val}"})

            models.POLine.objects.create(
                purchase_order=po,
                product=product_obj,
                description=line.get('description') or None,
                qty_ordered=qty,
                qty_received=int(line.get('qty_received', 0) or 0),
                unit_cost=unit_cost,
                line_total=line_total
            )

        po.total_amount = total
        po.save(update_fields=['total_amount'])
        return po

    # -------------------------
    # UPDATE (robust matching + positional fallback)
    # -------------------------
    def update(self, instance, validated_data):
        """
        Update PurchaseOrder + nested POLines.
        Matching rules (in order of preference):
         - If incoming item has an 'id' / 'poline_id' / 'line_id' -> match by that POLine id
         - Else if incoming item has a resolvable product id (product/product_id/productId) -> match outstanding POLine with that product
         - Else: FALLBACK to positional matching: match to the next unmatched POLine in DB order (useful when client sends only an ordered list)
        """
        lines_data = validated_data.pop('lines', None)
        supplier_in = validated_data.pop('supplier', None)
        request = self.context.get('request')
        user = getattr(request, 'user', None)

        # update top-level fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if supplier_in is not None:
            if isinstance(supplier_in, models.Supplier):
                instance.supplier = supplier_in
            elif isinstance(supplier_in, dict):
                sid = supplier_in.get('id')
                if sid:
                    instance.supplier = models.Supplier.objects.filter(id=int(sid)).first()
                else:
                    instance.supplier = models.Supplier.objects.create(**supplier_in)
            else:
                try:
                    instance.supplier = models.Supplier.objects.filter(id=int(supplier_in)).first()
                except Exception:
                    instance.supplier = None

        instance.save()

        if lines_data is None:
            return instance

        with transaction.atomic():
            # lock polines for update (no select_related to avoid FOR UPDATE outer-join problem)
            polines_qs = models.POLine.objects.select_for_update().filter(purchase_order=instance)
            polines = list(polines_qs.prefetch_related('product'))
            polines_map_by_id = {pl.id: pl for pl in polines}
            polines_by_product = {}
            for pl in polines:
                if pl.product_id is not None:
                    polines_by_product.setdefault(int(pl.product_id), []).append(pl)

            # an ordered list of unmatched polines for positional fallback
            unmatched_polines = [pl for pl in polines]
            consumed_ids = set()

            def mark_consumed(p):
                if not p:
                    return
                pid = getattr(p, 'id', None)
                if pid is None:
                    return
                consumed_ids.add(pid)
                # remove from unmatched_polines if present
                try:
                    unmatched_polines.remove(p)
                except ValueError:
                    pass
                # remove from product lists
                if p.product_id is not None:
                    lst = polines_by_product.get(int(p.product_id))
                    if lst and p in lst:
                        lst.remove(p)

            for idx, item in enumerate(lines_data):
                # canonicalize possible incoming keys
                raw_poline_id = item.get('id') or item.get('poline_id') or item.get('line_id')
                product_val = item.get('product') or item.get('product_id') or item.get('productId')
                raw_qty = item.get('qty_received') if 'qty_received' in item else (item.get('qty') if 'qty' in item else item.get('quantity'))

                # if product_val is dict, use its 'id' or 'pk'
                if isinstance(product_val, dict):
                    product_val = product_val.get('id') or product_val.get('pk')

                # normalize numbers
                try:
                    qty_received = int(raw_qty) if raw_qty is not None else None
                except (TypeError, ValueError):
                    qty_received = None

                try:
                    poline_id = int(raw_poline_id) if raw_poline_id is not None and str(raw_poline_id).strip() != '' else None
                except Exception:
                    poline_id = None

                try:
                    product_id = int(product_val) if product_val is not None and str(product_val).strip() != '' else None
                except Exception:
                    product_id = None

                poline = None

                # 1) match by explicit POLine id
                if poline_id:
                    candidate = polines_map_by_id.get(poline_id)
                    if candidate is None:
                        raise serializers.ValidationError({"lines": f"POLine id {poline_id} not found on this PurchaseOrder (incoming line index {idx})."})
                    # ensure not already consumed
                    if candidate.id in consumed_ids:
                        # allow repeated id only if intended — but guarded
                        logger.debug("POLine id %s was already consumed; incoming index %s", candidate.id, idx)
                    poline = candidate
                    mark_consumed(poline)

                # 2) otherwise match by product id (prefer lines with remaining qty)
                if poline is None and product_id is not None:
                    candidates = polines_by_product.get(product_id) or []
                    chosen = None
                    # prefer outstanding lines first
                    for c in candidates:
                        if c.id in consumed_ids:
                            continue
                        if (c.qty_received or 0) < (c.qty_ordered or 0):
                            chosen = c
                            break
                    # if none outstanding, take any candidate not consumed
                    if chosen is None:
                        for c in candidates:
                            if c.id not in consumed_ids:
                                chosen = c
                                break
                    # last resort DB lookup (shouldn't normally be required)
                    if chosen is None:
                        cand = models.POLine.objects.filter(purchase_order=instance, product_id=product_id).first()
                        if cand and getattr(cand, 'id', None) not in consumed_ids:
                            chosen = cand
                    if chosen is None:
                        raise serializers.ValidationError({"lines": f"No POLine found for product id {product_id} on this PurchaseOrder (incoming line index {idx})."})
                    poline = chosen
                    mark_consumed(poline)

                # 3) positional fallback: match to next unmatched poline
                if poline is None:
                    # pick the first unmatched poline that isn't consumed
                    fallback = None
                    for candidate in list(unmatched_polines):
                        if candidate.id not in consumed_ids:
                            fallback = candidate
                            break
                    if fallback:
                        poline = fallback
                        mark_consumed(poline)
                        logger.debug("Positional fallback matched incoming line index %s to POLine id %s", idx, getattr(poline, 'id', None))

                logger.debug("PurchaseOrder.update: incoming idx=%s resolved poline=%s (product_id=%s qty_received=%s)",
                             idx, getattr(poline, 'id', None), product_id, qty_received)

                # Now apply changes: either update an existing poline, or create a new one
                if poline:
                    prev_received = poline.qty_received or 0
                    if qty_received is not None and qty_received != prev_received:
                        poline.qty_received = qty_received
                        poline.save(update_fields=['qty_received'])

                        delta = qty_received - (prev_received or 0)
                        if delta > 0 and poline.product:
                            # race-safe update
                            models.Product.objects.filter(pk=poline.product.pk).update(quantity_in_stock=F('quantity_in_stock') + delta)
                            try:
                                poline.product.refresh_from_db()
                            except Exception:
                                pass
                            try:
                                models.InventoryMovement.objects.create(
                                    product=poline.product,
                                    change_qty=delta,
                                    reason='PO received',
                                    reference=f'PO:{instance.id} POLine:{poline.id}',
                                    performed_by=user if (user and user.is_authenticated) else None
                                )
                            except Exception as e:
                                logger.exception("Failed to create InventoryMovement for product=%s: %s", getattr(poline.product, 'id', None), e)
                            logger.debug("Product id=%s stock updated by +%s", getattr(poline.product, 'id', None), delta)
                else:
                    # no existing poline found at all -> attempt to create only if product_id present
                    if product_id is None:
                        raise serializers.ValidationError({"lines": f"Could not resolve POLine at index {idx}: missing or invalid 'id' and 'product'."})

                    product_obj = models.Product.objects.filter(id=product_id).first()
                    if product_obj is None:
                        raise serializers.ValidationError({"lines": f"Product with id {product_id} not found."})

                    try:
                        created_qty_ordered = int(item.get('qty_ordered', 0) or 0)
                    except Exception:
                        created_qty_ordered = 0
                    created_qty_received = int(qty_received or 0)
                    try:
                        created_unit_cost = Decimal(str(item.get('unit_cost', 0) or 0))
                    except Exception:
                        created_unit_cost = Decimal('0.00')
                    created_line_total = Decimal(str(item.get('line_total', 0))) if item.get('line_total') not in (None, '') else (Decimal(created_qty_ordered) * created_unit_cost)

                    created_pl = models.POLine.objects.create(
                        purchase_order=instance,
                        product=product_obj,
                        description=item.get('description', '') or None,
                        qty_ordered=created_qty_ordered,
                        qty_received=created_qty_received,
                        unit_cost=created_unit_cost,
                        line_total=created_line_total,
                    )
                    logger.debug("Created new POLine id=%s product=%s qty_received=%s", created_pl.id, getattr(created_pl.product, 'id', None), created_pl.qty_received)

                    if created_pl.qty_received and created_pl.product:
                        models.Product.objects.filter(pk=created_pl.product.pk).update(quantity_in_stock=F('quantity_in_stock') + created_pl.qty_received)
                        try:
                            created_pl.product.refresh_from_db()
                        except Exception:
                            pass
                        try:
                            models.InventoryMovement.objects.create(
                                product=created_pl.product,
                                change_qty=created_pl.qty_received,
                                reason='PO received (new POLine)',
                                reference=f'PO:{instance.id} POLine:{created_pl.id}',
                                performed_by=user if (user and user.is_authenticated) else None
                            )
                        except Exception as e:
                            logger.exception("Failed to create InventoryMovement for product=%s: %s", getattr(created_pl.product, 'id', None), e)
                        logger.debug("Product id=%s stock increased by %s (new POLine)", getattr(created_pl.product, 'id', None), created_pl.qty_received)

        # refresh and return a fresh instance (with lines prefetched)
        instance.refresh_from_db()
        instance = models.PurchaseOrder.objects.prefetch_related('lines__product').get(id=instance.id)
        return instance


#
# Inquiry + payments
#
class InquiryPaymentSerializer(serializers.ModelSerializer):
    # optional: show created_by username instead of id
    created_by = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = models.InquiryPayment
        # DON'T include created_at here because your table doesn't have that column.
        fields = (
            'id',
            'inquiry',        # will be inquiry id (FK)
            'amount',
            'payment_date',
            'payment_method',
            'reference',
            'created_by',
        )
        read_only_fields = ('id', 'payment_date', 'created_by')


class InquirySerializer(serializers.ModelSerializer):
    # Use the default reverse accessor name for InquiryPayment if you didn't set related_name.
    # Default is 'inquirypayment_set'. If your model sets related_name='payments', change source accordingly.
    payments = InquiryPaymentSerializer(many=True, read_only=True, source='inquirypayment_set')

    class Meta:
        model = models.Inquiry
        fields = (
            'id',
            'inquiry_no',
            'customer',
            'contact_name',
            'contact_phone',
            'product_description',
            'expected_price',
            'advance_amount',
            'advance_received',
            'status',
            'assigned_to',
            'notes',
            'created_at',
            'payments',
        )
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
        # do not include created_at — model uses payment_date instead
        fields = (
            'id',
            'supplier',
            'purchase_order',
            'amount',
            'payment_date',
            'payment_method',
            'reference',
            'created_by',
            'notes',
        )
        read_only_fields = ('id', 'payment_date', 'created_by')



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
    


# api/serializers.py

# ... existing imports ...
from .models import SystemSetting 

class SystemSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemSetting
        fields = '__all__'
        read_only_fields = ('id', 'updated_at')

# --- UPDATE YOUR EXISTING ProductSerializer ---
# Replace your current ProductSerializer with this version 
# so it hides the cost price if the setting is disabled for staff.

class ProductSerializer(serializers.ModelSerializer):
    # Example: show a bool if product is low/out of stock
    is_out_of_stock = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = models.Product
        fields = (
            'id', 'sku', 'name', 'description', 'cost_price', 'selling_price',
            'minimum_selling_price', 'quantity_in_stock',
            'is_active', 'created_at', 'updated_at', 'is_out_of_stock', 'vehicle'
        )
        read_only_fields = ('id', 'created_at', 'updated_at', 'is_out_of_stock')

    def get_is_out_of_stock(self, obj):
        return (obj.quantity_in_stock or 0) <= 0

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        request = self.context.get('request')
        
        # 1. Check if user is staff
        is_staff = False
        if request and hasattr(request, "user") and request.user.is_authenticated:
            # Check based on your role logic
            is_staff = getattr(request.user, 'role', '') == 'staff'

        # 2. Fetch global setting (Get singleton)
        try:
            settings = SystemSetting.objects.get(pk=1)
            show_cost = settings.show_cost_to_staff
        except SystemSetting.DoesNotExist:
            show_cost = False # Default to hidden if no settings found

        # 3. If staff AND "show cost" is OFF, remove cost_price from output
        if is_staff and not show_cost:
            ret.pop('cost_price', None)
            
        return ret