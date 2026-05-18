from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0004_user_allowed_backend_groups_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='subscription_billing_anchor',
            field=models.DateTimeField(blank=True, help_text='用于按时间比例结算月租', null=True, verbose_name='套餐计费锚点时间'),
        ),
    ]
