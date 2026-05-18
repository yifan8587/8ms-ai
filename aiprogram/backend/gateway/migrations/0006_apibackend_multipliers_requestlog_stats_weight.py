from decimal import Decimal
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('gateway', '0005_routingrule_match_users_alter_routingrule_match_type'),
    ]

    operations = [
        migrations.AddField(
            model_name='apibackend',
            name='pricing_multiplier',
            field=models.DecimalField(
                decimal_places=6, default=Decimal('1'), max_digits=12,
                verbose_name='模型定价倍率',
                help_text='同步模型时：上游单价 × 此系数写入本地定价（1 表示不调整）',
            ),
        ),
        migrations.AddField(
            model_name='apibackend',
            name='stats_request_multiplier',
            field=models.DecimalField(
                decimal_places=6, default=Decimal('1'), max_digits=12,
                verbose_name='请求统计系数',
                help_text='写入请求日志时的权重，用于网关统计中「等效请求数」汇总（1 表示 1 条日志计 1 次）',
            ),
        ),
        migrations.AddField(
            model_name='requestlog',
            name='stats_weight',
            field=models.DecimalField(
                decimal_places=6, default=Decimal('1'), max_digits=12,
                verbose_name='统计权重',
                help_text='来自同步时刻后端的「请求统计系数」，用于聚合等效请求数',
            ),
        ),
    ]
