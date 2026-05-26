"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ShieldAlert, X } from "lucide-react";

/**
 * 服务区域限制合规声明飘窗。
 *
 * 业务背景：
 *   为满足《生成式人工智能服务管理暂行办法》、《数据安全法》、
 *   《个人信息保护法》等法规要求，需要在用户访问门户时主动告知
 *   服务区域限制，并取得用户对相关条款的知悉确认。
 *
 * 设计要点：
 *   - 仅在客户端运行，避免 SSR 时影响首屏渲染；
 *   - 首次访问弹出，确认后写入 localStorage[ACK_KEY] 并按版本号去重，
 *     如需强制重新弹（例如修订声明），把 ACK_VERSION 升级一位即可；
 *   - Esc 关闭 / 蒙层点击关闭 / 关闭按钮 三种关闭手段都视为"确认知悉"；
 *   - 焦点陷阱：弹窗打开时把焦点移到主按钮，避免键盘用户迷路；
 *   - 文案完全走 next-intl，中英文同源。
 */
const ACK_KEY = "8ms.compliance.ack";
const ACK_VERSION = "2026-05-v1";

type ComplianceItem = {
  title: string;
  body: string;
};

export default function ComplianceNotice() {
  const t = useTranslations("compliance");
  const [open, setOpen] = useState(false);
  const primaryBtnRef = useRef<HTMLButtonElement | null>(null);

  // 首次进入站点（或声明版本升级后）才弹出
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const ack = window.localStorage.getItem(ACK_KEY);
      if (ack !== ACK_VERSION) {
        setOpen(true);
      }
    } catch {
      // localStorage 不可用（隐私模式 / 配额满）时直接弹一次，不阻塞页面
      setOpen(true);
    }
  }, []);

  // 锁定背景滚动 + 焦点初始化
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const timer = window.setTimeout(() => {
      primaryBtnRef.current?.focus();
    }, 50);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleClose() {
    try {
      window.localStorage.setItem(ACK_KEY, ACK_VERSION);
    } catch {
      // 忽略写入失败，不影响关闭体验
    }
    setOpen(false);
  }

  // i18n.raw 取出数组，做最低限度的类型断言
  const items = (t.raw("items") as ComplianceItem[]) ?? [];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          role="presentation"
          onClick={handleClose}
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 px-4 pb-6 pt-10 backdrop-blur-md sm:items-center sm:p-6"
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="compliance-title"
            aria-describedby="compliance-intro"
            onClick={(event) => event.stopPropagation()}
            className="glass-card relative w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[rgba(15,17,30,0.92)] p-6 shadow-2xl sm:p-8"
          >
            {/* 顶部装饰光晕 */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-indigo-500/25 via-fuchsia-500/10 to-transparent"
            />

            <button
              type="button"
              onClick={handleClose}
              aria-label={t("closeLabel")}
              className="absolute right-4 top-4 z-10 rounded-full p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="relative">
              <div className="mb-5 flex items-start gap-3">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400/25 to-rose-500/25 ring-1 ring-amber-300/40">
                  <ShieldAlert className="h-5 w-5 text-amber-300" />
                </span>
                <div className="min-w-0">
                  <h2
                    id="compliance-title"
                    className="text-lg font-bold leading-tight text-white sm:text-xl"
                  >
                    {t("title")}
                  </h2>
                  <p className="mt-1 text-sm text-slate-300">{t("greeting")}</p>
                </div>
              </div>

              <p
                id="compliance-intro"
                className="mb-5 text-sm leading-relaxed text-slate-300"
              >
                {t("intro")}
              </p>

              <ol className="mb-6 max-h-[42vh] space-y-3 overflow-y-auto pr-1 sm:max-h-none">
                {items.map((item, index) => (
                  <li
                    key={item.title}
                    className="rounded-xl border border-white/8 bg-white/[0.03] p-3.5 sm:p-4"
                  >
                    <div className="mb-1.5 flex items-center gap-2">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500/25 text-[11px] font-semibold text-indigo-200">
                        {index + 1}
                      </span>
                      <h3 className="text-sm font-semibold text-white">
                        {item.title}
                      </h3>
                    </div>
                    <p className="text-[13px] leading-relaxed text-slate-300">
                      {item.body}
                    </p>
                  </li>
                ))}
              </ol>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
                <Link
                  href="/terms"
                  onClick={handleClose}
                  className="text-center text-sm text-slate-400 underline-offset-4 transition-colors hover:text-white hover:underline sm:text-left"
                >
                  {t("moreLabel")}
                </Link>
                <button
                  ref={primaryBtnRef}
                  type="button"
                  onClick={handleClose}
                  className="header-cta rounded-full px-5 py-2.5 text-sm font-medium text-white"
                >
                  {t("agreeLabel")}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
