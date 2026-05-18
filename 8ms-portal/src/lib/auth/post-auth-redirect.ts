/**
 * 登录 / 注册成功后的统一跳转入口。
 *
 * 业务背景：
 *   8ms_code (Next.js 门户) 与 AIprogram/ai-frontend (Vue 管理后台) 部署在
 *   同一域名下，由 nginx 路径分发：
 *     /            → Next.js 门户（本应用）
 *     /console/    → Vue 管理后台（独立服务，监听 127.0.0.1:5173）
 *
 *   产品需求：用户在门户登录 / 注册成功后，自动进入 /console/ 工作区，
 *   并且不需要再次输入账号密码（依赖 session-storage 把 token 共享到 Vue
 *   端 localStorage 实现 SSO）。
 *
 * 由于 /console/ 不在 Next.js 路由表里，必须用 window.location.assign 做
 * 硬跳转；router.push("/console/") 会被识别成站内路由从而 404。
 *
 * 跳转目标可通过环境变量自定义：
 *   NEXT_PUBLIC_POST_LOGIN_REDIRECT=/console/   （默认）
 *   NEXT_PUBLIC_POST_LOGIN_REDIRECT=/           （保留站内逻辑，登录后停留门户）
 *   NEXT_PUBLIC_POST_LOGIN_REDIRECT=https://other.example.com/dashboard
 */
const DEFAULT_REDIRECT = "/console/";

export type RedirectAfterAuthOptions = {
  /**
   * 当 NEXT_PUBLIC_POST_LOGIN_REDIRECT 显式设为 "/" 或 "" 时调用，由调用方
   * 用 next-intl 的 router.push 做站内导航（保留客户端路由能力）。
   */
  fallbackRouter?: () => void;
};

function resolveTarget(): string {
  const fromEnv = process.env.NEXT_PUBLIC_POST_LOGIN_REDIRECT?.trim();
  if (fromEnv === undefined || fromEnv === "") {
    return DEFAULT_REDIRECT;
  }
  return fromEnv;
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

  window.location.assign(target);
}
