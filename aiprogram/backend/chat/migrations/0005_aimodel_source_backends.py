import django.db.models.deletion
from django.db import migrations, models


def forwards_copy_source_backend(apps, schema_editor):
    """把原来的 source_backend 加入新 M2M source_backends，保证展示不丢失。"""
    AIModel = apps.get_model('chat', 'AIModel')
    for m in AIModel.objects.exclude(source_backend__isnull=True):
        m.source_backends.add(m.source_backend)


def backwards_noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('chat', '0004_alter_aimodel_options_aimodel_business_type_and_more'),
        ('gateway', '0005_routingrule_match_users_alter_routingrule_match_type'),
    ]

    operations = [
        migrations.AlterField(
            model_name='aimodel',
            name='source_backend',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='synced_models',
                to='gateway.apibackend',
                verbose_name='主来源后端',
                help_text='兼容字段，同步时若还未设置则自动填写首个来源后端',
            ),
        ),
        migrations.AddField(
            model_name='aimodel',
            name='source_backends',
            field=models.ManyToManyField(
                blank=True,
                related_name='synced_from_models',
                to='gateway.apibackend',
                verbose_name='所有来源后端',
                help_text='同一模型可来自多个不同 API 后端（或不同 key）；展示时自动去重',
            ),
        ),
        migrations.RunPython(forwards_copy_source_backend, backwards_noop),
    ]
