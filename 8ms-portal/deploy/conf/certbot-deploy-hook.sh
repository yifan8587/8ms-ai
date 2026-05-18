#!/usr/bin/env bash
# ============================================================
#  Certbot 续期成功后的部署钩子：重新加载 Nginx 让新证书生效
#
#  certbot 会把此脚本放在 /etc/letsencrypt/renewal-hooks/deploy/
#  下，每次成功续期后自动调用。
# ============================================================
set -euo pipefail

if command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet nginx; then
  systemctl reload nginx
fi
