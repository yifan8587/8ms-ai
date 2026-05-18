"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { useAuthStore } from "@/lib/store/auth-store";
import { Globe, LogOut, Menu, X } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import type { Locale } from "@/i18n/config";

const navItems = [
  { href: "/", key: "home" },
  { href: "/resources", key: "resources" },
  { href: "/accelerate", key: "accelerate" },
  { href: "/account", key: "models" },
  { href: "/pricing", key: "pricing" },
  { href: "/knowledge", key: "knowledge" },
] as const;

export default function Header() {
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const { user, logout, hydrate } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const currentLocale = (params.locale as Locale) || "zh";
  const targetLocale = currentLocale === "zh" ? "en" : "zh";
  const isEnglish = currentLocale === "en";
  const brandImageAlt =
    currentLocale === "zh"
      ? "8MS.AI 品牌 Logo"
      : "8MS.AI brand logo";

  const switchLocale = () => {
    router.push(`/${targetLocale}${pathname}`);
  };

  return (
    <header className="fixed left-0 right-0 top-0 z-50">
      <div className="mx-auto max-w-[88rem] px-4 pt-3 sm:px-6 lg:px-8">
        <div
          className={`header-shell transition-all duration-300 ${
            scrolled
              ? "header-shell-scrolled rounded-[1.75rem]"
              : "rounded-[1.75rem]"
          }`}
        >
          <div className="header-grid items-center gap-3 px-3 py-3.5 sm:px-4 lg:gap-4 lg:px-5 lg:py-4">
            <Link
              href="/"
              aria-label={tc("brand")}
              className="brand-lockup-link header-brand-slot flex min-w-0 shrink-0 items-center"
            >
              <div className="brand-logo-frame relative h-[4.55rem] w-[14.5rem] sm:h-[4.9rem] sm:w-[16rem] lg:h-[5.25rem] lg:w-[17.25rem] xl:h-[5.8rem] xl:w-[19.75rem] 2xl:h-[6.2rem] 2xl:w-[21.5rem]">
                <Image
                  src="/brand-banner.png"
                  alt={brandImageAlt}
                  fill
                  sizes="(max-width: 640px) 232px, (max-width: 1024px) 256px, (max-width: 1280px) 276px, (max-width: 1536px) 316px, 344px"
                  priority
                  unoptimized
                  className="brand-logo-image"
                />
              </div>
            </Link>

            <nav
              className={`premium-nav-shell hidden min-w-0 items-center justify-center rounded-full p-1.5 lg:flex ${
                isEnglish ? "nav-shell-en gap-0" : "gap-1"
              }`}
            >
              {navItems.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={`premium-nav-item rounded-full py-2.5 text-sm transition-all duration-300 ${
                      isEnglish
                        ? "nav-item-en px-3 lg:px-3.5 xl:px-4"
                        : "px-[1.15rem]"
                    } ${
                      isActive
                        ? "premium-nav-item-active text-white"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {t(item.key)}
                  </Link>
                );
              })}
            </nav>

            <div className="header-actions-slot ml-auto flex shrink-0 items-center gap-2.5">
              <button
                onClick={switchLocale}
                className="header-utility rounded-full p-2.5 text-slate-400 transition-all duration-300 hover:text-white"
                title={targetLocale === "en" ? "English" : "中文"}
              >
                <Globe className="h-4 w-4" />
              </button>

              {user ? (
                <div className="hidden items-center gap-2.5 lg:flex">
                  <span className="max-w-[9rem] truncate text-sm text-slate-300">
                    {user.name}
                  </span>
                  <button
                    onClick={logout}
                    className="header-utility rounded-full p-2.5 text-slate-400 transition-all duration-300 hover:text-white"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="hidden items-center gap-2.5 lg:flex">
                  <Link
                    href="/auth/login"
                    className={`header-action-link px-3.5 py-2 text-sm text-slate-400 transition-colors hover:text-white ${
                      isEnglish ? "lg:px-3.5 xl:px-4" : "tracking-[0.08em]"
                    }`}
                  >
                    {tc("login")}
                  </Link>
                  <Link
                    href="/auth/register"
                    className={`header-cta rounded-full px-4.5 py-2.5 text-sm font-medium text-white ${
                      isEnglish ? "lg:px-4.5 xl:px-5" : ""
                    }`}
                  >
                    {tc("getStarted")}
                  </Link>
                </div>
              )}

              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="header-utility rounded-full p-2.5 text-slate-400 transition-all duration-300 hover:text-white lg:hidden"
              >
                {mobileOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div className="lg:hidden">
          <nav className="header-shell header-shell-scrolled mx-auto mt-3 flex max-w-[88rem] flex-col gap-1 rounded-[1.75rem] px-4 py-4 backdrop-blur-2xl sm:px-6 lg:px-8">
            {navItems.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`rounded-xl px-3 py-2 text-sm tracking-[0.06em] transition-colors ${
                    isActive
                      ? "premium-nav-item-active text-white"
                      : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
                  }`}
                >
                  {t(item.key)}
                </Link>
              );
            })}

            <div className="mt-4 flex flex-col gap-2 border-t border-white/8 pt-4">
              {user ? (
                <button
                  onClick={() => {
                    logout();
                    setMobileOpen(false);
                  }}
                  className="rounded-xl px-3 py-2 text-sm text-slate-400"
                >
                  {tc("logout")}
                </button>
              ) : (
                <>
                  <Link
                    href="/auth/login"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-xl px-3 py-2 text-sm text-slate-400"
                  >
                    {tc("login")}
                  </Link>
                  <Link
                    href="/auth/register"
                    onClick={() => setMobileOpen(false)}
                    className="header-cta rounded-xl px-3 py-2 text-center text-sm font-medium text-white"
                  >
                    {tc("getStarted")}
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
