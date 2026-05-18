#!/usr/bin/env bash
###############################################################################
#  8MS.AI 全栈站点 - 发布包打包脚本
#
#  把 8ms_code 与 AIprogram 两个仓库一起打包成 .tar.gz，方便上传到
#  Ubuntu 24.04 服务器后直接运行 install.sh / update.sh。
#
#  用法：
#    bash deploy/package.sh                                   # 默认输出到 ./release/
#    bash deploy/package.sh --out /tmp/release                # 指定输出目录
#    bash deploy/package.sh --backend-src /path/to/AIprogram  # 显式指定后端源码
#
#  打包后的目录结构：
#    8ms-release-YYYYMMDD-HHMMSS/
#    ├── 8ms_code/        # 前端门户源码
#    ├── AIprogram/       # 后端管理源码
#    └── deploy -> 8ms_code/deploy   （软链或拷贝，便于 install.sh 调用）
###############################################################################
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ── 默认变量 ──
PORTAL_SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${PORTAL_SRC}/release"
BACKEND_SRC_OVERRIDE=""

# ── 解析参数 ──
while [[ $# -gt 0 ]]; do
  case "$1" in
    --out)         OUT_DIR="$2"; shift 2 ;;
    --backend-src) BACKEND_SRC_OVERRIDE="$2"; shift 2 ;;
    -h|--help)     sed -n '2,18p' "$0"; exit 0 ;;
    *)
      if [[ -z "${OUT_DIR_CUSTOM:-}" && "$1" != -* && ! -e "${OUT_DIR}" ]]; then
        OUT_DIR="$1"; shift
      else
        error "未知参数: $1"
      fi ;;
  esac
done

# ── 自动探测后端源码 ──
detect_backend_src() {
  if [[ -n "${BACKEND_SRC_OVERRIDE}" ]]; then
    [[ -d "${BACKEND_SRC_OVERRIDE}" ]] || error "--backend-src 指定的目录不存在"
    cd "${BACKEND_SRC_OVERRIDE}" && pwd; return
  fi
  for d in "${PORTAL_SRC}/../AIprogram" "${PORTAL_SRC}/../aiprogram" \
           "/root/AIprogram" "/opt/aiprogram-source"; do
    if [[ -d "${d}/aiproject" && -f "${d}/requirements.txt" ]]; then
      cd "${d}" && pwd; return
    fi
  done
  error "未找到 AIprogram 源码，请用 --backend-src 指定"
}
BACKEND_SRC="$(detect_backend_src)"

TS="$(date +%Y%m%d-%H%M%S)"
PKG_NAME="8ms-release-${TS}"
PKG_DIR="${OUT_DIR}/${PKG_NAME}"
PKG_FILE="${OUT_DIR}/${PKG_NAME}.tar.gz"

info "门户源码:   ${PORTAL_SRC}"
info "后端源码:   ${BACKEND_SRC}"
info "输出目录:   ${OUT_DIR}"

echo "[1/4] 创建输出目录..."
mkdir -p "${PKG_DIR}/8ms_code" "${PKG_DIR}/AIprogram"

echo "[2/4] rsync 同步前端门户（排除 node_modules / .next 等）..."
rsync -a \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude 'out' \
  --exclude 'release' \
  --exclude 'logs' \
  --exclude '.env' \
  --exclude '.env.local' \
  --exclude '.idea' \
  --exclude '.vscode' \
  --exclude '*.log' \
  --exclude 'tsconfig.tsbuildinfo' \
  "${PORTAL_SRC}/" "${PKG_DIR}/8ms_code/"

echo "[3/4] rsync 同步后端 AIprogram（排除 venv / dist / __pycache__ 等）..."
rsync -a \
  --exclude '.git' \
  --exclude 'venv' \
  --exclude 'release' \
  --exclude 'ai-frontend/node_modules' \
  --exclude 'ai-frontend/dist' \
  --exclude '__pycache__' \
  --exclude '*.pyc' \
  --exclude '.env' \
  --exclude 'aiproject/staticfiles' \
  --exclude 'aiproject/media' \
  --exclude 'aiproject/logs' \
  --exclude '.cursor' \
  --exclude '.idea' \
  --exclude '.vscode' \
  "${BACKEND_SRC}/" "${PKG_DIR}/AIprogram/"

# 在包顶层放一个软链 deploy/，让 sudo bash deploy/install.sh 能直接跑
ln -sf 8ms_code/deploy "${PKG_DIR}/deploy"

echo "[4/4] 压缩 tar.gz..."
tar -C "${OUT_DIR}" -czf "${PKG_FILE}" "${PKG_NAME}"
rm -rf "${PKG_DIR}"

SIZE="$(du -sh "${PKG_FILE}" | cut -f1)"
echo ""
echo "============================================================"
echo "  打包完成"
echo "============================================================"
echo "  输出文件:  ${PKG_FILE}"
echo "  大小:      ${SIZE}"
echo ""
echo "  上传到 Ubuntu 24.04 服务器后："
echo "    scp ${PKG_FILE} root@<server>:/opt/"
echo "    ssh root@<server>"
echo "    cd /opt && tar -xzf ${PKG_NAME}.tar.gz"
echo "    cd ${PKG_NAME}"
echo ""
echo "  ── 一键全新部署（HTTPS, 域名 8ms.ai） ──"
echo "    sudo bash deploy/install.sh \\"
echo "      --domain 8ms.ai --www \\"
echo "      --ssl --email admin@8ms.ai"
echo ""
echo "  ── 已有旧版本，仅更新代码 ──"
echo "    sudo bash deploy/update.sh"
echo ""
echo "============================================================"
