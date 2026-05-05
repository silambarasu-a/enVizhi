import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";
import { APP_CONFIG } from "@/lib/config";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: `${APP_CONFIG.name} — Stock Tracker, Screener & Analysis`,
    template: `%s · ${APP_CONFIG.name}`,
  },
  description:
    "Screen NSE, BSE, and US stocks. Peter Lynch analysis, watchlists, alerts, and a portfolio tracker. Quotes delayed 15 min.",
  applicationName: APP_CONFIG.name,
  appleWebApp: {
    capable: true,
    title: APP_CONFIG.shortName,
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: APP_CONFIG.brandColor,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="h-full flex flex-col">
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
