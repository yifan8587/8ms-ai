#!/usr/bin/env bash
###############################################################################
#  8MS.AI 全栈站点 - Let's Encrypt SSL 证书申请 / 续期 / 切换 HTTPS 脚本
#
#  适用场景：
#    - 已经通过 install.sh 完成 HTTP 部署
#    - DNS 已解析到本机公网 IP
#
#  脚本完成的事（可重复执行，幂等）：
#    1. 校验依赖 / DNS / 80 端口可达
#    2. 自动安装 certbot 与 nginx 插件
#    3. 通过 webroot 模式向 LE 申请 / 续期 / 扩展 证书（支持 --expand）
#    4. 把 nginx 站点配置切换为 nginx-https.conf 模板
#       - 80 端口除 ACME 外，所有路径强制 301 → HTTPS
#       - 443 启用 HTTP/2 + HSTS + OCSP
#    5. 同步更新 backend.env：CSRF_TRUSTED_ORIGINS 增加所有
#       http://、https://<域名> 来源；CSRF_COOKIE_SECURE / SESSION_COOKIE_SECURE
#       置为 1
#    6. 同步更新 portal.env：NEXT_PUBLIC_SITE_URL 切到 https
#    7. 重启 backend / portal 服务，reload nginx
#    8. 安装 certbot deploy hook + 启用 certbot.timer，自动续期
#
#  用法：
#    sudo bash deploy/setup-ssl.sh \
#      --domain 8ms.ai --www \
#      --email admin@8ms.ai
#
#  参数：
#    --domain <主域名>   必填，例如 8ms.ai
#    --www              额外把 www.<主域名> 一起打进证书
#    --email <邮箱>      接收续期通知（首次申请必填）
#    --staging          使用 LE 测试环境（联调时避免触发频率限制）
#    --force-renew      强制重新签发（即使现有证书未过期）
###############################################################################
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

[[ "${EUID}" -eq 0 ]] || error "请使用 root 或 sudo 执行此脚本"

# ── 默认变量 ──
DOMAIN=""
ADD_WWW=0
SSL_EMAIL=""
STAGING=0
FORCE_RENEW=0

PORTAL_NAME="8ms-portal"
BACKEND_NAME="aiprogram"
PORTAL_ROOT="/opt/${PORTAL_NAME}"
BACKEND_ROOT="/opt/${BACKEND_NAME}"
PORTAL_PORT="3013"
BACKEND_PORT="8090"
CONSOLE_PORT="5173"
BACKEND_ENV_FILE="/etc/${BACKEND_NAME}/backend.env"
PORTAL_ENV_FILE="/etc/${PORTAL_NAME}/portal.env"

# ── 解析参数 ──
while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain)       DOMAIN="$2"; shift 2 ;;
    --www)          ADD_WWW=1; shift ;;
    --email)        SSL_EMAIL="$2"; shift 2 ;;
    --staging)      STAGING=1; shift ;;
    --force-renew)  FORCE_RENEW=1; shift ;;
    -h|--help)      sed -n '2,30p' "$0"; exit 0 ;;
    *) error "未知参数: $1（执行 -h 查看帮助）" ;;
  esac
done

[[ -n "${DOMAIN}" ]]    || error "必须通过 --domain 指定主域名"
[[ -n "${SSL_EMAIL}" ]] || error "必须通过 --email 指定证书续期邮箱"

# ── 路径定位 ──
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="${SCRIPT_DIR}"

# ── 必要文件检查 ──
[[ -d "${PORTAL_ROOT}/.next" ]] \
  || error "${PORTAL_ROOT}/.next 不存在，请先运行 install.sh"
[[ -d "${BACKEND_ROOT}/frontend/dist" ]] \
  || error "${BACKEND_ROOT}/frontend/dist 不存在，请先运行 install.sh"
[[ -f "/etc/nginx/sites-available/${PORTAL_NAME}.conf" ]] \
  || error "未找到 nginx 站点配置，请先运行 install.sh"

# ── 安装 certbot ──
if ! command -v certbot >/dev/null 2>&1; then
  info "安装 certbot ..."
  DEBIAN_FRONTEND=noninteractive apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq certbot python3-certbot-nginx >/dev/null
fi

# ── 域名列表 ──
DOMAINS=("${DOMAIN}")
if [[ ${ADD_WWW} -eq 1 ]]; then
  case "${DOMAIN}" in
    www.*) ;;
    *) DOMAINS+=("www.${DOMAIN}") ;;
  esac
fi
PRIMARY_DOMAIN="${DOMAINS[0]}"
NGINX_SERVER_NAME="${DOMAINS[*]}"

# ── DNS / 公网 IP 检测 ──
info "正在探测公网 IP 与 DNS 解析..."
SERVER_IP="$(curl -fsSL --max-time 5 https://api.ipify.org 2>/dev/null \
            || curl -fsSL --max-time 5 https://ifconfig.me 2>/dev/null \
            || hostname -I | awk '{print $1}')"
info "本机公网 IP（探测结果）: ${SERVER_IP:-未知}"
DNS_OK=1
for d in "${DOMAINS[@]}"; do
  RESOLVED="$(getent ahosts "$d" 2>/dev/null | awk 'NR==1{print $1}')"
  if [[ -n "${SERVER_IP}" && -n "${RESOLVED}" && "${RESOLVED}" != "${SERVER_IP}" ]]; then
    warn "  ${d}  ⇒ ${RESOLVED}（与本机 IP 不一致，certbot 可能验证失败）"
    DNS_OK=0
  else
    info "  ${d}  ⇒ ${RESOLVED:-未解析}"
    [[ -z "${RESOLVED}" ]] && DNS_OK=0
  fi
done
if [[ ${DNS_OK} -eq 0 ]]; then
  warn "如果 DNS 还没生效，证书申请大概率失败。可先做 dig +short ${PRIMARY_DOMAIN} 验证。"
fi

# ── 80 端口可达性检测 ──
if ss -ltn 2>/dev/null | grep -q ':80 '; then
  info "本机 80 端口监听正常"
else
  warn "本机 80 端口似乎未监听，certbot webroot 验证会失败。请检查 nginx 是否启动。"
fi

# ── 准备 webroot ──
mkdir -p /var/www/certbot
chown -R www-data:www-data /var/www/certbot 2>/dev/null || true

# ── 临时确保 nginx 在用 HTTP 配置（带 .well-known 路径） ──
NGINX_CONF="/etc/nginx/sites-available/${PORTAL_NAME}.conf"
if ! grep -q "/.well-known/acme-challenge/" "${NGINX_CONF}"; then
  warn "nginx 配置中缺少 ACME 验证目录，先用 HTTP 模板覆盖一次..."
  cp -f "${DEPLOY_DIR}/conf/nginx-http.conf" "${NGINX_CONF}"
  sed -i "s|__DOMAIN__|${NGINX_SERVER_NAME}|g"                       "${NGINX_CONF}"
  sed -i "s|__PORTAL_PORT__|${PORTAL_PORT}|g"                        "${NGINX_CONF}"
  sed -i "s|__BACKEND_PORT__|${BACKEND_PORT}|g"                      "${NGINX_CONF}"
  sed -i "s|__CONSOLE_PORT__|${CONSOLE_PORT}|g"                      "${NGINX_CONF}"
  sed -i "s|__STATIC_ROOT__|${BACKEND_ROOT}/backend/staticfiles|g"   "${NGINX_CONF}"
  sed -i "s|__MEDIA_ROOT__|${BACKEND_ROOT}/backend/media|g"          "${NGINX_CONF}"
  ln -sf "${NGINX_CONF}" "/etc/nginx/sites-enabled/${PORTAL_NAME}.conf"
  nginx -t && systemctl reload nginx
fi

# ── 申请证书（webroot 模式）──
# --expand     允许在已有同名证书上追加 SAN（避免单域名证书想加 www 时报错）
# --cert-name  强制把证书命名为主域名，nginx ssl_certificate 路径稳定
# --keep-until-expiring  续期前 30 天内才真正去 LE 拉新证书
CERTBOT_ARGS=(
  certonly
  --webroot -w /var/www/certbot
  --non-interactive --agree-tos
  --email "${SSL_EMAIL}"
  --no-eff-email
  --expand
  --cert-name "${PRIMARY_DOMAIN}"
  --rsa-key-size 4096
)
if [[ ${FORCE_RENEW} -eq 1 ]]; then
  CERTBOT_ARGS+=( --force-renewal )
else
  CERTBOT_ARGS+=( --keep-until-expiring )
fi
[[ ${STAGING} -eq 1 ]] && CERTBOT_ARGS+=( --staging )
for d in "${DOMAINS[@]}"; do
  CERTBOT_ARGS+=( -d "${d}" )
done

# 已有证书时打印一下 SAN，便于排查
EXISTING_CERT_DIR="/etc/letsencrypt/live/${PRIMARY_DOMAIN}"
if [[ -f "${EXISTING_CERT_DIR}/fullchain.pem" ]]; then
  EXISTING_DOMAINS=$(openssl x509 -in "${EXISTING_CERT_DIR}/fullchain.pem" -noout -text 2>/dev/null \
    | awk '/Subject Alternative Name/{getline; print}' \
    | sed 's/DNS://g; s/,//g; s/^[[:space:]]*//')
  info "检测到已有证书（包含：${EXISTING_DOMAINS:-未知}）"
  info "本次目标域名：${DOMAINS[*]}"
fi

info "运行 certbot 申请 / 续期证书：${DOMAINS[*]}"
if ! certbot "${CERTBOT_ARGS[@]}"; then
  error "certbot 证书申请失败。请按以下顺序排查：
  1) DNS 是否已经指向本机：dig +short ${PRIMARY_DOMAIN}
  2) 80 端口是否真的能从公网访问：curl -I http://${PRIMARY_DOMAIN}/.well-known/acme-challenge/test
  3) 云控制台安全组是否放通 80
  4) 频率限制：可改用 --staging 联调"
fi

CERT_DIR="/etc/letsencrypt/live/${PRIMARY_DOMAIN}"
[[ -f "${CERT_DIR}/fullchain.pem" ]] || error "证书未生成：${CERT_DIR}/fullchain.pem"
info "证书已就位：${CERT_DIR}/fullchain.pem"

# ── 切换 nginx 到 HTTPS 模板 ──
info "把 nginx 切换为 HTTPS 模板（80 → 443 强制跳转）..."
cp -f "${DEPLOY_DIR}/conf/nginx-https.conf" "${NGINX_CONF}"
sed -i "s|__DOMAIN__|${NGINX_SERVER_NAME}|g"                       "${NGINX_CONF}"
sed -i "s|__PRIMARY_DOMAIN__|${PRIMARY_DOMAIN}|g"                  "${NGINX_CONF}"
sed -i "s|__PORTAL_PORT__|${PORTAL_PORT}|g"                        "${NGINX_CONF}"
sed -i "s|__BACKEND_PORT__|${BACKEND_PORT}|g"                      "${NGINX_CONF}"
sed -i "s|__CONSOLE_PORT__|${CONSOLE_PORT}|g"                      "${NGINX_CONF}"
sed -i "s|__STATIC_ROOT__|${BACKEND_ROOT}/backend/staticfiles|g"   "${NGINX_CONF}"
sed -i "s|__MEDIA_ROOT__|${BACKEND_ROOT}/backend/media|g"          "${NGINX_CONF}"
nginx -t
systemctl reload nginx
info "nginx 已重载，HTTPS + 80→443 强制跳转生效"

# ── 同步 backend.env：CSRF / Cookie 安全项 ──
update_env_var() {
  local file="$1" key="$2" value="$3"
  if grep -q "^${key}=" "${file}"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "${file}"
  else
    echo "${key}=${value}" >> "${file}"
  fi
}
add_unique_csv() {
  local existing="$1" addition="$2"
  IFS=',' read -ra ARR <<< "${existing}"
  for v in "${ARR[@]}"; do
    [[ "${v}" == "${addition}" ]] && { echo "${existing}"; return; }
  done
  if [[ -z "${existing}" ]]; then echo "${addition}"; else echo "${existing},${addition}"; fi
}

if [[ -f "${BACKEND_ENV_FILE}" ]]; then
  update_env_var "${BACKEND_ENV_FILE}" CSRF_COOKIE_SECURE     1
  update_env_var "${BACKEND_ENV_FILE}" SESSION_COOKIE_SECURE  1

  # 同时把 http:// 与 https:// 来源都加入白名单（覆盖 80→443 跳转过程的边缘情况）
  CURRENT_CSRF=$(grep '^CSRF_TRUSTED_ORIGINS=' "${BACKEND_ENV_FILE}" | head -1 | cut -d= -f2-)
  CURRENT_HOSTS=$(grep '^DJANGO_ALLOWED_HOSTS=' "${BACKEND_ENV_FILE}" | head -1 | cut -d= -f2-)
  for d in "${DOMAINS[@]}"; do
    CURRENT_HOSTS="$(add_unique_csv "${CURRENT_HOSTS}" "${d}")"
    CURRENT_CSRF="$(add_unique_csv  "${CURRENT_CSRF}"  "https://${d}")"
    CURRENT_CSRF="$(add_unique_csv  "${CURRENT_CSRF}"  "http://${d}")"
  done
  update_env_var "${BACKEND_ENV_FILE}" DJANGO_ALLOWED_HOSTS "${CURRENT_HOSTS}"
  update_env_var "${BACKEND_ENV_FILE}" CSRF_TRUSTED_ORIGINS "${CURRENT_CSRF}"

  systemctl restart "${BACKEND_NAME}-backend.service" 2>/dev/null || true
  info "已开启 secure cookie + 完整 CSRF/Allowed-Hosts 并重启后端"
fi

# ── 同步 portal.env：SITE_URL 切到 https ──
if [[ -f "${PORTAL_ENV_FILE}" ]]; then
  update_env_var "${PORTAL_ENV_FILE}" NEXT_PUBLIC_SITE_URL "https://${PRIMARY_DOMAIN}"
  systemctl restart "${PORTAL_NAME}.service" 2>/dev/null || true
  info "已切换前端 SITE_URL 至 https 并重启门户"
fi

# ── 安装 deploy hook，使续期后自动 reload nginx ──
HOOK_DST="/etc/letsencrypt/renewal-hooks/deploy/8ms-reload-nginx.sh"
mkdir -p "$(dirname "${HOOK_DST}")"
cp -f "${DEPLOY_DIR}/conf/certbot-deploy-hook.sh" "${HOOK_DST}"
chmod 755 "${HOOK_DST}"

# ── 确保 certbot.timer 启用 ──
if systemctl list-unit-files | grep -q '^certbot\.timer'; then
  systemctl enable --now certbot.timer >/dev/null 2>&1 || true
  info "certbot.timer 已启用（每天自动尝试续期）"
fi

# ── 自检 ──
sleep 2
echo ""
info "─── 部署后自检 ───"
HTTP_CODE_REDIR=$(curl -sS -o /dev/null -m 8 -w "%{http_code}" -H "Host: ${PRIMARY_DOMAIN}" "http://127.0.0.1/" || echo 000)
HTTPS_CODE=$(curl -sS -o /dev/null -m 8 -k -w "%{http_code}" "https://${PRIMARY_DOMAIN}/" || echo 000)
HTTPS_CONSOLE=$(curl -sS -o /dev/null -m 8 -k -w "%{http_code}" "https://${PRIMARY_DOMAIN}/console/" || echo 000)
HTTPS_ADMIN=$(curl -sS -o /dev/null -m 8 -k -w "%{http_code}" "https://${PRIMARY_DOMAIN}/admin/login/" || echo 000)
HTTPS_API=$(curl -sS -o /dev/null -m 8 -k -w "%{http_code}" "https://${PRIMARY_DOMAIN}/api/users/login/" || echo 000)
info "  http://${PRIMARY_DOMAIN}/                    => ${HTTP_CODE_REDIR}  (期望 301)"
info "  https://${PRIMARY_DOMAIN}/                   => ${HTTPS_CODE}       (期望 200)"
info "  https://${PRIMARY_DOMAIN}/console/           => ${HTTPS_CONSOLE}    (期望 200)"
info "  https://${PRIMARY_DOMAIN}/admin/login/       => ${HTTPS_ADMIN}      (期望 200)"
info "  https://${PRIMARY_DOMAIN}/api/users/login/   => ${HTTPS_API}        (期望 200/405)"
echo ""

cat <<EOF
============================================================
  HTTPS 证书已成功部署
============================================================
  域名:               ${DOMAINS[*]}
  证书目录:           ${CERT_DIR}
  Nginx 配置:         ${NGINX_CONF}
  续期 deploy hook:   ${HOOK_DST}
  自动续期:           certbot.timer  (systemctl status certbot.timer)

  ── 强制 HTTP→HTTPS 已生效 ──
    curl -I http://${PRIMARY_DOMAIN}/        # → HTTP/1.1 301 Moved Permanently
    curl -I https://${PRIMARY_DOMAIN}/       # → 200

  ── Django Admin 访问 ──
    https://${PRIMARY_DOMAIN}/admin/     登录页
    https://${PRIMARY_DOMAIN}/admin/      （django-admin/ 别名同步可用）

  ── 手动测试续期（不会真的更新证书）──
    sudo certbot renew --dry-run

  注意：如果浏览器以前访问过 http://${PRIMARY_DOMAIN}/admin/，
       请清除该域名的所有 Cookie 后再试，避免老的 csrftoken / sessionid
       与 secure-cookie 模式不兼容导致 CSRF 403。
============================================================
EOF
