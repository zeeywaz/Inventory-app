# api/models.py
"""
Improved models.py for Inventory Manager app.
- Adds validators (MinValueValidator) to numeric fields
- Adds __str__ methods for clearer admin/debug display
- Adds db_index where fields are likely searched
- Uses PositiveIntegerField for quantity counts where appropriate
- Adds ordering and indexes for common query patterns
"""

from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import MinValueValidator
from django.utils import timezone


# -- Custom user (simple extension so you can have roles) --
class User(AbstractUser):
    ROLE_CHOICES = (
        ('admin', 'Admin'),
        ('staff', 'Staff'),
    )
    role = models.CharField(max_length=16, choices=ROLE_CHOICES, default='staff')

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"

    class Meta:
        db_table = 'users'
        ordering = ['username']


# -- Employees (separate from User; link optional) --
class Employee(models.Model):
    id = models.BigAutoField(primary_key=True)
    user = models.OneToOneField('api.User', null=True, blank=True, on_delete=models.SET_NULL)
    employee_code = models.CharField(max_length=64, blank=True, null=True, unique=True, db_index=True)
    name = models.CharField(max_length=255)
    department = models.CharField(max_length=128, blank=True, null=True)
    phone = models.CharField(max_length=50, blank=True, null=True)
    nic = models.CharField(max_length=50, blank=True, null=True)
    hire_date = models.DateField(blank=True, null=True)
    daily_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, validators=[MinValueValidator(0)])
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.employee_code or 'no-code'})"

    class Meta:
        db_table = 'employees'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['employee_code']),
            models.Index(fields=['name']),
        ]


# -- Customers --
class Customer(models.Model):
    id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=255)     # NON-NULL per requirement
    phone = models.CharField(max_length=50)     # NON-NULL per requirement (contact)
    email = models.EmailField(blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    credited_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0.00, validators=[MinValueValidator(0)])
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.phone})"

    class Meta:
        db_table = 'customers'
        ordering = ['name']
        indexes = [
            models.Index(fields=['phone']),
            models.Index(fields=['name']),
        ]


# -- Suppliers --
class Supplier(models.Model):
    id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=255)
    contact_name = models.CharField(max_length=255, blank=True, null=True)
    phone = models.CharField(max_length=50, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    payment_terms = models.CharField(max_length=255, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

    class Meta:
        db_table = 'suppliers'
        ordering = ['name']
        indexes = [
            models.Index(fields=['name']),
        ]


# -- Products --
class Product(models.Model):
    id = models.BigAutoField(primary_key=True)
    sku = models.CharField(max_length=128, unique=True, blank=True, null=True, db_index=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    cost_price = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, validators=[MinValueValidator(0)])
    selling_price = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, validators=[MinValueValidator(0)])
    minimum_selling_price = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, validators=[MinValueValidator(0)])
    quantity_in_stock = models.PositiveIntegerField(default=0)  # no negatives
    is_active = models.BooleanField(default=True)
    vehicle = models.CharField(max_length=255, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


    def __str__(self):
        return f"{self.name} ({self.sku or 'no-sku'})"

    class Meta:
        db_table = 'products'
        ordering = ['name']
        indexes = [
            models.Index(fields=['sku']),
            models.Index(fields=['name']),
        ]


# -- Inventory movements (stock adjustments) --
class InventoryMovement(models.Model):
    id = models.BigAutoField(primary_key=True)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='movements')
    change_qty = models.IntegerField()  # can be negative (deduct) or positive (add)
    reason = models.CharField(max_length=255, blank=True, null=True)
    reference = models.CharField(max_length=255, blank=True, null=True)
    performed_by = models.ForeignKey('api.User', null=True, blank=True, on_delete=models.SET_NULL)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.product.name}: {self.change_qty:+d} on {self.created_at.date()}"

    class Meta:
        db_table = 'inventory_movements'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['product']),
        ]


# -- Purchase orders and lines --
class PurchaseOrder(models.Model):
    STATUS_CHOICES = (
        ('draft', 'Draft'),
        ('placed', 'Placed'),
        ('partially_received', 'Partially Received'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    )
    id = models.BigAutoField(primary_key=True)
    po_no = models.CharField(max_length=64, blank=True, null=True, unique=True, db_index=True)
    supplier = models.ForeignKey(Supplier, null=True, blank=True, on_delete=models.SET_NULL)
    created_by = models.ForeignKey('api.User', null=True, blank=True, on_delete=models.SET_NULL)
    date = models.DateTimeField(auto_now_add=True)
    expected_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default='draft', db_index=True)
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0.00, validators=[MinValueValidator(0)])
    amount_paid = models.DecimalField(max_digits=14, decimal_places=2, default=0.00, validators=[MinValueValidator(0)])  # tracks credited amounts to be paid
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"PO {self.po_no or self.id} - {self.supplier.name if self.supplier else 'No Supplier'}"

    class Meta:
        db_table = 'purchase_orders'
        ordering = ['-date']
        indexes = [
            models.Index(fields=['po_no']),
            models.Index(fields=['supplier']),
        ]


class POLine(models.Model):
    id = models.BigAutoField(primary_key=True)
    purchase_order = models.ForeignKey(PurchaseOrder, related_name='lines', on_delete=models.CASCADE)
    product = models.ForeignKey(Product, null=True, blank=True, on_delete=models.SET_NULL)
    description = models.TextField(blank=True, null=True)
    qty_ordered = models.PositiveIntegerField()
    qty_received = models.PositiveIntegerField(default=0)
    unit_cost = models.DecimalField(max_digits=14, decimal_places=2, default=0.00, validators=[MinValueValidator(0)])
    line_total = models.DecimalField(max_digits=14, decimal_places=2, default=0.00, validators=[MinValueValidator(0)])
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"POLine {self.id} ({self.product.name if self.product else 'no-prod'})"

    class Meta:
        db_table = 'po_lines'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['purchase_order']),
            models.Index(fields=['product']),
        ]


# -- Supplier payments (payments towards POs) --
class SupplierPayment(models.Model):
    id = models.BigAutoField(primary_key=True)
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE)
    purchase_order = models.ForeignKey(PurchaseOrder, null=True, blank=True, on_delete=models.SET_NULL)
    amount = models.DecimalField(max_digits=14, decimal_places=2, validators=[MinValueValidator(0)])
    payment_date = models.DateTimeField(auto_now_add=True)
    payment_method = models.CharField(max_length=255, blank=True, null=True)
    reference = models.CharField(max_length=255, blank=True, null=True)
    created_by = models.ForeignKey('api.User', null=True, blank=True, on_delete=models.SET_NULL)
    notes = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"{self.supplier.name} paid {self.amount}"

    class Meta:
        db_table = 'supplier_payments'
        ordering = ['-payment_date']
        indexes = [
            models.Index(fields=['supplier']),
        ]


# -- Sales and sale lines --
class Sale(models.Model):
    id = models.BigAutoField(primary_key=True)
    sale_no = models.CharField(max_length=64, blank=True, null=True, unique=True, db_index=True)
    date = models.DateTimeField(auto_now_add=True)
    customer = models.ForeignKey(Customer, null=True, blank=True, on_delete=models.SET_NULL)
    employee = models.ForeignKey(Employee, null=True, blank=True, on_delete=models.SET_NULL)
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0.00, validators=[MinValueValidator(0)])
    tax = models.DecimalField(max_digits=14, decimal_places=2, default=0.00, validators=[MinValueValidator(0)])
    discount = models.DecimalField(max_digits=14, decimal_places=2, default=0.00, validators=[MinValueValidator(0)])
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0.00, validators=[MinValueValidator(0)])
    payment_method = models.CharField(max_length=255, blank=True, null=True)
    is_credit = models.BooleanField(default=False)
    created_by = models.ForeignKey('api.User', null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Sale {self.sale_no or self.id} - {self.total_amount}"

    class Meta:
        db_table = 'sales'
        ordering = ['-date']
        indexes = [
            models.Index(fields=['sale_no']),
            models.Index(fields=['date']),
        ]


class SaleLine(models.Model):
    id = models.BigAutoField(primary_key=True)
    sale = models.ForeignKey(Sale, related_name='lines', on_delete=models.CASCADE)
    product = models.ForeignKey(Product, null=True, blank=True, on_delete=models.SET_NULL)
    product_name = models.CharField(max_length=255)
    sku = models.CharField(max_length=128, blank=True, null=True)
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])
    original_unit_price = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])
    line_total = models.DecimalField(max_digits=14, decimal_places=2, validators=[MinValueValidator(0)])
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.product_name} x{self.quantity}"

    class Meta:
        db_table = 'sale_lines'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['sale']),
            models.Index(fields=['product']),
        ]


# -- Price overrides (for audit) --
class PriceOverride(models.Model):
    id = models.BigAutoField(primary_key=True)
    sale = models.ForeignKey(Sale, null=True, blank=True, on_delete=models.SET_NULL)
    sale_line = models.ForeignKey(SaleLine, null=True, blank=True, on_delete=models.SET_NULL)
    overridden_by = models.ForeignKey('api.User', null=True, blank=True, on_delete=models.SET_NULL)
    original_unit_price = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])
    final_unit_price = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])
    reason = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Override on sale {self.sale_id or 'N/A'}"

    class Meta:
        db_table = 'price_overrides'
        ordering = ['-created_at']


# -- Inquiries + optional advance payment & expected price --
class Inquiry(models.Model):
    STATUS_CHOICES = (
        ('new', 'New'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    )
    id = models.BigAutoField(primary_key=True)
    inquiry_no = models.CharField(max_length=64, blank=True, null=True, unique=True, db_index=True)
    customer = models.ForeignKey(Customer, null=True, blank=True, on_delete=models.SET_NULL)
    contact_name = models.CharField(max_length=255, blank=True, null=True)
    contact_phone = models.CharField(max_length=50, blank=True, null=True)
    product_description = models.TextField(blank=True, null=True)
    expected_price = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(0)])
    advance_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0.00, validators=[MinValueValidator(0)])
    advance_received = models.BooleanField(default=False)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default='new', db_index=True)
    assigned_to = models.ForeignKey('api.User', null=True, blank=True, on_delete=models.SET_NULL)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Inquiry {self.inquiry_no or self.id} - {self.status}"

    class Meta:
        db_table = 'inquiries'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['inquiry_no']),
            models.Index(fields=['status']),
        ]


class InquiryPayment(models.Model):
    id = models.BigAutoField(primary_key=True)
    inquiry = models.ForeignKey(Inquiry, related_name='payments', on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=14, decimal_places=2, validators=[MinValueValidator(0)])
    payment_date = models.DateTimeField(auto_now_add=True)
    payment_method = models.CharField(max_length=255, blank=True, null=True)
    reference = models.CharField(max_length=255, blank=True, null=True)
    created_by = models.ForeignKey('api.User', null=True, blank=True, on_delete=models.SET_NULL)

    def __str__(self):
        return f"{self.amount} on {self.payment_date.date()}"

    class Meta:
        db_table = 'inquiry_payments'
        ordering = ['-payment_date']


# -- Expenses --
class Expense(models.Model):
    id = models.BigAutoField(primary_key=True)
    date = models.DateTimeField(auto_now_add=True)
    category = models.CharField(max_length=255, blank=True, null=True)
    amount = models.DecimalField(max_digits=14, decimal_places=2, validators=[MinValueValidator(0)])
    paid_by = models.CharField(max_length=255, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    receipt_url = models.CharField(max_length=1024, blank=True, null=True)
    created_by = models.ForeignKey('api.User', null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.category or 'Expense'} - {self.amount}"

    class Meta:
        db_table = 'expenses'
        ordering = ['-date']


# -- Attendance with daily salary tracking (daily_salary can be overridden per record) --
class Attendance(models.Model):
    STATUS_CHOICES = (
        ('Present', 'Present'),
        ('Absent', 'Absent'),
        ('Leave', 'Leave'),
        ('Half Day', 'Half Day'),
    )
    id = models.BigAutoField(primary_key=True)
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE)
    date = models.DateField()
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default='Absent', db_index=True)
    checked_in_at = models.DateTimeField(null=True, blank=True)
    checked_out_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, null=True)
    daily_salary_applied = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(0)])  # override
    recorded_by = models.ForeignKey('api.User', null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    def applied_salary(self):
        return self.daily_salary_applied if self.daily_salary_applied is not None else (self.employee.daily_salary if self.employee else 0)

    def __str__(self):
        return f"{self.employee.name} - {self.date} - {self.status}"

    class Meta:
        db_table = 'attendance'
        unique_together = ('employee', 'date')
        ordering = ['-date']
        indexes = [
            models.Index(fields=['employee', 'date']),
        ]


# -- Audit logs --
class AuditLog(models.Model):
    id = models.BigAutoField(primary_key=True)
    actor = models.ForeignKey('api.User', null=True, blank=True, on_delete=models.SET_NULL)
    action = models.TextField()
    entity_type = models.CharField(max_length=128, blank=True, null=True)
    entity_id = models.BigIntegerField(null=True, blank=True)
    changes = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.action} by {self.actor.username if self.actor else 'system'}"

    class Meta:
        db_table = 'audit_logs'
        ordering = ['-created_at']
