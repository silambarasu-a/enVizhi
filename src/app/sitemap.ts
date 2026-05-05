import type { MetadataRoute } from "next";

const BASE_URL = process.env.AUTH_URL ?? "http://localhost:3005";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  // Only public, indexable URLs. Stock detail pages stay behind auth in v1
  // (so robots.ts disallows /stock/) — when they go public, list them here.
  return [
    {
      url: `${BASE_URL}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/signin`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
