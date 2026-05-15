from rest_framework import serializers
from .models import Payment, PaymentIntent, Subscription


class SubscriptionSerializer(serializers.ModelSerializer):
    """Serializer for creating and updating subscriptions"""
    
    class Meta:
        model = Subscription
        fields = ['id', 'student', 'total_lessons', 'remaining_lessons', 'valid_from', 'valid_until', 'is_active', 'created_at', 'updated_at']
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
        fields = ['id', 'total_lessons', 'remaining_lessons', 'valid_from', 'valid_until', 'is_active', 'created_at', 'updated_at', 'payments']
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


class PaymentIntentSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    student_id = serializers.IntegerField(source='student.id', read_only=True)
    parent_name = serializers.SerializerMethodField()

    class Meta:
        model = PaymentIntent
        fields = [
            'id',
            'student',
            'student_id',
            'student_name',
            'parent',
            'parent_name',
            'plan',
            'amount',
            'lessons',
            'status',
            'processed_at',
            'error_message',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields

    def get_student_name(self, obj):
        full_name = obj.student.get_full_name().strip()
        return full_name or obj.student.username

    def get_parent_name(self, obj):
        if not obj.parent:
            return None
        full_name = obj.parent.get_full_name().strip()
        return full_name or obj.parent.username


class SubscriptionListSerializer(serializers.ModelSerializer):
    """Serializer for subscription list view"""
    student = serializers.IntegerField(source='student_id', read_only=True)
    student_name = serializers.SerializerMethodField()

    def get_student_name(self, obj):
        full_name = obj.student.get_full_name().strip()
        return full_name or obj.student.username
    
    class Meta:
        model = Subscription
        fields = ['id', 'student', 'student_name', 'total_lessons', 'remaining_lessons', 'valid_from', 'valid_until', 'is_active', 'created_at']
        read_only_fields = fields
