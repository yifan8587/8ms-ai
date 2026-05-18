#!/usr/bin/env bash
###############################################################################
#  8MS.AI 全栈站点 - 增量更新脚本
#
#  使用前提：已通过 install.sh 完成首次部署
#
#  典型流程：
#    1) 把更新后的 8ms_code / AIprogram 源代码同步到服务器（git pull / scp）
#    2) 在 8ms_code 源代码根目录执行：
#         sudo bash deploy/update.sh
#       可选参数：
#         --backend-src /path/to/AIprogram   显式指定后端源码位置
#         --skip-portal                       仅更新后端
#         --skip-backend                      仅更新前端门户
#
#  脚本只做这些事：
#    - rsync 同步前端门户 / 后端源码到 /opt/
#    - 安装/更新 Python 依赖、执行 migrate、collectstatic
#    - 重新构建 Vue 管理后台 + Next.js 门户
#    - 同步 deploy/conf/*.service（如果模板有变更）
#    - 重启服务、reload nginx、连通性自检
#
#  不会动 /etc/aiprogram/backend.env、/etc/8ms-portal/portal.env，
#  不会重新申请 SSL 证书。
###############################################################################
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

[[ "${EUID}" -eq 0 ]] || error "请使用 root 或 sudo 执行此脚本"

# ── 默认变量 ──
PORTAL_NAME="8ms-portal"
BACKEND_NAME="aiprogram"
PORTAL_ROOT="/opt/${PORTAL_NAME}"
BACKEND_ROOT="/opt/${BACKEND_NAME}"
PORTAL_PORT="3013"
BACKEND_PORT="8090"
CONSOLE_PORT="5173"
BACKEND_BIND="127.0.0.1:${BACKEND_PORT}"
RUN_USER="www-data"
RUN_GROUP="www-data"
PORTAL_ENV_FILE="/etc/${PORTAL_NAME}/portal.env"
BACKEND_ENV_FILE="/etc/${BACKEND_NAME}/backend.env"

BACKEND_SRC_OVERRIDE=""
SKIP_PORTAL=0
SKIP_BACKEND=0

# ── 解析参数 ──
while [[ $# -gt 0 ]]; do
  case "$1" in
    --backend-src)  BACKEND_SRC_OVERRIDE="$2"; shift 2 ;;
    --skip-portal)  SKIP_PORTAL=1; shift ;;
    --skip-backend) SKIP_BACKEND=1; shift ;;
    -h|--help)      sed -n '2,30p' "$0"; exit 0 ;;
    *)
      if [[ -z "${BACKEND_SRC_OVERRIDE}" && "$1" != -* && -d "$1" ]]; then
        BACKEND_SRC_OVERRIDE="$1"; shift
      else
        error "未知参数: $1"
      fi ;;
  esac
done

# ── 路径定位 ──
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORTAL_SRC="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEPLOY_DIR="${SCRIPT_DIR}"

[[ -f "${PORTAL_SRC}/package.json" ]] \
  || error "找不到 8ms_code 的 package.json（应在 8ms_code/deploy/ 下执行）"

# 自动探测后端源码
detect_backend_src() {
  if [[ -n "${BACKEND_SRC_OVERRIDE}" ]]; then
    [[ -d "${BACKEND_SRC_OVERRIDE}" ]] || error "--backend-src 指定的目录不存在"
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
  error "未找到 AIprogram 源码，请用 --backend-src 指定"
}

if [[ ${SKIP_BACKEND} -eq 0 ]]; then
  BACKEND_SRC="$(detect_backend_src)"
  BACKEND_SUBSRC="${BACKEND_SRC}/aiproject"
  FRONTEND_VUE_SRC="${BACKEND_SRC}/ai-frontend"
  [[ -d "${BACKEND_SUBSRC}" ]]   || error "找不到 Django 工程：${BACKEND_SUBSRC}"
  [[ -d "${FRONTEND_VUE_SRC}" ]] || error "找不到 Vue 管理后台：${FRONTEND_VUE_SRC}"
fi

# ── 必备检查 ──
[[ -d "${BACKEND_ROOT}/venv" ]] || error "未找到 ${BACKEND_ROOT}/venv，请先执行 install.sh"
[[ -f "${BACKEND_ENV_FILE}" ]]  || error "未找到 ${BACKEND_ENV_FILE}，请先执行 install.sh"
[[ -f "${PORTAL_ENV_FILE}" ]]   || error "未找到 ${PORTAL_ENV_FILE}，请先执行 install.sh"

info "门户源代码:     ${PORTAL_SRC}"
[[ ${SKIP_BACKEND} -eq 0 ]] && info "后端源代码:     ${BACKEND_SRC}"
info "门户运行目录:   ${PORTAL_ROOT}"
info "后端运行目录:   ${BACKEND_ROOT}"

# ============================================================
if [[ ${SKIP_BACKEND} -eq 0 ]]; then
info "[1/8] rsync 同步后端 Django 源码"
# ============================================================
rsync -a --delete \
  --exclude '__pycache__' --exclude '*.pyc' --exclude '.git' \
  --exclude 'logs' --exclude 'staticfiles' --exclude 'media' \
  "${BACKEND_SUBSRC}/" "${BACKEND_ROOT}/backend/"

info "[2/8] rsync 同步 Vue 管理后台源码"
rsync -a --delete \
  --exclude 'node_modules' --exclude '.git' --exclude 'dist' \
  "${FRONTEND_VUE_SRC}/" "${BACKEND_ROOT}/frontend/"

info "[3/8] 同步 requirements.txt 并安装依赖"
cp -f "${BACKEND_SRC}/requirements.txt" "${BACKEND_ROOT}/requirements.txt"
"${BACKEND_ROOT}/venv/bin/pip" install --upgrade pip wheel -q
"${BACKEND_ROOT}/venv/bin/pip" install -r "${BACKEND_ROOT}/requirements.txt" -q

# 加载后端环境变量
sed -i 's/\r$//' "${BACKEND_ENV_FILE}"
set -a
# shellcheck source=/dev/null
source "${BACKEND_ENV_FILE}"
set +a
export DJANGO_SETTINGS_MODULE=aiproject.settings_production

info "[4/8] migrate + collectstatic"
cd "${BACKEND_ROOT}/backend"
mkdir -p logs media staticfiles
"${BACKEND_ROOT}/venv/bin/python" manage.py migrate --noinput
"${BACKEND_ROOT}/venv/bin/python" manage.py collectstatic --noinput --clear >/dev/null 2>&1

info "[5/8] 重新构建 Vue 管理后台 (base=/console/)"
cd "${BACKEND_ROOT}/frontend"
if [[ -f package-lock.json ]]; then
  npm ci --no-audit --no-fund --silent || npm install --no-audit --no-fund --silent
else
  npm install --no-audit --no-fund --silent
fi
export VITE_BASE_PATH="/console/"
npm run build -- --base=/console/ 2>&1 | tail -3
unset VITE_BASE_PATH
[[ -f "${BACKEND_ROOT}/frontend/dist/index.html" ]] || error "Vue 管理后台构建失败"

# dist/index.html 必须带 /console/ 前缀，否则 nginx 找不到静态资源
if ! grep -q '/console/assets/' "${BACKEND_ROOT}/frontend/dist/index.html"; then
  error "dist/index.html 没有 /console/ 前缀，构建产物有问题（请检查 vite 是否正确接受 --base）"
fi
fi

# ============================================================
if [[ ${SKIP_PORTAL} -eq 0 ]]; then
info "[6/8] rsync 同步 Next.js 门户源码"
# ============================================================
rsync -a --delete \
  --exclude '.git' --exclude 'node_modules' \
  --exclude '.next' --exclude 'out' \
  --exclude 'logs' --exclude '*.log' \
  --exclude '.idea' --exclude '.vscode' \
  --exclude '.env' --exclude '.env.local' \
  "${PORTAL_SRC}/" "${PORTAL_ROOT}/"
mkdir -p "${PORTAL_ROOT}/logs"

info "[7/8] 安装依赖并构建 Next.js 门户"
cd "${PORTAL_ROOT}"
if [[ -f package-lock.json ]]; then
  npm ci --no-audit --no-fund --silent || npm install --no-audit --no-fund --silent
else
  npm install --no-audit --no-fund --silent
fi
export BACKEND_API_BASE_URL="http://127.0.0.1:${BACKEND_PORT}/api"
export NEXT_TELEMETRY_DISABLED=1

# 把 portal.env 里的 NEXT_PUBLIC_* 注入构建期，否则不会被内联到客户端 bundle
sed -i 's/\r$//' "${PORTAL_ENV_FILE}" 2>/dev/null || true
set -a
# shellcheck source=/dev/null
source "${PORTAL_ENV_FILE}" 2>/dev/null || true
set +a

npm run build 2>&1 | tail -10
[[ -d "${PORTAL_ROOT}/.next" ]] || error "Next.js 构建失败"
fi

# ============================================================
info "[8/8] 同步 systemd 单元、权限与重启服务"
# ============================================================

sync_unit() {
  local tmpl="$1" dst="$2" sed_args=("${@:3}")
  [[ -f "${tmpl}" ]] || return 0
  local tmp; tmp="$(mktemp)"
  cp -f "${tmpl}" "${tmp}"
  for ((i=0; i<${#sed_args[@]}; i+=2)); do
    sed -i "s|${sed_args[i]}|${sed_args[i+1]}|g" "${tmp}"
  done
  if [[ ! -f "${dst}" ]] || ! cmp -s "${tmp}" "${dst}"; then
    cp -f "${tmp}" "${dst}"
    info "  systemd 单元已更新：${dst}"
    systemctl daemon-reload
  fi
  rm -f "${tmp}"
}

sync_unit "${DEPLOY_DIR}/conf/aiprogram-backend.service" \
          "/etc/systemd/system/${BACKEND_NAME}-backend.service" \
          "__BACKEND_ROOT__" "${BACKEND_ROOT}" \
          "__RUN_USER__"     "${RUN_USER}" \
          "__RUN_GROUP__"    "${RUN_GROUP}" \
          "__BACKEND_BIND__" "${BACKEND_BIND}"

# 确保 serve 已经安装（首版 install.sh 会装；老环境升级到本版本时需要补装）
SERVE_BIN="$(command -v serve || true)"
if [[ -z "${SERVE_BIN}" ]]; then
  info "首次升级到 5173 模式：安装 serve（用于 ai-frontend SPA）..."
  npm install -g serve@14 --silent --no-audit --no-fund >/dev/null 2>&1 \
    || npm install -g serve --silent --no-audit --no-fund >/dev/null 2>&1
  SERVE_BIN="$(command -v serve || true)"
  [[ -n "${SERVE_BIN}" ]] || error "serve 安装失败，请手动执行：sudo npm install -g serve"
fi

sync_unit "${DEPLOY_DIR}/conf/aiprogram-frontend.service" \
          "/etc/systemd/system/${BACKEND_NAME}-frontend.service" \
          "__BACKEND_ROOT__"  "${BACKEND_ROOT}" \
          "__RUN_USER__"      "${RUN_USER}" \
          "__RUN_GROUP__"     "${RUN_GROUP}" \
          "__CONSOLE_DIST__"  "${BACKEND_ROOT}/frontend/dist" \
          "__CONSOLE_PORT__"  "${CONSOLE_PORT}" \
          "__SERVE_BIN__"     "${SERVE_BIN}"

sync_unit "${DEPLOY_DIR}/conf/8ms-portal.service" \
          "/etc/systemd/system/${PORTAL_NAME}.service" \
          "__PORTAL_ROOT__"  "${PORTAL_ROOT}" \
          "__PORTAL_PORT__"  "${PORTAL_PORT}" \
          "__RUN_USER__"     "${RUN_USER}" \
          "__RUN_GROUP__"    "${RUN_GROUP}"

# 老环境如果 nginx 站点用的还是旧 alias 模板（没有 __CONSOLE_PORT__），
# 本次升级要把站点配置一并刷新，否则 /console/ 还是去拿 dist 静态文件
NGINX_CONF="/etc/nginx/sites-available/${PORTAL_NAME}.conf"
if [[ -f "${NGINX_CONF}" ]] && ! grep -q "ms8_console_upstream" "${NGINX_CONF}"; then
  warn "检测到老版 nginx 模板（缺少 ms8_console_upstream），刷新站点配置..."
  if grep -q "^[[:space:]]*listen[[:space:]]\+443[[:space:]]\+ssl" "${NGINX_CONF}"; then
    PRIMARY_DOMAIN="$(awk '/ssl_certificate /{ match($0,/live\/[^/]+/); if(RSTART) print substr($0,RSTART+5,RLENGTH-5); exit }' "${NGINX_CONF}")"
    DOMAIN_LINE="$(awk '/^[[:space:]]*server_name[[:space:]]/{ sub(/^[[:space:]]*server_name[[:space:]]*/,""); sub(/;.*/,""); print; exit }' "${NGINX_CONF}")"
    cp -f "${DEPLOY_DIR}/conf/nginx-https.conf" "${NGINX_CONF}"
    sed -i "s|__DOMAIN__|${DOMAIN_LINE:-_}|g"                          "${NGINX_CONF}"
    sed -i "s|__PRIMARY_DOMAIN__|${PRIMARY_DOMAIN:-localhost}|g"       "${NGINX_CONF}"
  else
    DOMAIN_LINE="$(awk '/^[[:space:]]*server_name[[:space:]]/{ sub(/^[[:space:]]*server_name[[:space:]]*/,""); sub(/;.*/,""); print; exit }' "${NGINX_CONF}")"
    cp -f "${DEPLOY_DIR}/conf/nginx-http.conf" "${NGINX_CONF}"
    sed -i "s|__DOMAIN__|${DOMAIN_LINE:-_}|g"                          "${NGINX_CONF}"
  fi
  sed -i "s|__PORTAL_PORT__|${PORTAL_PORT}|g"                          "${NGINX_CONF}"
  sed -i "s|__BACKEND_PORT__|${BACKEND_PORT}|g"                        "${NGINX_CONF}"
  sed -i "s|__CONSOLE_PORT__|${CONSOLE_PORT}|g"                        "${NGINX_CONF}"
  sed -i "s|__STATIC_ROOT__|${BACKEND_ROOT}/backend/staticfiles|g"     "${NGINX_CONF}"
  sed -i "s|__MEDIA_ROOT__|${BACKEND_ROOT}/backend/media|g"            "${NGINX_CONF}"
fi

# 同步 nginx 公共片段（map 指令）
if [[ -f "${DEPLOY_DIR}/conf/nginx-upgrade-map.conf" ]]; then
  cp -f "${DEPLOY_DIR}/conf/nginx-upgrade-map.conf" /etc/nginx/conf.d/ms8-upgrade-map.conf
fi

# 权限刷新
chown -R "${RUN_USER}:${RUN_GROUP}" "${PORTAL_ROOT}" "${BACKEND_ROOT}"

# 重启服务（按依赖顺序）
if [[ ${SKIP_BACKEND} -eq 0 ]]; then
  systemctl restart "${BACKEND_NAME}-backend.service"
  # ai-frontend 也属于后端管理项目（dist 由 update 重建），跟着一起重启
  systemctl enable --now "${BACKEND_NAME}-frontend.service" >/dev/null 2>&1 || true
  systemctl restart "${BACKEND_NAME}-frontend.service"
fi
if [[ ${SKIP_PORTAL} -eq 0 ]]; then
  systemctl restart "${PORTAL_NAME}.service"
fi
nginx -t >/dev/null 2>&1 && systemctl reload nginx || warn "nginx 配置有误，未 reload"

sleep 3
for svc in \
    "${BACKEND_NAME}-backend.service" \
    "${BACKEND_NAME}-frontend.service" \
    "${PORTAL_NAME}.service"; do
  if systemctl list-unit-files 2>/dev/null | grep -q "^${svc}"; then
    if systemctl is-active --quiet "${svc}"; then
      info "  ${svc} 运行正常"
    else
      warn "  ${svc} 异常，请查看：journalctl -u ${svc} -n 60"
    fi
  fi
done

# ── 简单连通性自检 ──
NGINX_CONF="/etc/nginx/sites-available/${PORTAL_NAME}.conf"
HOST="$(grep -E '^\s*server_name\s+' "${NGINX_CONF}" 2>/dev/null \
       | head -1 | sed 's/.*server_name\s*//;s/;.*//' | awk '{print $1}')"
[[ -z "${HOST}" || "${HOST}" == "_" ]] && HOST="$(hostname -I | awk '{print $1}')"

check_http() {
  local url="$1" code
  code=$(curl -sS -o /dev/null -m 8 -w "%{http_code}" -H "Host: ${HOST}" "${url}" || echo "000")
  if [[ "${code}" == "000" || "${code}" =~ ^5 ]]; then
    warn "  ${url} (Host: ${HOST}) => HTTP ${code}"
  else
    info "  ${url} (Host: ${HOST}) => HTTP ${code}"
  fi
}
check_http "http://127.0.0.1/"
check_http "http://127.0.0.1/api/users/login/"
check_http "http://127.0.0.1/admin/"
check_http "http://127.0.0.1/console/"

echo ""
echo "============================================================"
echo -e "${GREEN}  生产环境已更新完毕${NC}"
echo "============================================================"
echo "  前端门户:     ${PORTAL_NAME}.service @ ${PORTAL_ROOT}                    (127.0.0.1:${PORTAL_PORT})"
echo "  Django 后端:  ${BACKEND_NAME}-backend.service @ ${BACKEND_ROOT}/backend     (127.0.0.1:${BACKEND_PORT})"
echo "  Vue admin:    ${BACKEND_NAME}-frontend.service @ ${BACKEND_ROOT}/frontend  (127.0.0.1:${CONSOLE_PORT}, /console/)"
echo "  Nginx 站点:   /etc/nginx/sites-available/${PORTAL_NAME}.conf"
echo "============================================================"
