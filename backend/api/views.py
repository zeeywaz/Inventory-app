# api/views.py
from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action, api_view, permission_classes
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.utils.dateparse import parse_date, parse_datetime
from django.db.models import Sum, Count
from django.utils import timezone

from . import models
from .serializers import ProductSerializer, AttendanceSerializer, EmployeeSerializer
from rest_framework import filters

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
        if not (user and user.is_authenticated and (user.is_superuser or user.is_staff or getattr(user, 'role', None) in ('admin','staff'))):
            return Response({"detail": "Authentication required (admin or staff)."}, status=status.HTTP_401_UNAUTHORIZED)

        product = get_object_or_404(models.Product, pk=pk)
        try:
            change = int(request.data.get('change'))
        except Exception:
            return Response({"detail": "Please provide integer 'change' (positive or negative)."}, status=status.HTTP_400_BAD_REQUEST)

        reason = request.data.get('reason', '')[:255]
        notes = request.data.get('notes', '')

        new_qty = (product.quantity_in_stock or 0) + change
        if new_qty < 0:
            return Response({"detail": "Resulting stock cannot be negative."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            if hasattr(product, 'updated_at'):
                product.save(update_fields=['quantity_in_stock', 'updated_at'])
            else:
                product.save(update_fields=['quantity_in_stock'])
            movement = models.InventoryMovement.objects.create(
                product=product,
                change_qty=change,
                reason=reason or ('Manual adjust' if change != 0 else 'No-op'),
                performed_by=user,
                notes=notes
            )

        return Response({
            "detail": "Stock adjusted",
            "product_id": product.id,
            "new_quantity": new_qty,
            "movement_id": movement.id
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