import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "G-Buddy",
    short_name: "G-Buddy",
    description: "AI grow companion for managing multiple plants, logs, and assistant actions.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#09070f",
    theme_color: "#8b3dff",
    icons: [
      {
        src: "/gbuddy-icon.svg",
        sizes: "any",
        type: "image/svg+xml"
      }
    ]
  };
}
