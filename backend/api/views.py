# api/views.py
from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action, api_view, permission_classes
from django.shortcuts import get_object_or_404

from . import models
from .serializers import ProductSerializer, CustomerSerializer, SaleSerializer

#
# Basic ViewSets to test CR(U)D via DRF browsable API or curl/postman
#

class ProductViewSet(viewsets.ModelViewSet):
    """
    Basic Product CRUD. Uses ModelViewSet so you can list/create/retrieve/update/delete.
    Serializer `to_representation` can hide cost_price from staff if you implemented that.
    """
    queryset = models.Product.objects.all().order_by('-updated_at', '-created_at')
    serializer_class = ProductSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_serializer_context(self):
        # pass request to serializer so to_representation has access to user role
        context = super().get_serializer_context()
        context['request'] = self.request
        return context


class CustomerViewSet(viewsets.ModelViewSet):
    """
    Customer CRUD. Note: name and phone are required by your model.
    """
    queryset = models.Customer.objects.all().order_by('-created_at')
    serializer_class = CustomerSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]


class SaleViewSet(viewsets.ModelViewSet):
    """
    Sale CRUD. This assumes SaleSerializer handles nested lines creation.
    Keep permissions simple for now.
    """
    queryset = models.Sale.objects.all().order_by('-date')
    serializer_class = SaleSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        return ctx

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def mark_paid(self, request, pk=None):
        """
        Example custom action: mark a sale as paid (very simple demo).
        """
        sale = get_object_or_404(models.Sale, pk=pk)
        # Very minimal: set payment_method from body or 'cash' and return updated object.
        method = request.data.get('payment_method', 'cash')
        sale.payment_method = method
        sale.save(update_fields=['payment_method'])
        serializer = self.get_serializer(sale)
        return Response(serializer.data, status=status.HTTP_200_OK)


#
# Lightweight health-check endpoint (function based)
#
@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def health_check(request):
    return Response({"status": "ok", "service": "inventory-api", "version": "0.1"}, status=status.HTTP_200_OK)
