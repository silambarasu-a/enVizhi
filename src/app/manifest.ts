import type { MetadataRoute } from "next";
import { APP_CONFIG } from "@/lib/config";

// PWA manifest — gives Android, Chrome on desktop, and "Add to Home Screen"
// flows the right name + icon + theme color. The icons reference the
// Next.js-generated routes (/icon, /apple-icon) so we never hand-author PNGs.

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_CONFIG.name,
    short_name: APP_CONFIG.shortName,
    description: APP_CONFIG.tagline,
    start_url: "/",
    display: "standalone",
    background_color: "#FAFAFA",
    theme_color: APP_CONFIG.brandColor,
    icons: [
      {
        src: "/icon",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
