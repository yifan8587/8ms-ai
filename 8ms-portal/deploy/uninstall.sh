#!/usr/bin/env bash
###############################################################################
#  8MS.AI 全栈站点 - 卸载脚本（仅清理本程序，不卸载 mysql/nginx）
#
#  用法：
#    sudo bash deploy/uninstall.sh                         # 仅清理代码 / 服务 / 配置
#    sudo bash deploy/uninstall.sh --purge                 # 同时 DROP DATABASE
#    sudo bash deploy/uninstall.sh --purge --drop-cert     # 再删除 Let's Encrypt 证书
#    sudo bash deploy/uninstall.sh --purge --domain 8ms.ai # 指定要删除的证书域名
#    sudo bash deploy/uninstall.sh --yes                   # 跳过交互确认（CI 用）
#
#  默认会做：
#    - 停止并禁用 systemd 服务（8ms-portal、aiprogram-backend、aiprogram-frontend）
#    - 删除三个 systemd 单元
#    - 删除 nginx 站点配置 + map 公共片段
#    - 删除 /opt/8ms-portal、/opt/aiprogram
#    - 删除 certbot deploy hook
#
#  --purge 还会：
#    - 删除 /etc/aiprogram、/etc/8ms-portal（含 env）
#    - DROP DATABASE aiproject; DROP USER aiprogram;
#
#  --drop-cert 还会：
#    - certbot delete --cert-name <域名>（默认 8ms.ai，可用 --domain 指定）
###############################################################################
set -euo pipefail

[[ "${EUID}" -eq 0 ]] || { echo "请以 root 运行"; exit 1; }

PURGE=0
DROP_CERT=0
ASSUME_YES=0
DOMAIN_TO_DROP="8ms.ai"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --purge)      PURGE=1; shift ;;
    --drop-cert)  DROP_CERT=1; shift ;;
    --domain)     DOMAIN_TO_DROP="$2"; shift 2 ;;
    -y|--yes)     ASSUME_YES=1; shift ;;
    -h|--help)    sed -n '2,28p' "$0"; exit 0 ;;
    *)            echo "未知参数: $1"; exit 1 ;;
  esac
done

PORTAL_NAME="8ms-portal"
BACKEND_NAME="aiprogram"
PORTAL_ROOT="/opt/${PORTAL_NAME}"
BACKEND_ROOT="/opt/${BACKEND_NAME}"
PORTAL_ENV_DIR="/etc/${PORTAL_NAME}"
BACKEND_ENV_DIR="/etc/${BACKEND_NAME}"
PORTAL_ENV_FILE="${PORTAL_ENV_DIR}/portal.env"
BACKEND_ENV_FILE="${BACKEND_ENV_DIR}/backend.env"
PORTAL_UNIT="/etc/systemd/system/${PORTAL_NAME}.service"
BACKEND_UNIT="/etc/systemd/system/${BACKEND_NAME}-backend.service"
FRONTEND_UNIT="/etc/systemd/system/${BACKEND_NAME}-frontend.service"
NGINX_AVAIL="/etc/nginx/sites-available/${PORTAL_NAME}.conf"
NGINX_ENABL="/etc/nginx/sites-enabled/${PORTAL_NAME}.conf"
NGINX_MAP="/etc/nginx/conf.d/ms8-upgrade-map.conf"

echo ""
echo "===================================================================="
echo "  即将卸载："
echo "    /opt/${PORTAL_NAME}    /opt/${BACKEND_NAME}"
echo "    nginx 站点配置 / systemd 单元 / certbot deploy hook"
[[ ${PURGE} -eq 1 ]]     && echo "    + /etc/${PORTAL_NAME}   /etc/${BACKEND_NAME}"
[[ ${PURGE} -eq 1 ]]     && echo "    + DROP DATABASE aiproject; DROP USER aiprogram;"
[[ ${DROP_CERT} -eq 1 ]] && echo "    + Let's Encrypt 证书：${DOMAIN_TO_DROP}"
echo "===================================================================="
if [[ ${ASSUME_YES} -ne 1 ]]; then
  read -r -p "确认继续卸载？(yes/[no]) " _ans
  [[ "${_ans}" == "yes" ]] || { echo "已取消"; exit 0; }
fi

echo "[1/5] 停止并禁用 systemd 服务..."
for svc in \
    "${PORTAL_NAME}.service" \
    "${BACKEND_NAME}-backend.service" \
    "${BACKEND_NAME}-frontend.service"; do
  systemctl stop    "${svc}" 2>/dev/null || true
  systemctl disable "${svc}" 2>/dev/null || true
done

echo "[2/5] 移除 nginx 站点 / map 公共片段..."
rm -f "${NGINX_ENABL}"
rm -f "${NGINX_MAP}"
nginx -t >/dev/null 2>&1 && systemctl reload nginx || true

echo "[3/5] 删除运行目录与 systemd 单元..."
rm -rf "${PORTAL_ROOT}" "${BACKEND_ROOT}"
rm -f  "${PORTAL_UNIT}" "${BACKEND_UNIT}" "${FRONTEND_UNIT}"
rm -f  "${NGINX_AVAIL}"
rm -f  /etc/letsencrypt/renewal-hooks/deploy/8ms-reload-nginx.sh
rm -f  /etc/letsencrypt/renewal-hooks/deploy/aiprogram-reload-nginx.sh
systemctl daemon-reload

if [[ ${PURGE} -eq 1 ]]; then
  echo "[4/5] [PURGE] 删除 env 目录与数据库..."
  if [[ -f "${BACKEND_ENV_FILE}" ]]; then
    set -a; source "${BACKEND_ENV_FILE}"; set +a
    DB_NAME="${DB_NAME:-aiproject}"
    DB_USER="${DB_USER:-aiprogram}"
    if command -v mysql >/dev/null 2>&1 && systemctl is-active --quiet mysql; then
      mysql -uroot <<SQL || true
DROP DATABASE IF EXISTS \`${DB_NAME}\`;
DROP USER IF EXISTS '${DB_USER}'@'127.0.0.1';
DROP USER IF EXISTS '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL
      echo "      已 DROP DATABASE \`${DB_NAME}\` 与用户 \`${DB_USER}\`"
    fi
  fi
  rm -rf "${PORTAL_ENV_DIR}" "${BACKEND_ENV_DIR}"
else
  echo "[4/5] （未加 --purge，保留 env 目录与数据库）"
fi

if [[ ${DROP_CERT} -eq 1 ]]; then
  echo "[5/5] [DROP-CERT] 删除 Let's Encrypt 证书：${DOMAIN_TO_DROP}"
  if command -v certbot >/dev/null 2>&1 \
     && [[ -d "/etc/letsencrypt/live/${DOMAIN_TO_DROP}" ]]; then
    certbot delete --non-interactive --cert-name "${DOMAIN_TO_DROP}" 2>/dev/null \
      || rm -rf "/etc/letsencrypt/live/${DOMAIN_TO_DROP}" \
                "/etc/letsencrypt/archive/${DOMAIN_TO_DROP}" \
                "/etc/letsencrypt/renewal/${DOMAIN_TO_DROP}.conf"
    echo "      证书已删除"
  else
    echo "      未找到证书 ${DOMAIN_TO_DROP}，跳过"
  fi
else
  echo "[5/5] （未加 --drop-cert，保留 Let's Encrypt 证书）"
fi

echo ""
echo "卸载完成。"
