"""
自定义认证：支持「OpenAI 风格」的 API Key（存于 APIToken.token_key）。

与 SimpleJWT 并存：
  - `Authorization: Bearer sk-...` 且能在数据库匹配到 APIToken → 认证为该 Token 所属用户
  - 其它 Bearer 字符串交给 JWTAuthentication 处理

注意：不要在未匹配到 sk- 前缀时抛错，必须返回 None 让后续认证类继续尝试。
"""

from django.db.models import F
from django.utils import timezone
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from .models import APIToken


class APITokenAuthentication(BaseAuthentication):
    """识别 `Authorization: Bearer sk-...` 形式的平台 API Token。"""

    def authenticate(self, request):
        header = request.META.get("HTTP_AUTHORIZATION")
        if not header:
            return None
        parts = header.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            return None
        raw_key = parts[1].strip()
        if not raw_key.startswith("sk-"):
            return None

        try:
            token = APIToken.objects.select_related("user").get(
                token_key=raw_key, is_active=True
            )
        except APIToken.DoesNotExist:
            raise AuthenticationFailed("Incorrect API key provided.")

        if token.expires_at and token.expires_at < timezone.now():
            raise AuthenticationFailed("API key has expired.")

        if token.permissions not in ("chat", "all"):
            raise AuthenticationFailed("API key does not have permission for this operation.")

        user = token.user
        if not user.is_active:
            raise AuthenticationFailed("User associated with API key is inactive.")

        APIToken.objects.filter(pk=token.pk).update(
            last_used_at=timezone.now(),
            usage_count=F("usage_count") + 1,
        )
        return (user, token)
