"use client";

import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { ModelProviderLogo } from "@/components/model-provider-logo";
import {
  ShieldCheck,
  Crown,
  Headphones,
  Settings,
  Rocket,
  Building2,
  Code,
} from "lucide-react";

export default function ModelsPage() {
  const t = useTranslations("models");

  const advantages = [
    { icon: ShieldCheck, key: "official" },
    { icon: Crown, key: "enterprise" },
    { icon: Headphones, key: "support" },
    { icon: Settings, key: "flexible" },
  ];

  const audiences = [
    { icon: Rocket, key: "startup" },
    { icon: Building2, key: "enterprise" },
    { icon: Code, key: "developer" },
  ];

  const supportedModels = [
    { name: "OpenAI GPT-4o", provider: "openai", badge: "OA", accentRgb: "96, 165, 250" },
    { name: "Claude 4 Sonnet", provider: "anthropic", badge: "CL", accentRgb: "250, 204, 21" },
    { name: "Gemini 2.0 Pro", provider: "gemini", badge: "GM", accentRgb: "167, 139, 250" },
    { name: "DeepSeek-R1", provider: "deepseek", badge: "DS", accentRgb: "34, 211, 238" },
    { name: "Qwen 2.5", provider: "qwen", badge: "QW", accentRgb: "45, 212, 191" },
    { name: "Llama 3.1", provider: "llama", badge: "LL", accentRgb: "129, 140, 248" },
    { name: "Mistral Large", provider: "mistral", badge: "MS", accentRgb: "248, 113, 113" },
    { name: "Grok-3", provider: "xai", badge: "GK", accentRgb: "244, 114, 182" },
    { name: "Midjourney V6", provider: "midjourney", badge: "MJ", accentRgb: "192, 132, 252" },
    { name: "Stable Diffusion 3", provider: "stability", badge: "SD", accentRgb: "56, 189, 248" },
  ];

  return (
    <div>
      {/* Hero */}
      <section className="relative py-24 sm:py-32 overflow-hidden grid-pattern">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/15 rounded-full blur-[128px]" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-accent/15 rounded-full blur-[128px]" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight">
              {t("hero.title")}
              <br />
              <span className="gradient-text">{t("hero.titleHighlight")}</span>
            </h1>
            <p className="mt-6 mx-auto max-w-2xl text-lg text-muted-foreground leading-relaxed">
              {t("hero.description")}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Supported models showcase */}
      <section className="py-16 border-t border-border overflow-hidden">
        <div className="premium-ticker-shell px-4 sm:px-6 lg:px-8">
          <div className="hero-model-track">
            {[...supportedModels, ...supportedModels].map(
              ({ name, provider, badge, accentRgb }, index) => (
                <div
                  key={`${name}-${index}`}
                  className="hero-model-card"
                  style={
                    {
                      "--model-accent-rgb": accentRgb,
                    } as CSSProperties
                  }
                >
                  <span className="hero-model-icon">
                    <ModelProviderLogo provider={provider} fallback={badge} />
                  </span>
                  <span className="hero-model-name">{name}</span>
                </div>
              ),
            )}
          </div>
        </div>
      </section>

      {/* Advantages */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-16">
            {t("advantages.title")}
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {advantages.map(({ icon: Icon, key }, i) => (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass-card rounded-xl p-6 text-center transition-all duration-300"
              >
                <div className="mx-auto h-14 w-14 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-4">
                  <Icon className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  {t(`advantages.${key}.title`)}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t(`advantages.${key}.description`)}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Audience */}
      <section className="py-24 sm:py-32 border-t border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-16">
            {t("audience.title")}
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {audiences.map(({ icon: Icon, key }, i) => (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass-card rounded-xl p-8 text-center transition-all duration-300"
              >
                <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-6">
                  <Icon className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">
                  {t(`audience.${key}.title`)}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {t(`audience.${key}.description`)}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 sm:py-32 border-t border-border relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold">{t("cta.title")}</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            {t("cta.description")}
          </p>
          <button className="mt-8 px-8 py-3 rounded-lg bg-gradient-to-r from-primary to-accent text-white font-medium text-lg hover:opacity-90 transition-opacity">
            {t("cta.button")}
          </button>
        </div>
      </section>
    </div>
  );
}
