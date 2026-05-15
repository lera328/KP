from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied

from apps.users.models import Role

from .models import Payment, PaymentIntent, Subscription
from .serializers import (
    PaymentIntentSerializer,
    PaymentSerializer,
    SubscriptionDetailSerializer,
    SubscriptionListSerializer,
    SubscriptionSerializer,
)
from .services import AUTO_PROCESS_DELAY_SECONDS, get_payment_plans, save_payment_plans, process_pending_payment_intents


class SubscriptionViewSet(viewsets.ModelViewSet):
    """API for managing subscriptions"""
    permission_classes = [IsAuthenticated]
    serializer_class = SubscriptionSerializer

    def get_queryset(self):
        """Students see only their subscriptions; admins see all"""
        process_pending_payment_intents()
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
        process_pending_payment_intents()
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
        process_pending_payment_intents()
        user = request.user
        payments = Payment.objects.filter(subscription__student=user).order_by('-paid_at')
        
        serializer = self.get_serializer(payments, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def balance(self, request):
        """Get remaining lesson balance or period info for authenticated user"""
        process_pending_payment_intents()
        user = request.user
        subscription = Subscription.objects.filter(student=user, is_active=True).first()

        if not subscription:
            return Response(
                {"remaining_lessons": 0, "valid_from": None, "valid_until": None, "message": "No active subscription."},
                status=status.HTTP_200_OK
            )

        return Response({
            "remaining_lessons": subscription.remaining_lessons,
            "subscription_id": subscription.id,
            "total_lessons": subscription.total_lessons,
            "valid_from": subscription.valid_from,
            "valid_until": subscription.valid_until,
        })

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated], url_path='plans')
    def plans(self, request):
        plans = get_payment_plans()
        payload = [
            {
                "code": code,
                "label": data["label"],
                "amount": str(data["amount"]),
                "lessons": data["lessons"],
                "duration_months": data.get("duration_months", 0),
            }
            for code, data in plans.items()
        ]
        return Response(payload)

    @action(detail=False, methods=['put'], permission_classes=[IsAuthenticated], url_path='plans/update')
    def update_plans(self, request):
        user = request.user
        if not (user.roles.filter(code=Role.Code.ADMIN).exists() or user.is_superuser):
            raise PermissionDenied("Только администратор может изменять тарифы")

        plans_data = request.data
        if not isinstance(plans_data, list):
            return Response({"error": "Ожидается список тарифов"}, status=status.HTTP_400_BAD_REQUEST)

        new_plans = {}
        for item in plans_data:
            code = item.get("code")
            amount = item.get("amount")
            label = item.get("label", code)
            duration_months = item.get("duration_months", 1)
            lessons = item.get("lessons", 0)
            if not code or amount is None:
                return Response(
                    {"error": "Каждый тариф должен содержать code и amount"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            try:
                new_plans[code] = {
                    "amount": str(amount),
                    "lessons": int(lessons),
                    "duration_months": int(duration_months),
                    "label": str(label),
                }
            except (ValueError, TypeError) as e:
                return Response({"error": f"Ошибка в тарифе {code}: {e}"}, status=status.HTTP_400_BAD_REQUEST)

        save_payment_plans(new_plans)
        return Response({"detail": "Тарифы обновлены"})

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated], url_path='parent/initiate')
    def parent_initiate(self, request):
        user = request.user
        if not user.roles.filter(code=Role.Code.PARENT).exists():
            raise PermissionDenied("Только родитель может инициировать оплату")
        return Response(
            {"error": "Онлайн-оплата отключена. Обратитесь к администратору."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated], url_path='parent/intents')
    def parent_intents(self, request):
        user = request.user
        if not user.roles.filter(code=Role.Code.PARENT).exists():
            raise PermissionDenied("Только родитель может просматривать платежи")

        process_pending_payment_intents()

        parent_profile = getattr(user, 'parent_profile', None)
        if not parent_profile:
            return Response([])

        student_ids = list(parent_profile.students.values_list('user_id', flat=True))
        intents = PaymentIntent.objects.filter(student_id__in=student_ids).order_by('-created_at')
        serializer = PaymentIntentSerializer(intents, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated], url_path='admin/intents')
    def admin_intents(self, request):
        user = request.user
        if not (user.roles.filter(code=Role.Code.ADMIN).exists() or user.is_superuser):
            raise PermissionDenied("Только администратор может просматривать все платежи")

        process_pending_payment_intents()

        intents = PaymentIntent.objects.all().order_by('-created_at')
        serializer = PaymentIntentSerializer(intents, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated], url_path='admin/create')
    def admin_create(self, request):
        user = request.user
        if not (user.roles.filter(code=Role.Code.ADMIN).exists() or user.is_superuser):
            raise PermissionDenied("Только администратор может создавать платежи")

        student_id = request.data.get('student_id')
        plan = request.data.get('plan')

        if not student_id or not plan:
            return Response(
                {"error": "Нужно передать student_id и plan"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            from .services import create_admin_payment
            intent = create_admin_payment(int(student_id), plan)
            serializer = PaymentIntentSerializer(intent)
            return Response(
                {
                    "detail": "Платеж успешно создан и обработан",
                    "intent": serializer.data,
                },
                status=status.HTTP_201_CREATED,
            )
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response(
                {"error": f"Ошибка при создании платежа: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
