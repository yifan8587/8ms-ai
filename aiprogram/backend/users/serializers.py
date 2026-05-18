from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import APIToken

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    password2 = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'password2', 'nickname')

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({'password': '两次密码不一致'})
        return attrs

    def create(self, validated_data):
        validated_data.pop('password2')
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class UserProfileSerializer(serializers.ModelSerializer):
    tier_display = serializers.CharField(source='get_tier_display', read_only=True)
    customer_status_display = serializers.CharField(source='get_customer_status_display', read_only=True)
    parent_username = serializers.CharField(source='parent.username', read_only=True, default=None)
    sub_account_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'nickname', 'avatar', 'phone', 'company',
                  'tier', 'tier_display', 'customer_status', 'customer_status_display',
                  'balance', 'is_vip', 'vip_expire_at', 'credits', 'created_at',
                  'is_staff', 'is_superuser', 'is_sub_account', 'parent', 'parent_username',
                  'sub_account_count', 'monthly_token_limit')
        read_only_fields = ('id', 'username', 'tier', 'customer_status', 'balance',
                            'is_vip', 'vip_expire_at', 'credits', 'created_at',
                            'is_staff', 'is_superuser', 'is_sub_account', 'parent',
                            'sub_account_count')


class AdminUserSerializer(serializers.ModelSerializer):
    tier_display = serializers.CharField(source='get_tier_display', read_only=True)
    plan_name = serializers.SerializerMethodField()
    customer_status_display = serializers.CharField(source='get_customer_status_display', read_only=True)
    conversation_count = serializers.SerializerMethodField()
    message_count = serializers.SerializerMethodField()
    total_tokens = serializers.SerializerMethodField()
    total_cost = serializers.SerializerMethodField()
    request_count = serializers.SerializerMethodField()
    parent_username = serializers.CharField(source='parent.username', read_only=True, default=None)
    sub_account_count = serializers.IntegerField(read_only=True)
    sub_accounts_info = serializers.SerializerMethodField()
    allowed_model_ids = serializers.SerializerMethodField()
    allowed_backend_group_ids = serializers.SerializerMethodField()
    last_active_at = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'nickname', 'avatar', 'phone', 'company',
                  'tier', 'tier_display', 'plan_name', 'customer_status', 'customer_status_display',
                  'balance', 'is_vip', 'vip_expire_at', 'credits', 'notes',
                  'is_staff', 'is_active', 'date_joined', 'created_at',
                  'is_sub_account', 'parent', 'parent_username',
                  'sub_account_count', 'sub_accounts_info',
                  'monthly_token_limit', 'allowed_model_ids', 'allowed_backend_group_ids',
                  'conversation_count', 'message_count',
                  'total_tokens', 'total_cost', 'request_count', 'last_active_at')
        read_only_fields = ('id', 'username', 'date_joined', 'created_at',
                            'conversation_count', 'message_count',
                            'total_tokens', 'total_cost', 'request_count',
                            'last_active_at',
                            'sub_account_count', 'sub_accounts_info',
                            'allowed_model_ids', 'allowed_backend_group_ids')

    def _get_user_stats(self, obj):
        """缓存每个用户的网关统计聚合结果，避免重复查询"""
        cache = self.context.get('_user_stats_cache')
        if cache is None:
            cache = {}
            if 'request' in self.context:
                self.context['_user_stats_cache'] = cache

        if obj.pk not in cache:
            from gateway.models import RequestLog
            from django.db.models import Sum, Count, Max
            stats = RequestLog.objects.filter(user=obj).aggregate(
                total_tokens=Sum('total_tokens'),
                total_cost=Sum('cost_cny'),
                request_count=Count('id'),
                last_request_at=Max('created_at'),
            )
            cache[obj.pk] = stats
        return cache[obj.pk]

    def _get_tier_plan_map(self):
        cache = self.context.get('_tier_plan_name_cache')
        if cache is not None:
            return cache
        from billing.models import SubscriptionPlan
        cache = {}
        for p in SubscriptionPlan.objects.filter(is_active=True).order_by('sort_order', 'id').only('tier', 'name'):
            if p.tier not in cache and p.name:
                cache[p.tier] = p.name
        self.context['_tier_plan_name_cache'] = cache
        return cache

    def _get_plan_name(self, tier, fallback_display=''):
        tier_map = self._get_tier_plan_map()
        if tier in tier_map:
            return tier_map[tier]
        if tier == 'free':
            return '系统免费版'
        return fallback_display or tier

    def get_plan_name(self, obj):
        return self._get_plan_name(obj.tier, obj.get_tier_display())

    def get_conversation_count(self, obj):
        return obj.conversations.count()

    def get_message_count(self, obj):
        from chat.models import Message
        return Message.objects.filter(conversation__user=obj).count()

    def get_total_tokens(self, obj):
        return self._get_user_stats(obj)['total_tokens'] or 0

    def get_total_cost(self, obj):
        cost = self._get_user_stats(obj)['total_cost']
        return float(cost) if cost else 0.0

    def get_request_count(self, obj):
        return self._get_user_stats(obj)['request_count'] or 0

    def get_last_active_at(self, obj):
        ts = self._get_user_stats(obj)['last_request_at']
        return ts.isoformat() if ts else None

    def get_sub_accounts_info(self, obj):
        if obj.is_sub_account:
            return []
        subs = obj.sub_accounts.all()[:20]
        return [{
            'id': s.id, 'username': s.username, 'nickname': s.nickname,
            'tier': s.tier, 'customer_status': s.customer_status,
            'plan_name': self._get_plan_name(s.tier, s.get_tier_display()),
            'balance': float(s.balance), 'is_active': s.is_active,
        } for s in subs]

    def get_allowed_model_ids(self, obj):
        return list(obj.allowed_models.values_list('id', flat=True))

    def get_allowed_backend_group_ids(self, obj):
        return list(obj.allowed_backend_groups.values_list('id', flat=True))


class AdminUserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('email', 'nickname', 'phone', 'company', 'tier', 'customer_status',
                  'is_vip', 'vip_expire_at', 'credits', 'notes', 'is_staff', 'is_active',
                  'parent', 'is_sub_account', 'monthly_token_limit')


class SubAccountCreateSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(min_length=6)
    nickname = serializers.CharField(max_length=50, required=False, default='')
    email = serializers.EmailField(required=False, default='')
    monthly_token_limit = serializers.IntegerField(required=False, default=0)
    allowed_model_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, default=list
    )


class APITokenSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    token_key_masked = serializers.SerializerMethodField()

    class Meta:
        model = APIToken
        fields = ('id', 'name', 'token_key_masked', 'permissions', 'is_active',
                  'expires_at', 'last_used_at', 'usage_count', 'created_at', 'username')
        read_only_fields = ('id', 'created_at', 'last_used_at', 'usage_count', 'username')

    def get_token_key_masked(self, obj):
        k = obj.token_key
        if len(k) > 10:
            return k[:10] + '****' + k[-4:]
        return '****'


class APITokenCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = APIToken
        fields = ('id', 'name', 'token_key', 'permissions', 'expires_at', 'created_at')
        read_only_fields = ('id', 'token_key', 'created_at')
