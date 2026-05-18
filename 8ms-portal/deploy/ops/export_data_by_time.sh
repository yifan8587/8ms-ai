#!/usr/bin/env bash
set -Eeuo pipefail

# 按时间范围导出 MySQL Binlog（增量数据导出）
# 示例:
#   bash export_data_by_time.sh --start "2026-05-10 00:00:00" --stop "2026-05-10 23:59:59"

BACKUP_ROOT="${BACKUP_ROOT:-/opt/backups/8ms}"
EXPORT_DIR="${BACKUP_ROOT}/exports"
BACKEND_ENV="${BACKEND_ENV:-/etc/aiprogram/backend.env}"

START_TIME=""
STOP_TIME=""
OUT_FILE=""

usage() {
  cat <<'EOF'
用法:
  bash export_data_by_time.sh --start "YYYY-MM-DD HH:MM:SS" --stop "YYYY-MM-DD HH:MM:SS" [--out /path/file.sql.gz]

说明:
  - 导出内容基于 MySQL Binlog，适合按时间追溯增量变更
  - 需要 MySQL 开启 log_bin，否则无法按时间导出
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
  DB_USER="${DB_USER:-root}"
  DB_PASSWORD="${DB_PASSWORD:-}"
  DB_HOST="${DB_HOST:-127.0.0.1}"
  DB_PORT="${DB_PORT:-3306}"
}

collect_binlogs() {
  local tmp_file
  tmp_file="$(mktemp)"
  MYSQL_PWD="$DB_PASSWORD" mysql \
    -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" \
    -Nse "SHOW BINARY LOGS;" > "$tmp_file"

  if [[ ! -s "$tmp_file" ]]; then
    rm -f "$tmp_file"
    echo "未检测到 Binlog（可能未开启 log_bin）" >&2
    exit 1
  fi

  local logs=()
  while read -r log_name _size; do
    [[ -n "$log_name" ]] && logs+=("$log_name")
  done < "$tmp_file"
  rm -f "$tmp_file"

  if [[ ${#logs[@]} -eq 0 ]]; then
    echo "Binlog 列表为空" >&2
    exit 1
  fi

  printf '%s\n' "${logs[@]}"
}

main() {
  require_cmd mysql
  require_cmd mysqlbinlog
  require_cmd gzip
  require_cmd date

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --start)
        START_TIME="${2:-}"
        shift 2
        ;;
      --stop)
        STOP_TIME="${2:-}"
        shift 2
        ;;
      --out)
        OUT_FILE="${2:-}"
        shift 2
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

  [[ -n "$START_TIME" ]] || { echo "--start 必填" >&2; exit 1; }
  [[ -n "$STOP_TIME" ]] || { echo "--stop 必填" >&2; exit 1; }

  date -d "$START_TIME" '+%F %T' >/dev/null
  date -d "$STOP_TIME" '+%F %T' >/dev/null

  load_backend_env
  mkdir -p "$EXPORT_DIR"

  if [[ -z "$OUT_FILE" ]]; then
    local start_tag stop_tag
    start_tag="$(date -d "$START_TIME" +%Y%m%d-%H%M%S)"
    stop_tag="$(date -d "$STOP_TIME" +%Y%m%d-%H%M%S)"
    OUT_FILE="${EXPORT_DIR}/mysql-binlog-${start_tag}-to-${stop_tag}.sql.gz"
  fi

  mapfile -t binlogs < <(collect_binlogs)

  log "开始导出时间段数据: ${START_TIME} ~ ${STOP_TIME}"
  mysqlbinlog \
    --read-from-remote-server \
    --host="$DB_HOST" --port="$DB_PORT" \
    --user="$DB_USER" --password="$DB_PASSWORD" \
    --start-datetime="$START_TIME" \
    --stop-datetime="$STOP_TIME" \
    "${binlogs[@]}" | gzip -9 > "$OUT_FILE"

  log "导出完成: ${OUT_FILE}"
}

main "$@"
