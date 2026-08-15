import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tanstackStart({
      srcDirectory: "app",
      prerender: {
        enabled: true,
        autoStaticPathsDiscovery: true,
        crawlLinks: true,
        failOnError: true,
      },
      pages: [
        {
          path: "/404",
          sitemap: { exclude: true },
          prerender: {
            crawlLinks: false,
            outputPath: "/404.html",
          },
        },
      ],
    }),
    viteReact(),
    tailwindcss(),
  ],
  server: {
    port: 3000,
    allowedHosts: ["localhost", "127.0.0.1", "0.0.0.0", "josevalerio.com"],
  },
});
