from rest_framework import serializers
from .models import Subscription, Payment


class SubscriptionSerializer(serializers.ModelSerializer):
    """Serializer for creating and updating subscriptions"""
    
    class Meta:
        model = Subscription
        fields = ['id', 'student', 'total_lessons', 'remaining_lessons', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_total_lessons(self, value):
        if value <= 0:
            raise serializers.ValidationError("Total lessons must be greater than 0.")
        return value

    def create(self, validated_data):
        """Create subscription with validation"""
        instance = Subscription(**validated_data)
        instance.full_clean()  # Validate unique constraint
        instance.save()
        return instance


class SubscriptionDetailSerializer(serializers.ModelSerializer):
    """Read-only serializer with payment history"""
    payments = serializers.SerializerMethodField()
    
    class Meta:
        model = Subscription
        fields = ['id', 'total_lessons', 'remaining_lessons', 'is_active', 'created_at', 'updated_at', 'payments']
        read_only_fields = fields

    def get_payments(self, obj):
        """Include all payments for this subscription"""
        payments = obj.payments.all().order_by('-paid_at')
        return PaymentSerializer(payments, many=True).data


class PaymentSerializer(serializers.ModelSerializer):
    """Serializer for payments"""
    
    class Meta:
        model = Payment
        fields = ['id', 'subscription', 'amount', 'paid_at']
        read_only_fields = ['id', 'paid_at']


class SubscriptionListSerializer(serializers.ModelSerializer):
    """Serializer for subscription list view"""
    
    class Meta:
        model = Subscription
        fields = ['id', 'total_lessons', 'remaining_lessons', 'is_active', 'created_at']
        read_only_fields = fields
