import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "G-Buddy",
    short_name: "G-Buddy",
    description: "AI grow companion for managing multiple plants, logs, and assistant actions.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0d00358e",
    theme_color: "#00461280",
    icons: [
      {
        src: "/g-icon.png",
        sizes: "any",
        type: "image/png"
      }
    ]
  };
}
