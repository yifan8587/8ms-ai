# Ubuntu 24.04 LTS 全栈部署详解

本文是 [`README.md`](./README.md) 的补充，详细说明每一步背后做了什么、
出错时如何定位，以及如何手工逐步部署（不依赖一键脚本）。

---

## 0. 名词约定

| 别名 | 路径 / 端口 | 说明 |
| --- | --- | --- |
| 门户 (Portal)          | `/opt/8ms-portal`   监听 `127.0.0.1:3013` | Next.js 16 服务端 |
| 后端 (Backend)         | `/opt/aiprogram/backend` 监听 `127.0.0.1:8090` | Django + Gunicorn |
| 管理后台 (Console)     | `/opt/aiprogram/frontend/dist` 监听 `127.0.0.1:5173` | Vue 3 SPA，由 `serve -s dist -l 5173` 提供，nginx 代理 `/console/` |
| Portal env             | `/etc/8ms-portal/portal.env`               | Next.js 运行时变量（含 `NEXT_PUBLIC_POST_LOGIN_REDIRECT`） |
| Backend env            | `/etc/aiprogram/backend.env`               | Django + DB 变量 |
| systemd unit (portal)  | `/etc/systemd/system/8ms-portal.service`   | `node next/dist/bin/next start -p 3013` |
| systemd unit (backend) | `/etc/systemd/system/aiprogram-backend.service` | `venv/bin/gunicorn ... :8090` |
| systemd unit (frontend)| `/etc/systemd/system/aiprogram-frontend.service` | `serve -s dist -l 5173` |
| Nginx site             | `/etc/nginx/sites-available/8ms-portal.conf` | 统一站点 |

---

## 1. 准备一台干净的 Ubuntu 24.04 服务器

最低要求：**2 vCPU + 4G 内存 + 20G 磁盘**。Next.js 16 build 期对内存敏感，
低于 2G 容易 OOM；遇到时可以临时挂 swap：

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

打开必需端口：

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## 2. 一键部署的内部步骤拆解

`install.sh` 全程 15（带 `--ssl` 时 16）步，下面对每步做的事和对应排错命令做说明：

### 2.1 安装系统依赖

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg build-essential pkg-config \
  python3 python3-venv python3-dev python3-pip default-libmysqlclient-dev \
  mysql-server nginx rsync git tar ufw cron openssl
# Node 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt install -y nodejs
# Vue 管理后台 SPA 服务器
sudo npm install -g serve@14
# 申请证书时还会装：
sudo apt install -y certbot python3-certbot-nginx
```

排错：

- `apt` 卡住：检查 `/etc/apt/sources.list` 是否被云厂商镜像污染。
- Node 22 装失败：手动 `curl https://deb.nodesource.com/setup_22.x | bash -`
  看具体错误。

### 2.2 创建运行目录

```
/opt/8ms-portal/                # Next.js 工程
  ├── .next/
  ├── public/
  ├── package.json
  └── logs/
/opt/aiprogram/
  ├── backend/                  # Django 工程
  ├── frontend/                 # Vue 3 工程（构建后 dist/）
  ├── venv/
  └── logs/
/var/www/certbot/               # Let's Encrypt webroot
```

### 2.3 同步源代码（rsync）

```bash
# 8ms_code → /opt/8ms-portal
rsync -a --delete \
  --exclude '.git' --exclude 'node_modules' --exclude '.next' --exclude '.env*' \
  ./8ms_code/ /opt/8ms-portal/

# AIprogram/aiproject → /opt/aiprogram/backend
rsync -a --delete \
  --exclude '__pycache__' --exclude '*.pyc' --exclude 'logs' \
  --exclude 'staticfiles' --exclude 'media' \
  ./AIprogram/aiproject/ /opt/aiprogram/backend/

# AIprogram/ai-frontend → /opt/aiprogram/frontend
rsync -a --delete \
  --exclude 'node_modules' --exclude 'dist' \
  ./AIprogram/ai-frontend/ /opt/aiprogram/frontend/
```

### 2.4 Python 虚拟环境与依赖

```bash
python3 -m venv /opt/aiprogram/venv
/opt/aiprogram/venv/bin/pip install --upgrade pip wheel setuptools
/opt/aiprogram/venv/bin/pip install -r /opt/aiprogram/requirements.txt
```

排错：

- `mysqlclient` 编译失败：缺 `default-libmysqlclient-dev` / `build-essential`。
- `Django==6.x` 安装报错：确认 Python ≥ 3.10。

### 2.5 后端环境配置 `/etc/aiprogram/backend.env`

首次创建会自动生成：

- `DJANGO_SECRET_KEY`：32 字节随机
- `DB_PASSWORD` / `APP_DB_PASSWORD`：`Ai<rand-hex8>!` 格式
- `DJANGO_ALLOWED_HOSTS`：自动追加服务器 IP + 输入域名
- `CSRF_TRUSTED_ORIGINS`：自动追加 `http://`/`https://` 前缀的来源
- `CSRF_COOKIE_SECURE` / `SESSION_COOKIE_SECURE`：`--ssl` 时设为 1，否则 0

二次执行：保留原有内容，仅追加缺失的来源。

### 2.6 前端门户环境配置 `/etc/8ms-portal/portal.env`

```
NODE_ENV=production
PORT=3013
BACKEND_API_BASE_URL=http://127.0.0.1:8090/api
NEXT_PUBLIC_SITE_URL=https://www.8ms.ai
NEXT_PUBLIC_POST_LOGIN_REDIRECT=/console/chat
```

`BACKEND_API_BASE_URL` 由 Next.js 服务端代理路由
`src/app/api/backend/[...path]/route.ts` 读取，浏览器永远只看到同源
`/api/backend/...` 路径，对外完全隐藏 8090 端口。

`NEXT_PUBLIC_POST_LOGIN_REDIRECT` 是 build-time 变量，门户登录 / 注册成功后会
`window.location.assign(this_value)` 进行硬跳转。默认 `/console/` 是 Vue 管理
后台的入口，配合 `session-storage.ts` 把 token 共享到 Vue 端 localStorage，
实现无感单点登录。修改这个值后必须重新 `npm run build`，因为 `NEXT_PUBLIC_*`
是在构建期被内联进客户端 bundle 的。

### 2.7 MySQL 数据库

```bash
sudo mysql -uroot <<SQL
CREATE DATABASE IF NOT EXISTS aiproject CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'aiprogram'@'127.0.0.1' IDENTIFIED BY '<DB_PASSWORD>';
CREATE USER IF NOT EXISTS 'aiprogram'@'localhost' IDENTIFIED BY '<DB_PASSWORD>';
GRANT ALL PRIVILEGES ON aiproject.* TO 'aiprogram'@'127.0.0.1';
GRANT ALL PRIVILEGES ON aiproject.* TO 'aiprogram'@'localhost';
FLUSH PRIVILEGES;
SQL
```

### 2.8 Django migrate + collectstatic

```bash
cd /opt/aiprogram/backend
export DJANGO_SETTINGS_MODULE=aiproject.settings_production
set -a; source /etc/aiprogram/backend.env; set +a
/opt/aiprogram/venv/bin/python manage.py migrate
/opt/aiprogram/venv/bin/python manage.py collectstatic --noinput --clear
```

### 2.9 创建超级管理员

通过 `manage.py shell` 执行 idempotent 脚本：

- 不存在时创建用户 `admin / Admin@123456`
- 已存在时强制设为 `is_staff=True, is_superuser=True`，不会重置已有密码
- 同时给该用户准备一个 `permissions=all` 的 `APIToken`

### 2.10 构建 Vue 管理后台（`/console/`）

```bash
cd /opt/aiprogram/frontend
npm ci
npm run build -- --base=/console/      # ⚠️ 关键：base 必须 /console/
```

构建产物 `dist/` 中所有 `<script src="...">` 会自动被 vite 改写成
`/console/assets/xxx.js`。

**部署模式（自 v2 起）**：Vue admin 不再是 nginx 直接 `alias` 的静态文件，
而是作为独立 systemd 服务运行：

```bash
serve -s /opt/aiprogram/frontend/dist -l tcp://127.0.0.1:5173 --no-clipboard --single
```

`-s/--single` 让 `serve` 进入 SPA 模式，404 自动 fallback 到 `index.html`。
nginx 通过 `proxy_pass http://127.0.0.1:5173/;`（末尾斜杠 ⇒ 剥离 `/console/`
前缀）把 `/console/...` 转发过来：

```
/console/                  →  /                  →  dist/index.html
/console/assets/foo.js     →  /assets/foo.js     →  dist/assets/foo.js
/console/admin/dashboard   →  /admin/dashboard   →  serve SPA fallback
```

这样做的好处是：
- Vue admin 升级只需要重启 `aiprogram-frontend.service`，不会影响 Django/门户。
- nginx 不必关心 dist 目录结构与缓存细节，由 `serve` 统一处理。
- 三个项目独立运行，故障域更小。

### 2.11 构建 Next.js 门户

```bash
cd /opt/8ms-portal
npm ci
export BACKEND_API_BASE_URL=http://127.0.0.1:8090/api
export NEXT_TELEMETRY_DISABLED=1
npm run build
```

排错：

- `Error: ENOSPC` 或 OOM：参见 §1 加 swap。
- `next-intl` 报缺失语言文件：检查 `src/i18n/request.ts` 与 `src/messages/`。

### 2.12 安装三个 systemd 单元

| 单元 | 命令 | 端口 |
| --- | --- | --- |
| `8ms-portal.service`         | `node node_modules/next/dist/bin/next start -p 3013` | 3013 |
| `aiprogram-backend.service`  | `venv/bin/gunicorn ... :8090`（3 worker × 2 线程） | 8090 |
| `aiprogram-frontend.service` | `serve -s dist -l tcp://127.0.0.1:5173 --single` | 5173 |

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now aiprogram-backend.service
sudo systemctl enable --now aiprogram-frontend.service
sudo systemctl enable --now 8ms-portal.service
```

三个服务相互独立，故障域不重叠：
- Django 挂掉只影响 `/api/`、`/admin/`，门户首页与 `/console/` 仍可加载（但
  Vue admin 调 API 会 5xx）。
- Vue admin 挂掉只影响 `/console/`，门户与 API 都正常。
- 门户挂掉只影响 `/`，`/api/` 与 `/console/` 都正常。

### 2.13 Nginx 站点

`install.sh` 会写入两个文件：

1. `/etc/nginx/conf.d/ms8-upgrade-map.conf` — 顶层 `map` 定义：
   - `$connection_upgrade`，给 WebSocket / SSE 透传用。
   - `$console_cache_control`，按文件扩展名给 `/console/` 设置 `immutable` 长缓存
     或 `no-cache`，防止 SPA 升级后用户拿到旧 `index.html`。
2. `/etc/nginx/sites-available/8ms-portal.conf` — 站点配置：

   ```
   /                       → upstream 127.0.0.1:3013   (Next.js)
   /_next/static/          → upstream 127.0.0.1:3013
   /api/backend/           → upstream 127.0.0.1:3013   (⚠️ 必须先于 /api/)
   /api/                   → upstream 127.0.0.1:8090   (Django)
   /admin/, /django-admin/ → upstream 127.0.0.1:8090
   /static/                → alias /opt/aiprogram/backend/staticfiles/
   /media/                 → alias /opt/aiprogram/backend/media/
   /console/               → upstream 127.0.0.1:5173   (Vue admin via serve)
                                proxy_pass 末尾带斜杠剥离 /console/ 前缀
   /.well-known/acme-challenge/ → /var/www/certbot/
   ```

`location` 顺序很重要：nginx 用最长前缀匹配，所以 `/api/backend/` 必须出现在
`/api/` 之前，否则会被 Django 拦截而绕过 Next.js 的服务端代理。`/console/` 与
`/api/` 是独立前缀，互不影响。

### 2.14 ufw 防火墙

只放通 22 / 80 / 443，其他端口（3013、8090、3306）一律不暴露。

### 2.15 申请 SSL（带 `--ssl` 时）

由 `setup-ssl.sh` 完成：

```bash
certbot certonly --webroot -w /var/www/certbot \
  --non-interactive --agree-tos --email <你的邮箱> \
  --no-eff-email --keep-until-expiring --rsa-key-size 4096 \
  -d 8ms.ai -d www.8ms.ai
```

申请成功后：

- 用 `nginx-https.conf` 模板覆盖站点配置（含 80→443 强制跳转、HSTS、OCSP、TLS1.2/1.3）。
- 把 `backend.env` 的 `*_COOKIE_SECURE` 都改成 1，并把 `https://<域名>` 加进 `CSRF_TRUSTED_ORIGINS`。
- 把 `portal.env` 的 `NEXT_PUBLIC_SITE_URL` 切到 `https://<域名>`。
- 安装 `/etc/letsencrypt/renewal-hooks/deploy/8ms-reload-nginx.sh`，
  续期成功后会自动 `systemctl reload nginx`。
- 启用 `certbot.timer`，每天自动尝试续期。

---

## 3. 手工分步部署（不用一键脚本）

如果你想完全手动执行，可以按下表顺序操作：

```bash
# 1. 系统包
sudo apt update && sudo apt install -y \
  build-essential pkg-config python3-venv python3-dev \
  default-libmysqlclient-dev mysql-server nginx rsync openssl

curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt install -y nodejs

# 2. 拷贝两份源码
sudo mkdir -p /opt/8ms-portal /opt/aiprogram/backend /opt/aiprogram/frontend /opt/aiprogram/logs
sudo rsync -a --exclude='.git' --exclude='node_modules' --exclude='.next' \
  ./8ms_code/ /opt/8ms-portal/
sudo rsync -a --exclude='.git' --exclude='__pycache__' --exclude='logs' \
  --exclude='staticfiles' --exclude='media' \
  ./AIprogram/aiproject/ /opt/aiprogram/backend/
sudo rsync -a --exclude='.git' --exclude='node_modules' --exclude='dist' \
  ./AIprogram/ai-frontend/ /opt/aiprogram/frontend/
sudo cp ./AIprogram/requirements.txt /opt/aiprogram/

# 3. Python 虚拟环境
sudo python3 -m venv /opt/aiprogram/venv
sudo /opt/aiprogram/venv/bin/pip install -r /opt/aiprogram/requirements.txt

# 4. 写两个 env 文件（手工把 backend.env.example / portal.env.example 复制过去并改）
sudo install -d -m 750 /etc/aiprogram /etc/8ms-portal
sudo cp 8ms_code/deploy/conf/backend.env.example /etc/aiprogram/backend.env
sudo cp 8ms_code/deploy/conf/portal.env.example /etc/8ms-portal/portal.env
# 用编辑器修改 SECRET_KEY / DB_PASSWORD / DOMAIN ...

# 5. 创建 MySQL 库（参见 §2.7）

# 6. migrate / collectstatic
cd /opt/aiprogram/backend
export DJANGO_SETTINGS_MODULE=aiproject.settings_production
set -a; source /etc/aiprogram/backend.env; set +a
sudo /opt/aiprogram/venv/bin/python manage.py migrate
sudo /opt/aiprogram/venv/bin/python manage.py collectstatic --noinput --clear

# 7. 构建 Vue 后台
cd /opt/aiprogram/frontend
sudo npm ci
sudo npm run build -- --base=/console/

# 8. 构建 Next.js 门户
cd /opt/8ms-portal
sudo npm ci
sudo BACKEND_API_BASE_URL=http://127.0.0.1:8090/api npm run build

# 9. 安装 systemd / nginx 配置（手动 sed 替换占位符）
sudo cp 8ms_code/deploy/conf/aiprogram-backend.service /etc/systemd/system/
sudo cp 8ms_code/deploy/conf/8ms-portal.service /etc/systemd/system/
# sed -i ... 把 __APP_ROOT__ / __RUN_USER__ / __PORTAL_PORT__ 等替换成实际值

sudo cp 8ms_code/deploy/conf/nginx-upgrade-map.conf /etc/nginx/conf.d/ms8-upgrade-map.conf
sudo cp 8ms_code/deploy/conf/nginx-http.conf /etc/nginx/sites-available/8ms-portal.conf
sudo ln -sf /etc/nginx/sites-available/8ms-portal.conf /etc/nginx/sites-enabled/8ms-portal.conf
sudo rm -f /etc/nginx/sites-enabled/default
# sed -i ... 替换 __DOMAIN__ / __PORTAL_PORT__ / __BACKEND_PORT__ ...

# 10. 权限 & 启动
sudo chown -R www-data:www-data /opt/8ms-portal /opt/aiprogram
sudo systemctl daemon-reload
sudo systemctl enable --now aiprogram-backend.service 8ms-portal.service
sudo nginx -t && sudo systemctl reload nginx

# 11. 申请 SSL（DNS 已生效后）
sudo bash 8ms_code/deploy/setup-ssl.sh --domain 8ms.ai --www --email admin@8ms.ai
```

---

## 4. 常见问题排查

### Q1. `curl http://127.0.0.1/` 返回 502

```bash
# 先看 nginx 错误日志
sudo tail -n 50 /var/log/nginx/error.log
# 再看哪个 upstream 没起来
sudo systemctl status 8ms-portal.service
sudo systemctl status aiprogram-backend.service
sudo ss -ltnp | grep -E ':(3013|8090)'
```

常见原因：

1. Next.js 没构建成功（`/opt/8ms-portal/.next/` 缺失）→ 重新跑 `update.sh`。
2. Gunicorn 启动失败：DB 密码错、`SECRET_KEY` 缺失、`requirements.txt` 没装齐。
3. systemd 单元里 `EnvironmentFile=` 路径写错。

### Q2. `/console/` 页面打开是空白 / 资源 404

构建时一定要带 `--base=/console/`，否则资源会请求 `/assets/...` 而 404。
重新构建后清浏览器缓存：

```bash
cd /opt/aiprogram/frontend
sudo npm run build -- --base=/console/
sudo systemctl reload nginx
```

### Q3. Django Admin 登录报 CSRF 403 / "CSRF verification failed"

这是反代部署中最常见的"卡门槛"问题，按如下顺序排查：

#### 3.1 检查 backend.env 是否齐全

```bash
sudo grep -E '^(DJANGO_ALLOWED_HOSTS|CSRF_TRUSTED_ORIGINS|CSRF_COOKIE_SECURE|SESSION_COOKIE_SECURE)=' \
  /etc/aiprogram/backend.env
```

正确状态（HTTPS 部署）应当看到：

```
DJANGO_ALLOWED_HOSTS=127.0.0.1,localhost,8ms.ai,www.8ms.ai,<服务器IP>
CSRF_TRUSTED_ORIGINS=http://8ms.ai,https://8ms.ai,http://www.8ms.ai,https://www.8ms.ai,...
CSRF_COOKIE_SECURE=1
SESSION_COOKIE_SECURE=1
```

`install.sh` / `setup-ssl.sh` 已经把这些都自动写好。如果你手工改过，确认没漏域名。

#### 3.2 检查 nginx 是否正确转发 X-Forwarded-Proto

```bash
sudo nginx -T 2>/dev/null | grep -A1 'proxy_set_header X-Forwarded-Proto'
```

应当看到每个 `location ^~ /admin/`、`/api/`、`/` 都有
`proxy_set_header X-Forwarded-Proto $scheme;`。本仓库 `nginx-https.conf` 默认就有。

`settings_production.py` 配合下述设置识别 HTTPS：

```python
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
USE_X_FORWARDED_HOST = True
```

如果上述任一缺失，Django 把请求当作 HTTP 处理，CSRF 就会拒。

#### 3.3 清浏览器 cookie（最常见！）

如果你**先用 HTTP 部署过、后又切到 HTTPS**，浏览器里有一份 `Secure=False` 的旧
`csrftoken` / `sessionid`，在 `CSRF_COOKIE_SECURE=1` 模式下浏览器拒绝把这些
cookie 发给服务器，导致 CSRF 校验失败。

**修复方法**：

- Chrome / Edge：`F12 → Application → Cookies → 选中 https://8ms.ai → 全部删除`
- 或换无痕窗口测试：`Ctrl+Shift+N`
- 或彻底清除该域名所有数据：`chrome://settings/cookies/detail?site=8ms.ai`

#### 3.4 检查 Origin 是否被识别为可信

如果 3.1 / 3.2 / 3.3 都正确还失败，把后端日志开到 DEBUG 看具体的 Origin：

```bash
sudo systemctl restart aiprogram-backend.service
sudo journalctl -u aiprogram-backend.service -f
# 在浏览器再登录一次，能看到 Forbidden 日志
```

最后兜底大招：直接重装

```bash
sudo bash deploy/install.sh --fresh \
    --domain 8ms.ai --www --ssl --email admin@8ms.ai
```

### Q3.1 想强制 HTTP 自动跳转 HTTPS

`setup-ssl.sh` 拿到证书后会自动把站点切成 `nginx-https.conf` 模板，其中 80
端口除 ACME 验证外**全部 301 → HTTPS**：

```nginx
server {
    listen 80;
    server_name 8ms.ai www.8ms.ai;
    location ^~ /.well-known/acme-challenge/ { root /var/www/certbot; ... }
    location / { return 301 https://$host$request_uri; }
}
```

验证：

```bash
curl -I http://8ms.ai/             # → HTTP/1.1 301 Moved Permanently
curl -I http://www.8ms.ai/admin/   # → HTTP/1.1 301
curl -ILk http://8ms.ai/           # 跟随跳转，最终 200
```

如果 `curl -I http://8ms.ai/` 没有返回 301：

1. 确认证书已成功申请：`ls /etc/letsencrypt/live/8ms.ai/`
2. 确认 nginx 在用 HTTPS 模板：`sudo grep -c 'return 301 https' /etc/nginx/sites-available/8ms-portal.conf` 应该 ≥ 1
3. 重新跑：`sudo bash deploy/setup-ssl.sh --domain 8ms.ai --www --email admin@8ms.ai`

### Q4. Next.js 浏览器调用 API 报 404

确认 nginx 配置里 **`/api/backend/` 在 `/api/` 之前**。
可以快速验证：

```bash
sudo nginx -T 2>/dev/null | grep -A1 "location /api"
```

应当看到 `location /api/backend/` 在前面。

### Q5. `npm ci` 卡在 install / 内存不足被 kill

```bash
# 限制并发，避免一次拉太多
cd /opt/8ms-portal
sudo npm ci --prefer-offline --no-audit --no-fund
# 或者：先加 swap（参见 §1）
```

### Q6. certbot 申请证书时报 `connection refused` / `timeout`

- 检查 DNS 是否真的指向本机：`dig +short www.8ms.ai`。
- 检查 80 端口是否放通（云控制台安全组 + `sudo ufw status`）。
- 检查 nginx 是否在监听 80：`sudo ss -ltnp | grep ':80 '`。
- 可先用 `--staging` 联调，避免触发 Let's Encrypt 的频率限制。

### Q6.1 certbot 报 `MissingCommandlineFlag: ... --expand`

完整错误形如：

```
certbot.errors.MissingCommandlineFlag: Missing command line flag or config entry for this setting:
You have an existing certificate that contains a portion of the domains you requested
(ref: /etc/letsencrypt/renewal/8ms.ai.conf)
It contains these names: 8ms.ai
You requested these names for the new certificate: 8ms.ai, www.8ms.ai.
Do you want to expand and replace this existing certificate with the new certificate?
(You can set this with the --expand flag)
```

原因：第一次申请时只带了 `--domain 8ms.ai`（没加 `--www`），第二次想追加
`www.8ms.ai`。在 `--non-interactive` 模式下 certbot 不能弹问，必须显式
`--expand`。

`setup-ssl.sh` 已经在 certbot 命令里默认加上 `--expand` 与
`--cert-name <主域名>`，所以**直接重跑一次即可**：

```bash
sudo bash deploy/setup-ssl.sh \
    --domain 8ms.ai --www \
    --email admin@8ms.ai
```

如果你在用旧版本 `setup-ssl.sh`（拉取代码前），可以先手动扩展一次：

```bash
sudo certbot certonly \
  --webroot -w /var/www/certbot \
  --non-interactive --agree-tos --no-eff-email \
  --email admin@8ms.ai \
  --expand --cert-name 8ms.ai \
  -d 8ms.ai -d www.8ms.ai
sudo systemctl reload nginx
```

之后再跑 `setup-ssl.sh` 把 nginx 切成 HTTPS 模板即可。

### Q7. 想换域名

```bash
# 1) 修改 DNS 解析到本机
# 2) 把新域名加进 backend.env
sudo nano /etc/aiprogram/backend.env   # DJANGO_ALLOWED_HOSTS / CSRF_TRUSTED_ORIGINS
sudo nano /etc/8ms-portal/portal.env   # NEXT_PUBLIC_SITE_URL
# 3) 申请新证书
sudo bash deploy/setup-ssl.sh --domain <新域名> --email <邮箱>
# 4) 重启
sudo systemctl restart aiprogram-backend.service 8ms-portal.service
```

### Q8. 升级 Node / 重新构建前端失败

至少需要 Node 20.19+；`install.sh` 默认装 Node 22 LTS。
可以手工：

```bash
cd /opt/8ms-portal && sudo npm ci && sudo npm run build
cd /opt/aiprogram/frontend && sudo npm ci && sudo npm run build -- --base=/console/
```

---

## 5. 备份恢复

### 5.1 备份

```bash
# 数据库
sudo mysqldump -uroot aiproject | gzip > /backup/aiproject-$(date +%F).sql.gz

# 上传文件
sudo tar -C /opt/aiprogram -czf /backup/aiproject-media-$(date +%F).tar.gz backend/media

# 关键配置
sudo tar -czf /backup/aiproject-conf-$(date +%F).tar.gz \
  /etc/aiprogram /etc/8ms-portal \
  /etc/nginx/sites-available/8ms-portal.conf \
  /etc/systemd/system/aiprogram-backend.service \
  /etc/systemd/system/8ms-portal.service
```

### 5.2 恢复（迁移到新服务器）

```bash
# 1) 在新机器跑 install.sh 完成基础部署
sudo bash deploy/install.sh --domain 8ms.ai --www --ssl --email admin@8ms.ai

# 2) 停止后端
sudo systemctl stop aiprogram-backend.service

# 3) 用旧库恢复（先 DROP 再 import，或 mysql -uroot 直接 source）
gzip -d -c /backup/aiproject-2026-05-10.sql.gz | sudo mysql -uroot aiproject

# 4) 恢复 media
sudo tar -C /opt/aiprogram -xzf /backup/aiproject-media-2026-05-10.tar.gz
sudo chown -R www-data:www-data /opt/aiprogram/backend/media

# 5) 重新启动
sudo systemctl start aiprogram-backend.service
```

---

至此，整个 8MS.AI 全栈系统已经可以稳定地跑在 Ubuntu 24.04 上了。如果遇到本文未覆盖的问题，请把
`journalctl -u <service> -n 200` + `nginx -T` 的输出发给我，便于诊断。
