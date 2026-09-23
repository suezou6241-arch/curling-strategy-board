import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages のサブパス(/curling-strategy-board/)で配信する
  base: "/curling-strategy-board/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "apple-touch-icon.png",
        "pwa-192.png",
        "pwa-512.png",
        "pwa-maskable-512.png",
      ],
      manifest: {
        name: "カーリング作戦ボード",
        short_name: "作戦ボード",
        description:
          "スマホ縦画面でカーリングの作戦を組み立てるデジタル作戦ボード",
        lang: "ja",
        theme_color: "#0b3d2e",
        background_color: "#0b3d2e",
        display: "standalone",
        orientation: "portrait",
        start_url: "./",
        scope: "./",
        icons: [
          {
            src: "pwa-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "pwa-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // アプリシェルを全キャッシュしてオフライン起動を可能にする
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        navigateFallback: "index.html",
      },
    }),
  ],
  server: {
    host: true,
  },
});
