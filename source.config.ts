import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import { visit } from "unist-util-visit";

const youtubeHosts = new Set(["www.youtube.com", "youtube.com", "youtu.be"]);

function rewriteUnsupportedExternalImages() {
  return (tree: unknown) => {
    visit(tree as any, "image", (node: any, index: number | undefined, parent: any) => {
      if (typeof index !== "number" || !parent || typeof node.url !== "string") return;

      let parsedUrl: URL;
      try {
        parsedUrl = new URL(node.url);
      } catch {
        return;
      }

      if (!youtubeHosts.has(parsedUrl.hostname)) return;

      parent.children[index] = {
        type: "paragraph",
        children: [
          {
            type: "link",
            url: node.url,
            title: node.title ?? null,
            children: [
              {
                type: "text",
                value: node.alt || node.url,
              },
            ],
          },
        ],
      };
    });
  };
}

function normalizeSameDocumentLinks() {
  return (_tree: unknown, file: { path?: string }) => {
    visit(_tree as any, "link", (node: any) => {
      if (typeof node.url !== "string" || !node.url.includes("#")) return;

      const [rawPath, rawHash] = node.url.split("#", 2);
      if (!rawHash) return;

      const normalizedPath = rawPath.replace(/^\.?\//, "");
      const currentPath = file.path?.replaceAll("\\", "/").split("/").pop();

      if (!normalizedPath || !currentPath) return;
      if (normalizedPath !== currentPath) return;

      node.url = `#${rawHash}`;
    });
  };
}

export default defineConfig({
  mdxOptions: {
    remarkStructureOptions: false,
    rehypeCodeOptions: {
      fallbackLanguage: "plaintext",
      themes: {
        dark: "github-dark",
        light: "github-light",
      },
      langAlias: {
        dataview: "plaintext",
        "embed-c": "c",
        math: "plaintext",
      },
    },
    // Obsidian assets are already copied into /public by scripts/generate.ts,
    // so MDX should keep absolute asset URLs instead of turning them into imports.
    remarkImageOptions: {
      external: false,
      onError: "ignore",
      useImport: false,
      publicDir: "public",
    },
    remarkPlugins: [remarkMath, rewriteUnsupportedExternalImages, normalizeSameDocumentLinks],
    rehypePlugins: [rehypeKatex],
  },
});

export const docs = defineDocs({
  dir: "content/docs",
});
