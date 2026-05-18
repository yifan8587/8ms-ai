from django.contrib.auth.models import AbstractUser
from django.db import models
import secrets


class User(AbstractUser):
    TIER_CHOICES = [
        ('free', '免费版'),
        ('basic', '基础版'),
        ('pro', '专业版'),
        ('enterprise', '企业版'),
    ]
    STATUS_CHOICES = [
        ('active', '正常'),
        ('suspended', '已暂停'),
        ('banned', '已封禁'),
    ]

    nickname = models.CharField(max_length=50, blank=True, verbose_name='昵称')
    avatar = models.URLField(blank=True, verbose_name='头像')
    phone = models.CharField(max_length=20, blank=True, verbose_name='手机号')
    company = models.CharField(max_length=100, blank=True, verbose_name='公司')
    tier = models.CharField(max_length=20, choices=TIER_CHOICES, default='free',
                            verbose_name='套餐')
    customer_status = models.CharField(max_length=20, choices=STATUS_CHOICES,
                                       default='active', verbose_name='账号状态')
    balance = models.DecimalField(max_digits=12, decimal_places=4, default=0,
                                  verbose_name='账户余额(元)')
    credits = models.IntegerField(default=0, verbose_name='积分')
    is_vip = models.BooleanField(default=False, verbose_name='VIP用户')
    vip_expire_at = models.DateTimeField(null=True, blank=True, verbose_name='VIP到期时间')
    notes = models.TextField(blank=True, verbose_name='运营备注')

    # 主子账号
    parent = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True,
                               related_name='sub_accounts', verbose_name='主账号')
    is_sub_account = models.BooleanField(default=False, verbose_name='是否子账号')
    allowed_models = models.ManyToManyField('chat.AIModel', blank=True,
                                            related_name='allowed_users',
                                            verbose_name='可用模型',
                                            help_text='指定可用的单个模型；留空则按后端组或套餐决定')
    allowed_backend_groups = models.ManyToManyField('gateway.BackendGroup', blank=True,
                                                     related_name='allowed_users',
                                                     verbose_name='可用后端组',
                                                     help_text='指定后端组后，该组内所有后端提供的模型均可用')
    monthly_token_limit = models.BigIntegerField(default=0,
                                                  verbose_name='月Token额度',
                                                  help_text='0 表示使用套餐默认额度')
    subscription_billing_anchor = models.DateTimeField(
        null=True, blank=True, verbose_name='套餐计费锚点时间',
        help_text='用于按时间比例结算月租'
    )

    created_at = models.DateTimeField(auto_now_add=True, verbose_name='注册时间')

    class Meta:
        verbose_name = '用户'
        verbose_name_plural = '用户'

    def __str__(self):
        return self.username

    @property
    def display_name(self):
        return self.nickname or self.username

    @property
    def is_main_account(self):
        return not self.is_sub_account

    @property
    def sub_account_count(self):
        return self.sub_accounts.count()


class APIToken(models.Model):
    PERM_CHOICES = [
        ('chat', '对话接口'),
        ('all', '全部接口'),
    ]
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='api_tokens',
                             verbose_name='所属用户')
    name = models.CharField(max_length=100, verbose_name='Token名称')
    token_key = models.CharField(max_length=64, unique=True, verbose_name='Token值')
    permissions = models.CharField(max_length=20, choices=PERM_CHOICES, default='chat',
                                   verbose_name='权限')
    is_active = models.BooleanField(default=True, verbose_name='是否启用')
    expires_at = models.DateTimeField(null=True, blank=True, verbose_name='过期时间')
    last_used_at = models.DateTimeField(null=True, blank=True, verbose_name='最后使用时间')
    usage_count = models.BigIntegerField(default=0, verbose_name='使用次数')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        verbose_name = 'API Token'
        verbose_name_plural = 'API Tokens'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} - {self.name}"

    @classmethod
    def generate_key(cls):
        return 'sk-ai-' + secrets.token_hex(28)
