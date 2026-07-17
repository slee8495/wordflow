import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wordflow",
    short_name: "Wordflow",
    description: "Daily 5-10 minute Bible reading — story-style, with context and today's message.",
    start_url: "/",
    display: "standalone",
    background_color: "#faf3e6",
    theme_color: "#9c4726",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png" },
    ],
  };
}
