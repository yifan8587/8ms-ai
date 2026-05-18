from decimal import Decimal
import calendar
from django.utils import timezone

from .models import BillingRecord, SubscriptionPlan


def _get_user_plan(user):
    return SubscriptionPlan.objects.filter(tier=user.tier, is_active=True).first()


def get_user_discount_multiplier(user):
    """
    返回充值可用金额倍率 = 1 / discount
    """
    plan = _get_user_plan(user)
    if not plan:
        return Decimal('1')
    d = Decimal(str(plan.discount or 1))
    if d <= 0:
        return Decimal('1')
    return Decimal('1') / d


def _add_months(dt, months):
    """按自然月增加 months，保留时分秒，超出当月天数时取月末。"""
    year = dt.year + (dt.month - 1 + months) // 12
    month = (dt.month - 1 + months) % 12 + 1
    day = min(dt.day, calendar.monthrange(year, month)[1])
    return dt.replace(year=year, month=month, day=day)


def settle_subscription_fee(user, operator=None, now=None):
    """
    按“订阅锚点”按月整额结算套餐费用。
    - 锚点为空：初始化锚点，不扣费
    - 免费版或月租<=0：仅更新锚点
    - 非免费版：每满一个月扣一次月租（可跨多月补扣）
    """
    now = now or timezone.now()
    plan = _get_user_plan(user)
    anchor = user.subscription_billing_anchor
    if anchor is None:
        user.subscription_billing_anchor = now
        user.save(update_fields=['subscription_billing_anchor'])
        return Decimal('0')

    if now <= anchor:
        return Decimal('0')

    if not plan or plan.tier == 'free' or Decimal(str(plan.monthly_price or 0)) <= 0:
        user.subscription_billing_anchor = now
        user.save(update_fields=['subscription_billing_anchor'])
        return Decimal('0')

    # 计算需要结算的完整月数
    months_due = 0
    next_anchor = anchor
    while True:
        candidate = _add_months(next_anchor, 1)
        if candidate <= now:
            months_due += 1
            next_anchor = candidate
        else:
            break

    if months_due <= 0:
        return Decimal('0')

    charge = (Decimal(str(plan.monthly_price)) * Decimal(str(months_due))).quantize(Decimal('0.0001'))
    if charge <= 0:
        user.subscription_billing_anchor = now
        user.save(update_fields=['subscription_billing_anchor'])
        return Decimal('0')

    before = user.balance
    user.balance = max(Decimal('0'), user.balance - charge)
    user.subscription_billing_anchor = next_anchor
    user.save(update_fields=['balance', 'subscription_billing_anchor'])

    BillingRecord.objects.create(
        user=user,
        record_type='subscription',
        amount=-charge,
        balance_before=before,
        balance_after=user.balance,
        description=f'套餐月租按月结算 {months_due} 期（{plan.name}）',
        operator=operator,
    )
    return charge
