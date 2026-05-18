from rest_framework import serializers
from .models import APIBackend, BackendGroup, RoutingRule, RequestLog


class APIBackendSerializer(serializers.ModelSerializer):
    api_key_masked = serializers.SerializerMethodField()
    groups_info = serializers.SerializerMethodField()

    class Meta:
        model = APIBackend
        fields = (
            'id', 'name', 'description', 'base_url', 'api_key_masked',
            'weight', 'max_rpm', 'max_concurrent', 'timeout_seconds',
            'health_status', 'consecutive_failures',
            'last_health_check', 'last_failure_at',
            'total_requests', 'total_tokens', 'total_cost',
            'pricing_multiplier', 'stats_request_multiplier',
            'extra_headers', 'is_active', 'groups_info',
            'created_at', 'updated_at',
        )

    def get_api_key_masked(self, obj):
        key = obj.api_key or ''
        if len(key) <= 8:
            return '****'
        return key[:4] + '****' + key[-4:]

    def get_groups_info(self, obj):
        return [{'id': g.id, 'name': g.name} for g in obj.groups.all()]


class APIBackendCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = APIBackend
        fields = (
            'name', 'description', 'base_url', 'api_key',
            'weight', 'max_rpm', 'max_concurrent', 'timeout_seconds',
            'pricing_multiplier', 'stats_request_multiplier',
            'extra_headers', 'is_active',
        )


class BackendGroupSerializer(serializers.ModelSerializer):
    backends_info = serializers.SerializerMethodField()
    backends = serializers.PrimaryKeyRelatedField(
        many=True, queryset=APIBackend.objects.all(), required=False
    )

    class Meta:
        model = BackendGroup
        fields = (
            'id', 'name', 'description', 'backends', 'backends_info',
            'strategy', 'is_active', 'created_at', 'updated_at',
        )

    def get_backends_info(self, obj):
        return [
            {'id': b.id, 'name': b.name, 'base_url': b.base_url,
             'health_status': b.health_status, 'is_active': b.is_active}
            for b in obj.backends.all()
        ]


class RoutingRuleSerializer(serializers.ModelSerializer):
    backends_info = serializers.SerializerMethodField()
    backend_group_info = serializers.SerializerMethodField()
    match_type_display = serializers.CharField(source='get_match_type_display', read_only=True)
    strategy_display = serializers.CharField(source='get_strategy_display', read_only=True)
    match_users_info = serializers.SerializerMethodField()

    class Meta:
        model = RoutingRule
        fields = (
            'id', 'name', 'description', 'priority',
            'match_type', 'match_type_display', 'match_value',
            'match_users', 'match_users_info',
            'backends', 'backends_info',
            'backend_group', 'backend_group_info',
            'strategy', 'strategy_display',
            'is_active', 'created_at', 'updated_at',
        )

    def get_backends_info(self, obj):
        return [
            {'id': b.id, 'name': b.name, 'health_status': b.health_status}
            for b in obj.backends.all()
        ]

    def get_backend_group_info(self, obj):
        if obj.backend_group:
            return {'id': obj.backend_group.id, 'name': obj.backend_group.name}
        return None

    def get_match_users_info(self, obj):
        return [
            {'id': u.id, 'username': u.username}
            for u in obj.match_users.all()
        ]


class RoutingRuleCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = RoutingRule
        fields = (
            'name', 'description', 'priority',
            'match_type', 'match_value',
            'match_users',
            'backends', 'backend_group', 'strategy', 'is_active',
        )


class RequestLogSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True, default='')
    backend_name = serializers.CharField(source='backend.name', read_only=True, default='')
    rule_name = serializers.CharField(source='routing_rule.name', read_only=True, default='')
    business_type_display = serializers.CharField(source='get_business_type_display', read_only=True)

    class Meta:
        model = RequestLog
        fields = (
            'id', 'username', 'backend_name', 'rule_name',
            'model_id', 'business_type', 'business_type_display', 'is_stream',
            'prompt_tokens', 'completion_tokens', 'total_tokens',
            'upstream_cost', 'cost_cny',
            'response_time_ms', 'status_code', 'is_success',
            'error_message', 'stats_weight', 'created_at',
        )
