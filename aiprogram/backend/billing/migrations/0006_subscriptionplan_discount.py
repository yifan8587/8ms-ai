from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('billing', '0005_alter_exchangerate_id'),
    ]

    operations = [
        migrations.AddField(
            model_name='subscriptionplan',
            name='discount',
            field=models.DecimalField(decimal_places=4, default=1, help_text='实际可用金额 = 充值金额 * (1 / 折扣系数)，1 表示无折扣', max_digits=8, verbose_name='充值折扣系数'),
        ),
    ]
