import { getApiBaseUrl } from "@/lib/api/base-url";
import {
  normalizePortalResourceModel,
  type PortalModelGroup,
  type PortalModelSummary,
} from "../model";

type ApiEnvelope<T> = {
  code?: number;
  msg?: string;
  message?: string;
  data?: T;
};

async function parseApiResponse<T>(response: Response): Promise<T> {
  const json = (await response.json().catch(() => null)) as ApiEnvelope<T> | T | null;

  if (!response.ok) {
    const envelope = json as ApiEnvelope<T> | null;
    const message =
      envelope?.msg ??
      envelope?.message ??
      `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  if (
    json &&
    typeof json === "object" &&
    "data" in json &&
    (json as ApiEnvelope<T>).data !== undefined
  ) {
    return (json as ApiEnvelope<T>).data as T;
  }

  return json as T;
}

function isPortalModelGroup(
  value: PortalModelSummary | PortalModelGroup,
): value is PortalModelGroup {
  return Array.isArray((value as PortalModelGroup).models);
}

function flattenPortalResourceModels(
  payload: Array<PortalModelSummary | PortalModelGroup>,
): PortalModelSummary[] {
  return payload.flatMap((item) => {
    if (!isPortalModelGroup(item)) {
      return [item];
    }

    return (item.models ?? []).map((model) => ({
      ...model,
      business_type: model.business_type ?? item.business_type,
      business_type_display:
        model.business_type_display ?? item.business_type_display,
    }));
  });
}

export async function fetchPortalResourceModels(options?: { signal?: AbortSignal }) {
  const response = await fetch(`${getApiBaseUrl()}/chat/portal/models/`, {
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
    signal: options?.signal,
  });

  const payload =
    await parseApiResponse<Array<PortalModelSummary | PortalModelGroup>>(response);

  return Array.isArray(payload)
    ? flattenPortalResourceModels(payload).map((model, index) =>
        normalizePortalResourceModel(model, index),
      )
    : [];
}

export async function fetchPortalResourceModelDetail(
  modelId: string,
  options?: { signal?: AbortSignal },
) {
  const response = await fetch(
    `${getApiBaseUrl()}/chat/portal/models/${encodeURIComponent(modelId)}/`,
    {
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
      signal: options?.signal,
    },
  );

  const model = await parseApiResponse<PortalModelSummary>(response);

  return normalizePortalResourceModel(model, 0);
}
