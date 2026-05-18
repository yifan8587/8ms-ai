# 8ms-ai 项目 Git 操作手册

> 仓库地址：`git@github.com:yifan8587/8ms-ai.git`
> 仓库根目录：`/opt`
> 默认分支：`main`
> 维护者：yifan8587

本手册覆盖日常开发提交、密钥安全、协作流程和事故恢复。请所有人在本机/本服务器上操作 git 前先通读「一、注意事项」。

---

## 目录

1. [注意事项（必读）](#一注意事项必读)
2. [初次配置](#二初次配置)
3. [日常开发流程](#三日常开发流程)
4. [`.gitignore` 维护](#四gitignore-维护)
5. [密钥与敏感信息处理](#五密钥与敏感信息处理)
6. [分支与发布策略](#六分支与发布策略)
7. [常见问题与事故恢复](#七常见问题与事故恢复)
8. [备份与回滚](#八备份与回滚)

---

## 一、注意事项（必读）

1. **绝不把 API Key、数据库密码、`.env` 文件、`*.pem`、`id_rsa` 等敏感信息加入提交。** GitHub Push Protection 会拦截 push，且密钥一旦进入历史就视为已泄露，必须在云厂商后台立刻吊销。
2. **绝不提交大体积二进制**：`*.tar.gz`、`*.zip`、`venv/`、`node_modules/`、`dist/`、`*.log` 等已经在 `.gitignore` 中排除，不要手动 `git add -f` 强制加入。
3. **`/opt` 仓库根下只追踪源码**：`aiprogram/`、`8ms-portal/`、运维脚本、文档、`README.md`。`containerd/`、`backups/`、release tar 等系统/备份数据**永远不要追踪**。
4. **生产服务器上修改代码前先 `git status` 与 `git pull`**：避免覆盖远程已合入的变更。
5. **不在 `main` 上随手 commit**：日常开发用 feature 分支，验证通过后再合回 `main`。

---

## 二、初次配置

### 2.1 全局身份（每台机器仅需做一次）

```bash
git config --global user.name  "yifan8587"
git config --global user.email "yifan8587@gmail.com"
git config --global init.defaultBranch main
git config --global pull.rebase false      # 默认用 merge 拉取，避免 rebase 冲突
git config --global core.autocrlf input    # Linux/macOS 推荐
git config --global color.ui auto
```

查看当前配置：

```bash
git config --list
```

### 2.2 SSH Key 配置（推荐使用 SSH 而不是 HTTPS）

```bash
# 1) 生成密钥（已生成可跳过）
ssh-keygen -t ed25519 -C "yifan8587@gmail.com"

# 2) 把公钥粘贴到 GitHub → Settings → SSH and GPG keys → New SSH key
cat ~/.ssh/id_ed25519.pub

# 3) 测试连通性
ssh -T git@github.com
# 看到 "Hi yifan8587! You've successfully authenticated" 即成功
```

> ⚠️ 千万不要 `cat ~/.ssh/id_ed25519`（私钥）后粘贴到任何外部地方。

### 2.3 克隆仓库（在新机器/新目录）

```bash
git clone git@github.com:yifan8587/8ms-ai.git /opt
# 如果 /opt 已存在内容，改成下面这种方式
cd /opt
git init -b main
git remote add origin git@github.com:yifan8587/8ms-ai.git
git fetch origin
git reset --hard origin/main
```

---

## 三、日常开发流程

### 3.1 标准提交流程（每次改完代码必走）

```bash
cd /opt

# 1) 与远程同步，确保起点最新
git pull origin main

# 2) 查看改了什么
git status
git diff                # 工作区改动
git diff --staged       # 已暂存改动

# 3) 选择性暂存
git add aiprogram/backend/gateway/views.py
git add aiprogram/frontend/src/views/admin/
# 或一次全加（注意要先 git status 确认无敏感文件）
git add -A

# 4) 提交（消息建议遵守约定式提交，见 3.3）
git commit -m "feat(gateway): support streaming response for openrouter"

# 5) 推送
git push origin main
```

### 3.2 推送前自检清单

push 前先跑一遍下面这几行，避免再次被 Push Protection 拦截：

```bash
# 列出本次提交涉及的所有文件
git log origin/main..HEAD --name-only --pretty=format: | sort -u

# 扫描本地新提交是否含可疑密钥
git log origin/main..HEAD -p | grep -nE \
  "sk-or-v1-[A-Za-z0-9]{40,}|sk-proj-|sk-[A-Za-z0-9]{40,}|BEGIN (RSA |OPENSSH )?PRIVATE KEY" \
  && echo "⚠️ 发现疑似密钥，禁止 push！" || echo "✅ 暂无明显密钥"
```

### 3.3 Commit Message 规范（约定式提交）

```
<type>(<scope>): <短描述>

<可选的详细说明>
```

常用 `type`：

| type | 含义 |
|---|---|
| `feat` | 新功能 |
| `fix` | 修 bug |
| `chore` | 杂项、依赖升级、构建脚本 |
| `docs` | 仅文档变更 |
| `refactor` | 重构（不改外部行为） |
| `perf` | 性能优化 |
| `style` | 仅代码格式 |
| `test` | 测试相关 |
| `ci` | CI / 部署脚本 |
| `revert` | 回滚某次提交 |

示例：

```
feat(billing): 新增 token 用量按天聚合接口
fix(gateway): 修复 OpenRouter 超时重试导致重复扣费
chore(deps): 升级 django-rest-framework 至 3.15.2
docs: 更新部署手册数据库迁移段落
```

---

## 四、`.gitignore` 维护

仓库根的 `/opt/.gitignore` 已包含主流项目所需规则。新增忽略项时**优先编辑根级 `.gitignore`**。

### 4.1 验证某文件是否会被忽略

```bash
git check-ignore -v 路径/到/文件
```

### 4.2 已经误提交了不该追踪的文件怎么办？

```bash
# 从 git 中移除但保留磁盘文件
git rm --cached 路径/到/文件          # 单文件
git rm -r --cached 路径/到/目录       # 目录

# 把规则加入 .gitignore
echo "路径/到/文件" >> .gitignore

git add .gitignore
git commit -m "chore: untrack 误提交的文件并加入 gitignore"
git push
```

### 4.3 当前已生效的忽略大类（仅供 review）

- **大目录**：`venv/`、`.venv/`、`node_modules/`、`dist/`、`build/`、`.next/`
- **备份/发布**：`*.tar.gz`、`*.zip`、`/8ms-release-*/`、`/aiprogram-release-*/`、`/backups/`、`/containerd/`、`.git.backup-*`
- **密钥/环境**：`.env`、`.env.*`（保留 `*.env.example`）、`*.pem`、`*.key`、`id_rsa`、`id_ed25519`
- **缓存/日志**：`__pycache__/`、`*.pyc`、`*.log`、`logs/`

---

## 五、密钥与敏感信息处理

### 5.1 配置环境变量（推荐做法）

生产配置统一放 `/opt/aiprogram/backend/.env`（已被 `.gitignore` 排除），由 systemd 服务通过 `EnvironmentFile=` 注入：

```env
# /opt/aiprogram/backend/.env  ── 这个文件不会被 git 追踪
DJANGO_SECRET_KEY=请用 openssl rand -hex 32 生成
DJANGO_DEBUG=0
DJANGO_ALLOWED_HOSTS=8ms.ai,www.8ms.ai,api.8ms.ai
DB_NAME=aiproject
DB_USER=aiproject
DB_PASSWORD=请改成强密码
DB_HOST=127.0.0.1
DB_PORT=3306
OPENROUTER_API_KEY=sk-or-v1-xxxxx
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
CSRF_TRUSTED_ORIGINS=https://8ms.ai,https://www.8ms.ai
```

代码侧通过 `os.environ.get(...)` 读取，可参考 `aiprogram/backend/aiproject/settings.py`。

### 5.2 不慎把密钥写进代码怎么办？

**步骤 1 — 立刻吊销。** 任何被 push（或 push 失败但已经发往 GitHub）的密钥都视为泄露，必须到对应平台后台撤销并重新生成，例如：

- OpenRouter：<https://openrouter.ai/keys>
- OpenAI：<https://platform.openai.com/api-keys>
- 阿里云：访问凭证管理 → 删除并新建

**步骤 2 — 从工作区清除。** 把硬编码改为环境变量读取后正常 commit。

**步骤 3 — 从历史清除（按情况选）。**

- **远程仓库还没合入这条历史**（比如刚刚的本次情况）：
  ```bash
  # 删除本地 .git 重建，或者 reset --soft 到一个干净点后强推
  git reset --soft <某个早于泄露的 commit>
  git commit --amend
  git push --force-with-lease origin main
  ```
- **远程已经有了**：用 [`git filter-repo`](https://github.com/newren/git-filter-repo) 重写历史并强推（会影响协作者）：
  ```bash
  pip install git-filter-repo
  git filter-repo --path aiprogram/backend/aiproject/settings.py --invert-paths
  # 或者按内容替换
  echo "sk-or-v1-xxxxx==>***REMOVED***" > /tmp/redact.txt
  git filter-repo --replace-text /tmp/redact.txt
  git push --force origin main
  ```

### 5.3 GitHub Push Protection 报错怎么读

错误日志里有这一段是关键：

```
—— OpenRouter API Key ————————————————————————
 locations:
   - commit: <hash>
     path: <文件路径>:<行号>
```

`commit` 字段是含密钥的那次提交的 SHA。**注意：它不一定是 `HEAD`**，可能是历史中的某次。所以只清当前文件没用，必须重写包含该 commit 的整段历史。

---

## 六、分支与发布策略

### 6.1 推荐工作流（单人/小团队）

```text
main          ── 始终可部署，仅合入已测试通过的提交
 │
 ├─ feat/xxx  ── 单个功能开发分支
 ├─ fix/xxx   ── 修 bug 分支
 └─ release/v1.x ── 发布前的 RC 分支（可选）
```

### 6.2 创建并切换分支

```bash
git checkout -b feat/billing-aggregate          # 新建并切过去
# ... 开发 ...
git add -A && git commit -m "feat(billing): xxx"
git push -u origin feat/billing-aggregate
```

### 6.3 在 GitHub 上发起 Pull Request

1. 在 GitHub 仓库页 → Compare & pull request
2. base = `main`，compare = `feat/billing-aggregate`
3. 标题/描述按 3.3 的约定式提交风格
4. 自审：CI 跑过 + 没有泄露 → Merge

### 6.4 合并完毕后回收分支

```bash
git checkout main
git pull origin main
git branch -d feat/billing-aggregate           # 删本地
git push origin --delete feat/billing-aggregate # 删远端
```

### 6.5 打 Tag 发布版本

```bash
git tag -a v1.0.0 -m "v1.0.0: first public release"
git push origin v1.0.0
# 删除 Tag（如打错）
git tag -d v1.0.0
git push origin :refs/tags/v1.0.0
```

---

## 七、常见问题与事故恢复

### 7.1 push 被拒绝：`non-fast-forward`

远程有别人提交过，你本地落后了。

```bash
git pull --rebase origin main      # 先把远端合下来（rebase 更线性）
# 解决冲突后：
git add <冲突文件>
git rebase --continue
git push origin main
```

### 7.2 push 被拒绝：`GH013 ... contains secrets`

参见 §5.2 与 §5.3，**不要走 GitHub 给的「allow secret」链接**。

### 7.3 想撤销刚刚的 commit（还没 push）

```bash
git reset --soft HEAD~1     # 撤销 commit，保留改动在暂存区
git reset --mixed HEAD~1    # 撤销 commit + 取消暂存，改动还在工作区（默认）
git reset --hard HEAD~1     # 撤销 commit 并丢弃改动（危险！）
```

### 7.4 想撤销已经 push 的 commit

**安全做法（推荐）—— 用 revert 生成一个反向 commit：**

```bash
git revert <commit-hash>
git push origin main
```

**强制覆盖做法（仅在没人 pull 过、且自己很确定时使用）：**

```bash
git reset --hard <要回到的 commit>
git push --force-with-lease origin main
```

> `--force-with-lease` 比 `--force` 安全：如果远端期间被别人推过新提交，会拒绝覆盖。

### 7.5 误删了文件，想从 git 找回

```bash
# 工作区删了，还没 commit
git restore 路径/到/文件

# 已经 commit 删除了，想从历史拉回
git checkout <某次还有该文件的 commit> -- 路径/到/文件
```

### 7.6 stash：临时收起改动

```bash
git stash push -m "WIP: billing 接口未完工"
git pull origin main
git stash list
git stash pop          # 取出最近一次
git stash drop stash@{0}  # 直接丢弃
```

### 7.7 `nothing to commit` 但确实改了文件

可能是因为这些文件已经被 `.gitignore` 排除。用 `git check-ignore -v 文件` 验证。如果确实需要追踪，编辑 `.gitignore` 增加例外规则（前缀 `!`）。

### 7.8 误把 `.env` 提交了

```bash
git rm --cached aiprogram/backend/.env
git commit -m "chore: untrack .env"
git push origin main
# ⚠️ 然后必须立即重置 .env 里的所有密钥/密码，旧值视为已泄露
```

---

## 八、备份与回滚

### 8.1 本地 `.git` 备份策略

切换分支、强推、`reset --hard` 前最好先备份：

```bash
cp -a /opt/.git /opt/.git.backup-$(date +%Y%m%d-%H%M%S)
```

恢复：

```bash
rm -rf /opt/.git
mv /opt/.git.backup-20260518-145251 /opt/.git
```

### 8.2 远程紧急回滚到上一个 tag

```bash
git fetch --tags
git checkout v1.0.0
git checkout -b hotfix/rollback-v1.0.0
# 部署/验证
git push -u origin hotfix/rollback-v1.0.0
```

### 8.3 查看 reflog（"后悔药"）

任何引用变动（commit、reset、rebase、checkout）都记在 reflog 里，30 天内可恢复：

```bash
git reflog                       # 看所有动作
git reset --hard HEAD@{3}        # 回到 3 步之前的 HEAD
```

---

## 附录 A：常用命令速查

```bash
# 查看
git status                              # 当前状态
git log --oneline --graph --all -20     # 最近 20 条提交图
git diff <commitA> <commitB>            # 两个 commit 间差异
git blame 文件                            # 看每行最后由谁改

# 远程
git remote -v                           # 看远程地址
git remote set-url origin <新地址>       # 改远程地址
git fetch --prune                       # 拉取并清掉已删除的远端分支

# 撤销
git restore 文件                          # 撤销未暂存改动
git restore --staged 文件                 # 取消暂存
git reset --soft HEAD~1                 # 撤销最近一次 commit（保留改动）

# 历史
git cherry-pick <hash>                  # 把别的分支的某次提交搬过来
git log --follow 文件                     # 看某个文件的完整历史（含改名）
```

## 附录 B：本仓库一次性事故复盘（2026-05-18）

- **现象**：`git push -u origin main` 被 GitHub Push Protection 拒绝，提示 `GH013 ... OpenRouter API Key`。
- **根因**：早期把整个 `/opt` 作为仓库 + `git add -A`，把含明文 `OPENROUTER_API_KEY` 的 `settings.py` 与 release tar.gz 一起提交，密钥保留在历史 commit `1326921` 中。
- **处置**：
  1. 备份 `/opt/.git` 到 `/opt/.git.backup-20260518-145251`；
  2. 重写完整的 `/opt/.gitignore`，新增 `*.tar.gz`、`/backups/`、`/containerd/`、`venv/`、`node_modules/`、`.env*`、release 解压目录等；
  3. `git init -b main` 重建仓库，仅追踪源码（文件数 7732 → 288）；
  4. 单条 `chore: initial commit (clean history, gitignore tightened)` 提交；
  5. `git push -u origin main --force` 成功。
- **教训**：
  - 仓库根**不要**选 `/opt` 这种系统目录的"全包式"位置；
  - 任何 `git add -A` 之前必须先核对 `git status` + `.gitignore`；
  - 配置类敏感值统一走 `.env` + `os.environ.get(...)`；
  - 一旦 push 失败提示包含 secret，**先撤销密钥，再清历史**。
