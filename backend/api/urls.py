# api/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from .views import (
    ProductViewSet, AttendanceViewSet, EmployeeViewSet, CustomerViewSet,
    SupplierViewSet, health_check, SupplierPaymentViewSet, InquiryViewSet,
    ExpenseViewSet, PurchaseOrderViewSet, POLineViewSet, current_user, SalesViewSet, SystemBackupView, SystemSettingView, CustomerPaymentViewSet
)

router = DefaultRouter()
router.register(r'products', ProductViewSet, basename='product')
router.register(r'attendance', AttendanceViewSet, basename='attendance')
router.register(r'employees', EmployeeViewSet, basename='employee')
router.register(r'customers', CustomerViewSet, basename='customer')
router.register(r'suppliers', SupplierViewSet, basename='supplier')
router.register(r'supplier-payments', SupplierPaymentViewSet, basename='supplierpayment')
router.register(r'inquiries', InquiryViewSet, basename='inquiry')
router.register(r'expenses', ExpenseViewSet, basename='expense')
router.register(r'purchase-orders', PurchaseOrderViewSet, basename='purchaseorder')
router.register(r'po-lines', POLineViewSet, basename='poline')
router.register(r'sales', SalesViewSet, basename='sale')
router.register(r'customer-payments', CustomerPaymentViewSet, basename='customer-payment')
# ...

urlpatterns = [
    # 1. The standard API routers
    path('', include(router.urls)),

    # 2. Authentication Endpoints (Connecting React to Django)
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/me/', current_user, name='current_user'),
    path('system/backup/', SystemBackupView.as_view(), name='system-backup'),
    path('system/settings/', SystemSettingView.as_view(), name='system-settings'),
    # 3. Utilities
    path('health/', health_check, name='health-check'),
]