from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='ApiForwardRule',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100, unique=True, verbose_name='规则名称')),
                ('description', models.CharField(blank=True, max_length=300, verbose_name='规则说明')),
                ('request_path', models.CharField(max_length=200, verbose_name='请求路径')),
                (
                    'request_method',
                    models.CharField(
                        choices=[
                            ('ANY', '任意'),
                            ('GET', 'GET'),
                            ('POST', 'POST'),
                            ('PUT', 'PUT'),
                            ('PATCH', 'PATCH'),
                            ('DELETE', 'DELETE'),
                        ],
                        default='POST',
                        max_length=10,
                        verbose_name='请求方法',
                    ),
                ),
                ('target_base_url', models.URLField(verbose_name='目标后端地址')),
                ('target_path', models.CharField(max_length=200, verbose_name='目标后端路径')),
                ('timeout_seconds', models.PositiveIntegerField(default=30, verbose_name='超时时间(秒)')),
                ('priority', models.IntegerField(default=100, verbose_name='优先级(值越小越优先)')),
                ('header_overrides', models.JSONField(blank=True, default=dict, verbose_name='转发附加请求头')),
                ('is_active', models.BooleanField(default=True, verbose_name='是否启用')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='创建时间')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='更新时间')),
            ],
            options={
                'verbose_name': 'API转发规则',
                'verbose_name_plural': 'API转发规则',
                'ordering': ['priority', '-id'],
            },
        ),
        migrations.AddIndex(
            model_name='apiforwardrule',
            index=models.Index(fields=['is_active', 'priority'], name='gateway_apif_is_acti_3024c4_idx'),
        ),
        migrations.AddIndex(
            model_name='apiforwardrule',
            index=models.Index(fields=['request_path', 'request_method'], name='gateway_apif_request_0180e6_idx'),
        ),
    ]
