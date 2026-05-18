from django.db import migrations, models


def create_default_rate(apps, schema_editor):
    ExchangeRate = apps.get_model('billing', 'ExchangeRate')
    if not ExchangeRate.objects.exists():
        ExchangeRate.objects.create(usd_to_cny='7.2000', source='default', remark='系统默认')


def remove_default_rate(apps, schema_editor):
    ExchangeRate = apps.get_model('billing', 'ExchangeRate')
    ExchangeRate.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('billing', '0003_subscriptionplan_allowed_backend_groups_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='ExchangeRate',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('usd_to_cny', models.DecimalField(decimal_places=4, default=7.2, max_digits=10, verbose_name='美金兑人民币汇率')),
                ('source', models.CharField(blank=True, default='manual', help_text='manual/外部接口名称等', max_length=50, verbose_name='数据来源')),
                ('remark', models.CharField(blank=True, max_length=200, verbose_name='备注')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='最近更新时间')),
            ],
            options={
                'verbose_name': '汇率配置',
                'verbose_name_plural': '汇率配置',
            },
        ),
        migrations.RunPython(create_default_rate, remove_default_rate),
    ]
