from django.db import models
from django.conf import settings

BUSINESS_TYPE_CHOICES = [
    ('chat', '聊天对话'),
    ('coding', '编程开发'),
    ('text2img', '文生图'),
    ('text2video', '文生视频'),
    ('translation', '翻译'),
    ('writing', '写作'),
    ('analysis', '数据分析'),
    ('general', '通用'),
]

STRATEGY_CHOICES = [
    ('round_robin', '轮询'),
    ('weighted', '加权轮询'),
    ('random', '随机'),
    ('least_used', '最少使用'),
]


class APIBackend(models.Model):
    """单个 AI API 后端配置"""
    STATUS_CHOICES = [
        ('healthy', '健康'),
        ('degraded', '降级'),
        ('down', '不可用'),
    ]

    name = models.CharField(max_length=100, unique=True, verbose_name='后端名称')
    description = models.CharField(max_length=300, blank=True, verbose_name='描述')
    base_url = models.URLField(verbose_name='API 基础地址',
                               help_text='例如 https://openrouter.ai/api/v1')
    api_key = models.CharField(max_length=256, verbose_name='API Key')
    weight = models.PositiveIntegerField(default=1, verbose_name='权重',
                                         help_text='加权轮询时使用，值越大分配越多')
    max_rpm = models.PositiveIntegerField(default=0, verbose_name='每分钟最大请求数',
                                          help_text='0 表示不限制')
    max_concurrent = models.PositiveIntegerField(default=0, verbose_name='最大并发数',
                                                  help_text='0 表示不限制')
    timeout_seconds = models.PositiveIntegerField(default=60, verbose_name='超时时间(秒)')

    health_status = models.CharField(max_length=20, choices=STATUS_CHOICES,
                                     default='healthy', verbose_name='健康状态')
    consecutive_failures = models.PositiveIntegerField(default=0, verbose_name='连续失败次数')
    last_health_check = models.DateTimeField(null=True, blank=True, verbose_name='最近健康检查')
    last_failure_at = models.DateTimeField(null=True, blank=True, verbose_name='最近失败时间')

    total_requests = models.BigIntegerField(default=0, verbose_name='总请求数')
    total_tokens = models.BigIntegerField(default=0, verbose_name='总 Token 消耗')
    total_cost = models.DecimalField(max_digits=14, decimal_places=6, default=0,
                                     verbose_name='总费用(原始货币)')
    rr_counter = models.BigIntegerField(default=0, verbose_name='轮询计数器')

    extra_headers = models.JSONField(default=dict, blank=True, verbose_name='附加请求头')

    pricing_multiplier = models.DecimalField(
        max_digits=12, decimal_places=6, default=1,
        verbose_name='模型定价倍率',
        help_text='同步模型时：上游返回的单价 × 此系数写入 AIModel 定价字段',
    )
    stats_request_multiplier = models.DecimalField(
        max_digits=12, decimal_places=6, default=1,
        verbose_name='请求统计系数',
        help_text='每条请求日志记录的统计权重，用于网关看板等效请求数（非整数可表示抽样/加权）',
    )

    is_active = models.BooleanField(default=True, verbose_name='是否启用')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        verbose_name = 'API 后端'
        verbose_name_plural = 'API 后端'
        ordering = ['-is_active', 'name']
        indexes = [
            models.Index(fields=['is_active', 'health_status']),
        ]

    def __str__(self):
        return self.name


class BackendGroup(models.Model):
    """API 后端组 —— 将多个后端组合成一组，统一调度"""
    name = models.CharField(max_length=100, unique=True, verbose_name='组名称')
    description = models.CharField(max_length=300, blank=True, verbose_name='描述')
    backends = models.ManyToManyField(APIBackend, related_name='groups',
                                      blank=True, verbose_name='成员后端')
    strategy = models.CharField(max_length=20, choices=STRATEGY_CHOICES,
                                default='round_robin', verbose_name='组内负载策略')
    is_active = models.BooleanField(default=True, verbose_name='是否启用')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        verbose_name = 'API 后端组'
        verbose_name_plural = 'API 后端组'
        ordering = ['name']

    def __str__(self):
        return self.name


class RoutingRule(models.Model):
    """路由规则：决定哪些请求发往哪些后端/后端组"""
    MATCH_CHOICES = [
        ('all', '全部匹配'),
        ('model_prefix', '模型前缀匹配'),
        ('model_exact', '模型精确匹配'),
        ('user_tier', '用户等级匹配'),
        ('user_exact', '指定用户匹配'),
        ('business_type', '业务类型匹配'),
    ]

    name = models.CharField(max_length=100, unique=True, verbose_name='规则名称')
    description = models.CharField(max_length=300, blank=True, verbose_name='描述')
    priority = models.IntegerField(default=100, verbose_name='优先级',
                                   help_text='值越小优先级越高')
    match_type = models.CharField(max_length=20, choices=MATCH_CHOICES,
                                  default='all', verbose_name='匹配类型')
    match_value = models.CharField(max_length=200, blank=True, verbose_name='匹配值',
                                   help_text='模型前缀/模型ID/用户等级/业务类型')
    match_users = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True,
                                          related_name='routing_rules',
                                          verbose_name='指定用户',
                                          help_text='match_type 为 user_exact 时生效')

    # 目标：单个后端 或 后端组（二选一或都选）
    backends = models.ManyToManyField(APIBackend, related_name='routing_rules',
                                      blank=True, verbose_name='直接关联后端')
    backend_group = models.ForeignKey(BackendGroup, on_delete=models.SET_NULL,
                                      null=True, blank=True,
                                      related_name='routing_rules',
                                      verbose_name='关联后端组')
    strategy = models.CharField(max_length=20, choices=STRATEGY_CHOICES,
                                default='round_robin', verbose_name='负载策略')
    is_active = models.BooleanField(default=True, verbose_name='是否启用')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        verbose_name = '路由规则'
        verbose_name_plural = '路由规则'
        ordering = ['priority', '-id']
        indexes = [
            models.Index(fields=['is_active', 'priority']),
            models.Index(fields=['match_type', 'match_value']),
        ]

    def __str__(self):
        return f"{self.name} [{self.get_match_type_display()}]"

    def get_effective_backends(self):
        """获取规则生效的所有后端（直接关联 + 后端组内的）"""
        backend_ids = set(self.backends.values_list('id', flat=True))
        if self.backend_group:
            backend_ids.update(self.backend_group.backends.values_list('id', flat=True))
        return APIBackend.objects.filter(id__in=backend_ids)


class RequestLog(models.Model):
    """API 请求日志"""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                             null=True, related_name='api_request_logs', verbose_name='用户')
    backend = models.ForeignKey(APIBackend, on_delete=models.SET_NULL,
                                null=True, related_name='request_logs', verbose_name='使用后端')
    routing_rule = models.ForeignKey(RoutingRule, on_delete=models.SET_NULL,
                                     null=True, blank=True, verbose_name='匹配规则')
    model_id = models.CharField(max_length=200, verbose_name='模型ID')
    business_type = models.CharField(max_length=20, choices=BUSINESS_TYPE_CHOICES,
                                     default='chat', verbose_name='业务类型')
    is_stream = models.BooleanField(default=False, verbose_name='是否流式')

    prompt_tokens = models.IntegerField(default=0, verbose_name='输入 Tokens')
    completion_tokens = models.IntegerField(default=0, verbose_name='输出 Tokens')
    total_tokens = models.IntegerField(default=0, verbose_name='总 Tokens')
    upstream_cost = models.DecimalField(max_digits=14, decimal_places=8, default=0,
                                        verbose_name='上游成本(原始)')
    cost_cny = models.DecimalField(max_digits=12, decimal_places=6, default=0,
                                   verbose_name='成本(人民币)')

    response_time_ms = models.IntegerField(default=0, verbose_name='响应时间(ms)')
    status_code = models.IntegerField(default=200, verbose_name='HTTP 状态码')
    is_success = models.BooleanField(default=True, verbose_name='是否成功')
    error_message = models.TextField(blank=True, verbose_name='错误信息')

    stats_weight = models.DecimalField(
        max_digits=12, decimal_places=6, default=1,
        verbose_name='统计权重',
        help_text='记录时刻的后端请求统计系数，聚合时累加此字段作为等效请求数',
    )

    created_at = models.DateTimeField(auto_now_add=True, verbose_name='请求时间')

    class Meta:
        verbose_name = 'API 请求日志'
        verbose_name_plural = 'API 请求日志'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['backend', '-created_at']),
            models.Index(fields=['-created_at']),
            models.Index(fields=['model_id', '-created_at']),
        ]

    def __str__(self):
        username = self.user.username if self.user else 'anonymous'
        return f"{username} → {self.backend} ({self.model_id})"
