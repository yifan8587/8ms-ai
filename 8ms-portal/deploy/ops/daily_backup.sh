#!/usr/bin/env bash
set -Eeuo pipefail

# 每日压缩备份：
# 1) 备份 MySQL(aiproject) 为 sql.gz
# 2) 打包两个项目目录为 tar.gz
# 3) 保留最近 N 天备份

BACKUP_ROOT="${BACKUP_ROOT:-/opt/backups/8ms}"
DATE_TAG="$(date +%F)"
TIME_TAG="$(date +%H%M%S)"
DEST_DIR="${BACKUP_ROOT}/daily/${DATE_TAG}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

PORTAL_DIR="${PORTAL_DIR:-/opt/8ms-portal}"
AIPROGRAM_DIR="${AIPROGRAM_DIR:-/opt/aiprogram}"
BACKEND_ENV="${BACKEND_ENV:-/etc/aiprogram/backend.env}"

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

main() {
  require_cmd tar
  require_cmd gzip
  require_cmd mysqldump
  require_cmd find

  load_backend_env
  mkdir -p "$DEST_DIR"

  local db_file="${DEST_DIR}/db-${DB_NAME}-${TIME_TAG}.sql.gz"
  local portal_file="${DEST_DIR}/8ms-portal-${TIME_TAG}.tar.gz"
  local ai_file="${DEST_DIR}/aiprogram-${TIME_TAG}.tar.gz"
  local manifest="${DEST_DIR}/manifest-${TIME_TAG}.txt"

  log "开始导出数据库: ${DB_NAME}"
  MYSQL_PWD="$DB_PASSWORD" mysqldump \
    -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" \
    --single-transaction --routines --events --triggers \
    "$DB_NAME" | gzip -9 > "$db_file"

  log "开始打包项目目录"
  tar --exclude=".next/cache" --exclude="node_modules" --exclude="venv" \
    -czf "$portal_file" -C "/" "${PORTAL_DIR#/}"
  tar --exclude="frontend/node_modules" --exclude="frontend/dist" --exclude="venv" \
    -czf "$ai_file" -C "/" "${AIPROGRAM_DIR#/}"

  {
    echo "date=${DATE_TAG}"
    echo "time=${TIME_TAG}"
    echo "db_file=${db_file}"
    echo "portal_file=${portal_file}"
    echo "aiprogram_file=${ai_file}"
    echo "db_host=${DB_HOST}"
    echo "db_port=${DB_PORT}"
    echo "db_name=${DB_NAME}"
  } > "$manifest"

  log "清理 ${RETENTION_DAYS} 天前备份"
  find "${BACKUP_ROOT}/daily" -mindepth 1 -maxdepth 1 -type d -mtime "+${RETENTION_DAYS}" -exec rm -rf {} +

  log "备份完成: ${DEST_DIR}"
}

main "$@"
