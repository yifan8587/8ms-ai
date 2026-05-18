#!/usr/bin/env bash
###############################################################################
#  8MS.AI 全栈一键部署脚本（Ubuntu 24.04 LTS）
#
#  本脚本部署三个独立服务，全部由 systemd 管理、由 nginx 反向代理：
#    1) Next.js 前端门户 8ms_code         → /opt/8ms-portal/         (127.0.0.1:3013)
#    2) Django 后端 AIprogram/aiproject   → /opt/aiprogram/backend/  (127.0.0.1:8090)
#    3) Vue 管理后台 AIprogram/ai-frontend → /opt/aiprogram/frontend/ (127.0.0.1:5173)
#  通过同一个 nginx 站点统一对外提供：
#    /                       → Next.js 门户
#    /api/                   → Django REST
#    /admin/, /django-admin/ → Django Admin
#    /console/               → Vue 管理后台 (反向代理到 127.0.0.1:5173，serve SPA)
#    /static/, /media/       → Django collectstatic + 上传目录
#
#  常见用法：
#    # 1) 仅 HTTP 部署（先把站点跑起来；DNS 还没解析时使用）
#    sudo bash deploy/install.sh
#
#    # 2) 指定主域名（仍是 HTTP）
#    sudo bash deploy/install.sh --domain 8ms.ai --www
#
#    # 3) 一站式 HTTPS 部署（DNS 必须已经指向本机公网 IP）
#    sudo bash deploy/install.sh \
#        --domain 8ms.ai --www \
#        --ssl --email admin@8ms.ai
#
#    # 4) 全量重装（清除老环境的所有项目配置，再完整安装）：
#    sudo bash deploy/install.sh --fresh \
#        --domain 8ms.ai --www \
#        --ssl --email admin@8ms.ai
#
#    # 5) 终极重装（同时 DROP DATABASE 与删除 Let's Encrypt 证书）：
#    sudo bash deploy/install.sh --fresh --drop-db --drop-cert -y \
#        --domain 8ms.ai --www \
#        --ssl --email admin@8ms.ai
#
#    # 6) 自定义 AIprogram 源码位置（默认会自动探测以下路径）：
#    #     ../AIprogram   ../aiprogram   ./AIprogram   /root/AIprogram
#    sudo bash deploy/install.sh --backend-src /path/to/AIprogram
#
#  开关说明：
#    --fresh       部署前清除运行目录、env、systemd、nginx 站点配置
#    --drop-db     在 --fresh 基础上 DROP DATABASE / DROP USER（数据不可恢复！）
#    --drop-cert   在 --fresh 基础上删除现有 Let's Encrypt 证书
#    -y/--yes      非交互模式（CI 用），自动确认 --fresh 提示
#
#  脚本对不带 --fresh 的执行可以重复跑：增量更新代码 / 配置 / 服务，
#  不会重置 .env、不会重建数据库，不会重新申请已有证书。
#  详见同目录 README.md / DEPLOY-UBUNTU-24.04.md
###############################################################################
set -euo pipefail

# ── 颜色输出 ──
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }
hint()  { echo -e "${BLUE}[HINT]${NC} $*"; }

# ── 必须 root ──
[[ "${EUID}" -eq 0 ]] || error "请使用 root 或 sudo 执行此脚本"

# ── 默认变量 ──
DOMAIN=""
ADD_WWW=0
ENABLE_SSL=0
SSL_EMAIL=""
BACKEND_SRC_OVERRIDE=""

# 全量重装相关开关
FRESH_INSTALL=0          # --fresh        部署前停掉所有服务，删除 /opt/* /etc/* nginx 站点 / systemd 单元
DROP_DB=0                # --drop-db      在 --fresh 基础上额外 DROP DATABASE / DROP USER
DROP_CERT=0              # --drop-cert    在 --fresh 基础上额外删除 Let's Encrypt 证书
ASSUME_YES=0             # --yes / -y     非交互模式（适合 CI）

PORTAL_NAME="8ms-portal"
BACKEND_NAME="aiprogram"

PORTAL_ROOT="/opt/${PORTAL_NAME}"
BACKEND_ROOT="/opt/${BACKEND_NAME}"

PORTAL_PORT="3013"
BACKEND_PORT="8090"
CONSOLE_PORT="5173"          # Vue 管理后台 ai-frontend 的本机监听端口
BACKEND_BIND="127.0.0.1:${BACKEND_PORT}"

RUN_USER="www-data"
RUN_GROUP="www-data"

PORTAL_ENV_DIR="/etc/${PORTAL_NAME}"
PORTAL_ENV_FILE="${PORTAL_ENV_DIR}/portal.env"
BACKEND_ENV_DIR="/etc/${BACKEND_NAME}"
BACKEND_ENV_FILE="${BACKEND_ENV_DIR}/backend.env"

# ── 解析参数 ──
while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain)        DOMAIN="$2"; shift 2 ;;
    --www)           ADD_WWW=1; shift ;;
    --ssl)           ENABLE_SSL=1; shift ;;
    --email)         SSL_EMAIL="$2"; shift 2 ;;
    --backend-src)   BACKEND_SRC_OVERRIDE="$2"; shift 2 ;;
    --portal-port)   PORTAL_PORT="$2"; shift 2 ;;
    --backend-port)  BACKEND_PORT="$2"; BACKEND_BIND="127.0.0.1:${BACKEND_PORT}"; shift 2 ;;
    --console-port)  CONSOLE_PORT="$2"; shift 2 ;;
    --fresh)         FRESH_INSTALL=1; shift ;;
    --drop-db)       DROP_DB=1; FRESH_INSTALL=1; shift ;;
    --drop-cert)     DROP_CERT=1; FRESH_INSTALL=1; shift ;;
    -y|--yes)        ASSUME_YES=1; shift ;;
    -h|--help)       sed -n '2,55p' "$0"; exit 0 ;;
    *)
      if [[ -z "${DOMAIN}" && "$1" != -* ]]; then
        DOMAIN="$1"; shift
      else
        error "未知参数: $1（执行 -h 查看帮助）"
      fi ;;
  esac
done

if [[ ${ENABLE_SSL} -eq 1 && -z "${SSL_EMAIL}" ]]; then
  error "启用 --ssl 时必须同时指定 --email <邮箱>，certbot 会用此邮箱发送证书到期提醒"
fi
if [[ ${ENABLE_SSL} -eq 1 && -z "${DOMAIN}" ]]; then
  error "启用 --ssl 时必须指定 --domain <域名>"
fi

# ── 路径定位（脚本所在 = 8ms_code/deploy/） ──
PORTAL_SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_DIR="${PORTAL_SRC}/deploy"

[[ -f "${PORTAL_SRC}/package.json" ]] \
  || error "找不到 8ms_code 的 package.json（脚本应在 8ms_code/deploy/ 下执行）"

# 自动探测后端源码位置
detect_backend_src() {
  if [[ -n "${BACKEND_SRC_OVERRIDE}" ]]; then
    [[ -d "${BACKEND_SRC_OVERRIDE}" ]] || error "--backend-src 指定的目录不存在：${BACKEND_SRC_OVERRIDE}"
    echo "${BACKEND_SRC_OVERRIDE}"; return
  fi
  local candidates=(
    "${PORTAL_SRC}/../AIprogram"
    "${PORTAL_SRC}/../aiprogram"
    "${PORTAL_SRC}/AIprogram"
    "/root/AIprogram"
    "/opt/aiprogram-source"
  )
  for d in "${candidates[@]}"; do
    if [[ -d "${d}/aiproject" && -f "${d}/requirements.txt" ]]; then
      echo "$(cd "${d}" && pwd)"; return
    fi
  done
  error "未找到 AIprogram 源码目录。请用 --backend-src /path/to/AIprogram 指定。"
}
BACKEND_SRC="$(detect_backend_src)"
BACKEND_SUBSRC="${BACKEND_SRC}/aiproject"          # Django 工程
FRONTEND_VUE_SRC="${BACKEND_SRC}/ai-frontend"      # Vue 管理后台

[[ -d "${BACKEND_SUBSRC}" ]]    || error "找不到 Django 工程：${BACKEND_SUBSRC}"
[[ -d "${FRONTEND_VUE_SRC}" ]]  || error "找不到 Vue 管理后台：${FRONTEND_VUE_SRC}"
[[ -f "${BACKEND_SRC}/requirements.txt" ]] || error "找不到 ${BACKEND_SRC}/requirements.txt"

# ── 域名相关变量 ──
ALL_DOMAINS=""
PRIMARY_DOMAIN=""
if [[ -n "${DOMAIN}" ]]; then
  PRIMARY_DOMAIN="${DOMAIN}"
  ALL_DOMAINS="${DOMAIN}"
  if [[ ${ADD_WWW} -eq 1 ]]; then
    case "${DOMAIN}" in
      www.*) ;;
      *)     ALL_DOMAINS="${DOMAIN} www.${DOMAIN}" ;;
    esac
  fi
fi
NGINX_SERVER_NAME="${ALL_DOMAINS:-_}"
SERVER_IP="$(hostname -I | awk '{print $1}')"

###############################################################################
#  全量清除函数：--fresh 时调用，把当前服务器上所有跟本项目相关的运行时配置
#  （服务、目录、env、nginx 站点、systemd 单元、deploy hook）一次性清掉。
#  默认不动数据库与 Let's Encrypt 证书；要更激进可加 --drop-db / --drop-cert。
###############################################################################
cleanup_existing_install() {
  warn "──────── 开始全量清除现有部署 ────────"

  # 1) 停掉并禁用 systemd 服务（含历史命名残留）
  for svc in \
      "${PORTAL_NAME}.service" \
      "${BACKEND_NAME}-backend.service" \
      "${BACKEND_NAME}-frontend.service"; do
    if systemctl list-unit-files 2>/dev/null | grep -q "^${svc}"; then
      systemctl stop    "${svc}" 2>/dev/null || true
      systemctl disable "${svc}" 2>/dev/null || true
      info "  已停止：${svc}"
    fi
  done

  # 2) 删除 nginx 站点配置 + 公共 map 片段，并 reload
  rm -f "/etc/nginx/sites-enabled/${PORTAL_NAME}.conf"
  rm -f "/etc/nginx/sites-available/${PORTAL_NAME}.conf"
  rm -f "/etc/nginx/conf.d/ms8-upgrade-map.conf"
  if command -v nginx >/dev/null 2>&1 && systemctl is-active --quiet nginx; then
    nginx -t >/dev/null 2>&1 && systemctl reload nginx || true
  fi
  info "  已清理 nginx 站点 / map 片段"

  # 3) 删除 systemd 单元
  rm -f "/etc/systemd/system/${PORTAL_NAME}.service"
  rm -f "/etc/systemd/system/${BACKEND_NAME}-backend.service"
  rm -f "/etc/systemd/system/${BACKEND_NAME}-frontend.service"
  systemctl daemon-reload
  info "  已删除 systemd 单元"

  # 4) 删除 certbot deploy hook（不会动证书本体）
  rm -f /etc/letsencrypt/renewal-hooks/deploy/8ms-reload-nginx.sh
  rm -f /etc/letsencrypt/renewal-hooks/deploy/aiprogram-reload-nginx.sh

  # 5) 删除应用根目录与 env 目录
  if [[ -d "${PORTAL_ROOT}" ]]; then
    rm -rf "${PORTAL_ROOT}"; info "  已删除 ${PORTAL_ROOT}"
  fi
  if [[ -d "${BACKEND_ROOT}" ]]; then
    rm -rf "${BACKEND_ROOT}"; info "  已删除 ${BACKEND_ROOT}"
  fi
  if [[ -d "${PORTAL_ENV_DIR}" ]]; then
    rm -rf "${PORTAL_ENV_DIR}"; info "  已删除 ${PORTAL_ENV_DIR}"
  fi
  if [[ -d "${BACKEND_ENV_DIR}" ]]; then
    rm -rf "${BACKEND_ENV_DIR}"; info "  已删除 ${BACKEND_ENV_DIR}"
  fi

  # 6) 可选：DROP DATABASE + DROP USER
  if [[ ${DROP_DB} -eq 1 ]] && command -v mysql >/dev/null 2>&1; then
    local _db_name="${DB_NAME:-aiproject}"
    local _db_user="${DB_USER:-aiprogram}"
    if systemctl is-active --quiet mysql 2>/dev/null; then
      mysql -uroot <<SQL || true
DROP DATABASE IF EXISTS \`${_db_name}\`;
DROP USER IF EXISTS '${_db_user}'@'127.0.0.1';
DROP USER IF EXISTS '${_db_user}'@'localhost';
FLUSH PRIVILEGES;
SQL
      info "  已 DROP DATABASE \`${_db_name}\` 与用户 \`${_db_user}\`"
    fi
  fi

  # 7) 可选：删除 Let's Encrypt 证书
  if [[ ${DROP_CERT} -eq 1 ]] && command -v certbot >/dev/null 2>&1; then
    if [[ -n "${PRIMARY_DOMAIN}" ]] \
       && [[ -d "/etc/letsencrypt/live/${PRIMARY_DOMAIN}" ]]; then
      certbot delete --non-interactive --cert-name "${PRIMARY_DOMAIN}" 2>/dev/null \
        || rm -rf "/etc/letsencrypt/live/${PRIMARY_DOMAIN}" \
                  "/etc/letsencrypt/archive/${PRIMARY_DOMAIN}" \
                  "/etc/letsencrypt/renewal/${PRIMARY_DOMAIN}.conf"
      info "  已删除 Let's Encrypt 证书：${PRIMARY_DOMAIN}"
    fi
  fi

  warn "──────── 全量清除完成，开始重新安装 ────────"
  echo ""
}

if [[ ${FRESH_INSTALL} -eq 1 ]]; then
  echo ""
  warn "===================================================================="
  warn "  --fresh 模式：将清除以下内容（数据库 / 证书默认保留）："
  warn "    /opt/${PORTAL_NAME}    /opt/${BACKEND_NAME}"
  warn "    /etc/${PORTAL_NAME}    /etc/${BACKEND_NAME}"
  warn "    nginx 站点 / systemd 单元 / certbot deploy hook"
  [[ ${DROP_DB} -eq 1 ]]   && warn "    + DROP DATABASE aiproject + DROP USER aiprogram"
  [[ ${DROP_CERT} -eq 1 ]] && warn "    + 删除 Let's Encrypt 证书：${PRIMARY_DOMAIN:-未指定域名}"
  warn "===================================================================="
  if [[ ${ASSUME_YES} -ne 1 ]]; then
    read -r -p "确认全量清除并重新部署？(yes/[no]) " _ans
    [[ "${_ans}" == "yes" ]] || error "已取消（如需跳过此提示请加 -y）"
  fi
  cleanup_existing_install
fi

# ── 步骤计数 ──
TOTAL_STEPS=15      # 比之前多一步：安装 Vue admin systemd
[[ ${ENABLE_SSL} -eq 1 ]] && TOTAL_STEPS=$((TOTAL_STEPS+1))
step=0
next_step() { step=$((step+1)); echo ""; info "[$step/$TOTAL_STEPS] $*"; }

# ── banner 文案预先组装（heredoc 里嵌套 $() + 双引号会踩 bash 解析坑） ──
if [[ ${FRESH_INSTALL} -eq 1 ]]; then
  _fresh_label="是"
  if [[ ${DROP_DB} -eq 1 || ${DROP_CERT} -eq 1 ]]; then
    _fresh_extras=""
    [[ ${DROP_DB}   -eq 1 ]] && _fresh_extras+="DROP-DB "
    [[ ${DROP_CERT} -eq 1 ]] && _fresh_extras+="DROP-CERT"
    _fresh_label="是 (${_fresh_extras% })"
  fi
else
  _fresh_label="否"
fi
if [[ ${ENABLE_SSL} -eq 1 ]]; then
  _ssl_label="是 (Let's Encrypt: ${SSL_EMAIL})"
else
  _ssl_label="否（仅 HTTP）"
fi

cat <<EOF

============================================================
  8MS.AI 全栈一键部署 - Ubuntu 24.04
============================================================
  门户源码 (8ms_code):           ${PORTAL_SRC}
  后端源码 (AIprogram):          ${BACKEND_SRC}
  门户部署 (Next.js):            ${PORTAL_ROOT}        (127.0.0.1:${PORTAL_PORT})
  后端部署 (Django):             ${BACKEND_ROOT}/backend  (127.0.0.1:${BACKEND_PORT})
  Vue admin (ai-frontend):       ${BACKEND_ROOT}/frontend (127.0.0.1:${CONSOLE_PORT}, /console/)
  服务器内网 IP:                 ${SERVER_IP}
  全量重装 (--fresh):            ${_fresh_label}
  域名:                          ${ALL_DOMAINS:-（未指定，仅本机 IP 访问）}
  HTTPS / 证书:                  ${_ssl_label}
============================================================
EOF
sleep 1

# ============================================================
next_step "更新 apt 源并安装系统依赖"
# ============================================================
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq \
  ca-certificates curl gnupg lsb-release \
  build-essential pkg-config \
  python3 python3-venv python3-dev python3-pip \
  default-libmysqlclient-dev \
  mysql-server \
  nginx \
  rsync git tar \
  ufw \
  cron \
  openssl \
  > /dev/null

# ── Node.js 22 LTS（NodeSource） ──
NEED_NODE=1
if command -v node >/dev/null 2>&1; then
  CURRENT_NODE_MAJOR="$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1 || echo 0)"
  if [[ "${CURRENT_NODE_MAJOR}" -ge 20 ]]; then
    NEED_NODE=0
  fi
fi
if [[ ${NEED_NODE} -eq 1 ]]; then
  info "安装 Node.js 22 LTS ..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null 2>&1
  apt-get install -y -qq nodejs >/dev/null
fi

# ── serve（npm 包）：用于跑 Vue 管理后台 SPA，监听本机 ${CONSOLE_PORT} ──
# 不要用 npx 在 systemd 里冷启，会因为 PATH/HOME 限制各种翻车，统一全局装。
NEED_SERVE=1
if command -v serve >/dev/null 2>&1; then
  NEED_SERVE=0
fi
if [[ ${NEED_SERVE} -eq 1 ]]; then
  info "安装 serve（静态 SPA 服务器，用于 ai-frontend /console/） ..."
  npm install -g serve@14 --silent --no-audit --no-fund >/dev/null 2>&1 \
    || npm install -g serve --silent --no-audit --no-fund >/dev/null 2>&1
fi
SERVE_BIN="$(command -v serve || true)"
if [[ -z "${SERVE_BIN}" ]]; then
  error "serve 安装失败，请手动执行：sudo npm install -g serve"
fi

# ── certbot ──
if [[ ${ENABLE_SSL} -eq 1 ]]; then
  if ! command -v certbot >/dev/null 2>&1; then
    info "安装 certbot ..."
    apt-get install -y -qq certbot python3-certbot-nginx >/dev/null
  fi
fi

info "MySQL    : $(mysql --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)"
info "Nginx    : $(nginx -v 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)"
info "Python3  : $(python3 --version 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')"
info "Node.js  : $(node --version 2>/dev/null || echo N/A)"
info "npm      : $(npm --version 2>/dev/null || echo N/A)"
info "serve    : $("${SERVE_BIN}" --version 2>/dev/null | head -1 || echo N/A) (${SERVE_BIN})"
[[ ${ENABLE_SSL} -eq 1 ]] && info "Certbot  : $(certbot --version 2>/dev/null || echo N/A)"

# 防御性把所有 conf/ 模板转成 LF，防止 Windows 编辑器写出 CRLF
# 导致后续 source backend.env 时报 $'\r': command not found
if compgen -G "${DEPLOY_DIR}/conf/*" >/dev/null; then
  find "${DEPLOY_DIR}/conf" -type f \
    \( -name '*.example' -o -name '*.conf' -o -name '*.service' -o -name '*.sh' \) \
    -exec sed -i 's/\r$//' {} +
fi

systemctl enable --now mysql >/dev/null 2>&1
systemctl enable --now nginx >/dev/null 2>&1
systemctl enable --now cron  >/dev/null 2>&1 || true

# ============================================================
next_step "创建运行目录与日志目录"
# ============================================================
mkdir -p \
  "${PORTAL_ROOT}" \
  "${PORTAL_ROOT}/logs" \
  "${BACKEND_ROOT}/backend" \
  "${BACKEND_ROOT}/frontend" \
  "${BACKEND_ROOT}/logs" \
  "${BACKEND_ROOT}/backend/logs" \
  "${BACKEND_ROOT}/backend/media" \
  /var/www/certbot

# ============================================================
next_step "rsync 同步 8ms_code 门户源码到 ${PORTAL_ROOT}"
# ============================================================
rsync -a --delete \
  --exclude '.git' --exclude 'node_modules' \
  --exclude '.next' --exclude 'out' \
  --exclude 'logs' --exclude '*.log' \
  --exclude '.idea' --exclude '.vscode' \
  --exclude '.env' --exclude '.env.local' \
  "${PORTAL_SRC}/" "${PORTAL_ROOT}/"

# 保留 logs 目录（rsync --delete 会清空）
mkdir -p "${PORTAL_ROOT}/logs"

# ============================================================
next_step "rsync 同步 AIprogram 后端源码到 ${BACKEND_ROOT}"
# ============================================================
rsync -a --delete \
  --exclude '__pycache__' --exclude '*.pyc' --exclude '.git' \
  --exclude 'logs' --exclude 'staticfiles' --exclude 'media' \
  "${BACKEND_SUBSRC}/"  "${BACKEND_ROOT}/backend/"

rsync -a --delete \
  --exclude 'node_modules' --exclude '.git' --exclude 'dist' \
  "${FRONTEND_VUE_SRC}/" "${BACKEND_ROOT}/frontend/"

cp -f "${BACKEND_SRC}/requirements.txt" "${BACKEND_ROOT}/requirements.txt"

# ============================================================
next_step "创建 Python 虚拟环境并安装依赖"
# ============================================================
if [[ ! -d "${BACKEND_ROOT}/venv" ]]; then
  python3 -m venv "${BACKEND_ROOT}/venv"
fi
"${BACKEND_ROOT}/venv/bin/pip" install --upgrade pip wheel setuptools -q
"${BACKEND_ROOT}/venv/bin/pip" install -r "${BACKEND_ROOT}/requirements.txt" -q
PIP_COUNT=$("${BACKEND_ROOT}/venv/bin/pip" list --format=columns 2>/dev/null | tail -n +3 | wc -l)
info "Python 包安装完成（共 ${PIP_COUNT} 个）"

# ============================================================
next_step "生成 / 复用后端环境配置 ${BACKEND_ENV_FILE}"
# ============================================================
mkdir -p "${BACKEND_ENV_DIR}"
chmod 750 "${BACKEND_ENV_DIR}"

if [[ ! -f "${BACKEND_ENV_FILE}" ]]; then
  cp -f "${DEPLOY_DIR}/conf/backend.env.example" "${BACKEND_ENV_FILE}"
  chmod 600 "${BACKEND_ENV_FILE}"
  RANDOM_SECRET="$(openssl rand -hex 32)"
  RANDOM_DBPASS="Ai$(openssl rand -hex 8)!"
  sed -i "s|please-change-this-secret-key|${RANDOM_SECRET}|"           "${BACKEND_ENV_FILE}"
  sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=${RANDOM_DBPASS}|"             "${BACKEND_ENV_FILE}"
  sed -i "s|^APP_DB_PASSWORD=.*|APP_DB_PASSWORD=${RANDOM_DBPASS}|"     "${BACKEND_ENV_FILE}"
  if [[ ${ENABLE_SSL} -ne 1 ]]; then
    sed -i "s|^CSRF_COOKIE_SECURE=.*|CSRF_COOKIE_SECURE=0|"            "${BACKEND_ENV_FILE}"
    sed -i "s|^SESSION_COOKIE_SECURE=.*|SESSION_COOKIE_SECURE=0|"      "${BACKEND_ENV_FILE}"
  fi
  info "已创建 ${BACKEND_ENV_FILE}（随机 SECRET_KEY / 数据库密码已自动生成）"
else
  info "后端环境文件已存在，保留原有内容：${BACKEND_ENV_FILE}"
fi
# 兜底：把 env 文件强制转成 LF，防止 source 时被 \r 干扰
sed -i 's/\r$//' "${BACKEND_ENV_FILE}"

# ── 维护 ALLOWED_HOSTS / CSRF_TRUSTED_ORIGINS ──
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
  local found=0
  for v in "${ARR[@]}"; do
    [[ "${v}" == "${addition}" ]] && found=1 && break
  done
  if [[ ${found} -eq 0 && -n "${addition}" ]]; then
    if [[ -z "${existing}" ]]; then echo "${addition}"; else echo "${existing},${addition}"; fi
  else
    echo "${existing}"
  fi
}

CURRENT_HOSTS=$(grep '^DJANGO_ALLOWED_HOSTS=' "${BACKEND_ENV_FILE}" | head -1 | cut -d= -f2-)
CURRENT_CSRF=$(grep  '^CSRF_TRUSTED_ORIGINS=' "${BACKEND_ENV_FILE}" | head -1 | cut -d= -f2-)
[[ -z "${CURRENT_HOSTS}" ]] && CURRENT_HOSTS="127.0.0.1,localhost"
[[ -z "${CURRENT_CSRF}"  ]] && CURRENT_CSRF=""

NEW_HOSTS="$(add_unique_csv "${CURRENT_HOSTS}" "${SERVER_IP}")"
NEW_CSRF="$(add_unique_csv  "${CURRENT_CSRF}"  "http://${SERVER_IP}")"
NEW_CSRF="$(add_unique_csv  "${NEW_CSRF}"      "https://${SERVER_IP}")"

# 每个域名都同时把 http:// 和 https:// 加进 CSRF 白名单。
# 即使本次还没开 SSL，未来切 HTTPS 时也无需再改 env，省掉一次
# Django Admin 登录 POST 报 CSRF 403 的常见坑。
if [[ -n "${ALL_DOMAINS}" ]]; then
  for d in ${ALL_DOMAINS}; do
    NEW_HOSTS="$(add_unique_csv "${NEW_HOSTS}" "${d}")"
    NEW_CSRF="$(add_unique_csv  "${NEW_CSRF}"  "http://${d}")"
    NEW_CSRF="$(add_unique_csv  "${NEW_CSRF}"  "https://${d}")"
  done
fi
update_env_var "${BACKEND_ENV_FILE}" DJANGO_ALLOWED_HOSTS "${NEW_HOSTS}"
update_env_var "${BACKEND_ENV_FILE}" CSRF_TRUSTED_ORIGINS "${NEW_CSRF}"

# Django 在 nginx 反代后必须知道客户端用的是 https，否则会拒绝 CSRF / 重定向
# 错误的 scheme。settings_production.py 已经有：
#   SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
#   USE_X_FORWARDED_HOST = True
# 这里只需根据是否启用 SSL 调整 cookie secure 标志即可。
if [[ ${ENABLE_SSL} -eq 1 ]]; then
  update_env_var "${BACKEND_ENV_FILE}" CSRF_COOKIE_SECURE 1
  update_env_var "${BACKEND_ENV_FILE}" SESSION_COOKIE_SECURE 1
else
  # HTTP-only 模式禁用 secure cookie，否则浏览器拒绝 set-cookie 导致登录态丢失
  update_env_var "${BACKEND_ENV_FILE}" CSRF_COOKIE_SECURE 0
  update_env_var "${BACKEND_ENV_FILE}" SESSION_COOKIE_SECURE 0
fi

# 再次兜底（update_env_var 之后），确保 source 不会读到 \r
sed -i 's/\r$//' "${BACKEND_ENV_FILE}"
set -a; source "${BACKEND_ENV_FILE}"; set +a

DB_NAME="${DB_NAME:-aiproject}"
DB_USER="${DB_USER:-aiprogram}"
DB_PASSWORD="${DB_PASSWORD:-aiprogram@123}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
export DB_NAME DB_USER DB_PASSWORD DB_HOST DB_PORT

# ============================================================
next_step "生成 / 复用门户环境配置 ${PORTAL_ENV_FILE}"
# ============================================================
mkdir -p "${PORTAL_ENV_DIR}"
chmod 750 "${PORTAL_ENV_DIR}"

if [[ ! -f "${PORTAL_ENV_FILE}" ]]; then
  cp -f "${DEPLOY_DIR}/conf/portal.env.example" "${PORTAL_ENV_FILE}"
  chmod 600 "${PORTAL_ENV_FILE}"
  info "已创建 ${PORTAL_ENV_FILE}"
else
  info "门户环境文件已存在，保留原有内容：${PORTAL_ENV_FILE}"
fi
# 兜底转 LF
sed -i 's/\r$//' "${PORTAL_ENV_FILE}"

update_env_var "${PORTAL_ENV_FILE}" PORT                  "${PORTAL_PORT}"
update_env_var "${PORTAL_ENV_FILE}" BACKEND_API_BASE_URL  "http://127.0.0.1:${BACKEND_PORT}/api"
# 登录后跳转目标：默认 /console/（Vue 管理后台）
# 已存在的旧 portal.env 如果没有这一行，这里会自动补上
if ! grep -q '^NEXT_PUBLIC_POST_LOGIN_REDIRECT=' "${PORTAL_ENV_FILE}"; then
  update_env_var "${PORTAL_ENV_FILE}" NEXT_PUBLIC_POST_LOGIN_REDIRECT "/console/"
fi
if [[ -n "${PRIMARY_DOMAIN}" ]]; then
  if [[ ${ENABLE_SSL} -eq 1 ]]; then
    update_env_var "${PORTAL_ENV_FILE}" NEXT_PUBLIC_SITE_URL "https://${PRIMARY_DOMAIN}"
  else
    update_env_var "${PORTAL_ENV_FILE}" NEXT_PUBLIC_SITE_URL "http://${PRIMARY_DOMAIN}"
  fi
fi

# ============================================================
next_step "初始化 MySQL 数据库与账号"
# ============================================================
mysql -uroot <<SQL || true
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASSWORD}';
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
ALTER  USER '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASSWORD}';
ALTER  USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'127.0.0.1';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL
info "数据库 '${DB_NAME}' / 用户 '${DB_USER}' 已就绪"

# ============================================================
next_step "执行 Django migrate + collectstatic"
# ============================================================
cd "${BACKEND_ROOT}/backend"
export DJANGO_SETTINGS_MODULE=aiproject.settings_production
mkdir -p logs media staticfiles

"${BACKEND_ROOT}/venv/bin/python" manage.py migrate --noinput
info "数据库迁移完成"

"${BACKEND_ROOT}/venv/bin/python" manage.py collectstatic --noinput --clear >/dev/null 2>&1
STATIC_COUNT=$(find "${BACKEND_ROOT}/backend/staticfiles" -type f 2>/dev/null | wc -l)
info "已收集 ${STATIC_COUNT} 个静态文件 -> ${BACKEND_ROOT}/backend/staticfiles/"

# ============================================================
next_step "确保 Django 超级管理员存在"
# ============================================================
DJANGO_SUPERUSER_USERNAME="${DJANGO_SUPERUSER_USERNAME:-admin}"
DJANGO_SUPERUSER_EMAIL="${DJANGO_SUPERUSER_EMAIL:-admin@example.com}"
DJANGO_SUPERUSER_PASSWORD="${DJANGO_SUPERUSER_PASSWORD:-Admin@123456}"
export DJANGO_SUPERUSER_USERNAME DJANGO_SUPERUSER_EMAIL DJANGO_SUPERUSER_PASSWORD

"${BACKEND_ROOT}/venv/bin/python" manage.py shell <<'PYEOF' >/tmp/8ms-superuser.log 2>&1 || true
import os
from django.contrib.auth import get_user_model
User = get_user_model()
u = os.environ['DJANGO_SUPERUSER_USERNAME']
e = os.environ['DJANGO_SUPERUSER_EMAIL']
p = os.environ['DJANGO_SUPERUSER_PASSWORD']
user, created = User.objects.get_or_create(
    username=u,
    defaults={'email': e, 'is_staff': True, 'is_superuser': True},
)
if not created:
    user.email = e
    user.is_staff = True
    user.is_superuser = True
if created:
    user.set_password(p)
user.save()
print('CREATED' if created else 'UPDATED', '-', u)
try:
    from users.models import APIToken
    token, t_created = APIToken.objects.get_or_create(
        user=user, name='admin-default-token',
        defaults={'token_key': APIToken.generate_key(), 'permissions': 'all', 'is_active': True},
    )
    if not t_created:
        token.permissions = 'all'; token.is_active = True; token.save()
    print('TOKEN', token.token_key)
except Exception as e:
    print('TOKEN-SKIP', e)
PYEOF
info "超级管理员处理完成（详情：/tmp/8ms-superuser.log）"

# ============================================================
next_step "构建 Vue 管理后台 ai-frontend (base=/console/)"
# ============================================================
cd "${BACKEND_ROOT}/frontend"
if [[ -f package-lock.json ]]; then
  npm ci --no-audit --no-fund --silent || npm install --no-audit --no-fund --silent
else
  npm install --no-audit --no-fund --silent
fi
# 强制 base=/console/ 让所有静态资源路径都带前缀
# 同时把 BASE_URL 写入构建期环境变量，让 vue-router 与 axios redirect 都能正确拼前缀
export VITE_BASE_PATH="/console/"
npm run build -- --base=/console/ 2>&1 | tail -5
unset VITE_BASE_PATH
[[ -f "${BACKEND_ROOT}/frontend/dist/index.html" ]] || error "Vue 管理后台构建失败：未发现 dist/index.html"

# 构建产物自检：dist/index.html 必须带 /console/ 前缀，否则 nginx 找不到静态资源
if ! grep -q '/console/assets/' "${BACKEND_ROOT}/frontend/dist/index.html"; then
  warn "Vue 管理后台 dist/index.html 没有 /console/ 前缀！"
  warn "这通常是 vite 没有正确读取 --base，请检查："
  warn "  1) ai-frontend/package.json 中 \"build\" 是否被改写"
  warn "  2) ai-frontend/vite.config.js 是否硬编码了 base"
  grep -E '<script|<link' "${BACKEND_ROOT}/frontend/dist/index.html" | head -3 || true
  error "构建产物自检失败"
fi
info "Vue 管理后台构建完成 -> ${BACKEND_ROOT}/frontend/dist/"
info "  index.html 资源前缀：$(grep -oE '/console/assets/[^\"]+' ${BACKEND_ROOT}/frontend/dist/index.html | head -1)"

# ============================================================
next_step "构建 Next.js 门户 8ms_code"
# ============================================================
cd "${PORTAL_ROOT}"
# Next.js 16 需要 npm install 全量装依赖（含 devDeps），编译完才能用 next start
if [[ -f package-lock.json ]]; then
  npm ci --no-audit --no-fund --silent || npm install --no-audit --no-fund --silent
else
  npm install --no-audit --no-fund --silent
fi

# 在构建期把后端 API 注入；NEXT_PUBLIC_* 会被打进客户端包，
# 由于浏览器侧默认走 /api/backend/ 同源代理，这里只设置服务器端用的 BACKEND_API_BASE_URL。
export BACKEND_API_BASE_URL="http://127.0.0.1:${BACKEND_PORT}/api"
export NEXT_TELEMETRY_DISABLED=1

# 把 portal.env 里的 NEXT_PUBLIC_* 变量在 build 之前 export，
# 否则它们不会被内联进客户端 bundle，浏览器侧拿不到。
# 关键变量：
#   NEXT_PUBLIC_POST_LOGIN_REDIRECT=/console/chat   登录后跳转 Vue 工作区聊天页
#   NEXT_PUBLIC_SITE_URL                        SEO / 邮件链接用
#   NEXT_PUBLIC_SITE_NAME                       网页 title
set -a
# shellcheck disable=SC1090
source "${PORTAL_ENV_FILE}"
set +a

npm run build 2>&1 | tail -10
[[ -d "${PORTAL_ROOT}/.next" ]] || error "Next.js 构建失败：未发现 .next 目录"
info "Next.js 门户构建完成 -> ${PORTAL_ROOT}/.next/"
# 自检：客户端 bundle 应该包含我们刚才注入的 redirect 目标
if grep -rq "/console/chat" "${PORTAL_ROOT}/.next/static" 2>/dev/null; then
  info "客户端 bundle 已注入 NEXT_PUBLIC_POST_LOGIN_REDIRECT=/console/chat"
elif grep -rq "/console/" "${PORTAL_ROOT}/.next/static" 2>/dev/null; then
  info "客户端 bundle 已注入 NEXT_PUBLIC_POST_LOGIN_REDIRECT=/console/"
fi

# ============================================================
next_step "安装 systemd 后端服务（aiprogram-backend.service）"
# ============================================================
BACKEND_UNIT="/etc/systemd/system/${BACKEND_NAME}-backend.service"
cp -f "${DEPLOY_DIR}/conf/aiprogram-backend.service" "${BACKEND_UNIT}"
sed -i "s|__BACKEND_ROOT__|${BACKEND_ROOT}|g"   "${BACKEND_UNIT}"
sed -i "s|__RUN_USER__|${RUN_USER}|g"           "${BACKEND_UNIT}"
sed -i "s|__RUN_GROUP__|${RUN_GROUP}|g"         "${BACKEND_UNIT}"
sed -i "s|__BACKEND_BIND__|${BACKEND_BIND}|g"   "${BACKEND_UNIT}"
info "systemd 后端单元已写入：${BACKEND_UNIT}"

# ============================================================
next_step "安装 systemd 门户服务（8ms-portal.service）"
# ============================================================
PORTAL_UNIT="/etc/systemd/system/${PORTAL_NAME}.service"
cp -f "${DEPLOY_DIR}/conf/8ms-portal.service" "${PORTAL_UNIT}"
sed -i "s|__PORTAL_ROOT__|${PORTAL_ROOT}|g"     "${PORTAL_UNIT}"
sed -i "s|__PORTAL_PORT__|${PORTAL_PORT}|g"     "${PORTAL_UNIT}"
sed -i "s|__RUN_USER__|${RUN_USER}|g"           "${PORTAL_UNIT}"
sed -i "s|__RUN_GROUP__|${RUN_GROUP}|g"         "${PORTAL_UNIT}"
info "systemd 门户单元已写入：${PORTAL_UNIT}"

# ============================================================
next_step "安装 systemd Vue 管理后台服务（aiprogram-frontend.service）"
# ============================================================
# Vue admin 现在以独立进程跑，监听 127.0.0.1:${CONSOLE_PORT}，由 nginx /console/
# 反向代理。这样 SPA 路由 fallback / 缓存策略 / 升级回滚都不受 Django 影响。
FRONTEND_UNIT="/etc/systemd/system/${BACKEND_NAME}-frontend.service"
cp -f "${DEPLOY_DIR}/conf/aiprogram-frontend.service" "${FRONTEND_UNIT}"
sed -i "s|__BACKEND_ROOT__|${BACKEND_ROOT}|g"             "${FRONTEND_UNIT}"
sed -i "s|__RUN_USER__|${RUN_USER}|g"                     "${FRONTEND_UNIT}"
sed -i "s|__RUN_GROUP__|${RUN_GROUP}|g"                   "${FRONTEND_UNIT}"
sed -i "s|__CONSOLE_DIST__|${BACKEND_ROOT}/frontend/dist|g" "${FRONTEND_UNIT}"
sed -i "s|__CONSOLE_PORT__|${CONSOLE_PORT}|g"             "${FRONTEND_UNIT}"
# SERVE_BIN 路径里可能含有 /，改用 # 分隔
sed -i "s#__SERVE_BIN__#${SERVE_BIN}#g"                   "${FRONTEND_UNIT}"
info "systemd Vue admin 单元已写入：${FRONTEND_UNIT}"

# ============================================================
next_step "安装 Nginx 站点（HTTP 阶段）"
# ============================================================
# 先安装 $connection_upgrade / $console_cache_control 等公共 map 片段
UPGRADE_MAP_DST="/etc/nginx/conf.d/ms8-upgrade-map.conf"
cp -f "${DEPLOY_DIR}/conf/nginx-upgrade-map.conf" "${UPGRADE_MAP_DST}"

NGINX_AVAIL="/etc/nginx/sites-available/${PORTAL_NAME}.conf"
NGINX_ENABL="/etc/nginx/sites-enabled/${PORTAL_NAME}.conf"

cp -f "${DEPLOY_DIR}/conf/nginx-http.conf" "${NGINX_AVAIL}"
sed -i "s|__DOMAIN__|${NGINX_SERVER_NAME}|g"                          "${NGINX_AVAIL}"
sed -i "s|__PORTAL_PORT__|${PORTAL_PORT}|g"                           "${NGINX_AVAIL}"
sed -i "s|__BACKEND_PORT__|${BACKEND_PORT}|g"                         "${NGINX_AVAIL}"
sed -i "s|__CONSOLE_PORT__|${CONSOLE_PORT}|g"                         "${NGINX_AVAIL}"
sed -i "s|__STATIC_ROOT__|${BACKEND_ROOT}/backend/staticfiles|g"      "${NGINX_AVAIL}"
sed -i "s|__MEDIA_ROOT__|${BACKEND_ROOT}/backend/media|g"             "${NGINX_AVAIL}"

ln -sf "${NGINX_AVAIL}" "${NGINX_ENABL}"
rm -f /etc/nginx/sites-enabled/default
nginx -t
info "Nginx 配置校验通过"

# ============================================================
next_step "设置目录权限并启动所有服务"
# ============================================================
chown -R "${RUN_USER}:${RUN_GROUP}" "${PORTAL_ROOT}"
chown -R "${RUN_USER}:${RUN_GROUP}" "${BACKEND_ROOT}"
chmod 750 "${PORTAL_ROOT}"
chmod 750 "${BACKEND_ROOT}"
chown "${RUN_USER}:${RUN_GROUP}" "${PORTAL_ENV_FILE}" "${BACKEND_ENV_FILE}" 2>/dev/null || true

systemctl daemon-reload
systemctl enable --now "${BACKEND_NAME}-backend.service"
systemctl enable --now "${BACKEND_NAME}-frontend.service"
systemctl enable --now "${PORTAL_NAME}.service"
systemctl reload nginx

sleep 3
if systemctl is-active --quiet "${BACKEND_NAME}-backend.service"; then
  info "Django 后端 ${BACKEND_NAME}-backend.service 运行正常"
else
  warn "Django 后端服务未正常启动，请查看：journalctl -u ${BACKEND_NAME}-backend.service -n 80 --no-pager"
fi
if systemctl is-active --quiet "${BACKEND_NAME}-frontend.service"; then
  info "Vue admin ${BACKEND_NAME}-frontend.service 运行正常"
else
  warn "Vue admin 服务未正常启动，请查看：journalctl -u ${BACKEND_NAME}-frontend.service -n 80 --no-pager"
fi
if systemctl is-active --quiet "${PORTAL_NAME}.service"; then
  info "门户 ${PORTAL_NAME}.service 运行正常"
else
  warn "门户服务未正常启动，请查看：journalctl -u ${PORTAL_NAME}.service -n 80 --no-pager"
fi

# ============================================================
next_step "配置 ufw 防火墙（仅放通 22/80/443）"
# ============================================================
if command -v ufw >/dev/null 2>&1; then
  ufw allow OpenSSH >/dev/null 2>&1 || true
  ufw allow 'Nginx Full' >/dev/null 2>&1 || true
  if ! ufw status | grep -q "Status: active"; then
    yes | ufw enable >/dev/null 2>&1 || warn "ufw 启用失败，可手动 'sudo ufw enable'"
  fi
  ufw status verbose 2>/dev/null | grep -E '^(22|80|443)' || true
fi

# ============================================================
if [[ ${ENABLE_SSL} -eq 1 ]]; then
  next_step "申请 Let's Encrypt 证书并启用 HTTPS"
  bash "${DEPLOY_DIR}/setup-ssl.sh" \
    --domain "${PRIMARY_DOMAIN}" $([[ ${ADD_WWW} -eq 1 ]] && echo "--www") \
    --email "${SSL_EMAIL}"
fi

# ============================================================
echo ""
echo "============================================================"
echo -e "${GREEN}  部署完成${NC}"
echo "============================================================"
echo ""
echo "  Next.js 门户:     ${PORTAL_ROOT}                      (127.0.0.1:${PORTAL_PORT})"
echo "  Django 后端:      ${BACKEND_ROOT}/backend            (127.0.0.1:${BACKEND_PORT})"
echo "  Vue admin SPA:    ${BACKEND_ROOT}/frontend/dist      (127.0.0.1:${CONSOLE_PORT}, /console/)"
echo "  门户环境配置:     ${PORTAL_ENV_FILE}"
echo "  后端环境配置:     ${BACKEND_ENV_FILE}"
echo "  Nginx 配置:       ${NGINX_AVAIL}"
echo "  systemd:"
echo "                    /etc/systemd/system/${PORTAL_NAME}.service"
echo "                    /etc/systemd/system/${BACKEND_NAME}-backend.service"
echo "                    /etc/systemd/system/${BACKEND_NAME}-frontend.service"
echo ""
echo "  超管账号:         ${DJANGO_SUPERUSER_USERNAME}"
echo "  超管初始密码:     ${DJANGO_SUPERUSER_PASSWORD}    ← 部署后请立即修改！"
echo ""

if [[ ${ENABLE_SSL} -eq 1 ]]; then
  PRINT_URL="https://${PRIMARY_DOMAIN}"
elif [[ -n "${PRIMARY_DOMAIN}" ]]; then
  PRINT_URL="http://${PRIMARY_DOMAIN}"
else
  PRINT_URL="http://${SERVER_IP}"
fi

echo "  访问地址："
echo "    门户首页 (Next.js):   ${PRINT_URL}/"
echo "    Vue 管理后台:         ${PRINT_URL}/console/"
echo "    Django Admin:         ${PRINT_URL}/admin/      （或 /django-admin/）"
echo "    REST API 入口:        ${PRINT_URL}/api/"
echo ""
echo "  常用运维命令："
echo "    sudo systemctl status  ${PORTAL_NAME}.service"
echo "    sudo systemctl status  ${BACKEND_NAME}-backend.service"
echo "    sudo systemctl status  ${BACKEND_NAME}-frontend.service"
echo "    sudo systemctl restart ${PORTAL_NAME}.service"
echo "    sudo systemctl restart ${BACKEND_NAME}-backend.service"
echo "    sudo systemctl restart ${BACKEND_NAME}-frontend.service"
echo "    sudo journalctl -u     ${PORTAL_NAME}.service -f"
echo "    sudo journalctl -u     ${BACKEND_NAME}-backend.service -f"
echo "    sudo journalctl -u     ${BACKEND_NAME}-frontend.service -f"
echo "    sudo nginx -t && sudo systemctl reload nginx"
echo ""
echo "  下次更新代码（已改源代码后）："
echo "    sudo bash deploy/update.sh"
echo ""
if [[ ${ENABLE_SSL} -ne 1 && -n "${PRIMARY_DOMAIN}" ]]; then
  echo "  当前是 HTTP 部署。等 DNS 解析到本机后启用 HTTPS:"
  echo "    sudo bash deploy/setup-ssl.sh --domain ${PRIMARY_DOMAIN} \\"
  echo "         $([[ ${ADD_WWW} -eq 1 ]] && echo "--www") --email <你的邮箱>"
  echo ""
fi
echo "============================================================"
