from django.contrib import admin
from .models import APIBackend, BackendGroup, RoutingRule, RequestLog


@admin.register(APIBackend)
class APIBackendAdmin(admin.ModelAdmin):
    list_display = ('name', 'base_url', 'weight', 'health_status', 'total_requests', 'is_active')
    list_filter = ('is_active', 'health_status')
    search_fields = ('name', 'base_url')
    readonly_fields = ('total_requests', 'total_tokens', 'total_cost', 'rr_counter',
                       'consecutive_failures', 'last_health_check', 'last_failure_at',
                       'created_at', 'updated_at')


@admin.register(BackendGroup)
class BackendGroupAdmin(admin.ModelAdmin):
    list_display = ('name', 'strategy', 'is_active')
    filter_horizontal = ('backends',)


@admin.register(RoutingRule)
class RoutingRuleAdmin(admin.ModelAdmin):
    list_display = ('name', 'priority', 'match_type', 'match_value', 'strategy', 'is_active')
    list_filter = ('is_active', 'match_type', 'strategy')
    filter_horizontal = ('backends',)
    readonly_fields = ('created_at', 'updated_at')


@admin.register(RequestLog)
class RequestLogAdmin(admin.ModelAdmin):
    list_display = ('created_at', 'user', 'backend', 'model_id', 'total_tokens', 'cost_cny', 'is_success')
    list_filter = ('is_success', 'is_stream', 'backend', 'business_type')
    search_fields = ('user__username', 'model_id')
    date_hierarchy = 'created_at'

    def has_add_permission(self, request):
        return False
