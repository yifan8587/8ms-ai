from django.contrib import admin
from .models import BillingRecord, RechargeOrder, DailyUsage, SubscriptionPlan


@admin.register(BillingRecord)
class BillingRecordAdmin(admin.ModelAdmin):
    list_display = ('user', 'record_type', 'amount', 'balance_before', 'balance_after', 'description', 'operator', 'created_at')
    list_filter = ('record_type', 'created_at')
    search_fields = ('user__username', 'description')
    readonly_fields = ('balance_before', 'balance_after', 'created_at')


@admin.register(RechargeOrder)
class RechargeOrderAdmin(admin.ModelAdmin):
    list_display = ('order_no', 'user', 'amount', 'payment_method', 'status', 'operator', 'created_at', 'paid_at')
    list_filter = ('status', 'payment_method', 'created_at')
    search_fields = ('order_no', 'user__username')


@admin.register(DailyUsage)
class DailyUsageAdmin(admin.ModelAdmin):
    list_display = ('user', 'date', 'model_id', 'message_count', 'token_count', 'cost')
    list_filter = ('date',)
    search_fields = ('user__username', 'model_id')


@admin.register(SubscriptionPlan)
class SubscriptionPlanAdmin(admin.ModelAdmin):
    list_display = ('name', 'tier', 'monthly_price', 'monthly_token_limit',
                    'daily_request_limit', 'is_active', 'sort_order')
    list_filter = ('tier', 'is_active')
    list_editable = ('is_active', 'sort_order')
    filter_horizontal = ('allowed_models', 'allowed_backend_groups', 'allowed_backends')
