"use client";

import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import {
  Route,
  Globe,
  RefreshCw,
  Plug,
  Monitor,
  Server,
  Network,
  Cloud,
  ArrowRight,
} from "lucide-react";

export default function AcceleratePage() {
  const t = useTranslations("accelerate");

  const features = [
    { icon: Route, key: "smartRouting" },
    { icon: Globe, key: "globalNodes" },
    { icon: RefreshCw, key: "autoFailover" },
    { icon: Plug, key: "transparent" },
  ];

  const archSteps = [
    { icon: Monitor, key: "userSide", color: "from-blue-500 to-blue-600" },
    { icon: Network, key: "backbone", color: "from-accent to-primary" },
    { icon: Server, key: "edgeNode", color: "from-primary to-blue-500" },
    { icon: Cloud, key: "aiProvider", color: "from-purple-500 to-accent" },
  ];

  const comparisonRows = [
    { key: "latency" },
    { key: "stability" },
    { key: "availability" },
    { key: "firstToken" },
  ];

  return (
    <div>
      {/* Hero */}
      <section className="relative py-24 sm:py-32 overflow-hidden grid-pattern">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-accent/15 rounded-full blur-[128px]" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-primary/15 rounded-full blur-[128px]" />
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

      {/* Architecture */}
      <section className="py-24 sm:py-32 border-t border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-16">
            {t("architecture.title")}
          </h2>
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-0">
            {archSteps.map(({ icon: Icon, key, color }, i) => (
              <div key={key} className="flex items-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15 }}
                  className="flex flex-col items-center"
                >
                  <div
                    className={`h-20 w-20 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center shadow-lg`}
                  >
                    <Icon className="h-10 w-10 text-white" />
                  </div>
                  <span className="mt-3 text-sm font-medium">
                    {t(`architecture.${key}`)}
                  </span>
                </motion.div>
                {i < archSteps.length - 1 && (
                  <ArrowRight className="hidden md:block h-6 w-6 text-muted-foreground mx-6" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="py-24 sm:py-32 border-t border-border">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-16">
            {t("comparison.title")}
          </h2>
          <div className="glass-card rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">
                    {t("comparison.metric")}
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-medium text-muted-foreground">
                    {t("comparison.direct")}
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-medium">
                    <span className="gradient-text font-bold">
                      {t("comparison.accelerated")}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map(({ key }, i) => (
                  <motion.tr
                    key={key}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-6 py-4 text-sm font-medium">
                      {t(`comparison.${key}`)}
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-muted-foreground">
                      {t(`comparison.${key}Direct`)}
                    </td>
                    <td className="px-6 py-4 text-center text-sm font-semibold text-success">
                      {t(`comparison.${key}Accelerated`)}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 sm:py-32 border-t border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-16">
            {t("features.title")}
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map(({ icon: Icon, key }, i) => (
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
                  {t(`features.${key}.title`)}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t(`features.${key}.description`)}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 sm:py-32 border-t border-border relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-primary/5" />
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
