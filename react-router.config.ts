import { copyFile } from "node:fs/promises";
import { join } from "node:path";
import type { Config } from "@react-router/dev/config";

export default {
  ssr: false,
  prerender: true,
  async buildEnd({ reactRouterConfig }) {
    const clientBuildDirectory = join(
      reactRouterConfig.buildDirectory,
      "client",
    );

    // Cloudflare's static 404 mode expects this filename. React Router emits
    // the client-only fallback as __spa-fallback.html when / is pre-rendered.
    await copyFile(
      join(clientBuildDirectory, "__spa-fallback.html"),
      join(clientBuildDirectory, "404.html"),
    );
  },
} satisfies Config;
