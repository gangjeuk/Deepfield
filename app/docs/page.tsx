import { useFumadocsLoader } from "fumadocs-core/source/client";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/layouts/docs/page";
import type { MDXComponents } from "mdx/types";
import type { ReactNode } from "react";
import { redirect, useLoaderData } from "react-router";

import type { Route } from "./+types/page";
import type { DocGitHistoryManifest } from "~/lib/git.server";

import browserCollections from "collections/browser";
import { DocsGitHistory } from "~/components/docs-git-history";
import { getMDXComponents } from "~/components/mdx";
import gitHistoryManifest from "~/lib/generated/doc-git-history.json";
import {
  buildLocaleTabs,
  buildLocaleTree,
  getLocaleFromSlug,
  getLocaleLandingUrl,
} from "~/lib/docs";
import { baseOptions } from "~/lib/layout.shared";
import { getPageImage } from "~/lib/og";

type SourcePage = {
  absolutePath?: string;
  slugs: string[];
  url: string;
  path: string;
  data: {
    cover?: string | null;
    created?: string;
    description?: string;
    tags?: string[] | null;
    title?: string;
    toc?: unknown[];
    updated?: string;
  };
};

type TocItem = {
  depth: number;
  title: string;
  url: string;
};

function flattenTocTitle(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (Array.isArray(value)) {
    const flattened = value
      .map((entry) => flattenTocTitle(entry))
      .filter((entry): entry is string => Boolean(entry))
      .join("")
      .trim();

    return flattened.length > 0 ? flattened : null;
  }

  if (typeof value === "object" && value !== null) {
    if ("props" in value) {
      const props = (value as { props?: { children?: unknown } }).props;
      return flattenTocTitle(props?.children);
    }

    if ("children" in value) {
      return flattenTocTitle((value as { children?: unknown }).children);
    }
  }

  return null;
}

function normalizeTocItems(items: unknown[] | undefined): TocItem[] {
  return (items ?? []).flatMap((item) => {
    if (typeof item !== "object" || item === null) {
      return [];
    }

    const candidate = item as {
      depth?: unknown;
      title?: unknown;
      url?: unknown;
    };
    const title = flattenTocTitle(candidate.title);

    if (typeof candidate.url !== "string" || typeof candidate.depth !== "number" || !title) {
      return [];
    }

    return [
      {
        depth: candidate.depth,
        title,
        url: candidate.url,
      },
    ];
  });
}

function getSlugParts(value?: string) {
  return value?.split("/").filter(Boolean) ?? [];
}

function getPageFromSlug(
  source: {
    getPage: (slug: string[]) => SourcePage | null | undefined;
  },
  slug: string[],
): SourcePage | null {
  const encodedSlug = slug.map((segment) => encodeURI(segment));

  return source.getPage(slug) ?? source.getPage(encodedSlug) ?? null;
}

const docGitHistory = gitHistoryManifest as DocGitHistoryManifest;
const docsBodyLoader = browserCollections.docs.createClientLoader<{
  components?: MDXComponents;
}>({
  component: (loaded, props) => {
    const MDX = loaded.default as (input: { components?: MDXComponents }) => ReactNode;
    return <MDX components={props.components} />;
  },
});

export async function loader({ params }: Route.LoaderArgs) {
  const slug = getSlugParts(params["*"]);
  const locale = getLocaleFromSlug(slug);
  const { source } = await import("~/lib/source.server");
  const page = getPageFromSlug(source, slug);

  if (!page) {
    const localeLandingUrl =
      locale && slug.length === 1 ? getLocaleLandingUrl(source.pageTree, locale) : null;

    if (localeLandingUrl) {
      throw redirect(localeLandingUrl);
    }

    throw new Response("Not Found", { status: 404 });
  }

  const tree = buildLocaleTree(source.pageTree, locale, page.url);
  const tabs = buildLocaleTabs(source.pageTree);
  const changes = docGitHistory[page.path] ?? [];
  let toc = normalizeTocItems(page.data.toc);

  if (toc.length === 0 && page.absolutePath) {
    const [{ readFile }, { getTableOfContents }] = await Promise.all([
      import("node:fs/promises"),
      import("fumadocs-core/content/toc"),
    ]);
    const content = await readFile(page.absolutePath, "utf-8");
    toc = normalizeTocItems(await getTableOfContents(content));
  }

  return {
    changes,
    page: {
      data: {
        cover: page.data.cover ?? null,
        created: page.data.created,
        description: page.data.description,
        tags: page.data.tags ?? null,
        title: page.data.title ?? "",
        updated: page.data.updated,
      },
      path: page.path,
      slugs: page.slugs,
      toc,
      url: page.url,
    },
    tabs: tabs.map((tab) => ({
      description: typeof tab.description === "string" ? tab.description : undefined,
      title: typeof tab.title === "string" ? tab.title : undefined,
      url: tab.url,
    })),
    tree: await source.serializePageTree(tree),
  };
}

export default function DocsCatchAll() {
  const data = useLoaderData<typeof loader>();
  const { tree } = useFumadocsLoader({ tree: data.tree });
  const page = data.page;
  const toc = page.toc ?? [];
  const tocEnabled = toc.length > 0 || data.changes.length > 0;
  const mdx = docsBodyLoader.useContent(page.path, {
    components: getMDXComponents(page),
  });

  return (
    <>
      <meta property="og:image" content={getPageImage(page.slugs).url} />

      <DocsLayout {...baseOptions()} tree={tree} tabs={data.tabs} sidebar={{ collapsible: false }}>
        <DocsPage
          toc={toc}
          tableOfContent={{
            enabled: tocEnabled,
            footer: (
              <DocsGitHistory
                createdAt={data.page.data.created ?? null}
                entries={data.changes}
                updatedAt={data.page.data.updated ?? null}
              />
            ),
            style: "clerk",
          }}
          tableOfContentPopover={{
            enabled: tocEnabled,
            footer: (
              <DocsGitHistory
                compact
                createdAt={data.page.data.created ?? null}
                entries={data.changes}
                updatedAt={data.page.data.updated ?? null}
              />
            ),
            style: "clerk",
          }}
        >
          <DocsTitle>{page.data.title}</DocsTitle>
          {page.data.description ? (
            <DocsDescription>{page.data.description}</DocsDescription>
          ) : null}
          <DocsBody>{mdx}</DocsBody>
        </DocsPage>
      </DocsLayout>
    </>
  );
}
