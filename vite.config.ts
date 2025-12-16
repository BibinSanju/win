import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/win/",
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico"],
      manifest: {
        name: "WIN - Video Test Platform",
        short_name: "WIN",
        start_url: "/win/",
        scope: "/win/",
        display: "standalone",
        background_color: "#000000",
        theme_color: "#000000",
        icons: [
          { src: "/win/pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/win/pwa-512x512.png", sizes: "512x512", type: "image/png" },
        ],
      },
    }),
  ],
});
