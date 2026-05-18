"""
Production settings for aiproject.
Loaded via DJANGO_SETTINGS_MODULE=aiproject.settings_production
"""

import os
from pathlib import Path

from .settings import *  # noqa: F401,F403

BASE_DIR = Path(__file__).resolve().parent.parent

DEBUG = False

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", SECRET_KEY)  # type: ignore[name-defined]

ALLOWED_HOSTS = [
    host.strip()
    for host in os.environ.get("DJANGO_ALLOWED_HOSTS", "127.0.0.1,localhost").split(",")
    if host.strip()
]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.mysql",
        "NAME": os.environ.get("DB_NAME", "aiproject"),
        "USER": os.environ.get("DB_USER", "root"),
        "PASSWORD": os.environ.get("DB_PASSWORD", ""),
        "HOST": os.environ.get("DB_HOST", "127.0.0.1"),
        "PORT": os.environ.get("DB_PORT", "3306"),
        "OPTIONS": {
            "charset": "utf8mb4",
            "init_command": "SET sql_mode='STRICT_TRANS_TABLES'",
        },
    }
}

OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
OPENROUTER_BASE_URL = os.environ.get("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
USE_X_FORWARDED_HOST = True

SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_BROWSER_XSS_FILTER = True
X_FRAME_OPTIONS = "SAMEORIGIN"

CSRF_COOKIE_SECURE = os.environ.get("CSRF_COOKIE_SECURE", "0") == "1"
SESSION_COOKIE_SECURE = os.environ.get("SESSION_COOKIE_SECURE", "0") == "1"

_explicit_csrf = [
    origin.strip()
    for origin in os.environ.get("CSRF_TRUSTED_ORIGINS", "").split(",")
    if origin.strip()
]
_server_port = os.environ.get("SERVER_PORT", "")
_auto_csrf = []
for _host in ALLOWED_HOSTS:
    if _host in ("*", ""):
        continue
    _auto_csrf.append(f"http://{_host}")
    _auto_csrf.append(f"https://{_host}")
    if _server_port and _server_port not in ("80", "443"):
        _auto_csrf.append(f"http://{_host}:{_server_port}")
        _auto_csrf.append(f"https://{_host}:{_server_port}")
CSRF_TRUSTED_ORIGINS = list(dict.fromkeys(_explicit_csrf + _auto_csrf))

_explicit_cors = [
    origin.strip()
    for origin in os.environ.get("CORS_ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]
_auto_cors = []
for _host in ALLOWED_HOSTS:
    if _host in ("*", ""):
        continue
    _auto_cors.append(f"http://{_host}")
    _auto_cors.append(f"https://{_host}")
    if _server_port and _server_port not in ("80", "443"):
        _auto_cors.append(f"http://{_host}:{_server_port}")
        _auto_cors.append(f"https://{_host}:{_server_port}")
CORS_ALLOWED_ORIGINS = list(dict.fromkeys(_explicit_cors + _auto_cors))

# ── OpenAI 兼容 API 跨域策略 ──────────────────────────────────────
# /api/v1/* 是 OpenAI 兼容端点（仅靠 Bearer Token 鉴权，不依赖 Cookie），
# 必须允许任意来源访问，否则第三方 Web 工具（OpenWebUI、Dify Web 等）会被
# 浏览器 CORS 拦截。桌面客户端（Cherry Studio / ChatBox 等）不发 Origin，不受影响。
#
# 仅对 /api/* 启用 corsheaders，避免影响 /admin/ 等同源页面。
CORS_URLS_REGEX = r"^/api/.*$"
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = False  # Bearer Token 鉴权不需要 cookie
CORS_ALLOW_METHODS = [
    "GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD",
]
CORS_ALLOW_HEADERS = [
    "accept", "accept-encoding", "authorization", "content-type",
    "dnt", "origin", "user-agent", "x-csrftoken", "x-requested-with",
    "x-stainless-arch", "x-stainless-async", "x-stainless-lang",
    "x-stainless-os", "x-stainless-package-version", "x-stainless-runtime",
    "x-stainless-runtime-version", "openai-organization", "openai-beta",
]

_LOG_DIR = Path(os.environ.get("DJANGO_LOG_DIR", BASE_DIR / "logs"))
_LOG_DIR.mkdir(parents=True, exist_ok=True)

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "[{asctime}] {levelname} {name} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "file": {
            "level": "WARNING",
            "class": "logging.FileHandler",
            "filename": str(_LOG_DIR / "django.log"),
            "formatter": "verbose",
        },
        "console": {
            "level": "INFO",
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {
        "handlers": ["console", "file"],
        "level": "INFO",
    },
}
