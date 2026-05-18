"""
Gateway 信号处理。

主要职责：
  1. 当一个 APIBackend 被删除时，同步处理 chat.AIModel：
     - 若该模型仅来源于此后端 → 整条记录一并删除；
     - 若该模型还来源于其他后端 → 仅解除 M2M 关联，
       并把 source_backend 主指针调整为另一个仍存在的来源。
"""
import logging

from django.db import transaction
from django.db.models.signals import pre_delete
from django.dispatch import receiver

from .models import APIBackend

logger = logging.getLogger(__name__)


@receiver(pre_delete, sender=APIBackend)
def cascade_clean_models_on_backend_delete(sender, instance, **kwargs):
    """删除 API 后端前，把对应来源的 AIModel 一并清理。

    设计要点：
      - 用 pre_delete：在 APIBackend 真正被删除之前完成模型清理，
        避免 source_backend (FK SET_NULL) 把字段先置空、再无法判定来源；
      - 全部放在事务内，确保中途出错时回滚；
      - "仅来源于此后端" 的判定基于 source_backends (M2M)：
        如果集合长度为 1 且唯一元素是该后端，则视为唯一来源。
        若 M2M 为空但 source_backend (单 FK) 指向此后端，也视为唯一来源。
    """
    from chat.models import AIModel

    backend_id = instance.pk
    with transaction.atomic():
        # 命中"曾经把该后端登记进来源"的全部模型
        related_models = list(
            AIModel.objects.filter(source_backends=instance).only('id', 'name', 'model_id')
        ) + list(
            AIModel.objects.filter(source_backend=instance)
            .exclude(source_backends=instance)
            .only('id', 'name', 'model_id')
        )

        deleted_ids = []
        detached_ids = []
        for m in {x.id: x for x in related_models}.values():
            other_backends = list(
                m.source_backends.exclude(pk=backend_id).values_list('pk', flat=True)
            )
            if not other_backends:
                # 唯一来源 → 整条删除
                deleted_ids.append(m.id)
                m.delete()
            else:
                # 多来源 → 仅解除关联
                m.source_backends.remove(instance)
                if m.source_backend_id == backend_id:
                    m.source_backend_id = other_backends[0]
                    m.save(update_fields=['source_backend'])
                detached_ids.append(m.id)

        if deleted_ids or detached_ids:
            logger.info(
                "APIBackend(id=%s, name=%s) pre_delete: removed %d models, "
                "detached %d models",
                backend_id, instance.name, len(deleted_ids), len(detached_ids),
            )
