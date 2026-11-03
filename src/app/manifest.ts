import type { MetadataRoute } from "next";

// HighStrike as an app on the home screen (Ben, 2026-11-03: the homepage's "HighStrike, right on your phone"). Opens
// full screen on the dashboard, dark like the app. The admin keeps its own manifest (public/admin.webmanifest).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HighStrike",
    short_name: "HighStrike",
    description: "Options education, tools and smart scanning: fresh trade ideas every morning.",
    id: "/",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#0a0f12",
    theme_color: "#0a0f12",
    icons: [
      { src: "/app-icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/app-icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/app-icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
