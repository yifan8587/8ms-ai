import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function Footer() {
  const t = useTranslations("footer");
  const tc = useTranslations("common");

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <div className="mb-4">
              <div className="footer-brand-banner relative h-[4.2rem] w-[10.2rem] sm:h-[4.45rem] sm:w-[10.8rem]">
                <Image
                  src="/brand-banner.png"
                  alt="8MS.AI"
                  fill
                  sizes="172px"
                  unoptimized
                  className="footer-brand-banner-image"
                />
              </div>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {tc("slogan")}
            </p>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold">{t("product")}</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/resources"
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {t("productModels")}
                </Link>
              </li>
              <li>
                <Link
                  href="/accelerate"
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {t("productAccelerate")}
                </Link>
              </li>
              <li>
                <Link
                  href="/account"
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {t("productAccounts")}
                </Link>
              </li>
              <li>
                <Link
                  href="/pricing"
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {t("productPricing")}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold">{t("resources")}</h3>
            <ul className="space-y-2">
              <li>
                <span className="text-sm text-muted-foreground">
                  {t("tickets")}
                </span>
              </li>
              <li>
                <Link
                  href="/knowledge"
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {t("docs")}
                </Link>
              </li>
              <li>
                <span className="text-sm text-muted-foreground">
                  {t("blog")}
                </span>
              </li>
              <li>
                <span className="text-sm text-muted-foreground">
                  {t("status")}
                </span>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold">{t("company")}</h3>
            <ul className="space-y-2">
              <li>
                <span className="text-sm text-muted-foreground">
                  {t("about")}
                </span>
              </li>
              <li>
                <span className="text-sm text-muted-foreground">
                  {t("contact")}
                </span>
              </li>
              <li>
                <span className="text-sm text-muted-foreground">
                  {t("terms")}
                </span>
              </li>
              <li>
                <span className="text-sm text-muted-foreground">
                  {t("privacy")}
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-border pt-8 text-center">
          <p className="text-sm text-muted-foreground">{t("copyright")}</p>
        </div>
      </div>
    </footer>
  );
}
