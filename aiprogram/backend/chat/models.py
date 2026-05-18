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


class AIModel(models.Model):
    model_id = models.CharField(max_length=200, unique=True, verbose_name='模型ID')
    name = models.CharField(max_length=200, verbose_name='模型名称')
    description = models.TextField(blank=True, verbose_name='描述')
    context_length = models.IntegerField(default=4096, verbose_name='上下文长度')
    is_free = models.BooleanField(default=False, verbose_name='是否免费')
    is_active = models.BooleanField(default=True, verbose_name='是否启用')
    is_visible = models.BooleanField(default=True, verbose_name='是否可见',
                                     help_text='隐藏后前端用户不可选择，但已有对话可继续使用')
    pricing_prompt = models.DecimalField(max_digits=10, decimal_places=8, default=0,
                                         verbose_name='输入价格/token')
    pricing_completion = models.DecimalField(max_digits=10, decimal_places=8, default=0,
                                             verbose_name='输出价格/token')

    business_type = models.CharField(max_length=20, choices=BUSINESS_TYPE_CHOICES,
                                     default='general', verbose_name='业务类型')
    source_backend = models.ForeignKey('gateway.APIBackend', on_delete=models.SET_NULL,
                                       null=True, blank=True,
                                       related_name='synced_models',
                                       verbose_name='主来源后端',
                                       help_text='兼容字段，同步时若还未设置则自动填写首个来源后端')
    source_backends = models.ManyToManyField('gateway.APIBackend', blank=True,
                                             related_name='synced_from_models',
                                             verbose_name='所有来源后端',
                                             help_text='同一模型可来自多个不同 API 后端（或不同 key）；展示时自动去重')
    source_group = models.ForeignKey('gateway.BackendGroup', on_delete=models.SET_NULL,
                                     null=True, blank=True,
                                     related_name='synced_models',
                                     verbose_name='来源后端组')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'AI模型'
        verbose_name_plural = 'AI模型'
        ordering = ['business_type', '-is_free', 'name']
        indexes = [
            models.Index(fields=['business_type', 'is_active']),
            models.Index(fields=['source_backend']),
        ]

    def __str__(self):
        return self.name


class Conversation(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                             related_name='conversations')
    title = models.CharField(max_length=200, default='新对话', verbose_name='对话标题')
    model = models.ForeignKey(AIModel, on_delete=models.SET_NULL, null=True,
                              verbose_name='使用模型')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = '对话'
        verbose_name_plural = '对话'
        ordering = ['-updated_at']

    def __str__(self):
        return f"{self.user.username} - {self.title}"


class Message(models.Model):
    ROLE_CHOICES = [
        ('user', '用户'),
        ('assistant', 'AI助手'),
        ('system', '系统'),
    ]
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE,
                                     related_name='messages')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, verbose_name='角色')
    content = models.TextField(verbose_name='内容')
    tokens_used = models.IntegerField(default=0, verbose_name='消耗tokens')
    cost = models.DecimalField(max_digits=12, decimal_places=6, default=0, verbose_name='费用(元)')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = '消息'
        verbose_name_plural = '消息'
        ordering = ['created_at']

    def __str__(self):
        return f"{self.role}: {self.content[:50]}"
