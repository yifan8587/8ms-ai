# 前端项目部署文档
当前项目是 **Next.js 服务端应用**，不是 Vite 纯静态项目。构建产物为 `.next`，生产环境需要通过 Node.js 进程运行，不能只上传 `dist` 目录。

## 1. 项目信息

- 框架：Next.js 16
- React：19
- 默认开发端口：`3013`
- 默认生产端口：`3013`
- 构建命令：`npm run build`
- 启动命令：`npm run start`
- 生产产物目录：`.next`

`package.json` 中相关脚本：

```json
{
  "dev": "next dev -p 3013",
  "build": "next build",
  "start": "next start -p 3013"
}
```

## 2. 服务器环境要求

建议服务器使用：

- Linux：Ubuntu 20.04 / 22.04 / 24.04 或 CentOS / Rocky Linux
- Node.js：20 或 22
- npm：随 Node.js 安装
- Nginx：用于域名反向代理
- PM2：用于 Node.js 进程守护

检查版本：

```bash
node -v
npm -v
nginx -v
```

如果没有安装 PM2：

```bash
npm install -g pm2
```

## 3. 上传项目

推荐目录：

```bash
/opt/8ms_code
```

进入部署目录：

```bash
cd /opt/8ms_code
```

需要保留的核心内容：

```text
package.json
package-lock.json
next.config.ts
postcss.config.mjs
tsconfig.json
src/
public/
```

不建议上传：

```text
node_modules/
.next/
.idea/
```

这些目录应在服务器上重新安装依赖和重新构建生成。

## 4. 配置环境变量

当前项目会通过服务端代理访问后端接口。

默认后端地址：

```text
http://aiproject.jasonyifan.dpdns.org:30080/api
```

如果服务器部署时需要修改后端地址，推荐在项目根目录创建 `.env.production`：

```env
BACKEND_API_BASE_URL=http://你的后端地址/api
NEXT_PUBLIC_API_BASE_URL=http://你的后端地址/api
```

说明：

- `BACKEND_API_BASE_URL`：服务端 API 代理优先读取该变量。
- `NEXT_PUBLIC_API_BASE_URL`：Next 配置和兼容逻辑会读取该变量。
- 地址末尾可以带 `/`，项目代码会自动去掉多余斜杠。

示例：

```env
BACKEND_API_BASE_URL=http://127.0.0.1:30080/api
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:30080/api
```

## 5. 安装依赖

推荐使用 npm：

```bash
npm ci
```

如果 `npm ci` 因 lock 文件不一致失败，可以改用：

```bash
npm install
```

注意：项目中同时存在 `package-lock.json` 和 `pnpm-lock.yaml`，部署时建议统一使用一种包管理器。当前文档按 npm 部署。

## 6. 构建项目

执行：

```bash
npm run build
```

成功后会生成：

```text
.next/
```

如果构建成功，控制台会输出类似：

```text
Creating an optimized production build ...
Compiled successfully
Finalizing page optimization ...
```

## 7. 启动生产服务

直接启动：

```bash
npm run start
```

默认监听：

```text
http://服务器IP:3013
```

这种方式适合临时验证，不适合长期运行。正式环境推荐使用 PM2。

## 8. 使用 PM2 守护进程

启动：

```bash
pm2 start npm --name 8ms-fe -- run start
```

查看状态：

```bash
pm2 status
```

查看日志：

```bash
pm2 logs 8ms-fe
```

保存 PM2 进程列表：

```bash
pm2 save
```

设置开机自启：

```bash
pm2 startup
```

执行 `pm2 startup` 后，按控制台提示复制并执行生成的命令。

## 9. Nginx 反向代理

如果需要通过域名访问，例如：

```text
https://your-domain.com
```

可以配置 Nginx：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3013;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

检查 Nginx 配置：

```bash
nginx -t
```

重载 Nginx：

```bash
systemctl reload nginx
```

## 10. HTTPS 证书

如果服务器已经安装 Certbot，可以申请 HTTPS 证书：

```bash
certbot --nginx -d your-domain.com
```

申请成功后，Certbot 会自动修改 Nginx 配置并启用 HTTPS。

## 11. 更新发布流程

每次更新代码后，在服务器项目目录执行：

```bash
cd /opt/8ms_code
npm ci
npm run build
pm2 restart 8ms-fe
```

如果没有使用 `npm ci`：

```bash
cd /opt/8ms_code
npm install
npm run build
pm2 restart 8ms-fe
```

查看启动日志：

```bash
pm2 logs 8ms-fe
```

## 12. 常见问题

### 12.1 不要按 Vite 项目部署

当前项目不是 Vite 项目，不会生成 `dist` 目录。

错误方式：

```bash
npm run build
# 然后寻找 dist 上传
```

正确方式：

```bash
npm run build
npm run start
```

或：

```bash
npm run build
pm2 restart 8ms-fe
```

### 12.2 端口无法访问

检查服务是否启动：

```bash
pm2 status
pm2 logs 8ms-fe
```

检查端口：

```bash
ss -lntp | grep 3013
```

检查服务器安全组或防火墙是否放行：

```bash
ufw status
```

如果使用 Nginx，外部只需要开放 `80` 和 `443`，`3013` 可以只监听本机反向代理。

### 12.3 后端接口请求失败

检查 `.env.production`：

```bash
cat .env.production
```

检查服务器能否访问后端：

```bash
curl http://你的后端地址/api
```

修改环境变量后需要重新构建并重启：

```bash
npm run build
pm2 restart 8ms-fe
```

### 12.4 构建失败

先检查 Node.js 版本：

```bash
node -v
```

建议使用 Node.js 20 或 22。

清理后重新安装依赖：

```bash
rm -rf node_modules .next
npm ci
npm run build
```

如果 `npm ci` 失败：

```bash
npm install
npm run build
```

### 12.5 middleware 警告

构建时可能出现：

```text
The "middleware" file convention is deprecated. Please use "proxy" instead.
```

这是 Next.js 16 的迁移警告，不影响当前构建和运行。后续可以将 `src/middleware.ts` 按 Next.js 新规范迁移为 proxy 文件。

## 13. 推荐部署命令汇总

首次部署：

```bash
cd /opt/8ms_code
npm ci
npm run build
pm2 start npm --name 8ms-fe -- run start
pm2 save
pm2 startup
```

后续更新：

```bash
cd /opt/8ms_code
npm ci
npm run build
pm2 restart 8ms-fe
```

访问：

```text
http://服务器IP:3013
```

如果配置了 Nginx 和域名：

```text
https://your-domain.com
```
