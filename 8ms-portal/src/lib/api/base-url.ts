const DEFAULT_REMOTE_API_BASE_URL =
  "http://aiproject.jasonyifan.dpdns.org:30080/api";
const DEFAULT_PROXY_API_BASE_URL = "/api/backend";

export function getRemoteApiBaseUrl() {
  return (
    process.env.BACKEND_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    DEFAULT_REMOTE_API_BASE_URL
  ).replace(/\/+$/, "");
}

export function getApiBaseUrl() {
  if (typeof window !== "undefined") {
    return DEFAULT_PROXY_API_BASE_URL;
  }

  return getRemoteApiBaseUrl();
}
