from django.db import models
from django.conf import settings
import uuid


class ExchangeRate(models.Model):
    """
    全局汇率配置（单例）。
    所有美金(USD) → 人民币(CNY) 的换算都统一走这里。
    """
    usd_to_cny = models.DecimalField(max_digits=10, decimal_places=4, default=7.2,
                                     verbose_name='美金兑人民币汇率')
    source = models.CharField(max_length=50, blank=True, default='manual',
                              verbose_name='数据来源',
                              help_text='manual/外部接口名称等')
    remark = models.CharField(max_length=200, blank=True, verbose_name='备注')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='最近更新时间')

    class Meta:
        verbose_name = '汇率配置'
        verbose_name_plural = '汇率配置'

    def __str__(self):
        return f"USD→CNY {self.usd_to_cny}"

    @classmethod
    def get_solo(cls):
        """获取全局唯一汇率配置记录，若不存在则初始化。"""
        obj = cls.objects.first()
        if obj is None:
            obj = cls.objects.create(usd_to_cny=7.2, source='default')
        return obj

    @classmethod
    def get_rate(cls):
        """返回当前 USD→CNY 汇率（Decimal）。"""
        return cls.get_solo().usd_to_cny


class SubscriptionPlan(models.Model):
    """套餐方案"""
    TIER_CHOICES = [
        ('free', '免费版'),
        ('basic', '基础版'),
        ('pro', '专业版'),
        ('enterprise', '企业版'),
    ]
    name = models.CharField(max_length=100, verbose_name='套餐名称')
    tier = models.CharField(max_length=20, choices=TIER_CHOICES, unique=True,
                            verbose_name='套餐等级')
    description = models.TextField(blank=True, verbose_name='套餐描述')
    monthly_price = models.DecimalField(max_digits=10, decimal_places=2, default=0,
                                        verbose_name='月租价格(元)')
    discount = models.DecimalField(
        max_digits=8, decimal_places=4, default=1,
        verbose_name='充值折扣系数',
        help_text='实际可用金额 = 充值金额 * (1 / 折扣系数)，1 表示无折扣'
    )
    monthly_token_limit = models.BigIntegerField(default=0, verbose_name='每月Token额度',
                                                  help_text='0 表示不限制')
    daily_request_limit = models.IntegerField(default=0, verbose_name='每日请求次数限制',
                                               help_text='0 表示不限制')
    max_context_length = models.IntegerField(default=20, verbose_name='最大上下文条数')
    allowed_models = models.ManyToManyField('chat.AIModel', blank=True,
                                            related_name='allowed_plans',
                                            verbose_name='可用模型',
                                            help_text='指定可用的单个模型；留空则按后端组/后端或全部')
    allowed_backend_groups = models.ManyToManyField('gateway.BackendGroup', blank=True,
                                                     related_name='allowed_plans',
                                                     verbose_name='可用后端组',
                                                     help_text='选择后端组后，组内后端提供的所有模型均可用')
    allowed_backends = models.ManyToManyField('gateway.APIBackend', blank=True,
                                              related_name='allowed_plans',
                                              verbose_name='可用后端',
                                              help_text='直接指定后端，该后端提供的所有模型均可用')
    allowed_business_types = models.JSONField(default=list, blank=True,
                                              verbose_name='可用业务类型',
                                              help_text='JSON 数组，如 ["chat","coding"]，空数组表示全部')
    is_active = models.BooleanField(default=True, verbose_name='是否启用')
    sort_order = models.IntegerField(default=0, verbose_name='排序')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        verbose_name = '套餐方案'
        verbose_name_plural = '套餐方案'
        ordering = ['sort_order', 'monthly_price']

    def __str__(self):
        return f"{self.name} ({self.get_tier_display()}) ¥{self.monthly_price}/月"


class BillingRecord(models.Model):
    """账单流水记录"""
    TYPE_CHOICES = [
        ('recharge', '充值'),
        ('deduction', '消费'),
        ('refund', '退款'),
        ('adjustment', '人工调整'),
        ('reward', '奖励'),
        ('subscription', '套餐订阅'),
    ]
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                             related_name='billing_records', verbose_name='用户')
    record_type = models.CharField(max_length=20, choices=TYPE_CHOICES, verbose_name='类型')
    amount = models.DecimalField(max_digits=12, decimal_places=4, verbose_name='金额(+收/-支)')
    balance_before = models.DecimalField(max_digits=12, decimal_places=4, verbose_name='变动前余额')
    balance_after = models.DecimalField(max_digits=12, decimal_places=4, verbose_name='变动后余额')
    description = models.CharField(max_length=300, blank=True, verbose_name='描述')
    operator = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                 null=True, blank=True, related_name='operated_records',
                                 verbose_name='操作人')
    related_message_id = models.IntegerField(null=True, blank=True, verbose_name='关联消息ID')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        verbose_name = '账单流水'
        verbose_name_plural = '账单流水'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
        ]

    def __str__(self):
        return f"{self.user.username} {self.get_record_type_display()} {self.amount}"


class RechargeOrder(models.Model):
    """充值订单"""
    STATUS_CHOICES = [
        ('pending', '待支付'),
        ('paid', '已支付'),
        ('failed', '失败'),
        ('refunded', '已退款'),
    ]
    PAYMENT_CHOICES = [
        ('manual', '人工充值'),
        ('alipay', '支付宝'),
        ('wechat', '微信支付'),
        ('bank', '银行转账'),
        ('other', '其他'),
    ]
    order_no = models.CharField(max_length=64, unique=True, verbose_name='订单号')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                             related_name='recharge_orders', verbose_name='用户')
    amount = models.DecimalField(max_digits=12, decimal_places=4, verbose_name='充值金额(元)')
    payment_method = models.CharField(max_length=20, choices=PAYMENT_CHOICES,
                                      default='manual', verbose_name='支付方式')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES,
                              default='pending', verbose_name='状态')
    remark = models.CharField(max_length=300, blank=True, verbose_name='备注')
    operator = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                 null=True, blank=True, related_name='operated_orders',
                                 verbose_name='操作人')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    paid_at = models.DateTimeField(null=True, blank=True, verbose_name='支付时间')

    class Meta:
        verbose_name = '充值订单'
        verbose_name_plural = '充值订单'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.order_no} - {self.user.username} - {self.amount}元"

    @classmethod
    def generate_order_no(cls):
        import time
        return f"RC{int(time.time()*1000)}{uuid.uuid4().hex[:6].upper()}"


class DailyUsage(models.Model):
    """每日用量汇总"""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                             related_name='daily_usage', verbose_name='用户')
    date = models.DateField(verbose_name='日期')
    model_id = models.CharField(max_length=200, blank=True, verbose_name='模型ID')
    message_count = models.IntegerField(default=0, verbose_name='消息数')
    token_count = models.BigIntegerField(default=0, verbose_name='Token总量')
    cost = models.DecimalField(max_digits=12, decimal_places=6, default=0, verbose_name='费用(元)')

    class Meta:
        verbose_name = '每日用量'
        verbose_name_plural = '每日用量'
        unique_together = ('user', 'date', 'model_id')
        ordering = ['-date']

    def __str__(self):
        return f"{self.user.username} {self.date} {self.model_id}"
