import { notFound } from "next/navigation";
import {
  fetchPortalResourceModelDetail,
  ResourceDetailPageView,
  type ResourceCatalogModel,
} from "@/modules/resources";

type ResourceDetailPageProps = {
  params: Promise<{
    locale: string;
    modelId: string;
  }>;
};

export default async function Page({ params }: ResourceDetailPageProps) {
  const { locale, modelId } = await params;
  const decodedModelId = decodeURIComponent(modelId);
  let model: ResourceCatalogModel;

  try {
    model = await fetchPortalResourceModelDetail(decodedModelId);
  } catch {
    notFound();
  }

  return <ResourceDetailPageView locale={locale} model={model} />;
}
