import { getRemoteApiBaseUrl } from "@/lib/api/base-url";

function buildTargetUrl(pathSegments: string[], search: string) {
  const baseUrl = getRemoteApiBaseUrl();
  const path = pathSegments.map(encodeURIComponent).join("/");
  return `${baseUrl}/${path}/${search}`;
}

async function proxyRequest(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const url = new URL(request.url);
  const targetUrl = buildTargetUrl(path, url.search);

  const headers = new Headers(request.headers);
  headers.delete("host");
  // The upstream API validates forwarded hostnames and rejects the public
  // trycloudflare.com host when we proxy browser requests through the tunnel.
  headers.delete("x-forwarded-host");

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  const upstream = await fetch(targetUrl, init);
  const responseHeaders = new Headers(upstream.headers);

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  return proxyRequest(request, context);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  return proxyRequest(request, context);
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  return proxyRequest(request, context);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  return proxyRequest(request, context);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  return proxyRequest(request, context);
}
