import { resolve } from "node:path";

import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import mdx from "fumadocs-mdx/vite";
import { defineConfig, normalizePath } from "vite";

import * as mdxConfig from "./source.config";

function docsFullReloadPlugin() {
  const watchedRoots = [normalizePath(resolve("content/docs")), normalizePath(resolve(".source"))];
  const invalidateTargets = [
    normalizePath(resolve("app/lib/source.ts")),
    normalizePath(resolve("app/docs/page.tsx")),
    normalizePath(resolve("app/docs/search.ts")),
    normalizePath(resolve(".source/server.ts")),
    normalizePath(resolve(".source/browser.ts")),
    normalizePath(resolve(".source/dynamic.ts")),
  ];
  const reloadDebounceMs = Number(process.env.DOCS_RELOAD_DEBOUNCE ?? 50);

  let timer: NodeJS.Timeout | undefined;

  return {
    name: "local-docs-full-reload",
    configureServer(server: import("vite").ViteDevServer) {
      server.watcher.add(watchedRoots);

      const queueReload = (changedFile: string) => {
        const changed = normalizePath(changedFile);
        const directModules = server.moduleGraph.getModulesByFile(changedFile) ?? [];

        for (const mod of directModules) {
          server.moduleGraph.invalidateModule(mod);
        }

        for (const target of invalidateTargets) {
          const targetModules = server.moduleGraph.getModulesByFile(target) ?? [];
          for (const mod of targetModules) {
            server.moduleGraph.invalidateModule(mod);
          }
        }

        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          server.ws.send({
            type: "full-reload",
            path: "*",
          });
          server.config.logger.info(
            `[docs-reload] full reload triggered by ${normalizePath(changed)}`,
            { clear: false, timestamp: true },
          );
        }, reloadDebounceMs);
      };

      server.watcher.on("all", (_event, file) => {
        const normalized = normalizePath(file);
        if (watchedRoots.some((root) => normalized.startsWith(root))) {
          queueReload(file);
        }
      });
    },
  };
}

export default defineConfig({
  build: {
    manifest: true,
    minify: true,
  },
  publicDir: false,
  plugins: [
    tailwindcss(),
    mdx(mdxConfig),
    docsFullReloadPlugin(),
    reactRouter(),
    cloudflare({ configPath: "./wranglerc.json" }),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  ssr: {
    external: ["@takumi-rs/image-response"],
  },
});
