# api/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import ProductViewSet, AttendanceViewSet, EmployeeViewSet, health_check

router = DefaultRouter()
router.register(r'products', ProductViewSet, basename='product')
router.register(r'attendance', AttendanceViewSet, basename='attendance')
router.register(r'employees', EmployeeViewSet, basename='employee')

urlpatterns = [
    path('health/', health_check, name='api-health'),
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/', include('rest_framework.urls', namespace='rest_framework')),
    path('', include(router.urls)),
]
