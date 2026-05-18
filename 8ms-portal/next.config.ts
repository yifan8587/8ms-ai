import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const backendApiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://127.0.0.1:8090/api";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.trycloudflare.com"],
  async rewrites() {
    return [
      {
        source: "/backend-api/:path*",
        destination: `${backendApiBaseUrl.replace(/\/+$/, "")}/:path*`,
        locale: false,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
