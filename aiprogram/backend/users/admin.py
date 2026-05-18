from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, APIToken


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'email', 'nickname', 'tier', 'customer_status',
                    'balance', 'is_vip', 'credits', 'date_joined')
    list_filter = ('tier', 'customer_status', 'is_vip', 'is_sub_account')
    search_fields = ('username', 'email', 'nickname', 'phone', 'company')
    fieldsets = UserAdmin.fieldsets + (
        ('套餐与计费', {'fields': ('tier', 'customer_status', 'balance', 'monthly_token_limit')}),
        ('扩展信息', {'fields': ('nickname', 'avatar', 'phone', 'company',
                             'is_vip', 'vip_expire_at', 'credits', 'notes')}),
        ('主子账号', {'fields': ('parent', 'is_sub_account')}),
        ('模型权限', {'fields': ('allowed_models', 'allowed_backend_groups')}),
    )
    filter_horizontal = ('allowed_models', 'allowed_backend_groups')


@admin.register(APIToken)
class APITokenAdmin(admin.ModelAdmin):
    list_display = ('user', 'name', 'permissions', 'is_active', 'usage_count',
                    'last_used_at', 'created_at')
    list_filter = ('permissions', 'is_active')
    search_fields = ('user__username', 'name')
    readonly_fields = ('token_key', 'usage_count', 'last_used_at', 'created_at')
