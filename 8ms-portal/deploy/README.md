# 8MS.AI 全栈部署指南（Ubuntu 24.04 + Nginx + Let's Encrypt）

> 目标：把 **三个独立服务（Next.js 门户 + Django 后端 + Vue 管理后台）** 部署到
> 同一台 **Ubuntu 24.04 LTS** 服务器，全部由 **systemd** 管理、通过 **nginx**
> 路径分发到统一域名 `www.8ms.ai`，并由 **Certbot** 自动申请 / 续期
> **Let's Encrypt** 免费证书。

---

## 1. 整体架构

```
┌────────────────────────────────────────────────────────────────────────┐
│                  Internet (用户浏览器 / API 客户端)                      │
└────────────────────────────────┬───────────────────────────────────────┘
                                 │ 80 / 443
                                 ▼
                    ┌────────────────────────────┐
                    │  Nginx  (统一入口, SSL/TLS) │
                    └─┬──────────┬───────────┬───┘
   /, /_next/, /api/  │  /api/   │ /console/ │  /static/, /media/,
   /api/backend/*     │          │           │  /admin/, /django-admin/
                      ▼          ▼           ▼
              ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
              │  Next.js     │ │   Vue SPA    │ │   Django     │
              │  8ms_code    │ │  ai-frontend │ │   Gunicorn   │
              │  :3013       │ │  :5173       │ │   :8090      │
              │  systemd:    │ │  systemd:    │ │   systemd:   │
              │  8ms-portal  │ │  aiprogram-  │ │   aiprogram- │
              │              │ │  frontend    │ │   backend    │
              └──────┬───────┘ └──────────────┘ └──────┬───────┘
                     │ /api/backend/*  ─ 服务端代理 ─►   │
                                                        ▼
                                                  ┌──────────┐
                                                  │  MySQL 8 │
                                                  │ aiproject│
                                                  └──────────┘
```

| 路径 | 后端 | 说明 |
| --- | --- | --- |
| `/`                   | Next.js (`127.0.0.1:3013`)  | 8ms_code 门户首页 / SPA / 多语言路由 |
| `/_next/static/...`   | Next.js (`127.0.0.1:3013`)  | Next.js 自带静态资源 |
| `/api/backend/...`    | Next.js (`127.0.0.1:3013`)  | 门户内置同源代理（`src/app/api/backend/[...path]`） |
| `/api/...`            | Django (`127.0.0.1:8090`)   | REST API（用户 / chat / billing / knowledge / gateway） |
| `/admin/`、`/django-admin/` | Django (`127.0.0.1:8090`) | Django 内置管理后台 |
| `/static/`、`/media/` | Django collectstatic / 上传目录 |
| `/console/`           | Vue admin (`127.0.0.1:5173`) | ai-frontend SPA，独立 systemd 服务（`serve -s dist`），nginx 反向代理并剥离 `/console/` 前缀 |

> 三个服务**完全独立**：可以分别 `systemctl restart`、分别更新代码，nginx
> 路由把它们拼成一个统一域名。

### 1.1 单点登录（Next.js ⇆ Vue admin）

门户与 Vue admin 部署在同一域名，浏览器 localStorage 同源。`8ms_code` 在登录 /
注册成功时同时写入两套 key（`token / refreshToken / user` 与 Vue 端期望的
`access_token / refresh_token / user_info`），并在登录后自动硬跳转到 `/console/`，
所以用户**不需要二次登录**就能直接进入 Vue 管理后台。

跳转目标可通过环境变量 `NEXT_PUBLIC_POST_LOGIN_REDIRECT` 调整：

| 取值 | 行为 |
| --- | --- |
| `/console/` （默认） | 登录后整页跳转到 Vue 管理后台 |
| `/`                  | 保留旧行为：登录后停留在门户首页 |
| `https://other...`   | 跳转到外部 URL（多数场景不需要） |

---

## 2. 目录结构

```
deploy/
├── README.md                       # 本文档（速读版）
├── DEPLOY-UBUNTU-24.04.md          # 详细部署/排错手册
├── install.sh                      # 一键全新部署（首次安装）
├── setup-ssl.sh                    # 申请 / 更新 SSL 证书
├── update.sh                       # 增量更新（已部署后）
├── package.sh                      # 把 8ms_code + AIprogram 一起打成 .tar.gz
├── uninstall.sh                    # 卸载脚本
└── conf/
    ├── portal.env.example          # Next.js 门户环境变量模板
    ├── backend.env.example         # Django 后端环境变量模板
    ├── 8ms-portal.service          # systemd 单元（Next.js, :3013）
    ├── aiprogram-backend.service   # systemd 单元（Gunicorn, :8090）
    ├── aiprogram-frontend.service  # systemd 单元（Vue admin SPA, :5173）
    ├── nginx-http.conf             # 仅 HTTP 阶段
    ├── nginx-https.conf            # HTTPS 阶段
    ├── nginx-upgrade-map.conf      # 公共 map（WebSocket + /console/ 缓存策略）
    └── certbot-deploy-hook.sh      # 证书续期成功后自动 reload nginx
```

---

## 3. 部署前提

1. **服务器**：阿里云 / 腾讯云 / AWS 等任意公有云的 **Ubuntu 24.04 LTS**，
   建议规格 **2 核 4G 起**（前端构建对内存敏感）。
2. **安全组**：放通 **22 (SSH)**、**80 (HTTP)**、**443 (HTTPS)**。
3. **域名 DNS**（可选，未指定时仍可通过 IP 访问）：
   - `8ms.ai`     → `<服务器公网 IP>`
   - `www.8ms.ai` → `<服务器公网 IP>`
4. **运行用户**：root 或具备 sudo 权限的账号。
5. **源代码布局**：`8ms_code/` 与 `AIprogram/` 默认是**同级目录**，例如：

   ```
   /opt/source/
   ├── 8ms_code/        # ← 在这里执行 sudo bash deploy/install.sh
   └── AIprogram/
   ```

   如果不是同级，运行 `install.sh` 时通过 `--backend-src /path/to/AIprogram` 指定。

> ⚠️ 申请 Let's Encrypt 证书的前提是 **DNS 已生效**，可以用 `dig 8ms.ai` /
> `nslookup www.8ms.ai` 验证。

---

## 4. 一键部署（推荐）

### 4.1 通过打包上传（最干净）

```bash
# 在开发机打包：会同时把 8ms_code + AIprogram 打进一个 tar.gz
bash 8ms_code/deploy/package.sh
# → release/8ms-release-YYYYMMDD-HHMMSS.tar.gz

# 上传 + 解压
scp 8ms_code/release/8ms-release-*.tar.gz root@8ms.ai:/opt/
ssh root@8ms.ai
cd /opt
tar -xzf 8ms-release-*.tar.gz
cd 8ms-release-*
```

### 4.2 一站式 HTTPS 部署

```bash
sudo bash deploy/install.sh \
    --domain 8ms.ai --www \
    --ssl --email admin@8ms.ai
```

### 4.2.1 一键全量重装（先清空旧环境再部署）

> 用在系统里残留旧版本配置导致登录失败 / CSRF 错误 / 证书混乱时。

```bash
# 仅清空运行目录 / env / 服务，保留数据库和证书
sudo bash deploy/install.sh --fresh -y \
    --domain 8ms.ai --www \
    --ssl --email admin@8ms.ai

# 终极一键重装：连数据库、Let's Encrypt 证书也清掉重申请
sudo bash deploy/install.sh --fresh --drop-db --drop-cert -y \
    --domain 8ms.ai --www \
    --ssl --email admin@8ms.ai
```

`--fresh` 会按以下顺序执行：

1. 停止并禁用 `8ms-portal.service` / `aiprogram-backend.service` / `aiprogram-frontend.service`
2. 删除 `/opt/8ms-portal`、`/opt/aiprogram`、`/etc/8ms-portal`、`/etc/aiprogram`
3. 删除 nginx 站点 + 公共 map 片段
4. 删除 `/etc/systemd/system/{8ms-portal,aiprogram-backend,aiprogram-frontend}.service`
5. 删除 certbot deploy hook
6. （可选 `--drop-db`）`DROP DATABASE aiproject; DROP USER aiprogram;`
7. （可选 `--drop-cert`）`certbot delete --cert-name 8ms.ai`
8. 然后从头跑完整部署

脚本会自动完成：

| 步骤 | 内容 |
| --- | --- |
| 1  | apt 安装 MySQL 8 / Nginx / Python 3.12 / Node 22 / Certbot / build 工具链；`npm i -g serve` |
| 2  | 在 `/opt/8ms-portal` `/opt/aiprogram` 下创建运行目录 |
| 3  | rsync 同步 8ms_code 源代码 |
| 4  | rsync 同步 AIprogram (Django + ai-frontend) 源代码 |
| 5  | 创建 `/opt/aiprogram/venv` 并 `pip install -r requirements.txt` |
| 6  | 生成 `/etc/aiprogram/backend.env`（随机 SECRET_KEY / 随机 DB 密码） |
| 7  | 生成 `/etc/8ms-portal/portal.env`（指向 127.0.0.1:8090 的后端 + `NEXT_PUBLIC_POST_LOGIN_REDIRECT=/console/chat`） |
| 8  | 创建 MySQL 数据库 `aiproject` 与用户 `aiprogram` |
| 9  | `python manage.py migrate / collectstatic` |
| 10 | 创建超级管理员 `admin / Admin@123456`（**部署后立刻改密**） |
| 11 | 构建 Vue 管理后台（`npm run build -- --base=/console/`） |
| 12 | 构建 Next.js 门户（`npm run build`，构建期 source `portal.env` 让 `NEXT_PUBLIC_*` 内联生效） |
| 13 | 写入并启用三个 systemd 单元：`8ms-portal.service` / `aiprogram-backend.service` / `aiprogram-frontend.service` |
| 14 | 写入 nginx 站点 + 公共 map（含 `$console_cache_control`），reload nginx |
| 15 | ufw 开通 22/80/443 |
| 16 | 调用 `setup-ssl.sh` 申请 Let's Encrypt 证书并切换到 HTTPS 配置 |

### 4.3 验证

```bash
# 服务状态
systemctl status 8ms-portal.service
systemctl status aiprogram-backend.service
systemctl status aiprogram-frontend.service
journalctl -u 8ms-portal.service -n 50 --no-pager

# 本机端口监听
ss -ltnp | grep -E ':3013|:5173|:8090'
# 期望：
#   :3013 → next-server                 (8ms-portal)
#   :5173 → serve / node                 (aiprogram-frontend)
#   :8090 → gunicorn                     (aiprogram-backend)

# 反向代理
curl -I https://www.8ms.ai/                          # 200（门户）
curl -I https://www.8ms.ai/api/users/login/          # 200 / 405（Django）
curl -I https://www.8ms.ai/console/                  # 200（Vue 管理后台）
curl -I https://www.8ms.ai/admin/                    # 200 / 302（Django Admin）

# 浏览器打开
https://www.8ms.ai/                # 8ms_code 用户门户（登录后会自动跳 /console/）
https://www.8ms.ai/console/        # ai-frontend 管理后台
https://www.8ms.ai/admin/          # Django 后台
```

---

## 5. 分步部署（DNS 暂时还没解析）

```bash
# 5.1 先用 HTTP 模式跑起来
sudo bash deploy/install.sh --domain 8ms.ai --www

# 5.2 用 IP 测试
curl -I http://<服务器IP>/

# 5.3 等 DNS 解析生效后再开 HTTPS
sudo bash deploy/setup-ssl.sh \
    --domain 8ms.ai --www \
    --email admin@8ms.ai
```

---

## 6. 日常运维

### 6.1 更新代码（最常用）

在源代码根目录（`8ms_code/`）：

```bash
sudo bash deploy/update.sh
# 仅更新前端
sudo bash deploy/update.sh --skip-backend
# 仅更新后端
sudo bash deploy/update.sh --skip-portal
```

会执行：rsync 代码 → pip / npm 依赖 → migrate → collectstatic → 前端构建 →
重启服务 → reload nginx → 自检 HTTP 状态码。

### 6.2 修改环境变量

```bash
# 后端
sudo nano /etc/aiprogram/backend.env
sudo systemctl restart aiprogram-backend.service

# 前端门户
sudo nano /etc/8ms-portal/portal.env
sudo systemctl restart 8ms-portal.service
```

### 6.3 SSL 证书自动续期

`install.sh` / `setup-ssl.sh` 已经启用了 `certbot.timer`，并安装了 deploy hook
`/etc/letsencrypt/renewal-hooks/deploy/8ms-reload-nginx.sh`，无需人工干预。

```bash
sudo certbot renew --dry-run        # 测试续期流程
systemctl status certbot.timer       # 查看自动续期定时器
```

### 6.4 查看日志

```bash
# 前端门户
journalctl -u 8ms-portal.service -f
tail -f /opt/8ms-portal/logs/portal.out.log
tail -f /opt/8ms-portal/logs/portal.err.log

# 后端
journalctl -u aiprogram-backend.service -f
tail -f /opt/aiprogram/logs/access.log
tail -f /opt/aiprogram/logs/error.log
tail -f /opt/aiprogram/backend/logs/django.log

# Nginx
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

### 6.5 重启 / 停服务

```bash
sudo systemctl restart 8ms-portal.service          # Next.js 门户
sudo systemctl restart aiprogram-backend.service   # Django + Gunicorn
sudo systemctl restart aiprogram-frontend.service  # Vue admin (serve)
sudo systemctl reload  nginx
sudo systemctl status  mysql
```

> 三个 systemd 服务相互独立，可以单独重启而不影响其它服务。

### 6.6 单点登录调试

如果"门户登录后跳转 `/console/` 提示重新登录"：

1. 浏览器 F12 → Application → Local Storage → `https://www.8ms.ai`，确认存在
   `access_token` / `refresh_token` / `user_info`（这三个 key 是 Vue 端读的）。
2. 没有的话，多半是 `8ms_code` 没有重新构建到最新版本。重跑：

   ```bash
   sudo bash deploy/update.sh --skip-backend
   ```

3. 想关掉自动跳 `/console/`：编辑 `/etc/8ms-portal/portal.env`，改 `NEXT_PUBLIC_POST_LOGIN_REDIRECT=/`，再
   `sudo bash deploy/update.sh --skip-backend`（必须重新构建，因为 `NEXT_PUBLIC_*` 是
   build-time 变量）。

---

## 7. 卸载

```bash
# 仅停服务、删除运行目录（保留 env / DB / 证书）
sudo bash deploy/uninstall.sh

# 彻底清除（DROP DATABASE + 删除 env / 证书 hook / 站点配置）
sudo bash deploy/uninstall.sh --purge -y

# 连 Let's Encrypt 证书一起删
sudo bash deploy/uninstall.sh --purge --drop-cert --domain 8ms.ai -y
```

---

## 8. 常见问题

详见同目录 [`DEPLOY-UBUNTU-24.04.md`](./DEPLOY-UBUNTU-24.04.md)。
最常踩的几个坑速查：

### 8.1 Django Admin 登录提示 "CSRF verification failed"

99% 是浏览器里残留了**之前 HTTP 模式下设置的非 Secure cookie**，与现在的
`CSRF_COOKIE_SECURE=1` 不兼容。最快的修法：

1. 打开 `https://www.8ms.ai`，按 F12 → Application → Cookies → 全部删除；
2. 或直接换 **无痕窗口** 重新登录；
3. 仍失败时一键重装：`sudo bash deploy/install.sh --fresh -y --domain 8ms.ai --www --ssl --email admin@8ms.ai`。

详细排查（含 nginx 反代头检查、env 校验等）见 `DEPLOY-UBUNTU-24.04.md` Q3。

### 8.2 HTTP 没有自动跳 HTTPS

`setup-ssl.sh` 在拿到证书后会自动切 `nginx-https.conf`，让 80 端口除 ACME
验证外全部 `return 301 https://...`。如果你看到没跳：

```bash
# 强制重做 HTTPS 切换 + 重载 nginx
sudo bash deploy/setup-ssl.sh --domain 8ms.ai --www --email admin@8ms.ai
curl -I http://8ms.ai/    # 期望 301
```

### 8.3 老环境太脏想推倒重来

```bash
sudo bash deploy/install.sh --fresh --drop-db --drop-cert -y \
    --domain 8ms.ai --www --ssl --email admin@8ms.ai
```

⚠️ `--drop-db` 会**永久删除 aiproject 数据库**，请先备份：

```bash
sudo mysqldump -uroot aiproject | gzip > /backup/aiproject-$(date +%F).sql.gz
```

---

## 9. 安全建议

1. **首次登录后立即修改超级管理员密码**：`/admin/`。
2. 修改 `/etc/aiprogram/backend.env`、`/etc/8ms-portal/portal.env` 后请保持权限 `chmod 600`。
3. 强烈建议：
   - 在 Nginx 前再加一层 CDN / WAF（阿里云 / Cloudflare）。
   - 定期备份 MySQL：`mysqldump -uroot aiproject > backup-$(date +%F).sql`。
   - 启用 `unattended-upgrades` 自动安装系统安全补丁。
   - 限制 `/admin/` 的访问 IP（云防火墙或 nginx `allow/deny`）。
