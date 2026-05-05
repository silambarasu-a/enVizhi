import type { MetadataRoute } from "next";

const BASE_URL = process.env.AUTH_URL ?? "http://localhost:3005";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Block every authenticated route + the API + auth flow.
        // The signin form itself stays crawlable so the entry point is indexed.
        disallow: [
          "/api/",
          "/dashboard",
          "/screener",
          "/watchlists",
          "/watchlists/",
          "/portfolio",
          "/portfolio/",
          "/alerts",
          "/stock/",
          "/signin/check-email",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
