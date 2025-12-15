# api/views.py
from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action, api_view, permission_classes
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.utils.dateparse import parse_date, parse_datetime
from django.db.models import Sum, Count, F
from django.utils import timezone

from . import models
from .serializers import ProductSerializer, AttendanceSerializer, EmployeeSerializer
from rest_framework import filters
from decimal import Decimal

from rest_framework import serializers as drf_serializers  # small alias to avoid name clash with your serializers module


#
# Custom permissions (simple, role based)
#
class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Allow read-only access to anyone.
    Write access only for authenticated users with role 'admin' OR Django superusers/is_staff.
    """
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        user = request.user
        return bool(
            user and user.is_authenticated and (
                user.is_superuser or user.is_staff or getattr(user, 'role', None) == 'admin'
            )
        )


class IsAdminOrStockEditor(permissions.BasePermission):
    """
    Allow full write for admin (or superuser/is_staff).
    Allow PATCH/PUT only for staff if they only modify 'quantity_in_stock'.
    """
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        user = request.user
        if not (user and user.is_authenticated):
            return False
        # Adminish users: superuser, is_staff, or role == 'admin'
        if user.is_superuser or user.is_staff or getattr(user, 'role', None) == 'admin':
            return True
        # allow staff (role == 'staff') to proceed — field-level enforcement happens in update()
        if getattr(user, 'role', None) == 'staff':
            return True
        return False


#
# ProductViewSet (unchanged) ...
# (keep the full ProductViewSet implementation you already have)
#
class ProductViewSet(viewsets.ModelViewSet):
    queryset = models.Product.objects.all().order_by('-updated_at', '-created_at')
    serializer_class = ProductSerializer
    permission_classes = [IsAdminOrStockEditor]

    def get_permissions(self):
        return [perm() for perm in self.permission_classes]

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        return ctx

    def create(self, request, *args, **kwargs):
        user = request.user
        if not (user and user.is_authenticated and (user.is_superuser or user.is_staff or getattr(user, 'role', None) == 'admin')):
            return Response({"detail": "Only admin can create products."}, status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        user = request.user
        if not (user and user.is_authenticated and (user.is_superuser or user.is_staff or getattr(user, 'role', None) == 'admin')):
            return Response({"detail": "Only admin can delete products."}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        return self._handle_update(request, partial=False, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        return self._handle_update(request, partial=True, *args, **kwargs)

    def _handle_update(self, request, partial, *args, **kwargs):
        user = request.user
        instance = self.get_object()

        # Admin (superuser/is_staff/role=='admin') can do anything
        if user and user.is_authenticated and (user.is_superuser or user.is_staff or getattr(user, 'role', None) == 'admin'):
            return super().update(request, *args, **kwargs)

        # Staff can only change quantity_in_stock (or call adjust_stock action)
        if user and user.is_authenticated and getattr(user, 'role', None) == 'staff':
            allowed_fields = {'quantity_in_stock'}
            incoming_fields = set(request.data.keys())

            # If they are only updating quantity_in_stock, allow
            if incoming_fields.issubset(allowed_fields):
                try:
                    new_qty = int(request.data.get('quantity_in_stock', instance.quantity_in_stock))
                except (TypeError, ValueError):
                    return Response({"detail": "Invalid quantity_in_stock value."}, status=status.HTTP_400_BAD_REQUEST)

                qty_delta = new_qty - (instance.quantity_in_stock or 0)

                with transaction.atomic():
                    serializer = self.get_serializer(instance, data={'quantity_in_stock': new_qty}, partial=True)
                    serializer.is_valid(raise_exception=True)
                    self.perform_update(serializer)
                    if qty_delta != 0:
                        models.InventoryMovement.objects.create(
                            product=instance,
                            change_qty=qty_delta,
                            reason=request.data.get('reason', 'Stock adjusted by staff'),
                            performed_by=user,
                            notes=request.data.get('notes', '')
                        )

                instance.refresh_from_db()
                return Response(self.get_serializer(instance).data, status=status.HTTP_200_OK)

            return Response({"detail": "Staff can only update stock (quantity_in_stock)."}, status=status.HTTP_403_FORBIDDEN)

        return Response({"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)

    @action(detail=True, methods=['post'], url_path='adjust-stock', permission_classes=[permissions.IsAuthenticated])
    def adjust_stock(self, request, pk=None):
        user = request.user
        # Auth check
        if not (user and user.is_authenticated and (user.is_superuser or user.is_staff or getattr(user, 'role', None) in ('admin','staff'))):
            return Response({"detail": "Authentication required (admin or staff)."}, status=status.HTTP_401_UNAUTHORIZED)

        product = get_object_or_404(models.Product, pk=pk)
        
        # --- NEW LOGIC: Support absolute 'new_quantity' ---
        change = request.data.get('change')
        new_quantity_input = request.data.get('new_quantity')
        
        if new_quantity_input is not None:
            try:
                target_qty = int(new_quantity_input)
                current_qty = product.quantity_in_stock or 0
                change = target_qty - current_qty
            except (ValueError, TypeError):
                return Response({"detail": "Invalid new_quantity"}, status=status.HTTP_400_BAD_REQUEST)
        elif change is not None:
            try:
                change = int(change)
            except (ValueError, TypeError):
                return Response({"detail": "Invalid change value"}, status=status.HTTP_400_BAD_REQUEST)
        else:
             return Response({"detail": "Provide 'change' (delta) or 'new_quantity' (absolute)."}, status=status.HTTP_400_BAD_REQUEST)
        # --------------------------------------------------

        reason = request.data.get('reason', '')[:255]
        notes = request.data.get('notes', '')

        # Calculate final
        new_qty = (product.quantity_in_stock or 0) + change
        if new_qty < 0:
            return Response({"detail": "Resulting stock cannot be negative."}, status=status.HTTP_400_BAD_REQUEST)

        # Do the update
        with transaction.atomic():
            product.quantity_in_stock = new_qty
            product.save(update_fields=['quantity_in_stock', 'updated_at'])
            
            # Only record movement if there was a change
            movement = None
            if change != 0:
                movement = models.InventoryMovement.objects.create(
                    product=product,
                    change_qty=change,
                    reason=reason or 'Stock adjusted',
                    performed_by=user,
                    notes=notes
                )

        return Response({
            "detail": "Stock adjusted",
            "product_id": product.id,
            "new_quantity": new_qty,
            "movement_id": movement.id if movement else None
        }, status=status.HTTP_200_OK)


#
# Attendance ViewSet
#
class AttendanceViewSet(viewsets.ModelViewSet):
    """
    Attendance endpoints:
      - list, retrieve, create, update, destroy
      - list supports ?date=YYYY-MM-DD and ?employee_id=<id> filters
      - POST to /attendance/bulk-mark/ to upsert many records for a date
      - GET /attendance/report/?date=YYYY-MM-DD returns counts and payroll
    """
    queryset = models.Attendance.objects.all().order_by('-date', '-created_at')
    serializer_class = AttendanceSerializer
    permission_classes = [IsAdminOrStockEditor]  # admin and staff allowed to manage attendance

    def get_queryset(self):
        qs = super().get_queryset()
        q_date = self.request.query_params.get('date')
        employee_id = self.request.query_params.get('employee_id')
        if q_date:
            try:
                d = parse_date(q_date)
                if d:
                    qs = qs.filter(date=d)
            except Exception:
                pass
        if employee_id:
            try:
                qs = qs.filter(employee__id=int(employee_id))
            except Exception:
                pass
        return qs

    def create(self, request, *args, **kwargs):
        # Attach recorded_by automatically if not provided
        data = request.data.copy()
        if 'recorded_by' not in data or not data.get('recorded_by'):
            data['recorded_by'] = request.user.pk if request.user and request.user.is_authenticated else None

        # default daily_salary_applied to employee.daily_salary if not supplied
        emp_id = data.get('employee') or data.get('employee_id')
        if emp_id and not data.get('daily_salary_applied'):
            try:
                emp = models.Employee.objects.get(pk=emp_id)
                data['daily_salary_applied'] = emp.daily_salary
            except models.Employee.DoesNotExist:
                pass

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def perform_create(self, serializer):
        # ensure recorded_by set to request.user if not provided
        rb = serializer.validated_data.get('recorded_by', None)
        if not rb and self.request.user and self.request.user.is_authenticated:
            serializer.save(recorded_by=self.request.user)
        else:
            serializer.save()

    def update(self, request, *args, **kwargs):
        # For updates allow admin or staff; staff can still edit their own notes etc.
        return super().update(request, *args, **kwargs)

    # Bulk mark endpoint: upsert many attendance records for a date
    @action(detail=False, methods=['post'], url_path='bulk-mark', permission_classes=[permissions.IsAuthenticated])
    def bulk_mark(self, request):
        """
        POST payload example:
        {
          "date": "2025-11-08",
          "records": [
            {"employee_id": 1, "status": "Present", "daily_salary_applied": 120.00, "checked_in_at": "2025-11-08T08:30:00Z"},
            {"employee_id": 2, "status": "Absent"}
          ]
        }
        This will create or update attendance records for the given date.
        """
        user = request.user
        if not (user and user.is_authenticated and (user.is_superuser or user.is_staff or getattr(user, 'role', None) in ('admin','staff'))):
            return Response({"detail": "Authentication required (admin or staff)."}, status=status.HTTP_401_UNAUTHORIZED)

        payload = request.data
        date_str = payload.get('date')
        records = payload.get('records', [])
        if not date_str:
            return Response({"detail": "Missing 'date' in body."}, status=status.HTTP_400_BAD_REQUEST)

        date_obj = parse_date(date_str)
        if not date_obj:
            return Response({"detail": "Invalid date format. Use YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)

        created = 0
        updated = 0
        errors = []
        processed_ids = []

        with transaction.atomic():
            for rec in records:
                emp_id = rec.get('employee_id') or rec.get('employee')
                if not emp_id:
                    errors.append({"record": rec, "error": "missing employee_id"})
                    continue
                try:
                    emp = models.Employee.objects.get(pk=emp_id)
                except models.Employee.DoesNotExist:
                    errors.append({"record": rec, "error": "employee not found"})
                    continue

                defaults = {
                    'status': rec.get('status', 'Absent'),
                    'notes': rec.get('notes', ''),
                    'daily_salary_applied': rec.get('daily_salary_applied', emp.daily_salary),
                }
                # parse datetimes if provided
                if rec.get('checked_in_at'):
                    dt = parse_datetime(rec.get('checked_in_at'))
                    defaults['checked_in_at'] = dt
                if rec.get('checked_out_at'):
                    dt = parse_datetime(rec.get('checked_out_at'))
                    defaults['checked_out_at'] = dt

                obj, created_flag = models.Attendance.objects.update_or_create(
                    employee=emp,
                    date=date_obj,
                    defaults={**defaults, 'recorded_by': user}
                )
                processed_ids.append(obj.pk)
                if created_flag:
                    created += 1
                else:
                    updated += 1

        # basic payroll summary for that date
        summary_qs = models.Attendance.objects.filter(date=date_obj)
        payroll_total = summary_qs.aggregate(total=Sum('daily_salary_applied'))['total'] or 0.0
        counts = summary_qs.values('status').annotate(count=Count('status'))

        return Response({
            "date": date_obj.isoformat(),
            "created": created,
            "updated": updated,
            "processed_ids": processed_ids,
            "payroll_total": float(payroll_total),
            "counts": list(counts),
            "errors": errors
        }, status=status.HTTP_200_OK)

    # Quick report for a date
    @action(detail=False, methods=['get'], url_path='report', permission_classes=[permissions.IsAuthenticated])
    def report(self, request):
        """
        GET /api/attendance/report/?date=YYYY-MM-DD
        returns counts and payroll cost for the date
        """
        q_date = request.query_params.get('date')
        if not q_date:
            return Response({"detail": "Provide ?date=YYYY-MM-DD"}, status=status.HTTP_400_BAD_REQUEST)
        date_obj = parse_date(q_date)
        if not date_obj:
            return Response({"detail": "Invalid date format."}, status=status.HTTP_400_BAD_REQUEST)

        qs = models.Attendance.objects.filter(date=date_obj)
        payroll_total = qs.aggregate(total=Sum('daily_salary_applied'))['total'] or 0.0
        counts = qs.values('status').annotate(count=Count('status'))
        return Response({
            "date": date_obj.isoformat(),
            "payroll_total": float(payroll_total),
            "counts": list(counts),
            "records": AttendanceSerializer(qs, many=True).data
        }, status=status.HTTP_200_OK)


#
# Lightweight health-check endpoint (function based)
#
@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def health_check(request):
    return Response({"status": "ok", "service": "inventory-api", "version": "0.1"}, status=status.HTTP_200_OK)

 
class EmployeeViewSet(viewsets.ModelViewSet):
    """
    Employee CRUD and small utilities:
      - list/retrieve/create/update/destroy
      - search by ?search=<name|employee_code|phone>
      - actions: POST /api/employees/{id}/deactivate/ and /activate/
    Permissions:
      - read: public (or authenticated depending on your app)
      - write/delete/create: admin (superuser / is_staff / role=='admin')
    """
    queryset = models.Employee.objects.all().order_by('id')
    serializer_class = getattr(__import__('api.serializers', fromlist=['EmployeeSerializer']), 'EmployeeSerializer')
    permission_classes = [IsAdminOrReadOnly]

    # enable simple search (name, employee_code, phone)
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'employee_code', 'phone']

    def create(self, request, *args, **kwargs):
        # Only admins can create (IsAdminOrReadOnly already enforces)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        # Admins allowed (IsAdminOrReadOnly enforces)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        # keep default destruction; permission class prevents non-admin deletes
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'], permission_classes=[IsAdminOrReadOnly])
    def deactivate(self, request, pk=None):
        """Soft-deactivate employee (set is_active = False)"""
        employee = self.get_object()
        employee.is_active = False
        employee.save(update_fields=['is_active', 'updated_at'] if hasattr(employee, 'updated_at') else ['is_active'])
        return Response({'detail': 'Employee deactivated', 'id': employee.id}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[IsAdminOrReadOnly])
    def activate(self, request, pk=None):
        """Activate employee (set is_active = True)"""
        employee = self.get_object()
        employee.is_active = True
        employee.save(update_fields=['is_active', 'updated_at'] if hasattr(employee, 'updated_at') else ['is_active'])
        return Response({'detail': 'Employee activated', 'id': employee.id}, status=status.HTTP_200_OK)
    




from decimal import Decimal, InvalidOperation
from django.db.models import F
from rest_framework import serializers  # used for quick validation in actions

# ---- CustomerViewSet ----
class CustomerViewSet(viewsets.ModelViewSet):
    """
    Customers:
      - list/retrieve/create/update/delete (admin-only for writes)
      - search by ?search=
      - POST /api/customers/{id}/adjust-credit/  body: { "amount": 100.00, "op": "add"|"subtract", "note": "..." }
    """
    queryset = models.Customer.objects.all().order_by('-created_at')
    serializer_class = getattr(__import__('api.serializers', fromlist=['CustomerSerializer']), 'CustomerSerializer'
                                )
    permission_classes = [IsAdminOrStockEditor]

    # enable search on name/phone/email
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'phone', 'email']

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def adjust_credit(self, request, pk=None):
        """
        Adjust credited_amount for a customer.
        body: { "amount": "100.00", "op": "add" | "subtract", "note": "optional note" }
        Only authenticated users can call this (admin checks enforced elsewhere if needed).
        """
        user = request.user
        try:
            customer = self.get_object()
        except Exception:
            return Response({"detail": "Customer not found."}, status=status.HTTP_404_NOT_FOUND)

        # validate minimal payload
        class _AdjSerializer(serializers.Serializer):
            amount = serializers.DecimalField(max_digits=14, decimal_places=2)
            op = serializers.ChoiceField(choices=('add', 'subtract'), default='add')
            note = serializers.CharField(required=False, allow_blank=True)

        ser = _AdjSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        amount = ser.validated_data['amount']
        op = ser.validated_data['op']
        note = ser.validated_data.get('note', '')

        if op == 'add':
            customer.credited_amount = (customer.credited_amount or Decimal('0.00')) + Decimal(amount)
        else:
            # prevent negative credited_amount (business decision)
            new_val = (customer.credited_amount or Decimal('0.00')) - Decimal(amount)
            if new_val < 0:
                return Response({"detail": "Operation would make credited_amount negative."},
                                status=status.HTTP_400_BAD_REQUEST)
            customer.credited_amount = new_val

        customer.save(update_fields=['credited_amount'])

        # optional: create an AuditLog entry
        try:
            models.AuditLog.objects.create(
                actor=user if (user and user.is_authenticated) else None,
                action=f"adjusted customer credit ({op})",
                entity_type='customer',
                entity_id=customer.id,
                changes={"op": op, "amount": str(amount), "note": note},
            )
        except Exception:
            # don't fail the request if audit log can't be created
            pass

        return Response({
            "id": customer.id,
            "credited_amount": str(customer.credited_amount),
            "note": note
        }, status=status.HTTP_200_OK)


# ---- SupplierViewSet ----
class SupplierViewSet(viewsets.ModelViewSet):
    """
    Suppliers:
      - list/retrieve/create/update/delete (admin-only for writes)
      - search by ?search=
      - POST /api/suppliers/{id}/record-payment/ to record a payment to a supplier
    """
    queryset = models.Supplier.objects.all().order_by('-created_at')
    serializer_class = getattr(__import__('api.serializers', fromlist=['SupplierSerializer']), 'SupplierSerializer')
    permission_classes = [IsAdminOrReadOnly]

    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'contact_name', 'phone', 'email']

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def record_payment(self, request, pk=None):
        """
        Record a payment to supplier. Body example:
        {
          "amount": "2500.00",
          "purchase_order_id": 12,           # optional
          "payment_method": "bank transfer",
          "reference": "TXN123",
          "notes": "Paid partial"
        }
        """
        user = request.user
        try:
            supplier = self.get_object()
        except Exception:
            return Response({"detail": "Supplier not found."}, status=status.HTTP_404_NOT_FOUND)

        class _PaySerializer(serializers.Serializer):
            amount = serializers.DecimalField(max_digits=14, decimal_places=2)
            purchase_order_id = serializers.IntegerField(required=False)
            payment_method = serializers.CharField(required=False, allow_blank=True)
            reference = serializers.CharField(required=False, allow_blank=True)
            notes = serializers.CharField(required=False, allow_blank=True)

        ser = _PaySerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        amount = ser.validated_data['amount']
        po_id = ser.validated_data.get('purchase_order_id')
        payment_method = ser.validated_data.get('payment_method', '')
        reference = ser.validated_data.get('reference', '')
        notes = ser.validated_data.get('notes', '')

        with transaction.atomic():
            # create SupplierPayment record
            pay = models.SupplierPayment.objects.create(
                supplier=supplier,
                purchase_order=models.PurchaseOrder.objects.filter(pk=po_id).first() if po_id else None,
                amount=amount,
                payment_method=payment_method,
                reference=reference,
                created_by=user if (user and user.is_authenticated) else None,
                notes=notes
            )

            # update related PO.amount_paid if provided
            if po_id:
                po = models.PurchaseOrder.objects.filter(pk=po_id).first()
                if po:
                    # increment with F to avoid race conditions
                    po.amount_paid = F('amount_paid') + Decimal(amount)
                    po.save(update_fields=['amount_paid'])

            # optional: audit log
            try:
                models.AuditLog.objects.create(
                    actor=user if (user and user.is_authenticated) else None,
                    action="supplier_payment_created",
                    entity_type="supplier_payment",
                    entity_id=pay.id,
                    changes={"amount": str(amount), "po_id": po_id, "reference": reference},
                )
            except Exception:
                pass

        # return a simple payload
        return Response({
            "payment_id": pay.id,
            "supplier_id": supplier.id,
            "amount": str(pay.amount),
            "purchase_order_id": po_id
        }, status=status.HTTP_201_CREATED)



class SupplierPaymentViewSet(viewsets.ModelViewSet):
    """
    SupplierPayment:
      - list/retrieve/create/update/destroy
      - create will update PO.amount_paid atomically (if purchase_order provided)
      - query filters: ?supplier_id= & ?purchase_order_id=
    """
    queryset = models.SupplierPayment.objects.all().order_by('-payment_date', '-id')

    serializer_class = getattr(__import__('api.serializers', fromlist=['SupplierPaymentSerializer']), 'SupplierPaymentSerializer'
                                )
    permission_classes = [IsAdminOrReadOnly]
    filter_backends = [filters.SearchFilter]
    search_fields = ['reference', 'payment_method', 'notes']

    def get_queryset(self):
        qs = super().get_queryset()
        supplier_id = self.request.query_params.get('supplier_id')
        po_id = self.request.query_params.get('purchase_order_id')
        if supplier_id:
            try:
                qs = qs.filter(supplier__id=int(supplier_id))
            except Exception:
                pass
        if po_id:
            try:
                qs = qs.filter(purchase_order__id=int(po_id))
            except Exception:
                pass
        return qs

    def perform_create(self, serializer):
        """
        Create payment and if tied to a purchase_order, increment PO.amount_paid using F() to avoid races.
        """
        user = self.request.user if (self.request.user and self.request.user.is_authenticated) else None
        with transaction.atomic():
            payment = serializer.save(created_by=user)
            po = payment.purchase_order
            if po:
                po.amount_paid = F('amount_paid') + Decimal(payment.amount)
                po.save(update_fields=['amount_paid'])
                po.refresh_from_db()

            # optional audit
            try:
                models.AuditLog.objects.create(
                    actor=user,
                    action='supplier_payment_created',
                    entity_type='supplier_payment',
                    entity_id=payment.id,
                    changes={'amount': str(payment.amount), 'purchase_order': getattr(po, 'id', None)}
                )
            except Exception:
                pass

    def perform_update(self, serializer):
        """
        If amount is changed, update linked PO.amount_paid by delta.
        We disallow changing purchase_order of an existing payment (to keep bookkeeping simple).
        """
        instance = self.get_object()
        incoming_po = serializer.validated_data.get('purchase_order', None)
        if incoming_po and instance.purchase_order and incoming_po.id != instance.purchase_order.id:
            raise drf_serializers.ValidationError("Changing purchase_order on existing payment is not allowed.")

        old_amount = instance.amount
        new_amount = serializer.validated_data.get('amount', old_amount)

        with transaction.atomic():
            serializer.save()
            if instance.purchase_order and new_amount != old_amount:
                delta = Decimal(new_amount) - Decimal(old_amount)
                po = instance.purchase_order
                po.amount_paid = F('amount_paid') + delta
                po.save(update_fields=['amount_paid'])
                po.refresh_from_db()



# ---- InquiryViewSet ----
class InquiryViewSet(viewsets.ModelViewSet):
    """
    Inquiry endpoints:
      - list/retrieve/create/update/delete (admin-only for writes)
      - search by ?search=
      - POST /api/inquiries/{id}/add-payment/  body: { "amount": "100.00", "payment_method":"", "reference":"", "notes":"" }
      - POST /api/inquiries/{id}/mark-status/ body: { "status": "completed" }
    """
    queryset = models.Inquiry.objects.all().order_by('-created_at')
    serializer_class = getattr(__import__('api.serializers', fromlist=['InquirySerializer']), 'InquirySerializer')
    permission_classes = [IsAdminOrReadOnly]
    filter_backends = [filters.SearchFilter]
    search_fields = ['inquiry_no', 'contact_name', 'contact_phone', 'status']

    def get_queryset(self):
        qs = super().get_queryset()
        customer_id = self.request.query_params.get('customer_id')
        status_q = self.request.query_params.get('status')
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        if customer_id:
            try:
                qs = qs.filter(customer__id=int(customer_id))
            except Exception:
                pass
        if status_q:
            qs = qs.filter(status=status_q)
        # simple date range filter (created_at)
        if date_from:
            try:
                qs = qs.filter(created_at__date__gte=parse_date(date_from))
            except Exception:
                pass
        if date_to:
            try:
                qs = qs.filter(created_at__date__lte=parse_date(date_to))
            except Exception:
                pass
        return qs

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def add_payment(self, request, pk=None):
        """
        Add a payment to this inquiry. Creates InquiryPayment and may set inquiry.advance_received.
        Body:
          { "amount": "100.00", "payment_method": "cash", "reference": "TX123", "notes": "partial" }
        """
        user = request.user
        try:
            inquiry = self.get_object()
        except Exception:
            return Response({"detail": "Inquiry not found."}, status=status.HTTP_404_NOT_FOUND)

        class _PaySerializer(drf_serializers.Serializer):
            amount = drf_serializers.DecimalField(max_digits=14, decimal_places=2)
            payment_method = drf_serializers.CharField(required=False, allow_blank=True)
            reference = drf_serializers.CharField(required=False, allow_blank=True)
            notes = drf_serializers.CharField(required=False, allow_blank=True)

        ser = _PaySerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        with transaction.atomic():
            pay = models.InquiryPayment.objects.create(
                inquiry=inquiry,
                amount=data['amount'],
                payment_method=data.get('payment_method', ''),
                reference=data.get('reference', ''),
                created_by=user if (user and user.is_authenticated) else None,
            )
            # if this payment meets or exceeds the inquiry's advance_amount, mark advance_received
            try:
                adv = inquiry.advance_amount or Decimal('0.00')
                if Decimal(pay.amount) >= Decimal(adv) and adv > Decimal('0.00'):
                    inquiry.advance_received = True
                    inquiry.save(update_fields=['advance_received'])
            except Exception:
                # ignore decimal/coercion issues; don't fail payment creation
                pass

        return Response({
            "payment_id": pay.id,
            "inquiry_id": inquiry.id,
            "amount": str(pay.amount)
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], permission_classes=[IsAdminOrReadOnly])
    def mark_status(self, request, pk=None):
        """
        Admin-only: change an inquiry status.
        Body: { "status": "completed" }
        """
        ser = drf_serializers.Serializer(data=request.data)
        ser.fields['status'] = drf_serializers.CharField()
        ser.is_valid(raise_exception=True)
        new_status = ser.validated_data['status']
        inquiry = self.get_object()
        inquiry.status = new_status
        inquiry.save(update_fields=['status'])
        return Response({"detail": "Status updated", "status": new_status}, status=status.HTTP_200_OK)


# ---- ExpenseViewSet ----
class ExpenseViewSet(viewsets.ModelViewSet):
    """
    Expense endpoints:
      - list/retrieve/create/update/delete (admin-only for writes)
      - filters: ?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD, ?min_amount=&?max_amount=
    """
    queryset = models.Expense.objects.all().order_by('-date')
    serializer_class = getattr(__import__('api.serializers', fromlist=['ExpenseSerializer']), 'ExpenseSerializer')
    permission_classes = [IsAdminOrReadOnly]
    filter_backends = [filters.SearchFilter]
    search_fields = ['category', 'notes', 'paid_by']

    def get_queryset(self):
        qs = super().get_queryset()
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        min_amount = self.request.query_params.get('min_amount')
        max_amount = self.request.query_params.get('max_amount')
        if date_from:
            try:
                qs = qs.filter(date__date__gte=parse_date(date_from))
            except Exception:
                pass
        if date_to:
            try:
                qs = qs.filter(date__date__lte=parse_date(date_to))
            except Exception:
                pass
        if min_amount:
            try:
                qs = qs.filter(amount__gte=Decimal(min_amount))
            except Exception:
                pass
        if max_amount:
            try:
                qs = qs.filter(amount__lte=Decimal(max_amount))
            except Exception:
                pass
        return qs

    def perform_create(self, serializer):
        """
        Attach created_by automatically and save.
        """
        user = self.request.user if (self.request.user and self.request.user.is_authenticated) else None
        serializer.save(created_by=user)

    @action(detail=True, methods=['post'], permission_classes=[IsAdminOrReadOnly])
    def mark_paid(self, request, pk=None):
        """
        Example utility action: set an expense as recorded/paid — purely domain-specific.
        Here we just allow marking notes or other meta updates.
        Body: { "notes": "reimbursed" }
        """
        exp = self.get_object()
        notes = request.data.get('notes', None)
        if notes is not None:
            exp.notes = notes
            exp.save(update_fields=['notes'])
        return Response({"detail": "Updated", "id": exp.id}, status=status.HTTP_200_OK)



# ---- PurchaseOrderViewSet & POLineViewSet ----
class POLineViewSet(viewsets.ModelViewSet):
    """
    Optional: manage PO line items directly if needed
    """
    queryset = models.POLine.objects.all().order_by('-created_at')
    serializer_class = getattr(__import__('api.serializers', fromlist=['POLineSerializer']), 'POLineSerializer')
    permission_classes = [IsAdminOrReadOnly]
    filter_backends = [filters.SearchFilter]
    search_fields = ['product__name', 'purchase_order__po_no']


class PurchaseOrderViewSet(viewsets.ModelViewSet):
    """
    PurchaseOrder endpoints:
      - list/retrieve/create/update/delete
      - actions:
        POST /api/purchase-orders/{id}/receive/
          body: {
            "lines": [{"poline_id": 1, "qty_received": 5}, ...],
            "create_payment": {"amount": "1000.00", "payment_method": "...", "reference": "...", "notes": "..."}  # optional
          }
        POST /api/purchase-orders/{id}/complete/   # marks every line as fully received and updates stock
        POST /api/purchase-orders/{id}/record-payment/  # shorthand to create a SupplierPayment for this PO
    """
    queryset = models.PurchaseOrder.objects.all().order_by('-date', '-id')
    serializer_class = getattr(__import__('api.serializers', fromlist=['PurchaseOrderSerializer']), 'PurchaseOrderSerializer')
    permission_classes = [IsAdminOrReadOnly]
    filter_backends = [filters.SearchFilter]
    search_fields = ['po_no', 'supplier__name', 'status']

    def perform_create(self, serializer):
        # set created_by and auto-generate po_no if missing
        user = self.request.user if (self.request.user and self.request.user.is_authenticated) else None
        po = serializer.save(created_by=user)
        if not po.po_no:
            # simple po_no generation: PO + id
            po.po_no = f"PO{po.id:06d}"
            po.save(update_fields=['po_no'])

    @action(detail=True, methods=['post'], permission_classes=[IsAdminOrStockEditor])
    def receive(self, request, pk=None):
        """
        Receive items for a PO and update product stock + create InventoryMovement entries.
        Body:
          {
            "lines": [{"poline_id": 12, "qty_received": 5}, ...],   # optional; if omitted and mark_complete true, we receive all remaining
            "mark_complete": false,   # optional boolean
            "create_payment": {"amount":"100.00", "payment_method":"bank", "reference":"TX", "notes":""}  # optional
          }
        """
        user = request.user
        po = get_object_or_404(models.PurchaseOrder, pk=pk)

        payload = request.data or {}
        lines_payload = payload.get('lines')
        mark_complete = bool(payload.get('mark_complete', False))
        create_payment = payload.get('create_payment')

        processed = []
        errors = []

        with transaction.atomic():
            po_lines = {pl.id: pl for pl in po.lines.select_for_update().all()}  # lock lines
            # helper to receive a given poline by qty
            def _receive_line(pl, recv_qty):
                # ensure non-negative integer
                try:
                    recv_qty = int(recv_qty)
                except Exception:
                    return {"error": "invalid qty", "poline_id": pl.id}
                remaining = (pl.qty_ordered or 0) - (pl.qty_received or 0)
                if remaining <= 0:
                    return {"skipped": "already fully received", "poline_id": pl.id}
                to_add = min(max(0, recv_qty), remaining)
                if to_add <= 0:
                    return {"skipped": "zero or invalid qty", "poline_id": pl.id}

                # update poline
                pl.qty_received = (pl.qty_received or 0) + to_add
                pl.save(update_fields=['qty_received'])

                # update product qty and create InventoryMovement if product exists
                prod = pl.product
                if prod:
                    # use F to avoid race issues; refresh later
                    models.Product.objects.filter(pk=prod.pk).update(quantity_in_stock=F('quantity_in_stock') + to_add)
                    prod.refresh_from_db()
                    models.InventoryMovement.objects.create(
                        product=prod,
                        change_qty=to_add,
                        reason=f"Received from PO {po.po_no or po.id}",
                        reference=str(po.po_no or po.id),
                        performed_by=user if (user and user.is_authenticated) else None,
                        notes=f"POLine {pl.id}"
                    )
                return {"received": to_add, "poline_id": pl.id, "product_id": getattr(pl.product, 'id', None)}

            # If explicit lines provided, use them
            if lines_payload:
                for entry in lines_payload:
                    poline_id = entry.get('poline_id') or entry.get('id') or entry.get('line_id')
                    qty = entry.get('qty_received') or entry.get('qty') or entry.get('quantity')
                    if not poline_id:
                        errors.append({"entry": entry, "error": "missing poline_id"})
                        continue
                    pl = po_lines.get(int(poline_id))
                    if not pl:
                        errors.append({"entry": entry, "error": "poline not found or not part of PO"})
                        continue
                    res = _receive_line(pl, qty)
                    processed.append(res)
            elif mark_complete:
                # receive all remaining quantities
                for pl in po_lines.values():
                    remaining = (pl.qty_ordered or 0) - (pl.qty_received or 0)
                    if remaining > 0:
                        res = _receive_line(pl, remaining)
                        processed.append(res)
            else:
                return Response({"detail": "Provide 'lines' or set 'mark_complete': true"}, status=status.HTTP_400_BAD_REQUEST)

            # determine PO status after receiving
            agg = po.lines.aggregate(total_ordered=Sum('qty_ordered'), total_received=Sum('qty_received'))
            total_ordered = int(agg['total_ordered'] or 0)
            total_received = int(agg['total_received'] or 0)
            new_status = po.status
            if total_received <= 0:
                new_status = po.status or 'placed'
            elif total_received < total_ordered:
                new_status = 'partially_received'
            else:
                new_status = 'completed'
            if new_status != po.status:
                po.status = new_status
                po.save(update_fields=['status'])

            # optional: create supplier payment if requested
            payment_info = None
            if create_payment:
                try:
                    amt = Decimal(str(create_payment.get('amount')))
                    pay = models.SupplierPayment.objects.create(
                        supplier=po.supplier,
                        purchase_order=po,
                        amount=amt,
                        payment_method=create_payment.get('payment_method', ''),
                        reference=create_payment.get('reference', ''),
                        created_by=user if (user and user.is_authenticated) else None,
                        notes=create_payment.get('notes', '')
                    )
                    # increment PO.amount_paid
                    po.amount_paid = F('amount_paid') + amt
                    po.save(update_fields=['amount_paid'])
                    po.refresh_from_db()
                    payment_info = {"payment_id": pay.id, "amount": str(pay.amount)}
                except Exception as e:
                    # don't break receiving if payment creation fails; return error info
                    payment_info = {"error": str(e)}

        return Response({
            "po_id": po.id,
            "po_no": po.po_no,
            "new_status": po.status,
            "processed": processed,
            "errors": errors,
            "payment": payment_info
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[IsAdminOrStockEditor])
    def complete(self, request, pk=None):
        """
        Mark a PO as fully received (qty_received = qty_ordered for all lines),
        update stock and inventory movements accordingly.
        """
        user = request.user
        po = get_object_or_404(models.PurchaseOrder, pk=pk)
        processed = []
        with transaction.atomic():
            for pl in po.lines.select_for_update().all():
                remaining = (pl.qty_ordered or 0) - (pl.qty_received or 0)
                if remaining <= 0:
                    processed.append({"poline_id": pl.id, "skipped": "already fully received"})
                    continue
                # add remaining
                pl.qty_received = pl.qty_ordered
                pl.save(update_fields=['qty_received'])
                if pl.product:
                    models.Product.objects.filter(pk=pl.product.pk).update(quantity_in_stock=F('quantity_in_stock') + remaining)
                    prod = pl.product
                    prod.refresh_from_db()
                    models.InventoryMovement.objects.create(
                        product=prod,
                        change_qty=remaining,
                        reason=f"PO {po.po_no or po.id} completed",
                        reference=str(po.po_no or po.id),
                        performed_by=user if (user and user.is_authenticated) else None,
                        notes=f"POLine {pl.id} completion"
                    )
                processed.append({"poline_id": pl.id, "received": remaining, "product_id": getattr(pl.product, 'id', None)})

            # update PO status & totals
            po.status = 'completed'
            po.save(update_fields=['status'])

        return Response({"detail": "PO completed", "po_id": po.id, "processed": processed}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[IsAdminOrReadOnly])
    def record_payment(self, request, pk=None):
        """
        Convenience action to create a SupplierPayment for this PO.
        Body:
          { "amount": "100.00", "payment_method": "bank", "reference":"", "notes":"" }
        """
        user = request.user
        po = get_object_or_404(models.PurchaseOrder, pk=pk)
        class _PaySerializer(drf_serializers.Serializer):
            amount = drf_serializers.DecimalField(max_digits=14, decimal_places=2)
            payment_method = drf_serializers.CharField(required=False, allow_blank=True)
            reference = drf_serializers.CharField(required=False, allow_blank=True)
            notes = drf_serializers.CharField(required=False, allow_blank=True)
        ser = _PaySerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        with transaction.atomic():
            pay = models.SupplierPayment.objects.create(
                supplier=po.supplier,
                purchase_order=po,
                amount=data['amount'],
                payment_method=data.get('payment_method', ''),
                reference=data.get('reference', ''),
                created_by=user if (user and user.is_authenticated) else None,
                notes=data.get('notes', '')
            )
            po.amount_paid = F('amount_paid') + Decimal(pay.amount)
            po.save(update_fields=['amount_paid'])
            po.refresh_from_db()
        return Response({"payment_id": pay.id, "po_id": po.id, "amount": str(pay.amount)}, status=status.HTTP_201_CREATED)

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user(request):
    """
    GET /api/auth/me/ -> returns basic fields of the authenticated user.
    """
    user = request.user
    return Response({
        "id": user.id,
        "username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email,
        "role": getattr(user, 'role', None)
    })


# add these imports to the top of api/views.py if not already present
from rest_framework import viewsets, status, filters, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils.dateparse import parse_date
from .serializers import SaleSerializer  # <- make sure this import is present

# ---------- SalesViewSet ----------
class SalesViewSet(viewsets.ModelViewSet):
    """
    Sales endpoints:
      - list, retrieve, create, update, destroy
      - filters: ?date=YYYY-MM-DD, ?customer=<id>, ?search=
      - create uses the nested SaleSerializer (your serializers.SaleSerializer handles lines)
    """
    queryset = models.Sale.objects.all().order_by('-date', '-created_at')
    serializer_class = SaleSerializer
    # choose permission class you want. reuse IsAdminOrStockEditor so staff/admin can write.
    permission_classes = [IsAdminOrStockEditor]
    filter_backends = [filters.SearchFilter]
    search_fields = ['sale_no', 'customer__name', 'created_by__username', 'lines__product_name']

    def get_permissions(self):
        # instantiate permission classes just like other viewsets in this file
        return [perm() for perm in self.permission_classes]

    def get_queryset(self):
        qs = super().get_queryset()
        q_date = self.request.query_params.get('date')
        customer = self.request.query_params.get('customer')
        if q_date:
            try:
                d = parse_date(q_date)
                if d:
                    qs = qs.filter(date=d)
            except Exception:
                pass
        if customer:
            try:
                qs = qs.filter(customer__id=int(customer))
            except Exception:
                pass
        return qs

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        return ctx

    def create(self, request, *args, **kwargs):
        """
        Use SaleSerializer.create() which already supports nested lines.
        Ensure serializer receives request in context so created_by etc. work.
        """
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def perform_create(self, serializer):
        # The serializer.create() method already handles 'created_by' from context
        serializer.save()

    # optional convenience: daily summary endpoint
    @action(detail=False, methods=['get'], url_path='daily-summary', permission_classes=[permissions.IsAuthenticated])
    def daily_summary(self, request):
        q_date = request.query_params.get('date')
        if not q_date:
            return Response({"detail": "Provide ?date=YYYY-MM-DD"}, status=status.HTTP_400_BAD_REQUEST)
        d = parse_date(q_date)
        if not d:
            return Response({"detail": "Invalid date format."}, status=status.HTTP_400_BAD_REQUEST)
        qs = models.Sale.objects.filter(date=d)
        total = qs.aggregate(total=Sum('total_amount'))['total'] or 0.0
        return Response({"date": d.isoformat(), "count": qs.count(), "total": float(total)}, status=status.HTTP_200_OK)



# api/views.py

# ... existing imports ...
from django.core.management import call_command
from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser
import io
import json
import os
from django.conf import settings

# ... existing ViewSets ...

class SystemBackupView(APIView):
    """
    GET: Download a JSON dump of the 'api' app data.
    POST: Upload a JSON file to restore/merge data using 'loaddata'.
    """
    # Only admins should access this!
    permission_classes = [permissions.IsAdminUser] 
    parser_classes = [MultiPartParser]

    def get(self, request):
        """Generates a JSON backup of the 'api' app."""
        buffer = io.StringIO()
        
        # 'dumpdata' serializes the DB. We filter for only the 'api' app models.
        # You can add other apps if needed (e.g., 'auth').
        try:
            call_command('dumpdata', 'api', indent=2, stdout=buffer)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        buffer.seek(0)
        data = buffer.read()
        
        # Return as a downloadable file
        response = HttpResponse(data, content_type='application/json')
        filename = f"inventory_backup_{timezone.now().strftime('%Y-%m-%d_%H-%M')}.json"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

    def post(self, request):
        """Restores data from an uploaded JSON file."""
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({"detail": "No file provided."}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Save temp file (loaddata requires a file path)
        temp_path = os.path.join(settings.BASE_DIR, 'temp_restore.json')
        
        try:
            with open(temp_path, 'wb+') as destination:
                for chunk in file_obj.chunks():
                    destination.write(chunk)

            # 2. Run loaddata
            # This merges data: updates matching IDs, creates new ones.
            out = io.StringIO()
            call_command('loaddata', temp_path, stdout=out)
            
            result_msg = out.getvalue()
            return Response({"detail": "Restore successful", "log": result_msg}, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({"detail": f"Restore failed: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)
        finally:
            # 3. Cleanup
            if os.path.exists(temp_path):
                os.remove(temp_path)




# api/views.py

# ... existing imports ...
from .models import SystemSetting
from .serializers import SystemSettingSerializer

class SystemSettingView(APIView):
    """
    GET: Retrieve global settings (creates defaults if missing).
    PATCH: Update settings (Admin only).
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        # Get or create the singleton record (pk=1)
        settings_obj, created = SystemSetting.objects.get_or_create(pk=1)
        serializer = SystemSettingSerializer(settings_obj)
        return Response(serializer.data)

    def patch(self, request):
        # Only admins can change settings
        if not (request.user.is_superuser or getattr(request.user, 'role', '') == 'admin'):
            return Response({"detail": "Admin permission required."}, status=status.HTTP_403_FORBIDDEN)

        settings_obj, _ = SystemSetting.objects.get_or_create(pk=1)
        serializer = SystemSettingSerializer(settings_obj, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)