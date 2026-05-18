#!/usr/bin/env bash
set -Eeuo pipefail

# 一键恢复到初始状态（基线快照）：
# 1) --init-baseline: 把当前项目+数据库保存为 initial baseline
# 2) 默认执行恢复: 停服务 -> 还原目录 -> 导入数据库 -> 启服务

BACKUP_ROOT="${BACKUP_ROOT:-/opt/backups/8ms}"
BASELINE_DIR="${BACKUP_ROOT}/baseline"
PORTAL_DIR="${PORTAL_DIR:-/opt/8ms-portal}"
AIPROGRAM_DIR="${AIPROGRAM_DIR:-/opt/aiprogram}"
BACKEND_ENV="${BACKEND_ENV:-/etc/aiprogram/backend.env}"

PORTAL_SERVICE="${PORTAL_SERVICE:-8ms-portal.service}"
BACKEND_SERVICE="${BACKEND_SERVICE:-aiprogram-backend.service}"
FRONTEND_SERVICE="${FRONTEND_SERVICE:-aiprogram-frontend.service}"

INIT_BASELINE="0"
YES="0"

usage() {
  cat <<'EOF'
用法:
  bash restore_initial_state.sh --init-baseline [-y]
  bash restore_initial_state.sh [-y]

说明:
  --init-baseline   生成初始基线快照（当前状态作为初始状态）
  -y                跳过交互确认
EOF
}

log() {
  echo "[$(date '+%F %T')] $*"
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "缺少命令: $1" >&2
    exit 1
  }
}

load_backend_env() {
  if [[ -f "$BACKEND_ENV" ]]; then
    # shellcheck disable=SC1090
    set -a && source "$BACKEND_ENV" && set +a
  fi
  DB_NAME="${DB_NAME:-aiproject}"
  DB_USER="${DB_USER:-root}"
  DB_PASSWORD="${DB_PASSWORD:-}"
  DB_HOST="${DB_HOST:-127.0.0.1}"
  DB_PORT="${DB_PORT:-3306}"
}

stop_services() {
  systemctl stop "$PORTAL_SERVICE" || true
  systemctl stop "$BACKEND_SERVICE" || true
  systemctl stop "$FRONTEND_SERVICE" || true
}

start_services() {
  systemctl start "$BACKEND_SERVICE" || true
  systemctl start "$FRONTEND_SERVICE" || true
  systemctl start "$PORTAL_SERVICE" || true
}

init_baseline() {
  load_backend_env
  mkdir -p "$BASELINE_DIR"
  local ts
  ts="$(date +%F-%H%M%S)"

  local db_file="${BASELINE_DIR}/initial-db.sql.gz"
  local portal_file="${BASELINE_DIR}/initial-8ms-portal.tar.gz"
  local ai_file="${BASELINE_DIR}/initial-aiprogram.tar.gz"
  local meta_file="${BASELINE_DIR}/initial-meta.txt"

  log "导出初始数据库快照"
  MYSQL_PWD="$DB_PASSWORD" mysqldump \
    -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" \
    --single-transaction --routines --events --triggers \
    "$DB_NAME" | gzip -9 > "$db_file"

  log "打包初始项目目录"
  tar --exclude=".next/cache" --exclude="node_modules" --exclude="venv" \
    -czf "$portal_file" -C "/" "${PORTAL_DIR#/}"
  tar --exclude="frontend/node_modules" --exclude="frontend/dist" --exclude="venv" \
    -czf "$ai_file" -C "/" "${AIPROGRAM_DIR#/}"

  {
    echo "created_at=${ts}"
    echo "db_name=${DB_NAME}"
    echo "db_host=${DB_HOST}"
    echo "db_port=${DB_PORT}"
    echo "portal_dir=${PORTAL_DIR}"
    echo "aiprogram_dir=${AIPROGRAM_DIR}"
  } > "$meta_file"

  log "初始基线已生成: ${BASELINE_DIR}"
}

restore_from_baseline() {
  load_backend_env
  local db_file="${BASELINE_DIR}/initial-db.sql.gz"
  local portal_file="${BASELINE_DIR}/initial-8ms-portal.tar.gz"
  local ai_file="${BASELINE_DIR}/initial-aiprogram.tar.gz"

  [[ -f "$db_file" ]] || { echo "未找到基线数据库文件: $db_file" >&2; exit 1; }
  [[ -f "$portal_file" ]] || { echo "未找到基线项目文件: $portal_file" >&2; exit 1; }
  [[ -f "$ai_file" ]] || { echo "未找到基线项目文件: $ai_file" >&2; exit 1; }

  if [[ "$YES" != "1" ]]; then
    read -r -p "将覆盖当前项目目录和数据库，确认继续? [y/N] " ans
    [[ "$ans" =~ ^[Yy]$ ]] || { echo "已取消"; exit 0; }
  fi

  log "停止服务"
  stop_services

  log "恢复项目目录"
  rm -rf "$PORTAL_DIR" "$AIPROGRAM_DIR"
  tar -xzf "$portal_file" -C "/"
  tar -xzf "$ai_file" -C "/"

  log "恢复数据库 ${DB_NAME}"
  MYSQL_PWD="$DB_PASSWORD" mysql \
    -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" \
    -e "DROP DATABASE IF EXISTS \`${DB_NAME}\`; CREATE DATABASE \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
  gzip -dc "$db_file" | MYSQL_PWD="$DB_PASSWORD" mysql \
    -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" "$DB_NAME"

  log "启动服务"
  start_services
  log "恢复完成"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --init-baseline)
      INIT_BASELINE="1"
      shift
      ;;
    -y)
      YES="1"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "未知参数: $1" >&2
      usage
      exit 1
      ;;
  esac
done

require_cmd tar
require_cmd gzip
require_cmd mysql
require_cmd mysqldump
require_cmd systemctl

if [[ "$INIT_BASELINE" == "1" ]]; then
  init_baseline
else
  restore_from_baseline
fi
