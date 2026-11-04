import type { MetadataRoute } from "next"

// Makes WeTrack installable. iPhone and iPad only allow push notifications to a site added to the Home Screen.
// Icons are the logo's "w." (public/icons, app/apple-icon.png); the maskable one keeps it inside the safe zone.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WeTrack",
    short_name: "WeTrack",
    description: "Development tasks, deadlines and releases — without the spreadsheet.",
    start_url: "/",
    display: "standalone",
    background_color: "#f0f0f0",
    theme_color: "#f0f0f0",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
