import type { Metadata, Viewport } from "next";
import { InstallApp } from "./install-app";
import { headers } from "next/headers";
import "./globals.css";

export const viewport: Viewport = { themeColor: "#102a56" };

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");

  return {
    metadataBase: new URL(`${protocol}://${host}`),
    title: {
      default: "Peptiking",
      template: "%s · Peptiking",
    },
    description: "A fast, mobile-first spending tracker for your whole team.",
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, title: "Peptiking", statusBarStyle: "default" },
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "256x256", type: "image/x-icon" },
        { url: "/icon.png", sizes: "512x512", type: "image/png" },
      ],
      apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
    openGraph: {
      title: "Peptiking",
      description: "Team spending, sorted.",
      type: "website",
      images: [{ url: "/og.png", width: 1731, height: 909, alt: "Peptiking — Team spending, sorted." }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Peptiking",
      description: "Team spending, sorted.",
      images: ["/og.png"],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}<InstallApp /></body>
    </html>
  );
}
