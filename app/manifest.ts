import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Peptiking Spending",
    short_name: "Peptiking",
    description: "Capture team spending and receipt proof.",
    id: "/",
    scope: "/",
    start_url: "/",
    display: "standalone",
    background_color: "#f2f5f9",
    theme_color: "#102a56",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
