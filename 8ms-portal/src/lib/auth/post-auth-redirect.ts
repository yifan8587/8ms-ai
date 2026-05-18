/**
 * 登录 / 注册成功后的统一跳转入口。
 *
 * 业务背景：
 *   8ms-portal (Next.js 门户) 与 aiprogram/frontend (Vue 管理后台) 部署在
 *   同一域名下，由 nginx 路径分发：
 *     /            → Next.js 门户（本应用）
 *     /console/    → Vue 管理后台（独立服务，监听 127.0.0.1:5173）
 *
 *   产品需求：用户在门户登录 / 注册成功后，自动进入 Vue 工作区的聊天页
 *   `/console/chat`，并且不需要再次输入账号密码（依赖 session-storage
 *   把 token 共享到 Vue 端 localStorage 实现 SSO）。
 *
 * 由于 /console/ 不在 Next.js 路由表里，必须用 window.location.assign 做
 * 硬跳转；router.push("/console/...") 会被识别成站内路由从而 404。
 *
 * 跳转目标可通过环境变量自定义：
 *   NEXT_PUBLIC_POST_LOGIN_REDIRECT=/console/chat        （默认）
 *   NEXT_PUBLIC_POST_LOGIN_REDIRECT=/                    （保留站内逻辑，登录后停留门户）
 *   NEXT_PUBLIC_POST_LOGIN_REDIRECT=https://other.example.com/dashboard
 *
 * 安全说明：
 *   出于安全考虑，跳转 URL **不会**携带密码（密码绝不应出现在 URL / 日志 / referer
 *   中）。真正的免二次登录依赖 localStorage 共享 JWT。query 中仅附带用户名
 *   `u=<username>` 与来源标记 `from=portal`，便于 Vue 端做欢迎语 / 埋点。
 */
const DEFAULT_REDIRECT = "/console/chat";

export type RedirectAfterAuthOptions = {
  /**
   * 当 NEXT_PUBLIC_POST_LOGIN_REDIRECT 显式设为 "/" 或 "" 时调用，由调用方
   * 用 next-intl 的 router.push 做站内导航（保留客户端路由能力）。
   */
  fallbackRouter?: () => void;

  /**
   * 当前登录用户名。如果提供，会被追加到跳转 URL 的 query 中（u=...&from=portal）。
   * 仅用于 Vue 端识别来源；密码绝不会被携带。
   */
  username?: string;
};

function resolveTarget(): string {
  const fromEnv = process.env.NEXT_PUBLIC_POST_LOGIN_REDIRECT?.trim();
  if (fromEnv === undefined || fromEnv === "") {
    return DEFAULT_REDIRECT;
  }
  return fromEnv;
}

function appendPortalQuery(target: string, username?: string): string {
  // 站内静态路径才追加 query，避免污染外部 URL
  if (target === "/" || target === "") return target;
  if (!username) return target;

  try {
    // 完整 URL：用 URL 构造器追加 query
    if (/^https?:\/\//i.test(target)) {
      const u = new URL(target);
      u.searchParams.set("from", "portal");
      u.searchParams.set("u", username);
      return u.toString();
    }
    // 相对路径：手工拼接，保留可能存在的 hash
    const [pathAndQuery, hash = ""] = target.split("#", 2);
    const [path, existingQuery = ""] = pathAndQuery.split("?", 2);
    const params = new URLSearchParams(existingQuery);
    params.set("from", "portal");
    params.set("u", username);
    const qs = params.toString();
    return `${path}?${qs}${hash ? `#${hash}` : ""}`;
  } catch {
    return target;
  }
}

export function redirectAfterAuth(options: RedirectAfterAuthOptions = {}) {
  if (typeof window === "undefined") {
    return;
  }

  const target = resolveTarget();

  // 显式配置成站内首页时，走 next-intl 路由，避免不必要的整页刷新
  if (target === "/" && options.fallbackRouter) {
    options.fallbackRouter();
    return;
  }

  const finalUrl = appendPortalQuery(target, options.username);
  window.location.assign(finalUrl);
}
