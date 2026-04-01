from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from .models import Subscription, Payment
from .serializers import (
    SubscriptionSerializer,
    SubscriptionDetailSerializer,
    SubscriptionListSerializer,
    PaymentSerializer
)
from ..users.permissions import IsAdminRole


class SubscriptionViewSet(viewsets.ModelViewSet):
    """API for managing subscriptions"""
    permission_classes = [IsAuthenticated]
    serializer_class = SubscriptionSerializer

    def get_queryset(self):
        """Students see only their subscriptions; admins see all"""
        user = self.request.user
        if user.roles.filter(code="admin").exists() or user.is_superuser:
            return Subscription.objects.all()
        return Subscription.objects.filter(student=user)

    def get_serializer_class(self):
        """Use different serializers for different actions"""
        if self.action == 'list':
            return SubscriptionListSerializer
        if self.action == 'retrieve':
            return SubscriptionDetailSerializer
        return SubscriptionSerializer

    def create(self, request, *args, **kwargs):
        """Admin creates subscription for a student"""
        if not (request.user.roles.filter(code="admin").exists() or request.user.is_superuser):
            return Response(
                {"error": "Only admins can create subscriptions."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def active(self, request):
        """Get current active subscription for authenticated user"""
        user = request.user
        subscription = Subscription.objects.filter(student=user, is_active=True).first()
        
        if not subscription:
            return Response(
                {"error": "No active subscription found."},
                status=status.HTTP_404_NOT_FOUND
            )
        
        serializer = SubscriptionDetailSerializer(subscription)
        return Response(serializer.data)

    @action(detail=True, methods=['patch'], permission_classes=[IsAuthenticated])
    def deactivate(self, request, pk=None):
        """Deactivate a subscription (admin only)"""
        subscription = self.get_object()
        
        if not (request.user.roles.filter(code="admin").exists() or request.user.is_superuser):
            return Response(
                {"error": "Only admins can deactivate subscriptions."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        subscription.is_active = False
        subscription.save()
        
        serializer = SubscriptionDetailSerializer(subscription)
        return Response(serializer.data)


class PaymentViewSet(viewsets.ModelViewSet):
    """API for managing payments"""
    permission_classes = [IsAuthenticated]
    serializer_class = PaymentSerializer

    def get_queryset(self):
        """Students see only their payments; admins see all"""
        user = self.request.user
        if user.roles.filter(code="admin").exists() or user.is_superuser:
            return Payment.objects.all()
        return Payment.objects.filter(subscription__student=user)

    def create(self, request, *args, **kwargs):
        """Create payment (admin adds funds to subscription)"""
        if not (request.user.roles.filter(code="admin").exists() or request.user.is_superuser):
            return Response(
                {"error": "Only admins can create payments."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            
            # Update remaining_lessons
            subscription = serializer.validated_data['subscription']
            subscription.remaining_lessons += serializer.validated_data['amount']
            subscription.save()
            
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def my_payments(self, request):
        """Get payment history for authenticated user"""
        user = request.user
        payments = Payment.objects.filter(subscription__student=user).order_by('-paid_at')
        
        serializer = self.get_serializer(payments, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def balance(self, request):
        """Get remaining lesson balance for authenticated user"""
        user = request.user
        subscription = Subscription.objects.filter(student=user, is_active=True).first()
        
        if not subscription:
            return Response(
                {"remaining_lessons": 0, "message": "No active subscription."},
                status=status.HTTP_200_OK
            )
        
        return Response({
            "remaining_lessons": subscription.remaining_lessons,
            "subscription_id": subscription.id,
            "total_lessons": subscription.total_lessons,
        })
