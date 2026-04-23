declare module "collections/server" {
  import type { MetaData, PageData } from "fumadocs-core/source";
  import type { DocsCollectionEntry } from "fumadocs-mdx/runtime/server";

  type Frontmatter = PageData & {
    full?: boolean;
    _openapi?: Record<string, unknown>;
  };

  export const docs: DocsCollectionEntry<"docs", Frontmatter, MetaData>;
}
