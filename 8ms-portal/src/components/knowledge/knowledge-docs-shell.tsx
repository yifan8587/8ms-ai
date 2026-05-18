"use client";

import type { Locale } from "@/i18n/config";
import { KnowledgeDocsEntry } from "@/modules/knowledge/entry";

type KnowledgeDocsShellProps = {
  initialArticleId?: string | null;
  locale?: Locale;
};

export default function KnowledgeDocsShell(props: KnowledgeDocsShellProps) {
  return <KnowledgeDocsEntry {...props} />;
}
