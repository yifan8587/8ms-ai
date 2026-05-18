"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { motion } from "framer-motion";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { mockPricingPlans } from "@/lib/api/mock-data";
import type { Locale } from "@/i18n/config";

export default function PricingPage() {
  const t = useTranslations("pricing");
  const params = useParams();
  const locale = (params.locale as Locale) || "zh";
  const [yearly, setYearly] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold">{t("title")}</h1>
          <p className="mt-4 text-lg text-muted-foreground">{t("subtitle")}</p>

          {/* Toggle */}
          <div className="mt-8 inline-flex items-center gap-3 bg-muted rounded-lg p-1">
            <button
              onClick={() => setYearly(false)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                !yearly ? "bg-background text-foreground" : "text-muted-foreground"
              }`}
            >
              {t("monthly")}
            </button>
            <button
              onClick={() => setYearly(true)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                yearly ? "bg-background text-foreground" : "text-muted-foreground"
              }`}
            >
              {t("yearly")}
            </button>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {t("yearlyHint")}
          </p>
        </div>

        {/* Plans */}
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-5 max-w-[96rem] mx-auto">
          {mockPricingPlans.map((plan, i) => {
            const price = yearly ? plan.priceYearly : plan.price;
            const features =
              locale === "en" ? plan.featuresEn : plan.features;
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`rounded-2xl p-8 flex flex-col relative ${
                  plan.popular
                    ? "glass-card ring-2 ring-primary"
                    : "glass-card"
                }`}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-primary to-accent text-white text-xs font-medium">
                    {t("popular")}
                  </span>
                )}

                <h3 className="text-xl font-bold">
                  {locale === "en" ? plan.nameEn : plan.name}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {locale === "en" ? plan.descriptionEn : plan.description}
                </p>

                <div className="mt-6 mb-8">
                  {price === -1 ? (
                    <span className="text-3xl font-bold">{t("customLabel")}</span>
                  ) : price === 0 ? (
                    <span className="text-3xl font-bold">{t("freeLabel")}</span>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold">${price}</span>
                      <span className="text-muted-foreground text-sm">
                        {yearly ? t("perYear") : t("perMonth")}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-3 mb-8">
                  <p className="text-sm font-medium text-muted-foreground">
                    {t("features")}
                  </p>
                  {features.map((feature, fi) => (
                    <div key={fi} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-success shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </div>

                {plan.cta === "subscribe" ? (
                  <Link
                    href="/auth/register"
                    className={`w-full py-3 rounded-lg text-center font-medium transition-all ${
                      plan.popular
                        ? "bg-gradient-to-r from-primary to-accent text-white hover:opacity-90"
                        : "bg-muted text-foreground hover:bg-muted/80"
                    }`}
                  >
                    {t("subscribe")}
                  </Link>
                ) : (
                  <button className="w-full py-3 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground transition-colors font-medium">
                    {t("contactSales")}
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* FAQ */}
        <div className="mt-24 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">
            {t("faq.title")}
          </h2>
          <div className="space-y-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="glass-card rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === n ? null : n)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left"
                >
                  <span className="font-medium">{t(`faq.q${n}`)}</span>
                  {openFaq === n ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                {openFaq === n && (
                  <div className="px-6 pb-4 text-sm text-muted-foreground leading-relaxed">
                    {t(`faq.a${n}`)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
