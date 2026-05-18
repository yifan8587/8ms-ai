from rest_framework import serializers
from .models import BillingRecord, RechargeOrder, DailyUsage, SubscriptionPlan, ExchangeRate
from django.contrib.auth import get_user_model
from decimal import Decimal

User = get_user_model()


class SubscriptionPlanSerializer(serializers.ModelSerializer):
    tier_display = serializers.CharField(source='get_tier_display', read_only=True)
    allowed_models_count = serializers.SerializerMethodField()
    allowed_backend_groups_info = serializers.SerializerMethodField()
    allowed_backends_info = serializers.SerializerMethodField()

    class Meta:
        model = SubscriptionPlan
        fields = (
            'id', 'name', 'tier', 'tier_display', 'description',
            'monthly_price', 'discount', 'monthly_token_limit', 'daily_request_limit',
            'max_context_length',
            'allowed_models', 'allowed_backend_groups', 'allowed_backends',
            'allowed_backend_groups_info', 'allowed_backends_info',
            'allowed_business_types',
            'allowed_models_count', 'is_active', 'sort_order',
            'created_at', 'updated_at',
        )

    def get_allowed_models_count(self, obj):
        count = obj.allowed_models.count()
        return count if count > 0 else -1

    def get_allowed_backend_groups_info(self, obj):
        return [{'id': g.id, 'name': g.name} for g in obj.allowed_backend_groups.all()]

    def get_allowed_backends_info(self, obj):
        return [{'id': b.id, 'name': b.name} for b in obj.allowed_backends.all()]


class SubscriptionPlanCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubscriptionPlan
        fields = (
            'name', 'tier', 'description', 'monthly_price', 'discount',
            'monthly_token_limit', 'daily_request_limit',
            'max_context_length',
            'allowed_models', 'allowed_backend_groups', 'allowed_backends',
            'allowed_business_types', 'is_active', 'sort_order',
        )


class BillingRecordSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    record_type_display = serializers.CharField(source='get_record_type_display', read_only=True)
    operator_name = serializers.CharField(source='operator.username', read_only=True, default=None)

    class Meta:
        model = BillingRecord
        fields = ('id', 'username', 'record_type', 'record_type_display', 'amount',
                  'balance_before', 'balance_after', 'description', 'operator_name',
                  'related_message_id', 'created_at')


class RechargeOrderSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    payment_method_display = serializers.CharField(source='get_payment_method_display', read_only=True)
    operator_name = serializers.CharField(source='operator.username', read_only=True, default=None)

    class Meta:
        model = RechargeOrder
        fields = ('id', 'order_no', 'username', 'amount', 'payment_method',
                  'payment_method_display', 'status', 'status_display', 'remark',
                  'operator_name', 'created_at', 'paid_at')


class DailyUsageSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = DailyUsage
        fields = ('id', 'username', 'date', 'model_id', 'message_count', 'token_count', 'cost')


class AdminRechargeSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=4, min_value=Decimal('0.0001'))
    payment_method = serializers.ChoiceField(choices=RechargeOrder.PAYMENT_CHOICES, default='manual')
    remark = serializers.CharField(max_length=300, allow_blank=True, default='')


class ExchangeRateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExchangeRate
        fields = ('id', 'usd_to_cny', 'source', 'remark', 'updated_at')
        read_only_fields = ('id', 'updated_at')
