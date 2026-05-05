import { ImageResponse } from "next/og";
import { APP_CONFIG } from "@/lib/config";

// Browser tab favicon. Next.js auto-routes this to /icon and emits the
// proper <link rel="icon"> tag in <head>.

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: APP_CONFIG.brandColor,
          borderRadius: 7,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          viewBox="0 0 32 32"
          width="22"
          height="22"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M 5 16 C 9 10, 23 10, 27 16 C 23 22, 9 22, 5 16 Z"
            fill="none"
            stroke="white"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path
            d="M 10.5 18 L 14 14.5 L 17.5 16.5 L 21.5 12.5"
            fill="none"
            stroke="white"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    { ...size },
  );
}
