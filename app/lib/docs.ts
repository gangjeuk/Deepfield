import { findPath, flattenTree, type Folder, type Node, type Root } from "fumadocs-core/page-tree";
import type { LayoutTab } from "fumadocs-ui/layouts/shared";

import rawDocAssetsManifest from "./generated/doc-assets.json";
import rawDocFrontmatterManifest from "./generated/doc-frontmatter.json";

export const localeRegistry = {
  en: { label: "English", nativeLabel: "English", flag: "US" },
  jp: { label: "Japanese", nativeLabel: "日本語", flag: "JP" },
  kr: { label: "Korean", nativeLabel: "한국어", flag: "KR" },
} as const;

const docAssetsManifest = rawDocAssetsManifest as Record<string, string[]>;
const docFrontmatterManifest = rawDocFrontmatterManifest as Record<
  string,
  {
    cover?: string | null;
  }
>;

const localeOrder = ["en", "jp", "kr"] as const;

export type SiteLocale = keyof typeof localeRegistry;

export type SourcePageLike = {
  url: string;
  path: string;
  data: {
    title?: string;
    description?: string;
    updated?: string;
    created?: string;
    cover?: string | null;
    tags?: string[] | null;
  };
};

function isFolder(node: Node): node is Folder {
  return node.type === "folder";
}

export function isSiteLocale(value?: string): value is SiteLocale {
  return value === "en" || value === "jp" || value === "kr";
}

export function getLocaleFromSlug(slug: string[]): SiteLocale | undefined {
  return isSiteLocale(slug[0]) ? slug[0] : undefined;
}

function getUrlLocale(url?: string): SiteLocale | undefined {
  if (!url) return undefined;

  const [, docsPrefix, locale] = url.split("/");
  if (docsPrefix !== "docs") return undefined;

  return isSiteLocale(locale) ? locale : undefined;
}

function getFolderLocale(folder: Folder): SiteLocale | undefined {
  const firstPageUrl = folder.index?.url ?? flattenTree(folder.children)[0]?.url;
  return getUrlLocale(firstPageUrl);
}

function getFolderLandingUrl(folder: Folder) {
  return folder.index?.url ?? flattenTree(folder.children)[0]?.url ?? null;
}

function cloneNode(node: Node): Node {
  if (node.type === "folder") {
    const children = node.children.map(cloneNode);

    if (node.index) {
      children.unshift({ ...node.index });
    }

    return {
      ...node,
      index: undefined,
      children,
    };
  }

  return { ...node };
}

function cloneRoot(root: Root): Root {
  return {
    ...root,
    children: root.children.map(cloneNode),
  };
}

function withExpandedFolders(tree: Root, currentUrl?: string): Root {
  const cloned = cloneRoot(tree);
  const activePath = currentUrl
    ? findPath(cloned.children, (node) => node.type === "page" && node.url === currentUrl)
    : null;
  const activeFolderIds = new Set(
    activePath
      ?.filter((node): node is Folder => node.type === "folder")
      .map((node) => node.$id)
      .filter(Boolean),
  );

  function expand(node: Node, depth: number): Node {
    if (node.type !== "folder") return { ...node };

    return {
      ...node,
      index: node.index ? { ...node.index } : undefined,
      defaultOpen: depth < 1 || activeFolderIds.has(node.$id),
      children: node.children.map((child) => expand(child, depth + 1)),
    };
  }

  return {
    ...cloned,
    children: cloned.children.map((node) => expand(node, 0)),
  };
}

export function buildLocaleTree(
  tree: Root,
  locale: SiteLocale | undefined,
  currentUrl?: string,
): Root {
  if (!locale) return withExpandedFolders(tree, currentUrl);

  const localeFolder = tree.children.find(
    (child): child is Folder => isFolder(child) && getFolderLocale(child) === locale,
  );

  if (!localeFolder) return withExpandedFolders(tree, currentUrl);

  return withExpandedFolders(
    {
      ...tree,
      name: localeRegistry[locale].nativeLabel,
      description: `${localeRegistry[locale].label} archive`,
      children: localeFolder.children.map(cloneNode),
    },
    currentUrl,
  );
}

export function getLocaleLandingUrl(tree: Root, locale: SiteLocale) {
  const localeFolder = tree.children.find(
    (child): child is Folder => isFolder(child) && getFolderLocale(child) === locale,
  );

  return localeFolder ? getFolderLandingUrl(localeFolder) : null;
}

export function buildLocaleTabs(tree: Root): LayoutTab[] {
  const entries = tree.children.flatMap((child) => {
    if (!isFolder(child)) return [];

    const locale = getFolderLocale(child);
    if (!locale) return [];

    const pages = [...(child.index ? [child.index] : []), ...flattenTree(child.children)];
    const landingUrl = getFolderLandingUrl(child);

    if (!landingUrl) return [];

    return [
      {
        url: landingUrl,
        title: localeRegistry[locale].nativeLabel,
        description: localeRegistry[locale].label,
        urls: new Set(pages.map((page) => page.url)),
      } satisfies LayoutTab,
    ];
  });

  return entries.sort((left, right) => {
    const leftIndex = localeOrder.findIndex(
      (locale) => left.urls?.has(`/docs/${locale}`) || left.url.startsWith(`/docs/${locale}`),
    );
    const rightIndex = localeOrder.findIndex(
      (locale) => right.urls?.has(`/docs/${locale}`) || right.url.startsWith(`/docs/${locale}`),
    );

    return leftIndex - rightIndex;
  });
}

export function getPageLocale(page: SourcePageLike): SiteLocale | undefined {
  return getUrlLocale(page.url);
}

export function isIndexPage(page: SourcePageLike) {
  return page.path.endsWith("/index.mdx") || page.path === "index.mdx";
}

export function getPageDate(page: SourcePageLike) {
  const value = page.data.updated ?? page.data.created;
  const date = value ? new Date(value) : null;

  return date && !Number.isNaN(date.valueOf()) ? date : null;
}

export function getPageSection(page: SourcePageLike) {
  const segments = page.path
    .replace(/\.mdx?$/, "")
    .split("/")
    .filter(Boolean);
  const [, section, subsection] = segments;

  return [section, subsection].filter(Boolean).join(" / ") || "Archive";
}

export function parseCoverAssetName(cover: unknown) {
  if (typeof cover !== "string") return null;

  const match = cover.match(/\[\[(.+?)]]/);
  const value = match ? match[1] : cover;
  const [fileName] = value.split("|");

  return fileName?.trim() || null;
}

function encodePath(path: string) {
  return path
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function buildAssetProxyUrl(path: string) {
  const query = new URLSearchParams({
    path: path.replace(/^\/+/, ""),
  });

  return `/docs-asset?${query.toString()}`;
}

function scoreAssetCandidate(page: SourcePageLike, candidate: string) {
  const pageSegments = page.path
    .replace(/\.mdx?$/, "")
    .split("/")
    .filter(Boolean);
  const candidateSegments = candidate.split("/").filter(Boolean);
  let score = 0;

  for (let index = 0; index < Math.min(pageSegments.length, candidateSegments.length); index += 1) {
    if (pageSegments[index]?.toLowerCase() !== candidateSegments[index]?.toLowerCase()) break;
    score += 1;
  }

  const locale = getPageLocale(page);
  if (locale && candidateSegments[0]?.toLowerCase() === locale) {
    score += 2;
  }

  return score;
}

function resolveManifestCoverUrl(assetName: string, page: SourcePageLike) {
  const candidates = docAssetsManifest[assetName];
  if (!Array.isArray(candidates) || candidates.length === 0) return null;

  const candidate = [...candidates].sort((left, right) => {
    return scoreAssetCandidate(page, right) - scoreAssetCandidate(page, left);
  })[0];

  return candidate ?? null;
}

export function resolveDocumentAssetUrl(src: string, page: SourcePageLike) {
  const normalizedSrc = src.trim();

  if (!normalizedSrc || /^https?:\/\//i.test(normalizedSrc) || normalizedSrc.startsWith("data:")) {
    return normalizedSrc;
  }

  const cleanSrc = normalizedSrc.replace(/^<|>$/g, "");
  const fileName = cleanSrc.split("/").filter(Boolean).at(-1);

  if (!fileName) {
    return buildAssetProxyUrl(cleanSrc);
  }

  const manifestAssetPath = resolveManifestCoverUrl(fileName, page);
  if (!manifestAssetPath) {
    return buildAssetProxyUrl(cleanSrc);
  }

  return buildAssetProxyUrl(manifestAssetPath);
}

export function resolveCoverUrl(page: SourcePageLike) {
  const rawCover = page.data.cover ?? docFrontmatterManifest[page.path]?.cover ?? null;

  if (typeof rawCover === "string") {
    const normalizedCover = rawCover.trim();

    if (/^https?:\/\//i.test(normalizedCover)) {
      return normalizedCover;
    }
  }

  const assetName = parseCoverAssetName(rawCover);
  if (!assetName) return null;

  if (/^https?:\/\//i.test(assetName)) {
    return assetName;
  }

  if (assetName.startsWith("/")) {
    return buildAssetProxyUrl(assetName);
  }

  if (assetName.includes("/")) {
    return buildAssetProxyUrl(assetName);
  }

  const segments = page.path.replace(/\.mdx?$/, "").split("/");
  const fileName = segments.pop();
  const parent = segments.join("/");

  if (!fileName) return null;

  const pageAssetPath = `${parent}/assets/${fileName}/${assetName}`;
  const manifestAssetPath = resolveManifestCoverUrl(assetName, page);

  return buildAssetProxyUrl(manifestAssetPath ?? pageAssetPath);
}

export function summarizePage(page: SourcePageLike) {
  if (typeof page.data.description === "string" && page.data.description.trim().length > 0) {
    return page.data.description.trim();
  }

  const tags = Array.isArray(page.data.tags)
    ? page.data.tags.filter((tag): tag is string => typeof tag === "string")
    : [];

  if (tags.length > 0) return tags.slice(0, 3).join(" · ");

  return getPageSection(page);
}

export function sortPagesByDate<T extends SourcePageLike>(pages: T[]) {
  return [...pages].sort((left, right) => {
    const leftDate = getPageDate(left)?.getTime() ?? 0;
    const rightDate = getPageDate(right)?.getTime() ?? 0;
    return rightDate - leftDate;
  });
}
