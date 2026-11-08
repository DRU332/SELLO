import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sellos · Panel",
    short_name: "Sellos",
    description: "Tarjetas de lealtad digitales",
    start_url: "/panel",
    display: "standalone",
    background_color: "#f8f7f4",
    theme_color: "#1c1917",
    lang: "es-MX",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
