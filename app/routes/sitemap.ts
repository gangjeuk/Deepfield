import type { LoaderFunctionArgs } from "react-router";

import {
  getLocaleLandingUrl,
  getPageDate,
  isIndexPage,
  localeRegistry,
  resolveCoverUrl,
  type SiteLocale,
  type SourcePageLike,
} from "~/lib/docs";

type ChangeFrequency = "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";

type SitemapEntry = {
  alternates?: Array<{ href: string; hreflang: string }>;
  changefreq?: ChangeFrequency;
  image?: { loc: string; title?: string };
  loc: string;
  lastmod?: string;
  priority?: number;
};

const localePaths = (Object.keys(localeRegistry) as SiteLocale[]).map((locale) => `/${locale}`);

function getSiteOrigin(request: Request) {
  const configuredOrigin =
    process.env.SITE_URL ?? process.env.APP_URL ?? process.env.PUBLIC_SITE_URL;

  const origin = configuredOrigin || new URL(request.url).origin;

  return origin.endsWith("/") ? origin.slice(0, -1) : origin;
}

function toAbsoluteUrl(origin: string, path: string) {
  return new URL(path, `${origin}/`).toString();
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function toIsoDate(date: Date | null) {
  return date?.toISOString();
}

function clampPriority(value: number) {
  return Math.max(0, Math.min(1, value));
}

function formatPriority(value?: number) {
  return typeof value === "number" ? clampPriority(value).toFixed(1) : undefined;
}

function getAgeInDays(date: Date | null) {
  if (!date) return null;

  const diff = Date.now() - date.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function getPageChangeFrequency(date: Date | null, indexPage: boolean): ChangeFrequency {
  const ageInDays = getAgeInDays(date);

  if (ageInDays === null) {
    return indexPage ? "monthly" : "yearly";
  }

  if (ageInDays <= 30) return "weekly";
  if (ageInDays <= 180) return "monthly";
  if (ageInDays <= 365) return "yearly";

  return indexPage ? "yearly" : "never";
}

function getHreflangFromPath(path: string) {
  const segments = path.split("/").filter(Boolean);
  return segments.at(-1) ?? "x-default";
}

function buildAlternateLinks(origin: string, paths: string[], defaultPath = "/") {
  const alternates = paths.map((path) => {
    return {
      href: toAbsoluteUrl(origin, path),
      hreflang: getHreflangFromPath(path),
    };
  });

  return [
    ...alternates,
    {
      href: toAbsoluteUrl(origin, defaultPath),
      hreflang: "x-default",
    },
  ];
}

function renderEntry(entry: SitemapEntry) {
  const lastmodTag = entry.lastmod ? `<lastmod>${escapeXml(entry.lastmod)}</lastmod>` : "";
  const changefreqTag = entry.changefreq ? `<changefreq>${entry.changefreq}</changefreq>` : "";
  const priority = formatPriority(entry.priority);
  const priorityTag = priority ? `<priority>${priority}</priority>` : "";
  const alternateTags =
    entry.alternates?.map((alternate) => {
      return `<xhtml:link rel="alternate" hreflang="${escapeXml(alternate.hreflang)}" href="${escapeXml(alternate.href)}" />`;
    }) ?? [];
  const imageTag = entry.image
    ? `<image:image><image:loc>${escapeXml(entry.image.loc)}</image:loc>${
        entry.image.title ? `<image:title>${escapeXml(entry.image.title)}</image:title>` : ""
      }</image:image>`
    : "";

  return [
    "<url>",
    `<loc>${escapeXml(entry.loc)}</loc>`,
    ...alternateTags,
    lastmodTag,
    changefreqTag,
    priorityTag,
    imageTag,
    "</url>",
  ].join("");
}

export async function loader({ request }: LoaderFunctionArgs) {
  const { source } = await import("~/lib/source.server");
  const origin = getSiteOrigin(request);
  const entries = new Map<string, SitemapEntry>();
  const localeAlternates = buildAlternateLinks(origin, localePaths);
  const docsLocalePaths = (Object.keys(localeRegistry) as SiteLocale[])
    .map((locale) => getLocaleLandingUrl(source.pageTree, locale))
    .filter((path): path is string => Boolean(path));
  const docsLocaleAlternates =
    docsLocalePaths.length > 0
      ? buildAlternateLinks(
          origin,
          docsLocalePaths,
          docsLocalePaths.includes("/docs/en") ? "/docs/en" : docsLocalePaths[0],
        )
      : undefined;

  entries.set(toAbsoluteUrl(origin, "/"), {
    alternates: localeAlternates,
    changefreq: "weekly",
    loc: toAbsoluteUrl(origin, "/"),
    priority: 1,
  });

  for (const path of localePaths) {
    const loc = toAbsoluteUrl(origin, path);
    entries.set(loc, {
      alternates: localeAlternates,
      changefreq: "weekly",
      loc,
      priority: 0.9,
    });
  }

  for (const page of source.getPages() as unknown as SourcePageLike[]) {
    const pageDate = getPageDate(page);
    const pageIsIndex = isIndexPage(page);
    const cover = resolveCoverUrl(page);
    const loc = toAbsoluteUrl(origin, page.url);
    const lastmod = toIsoDate(pageDate);
    const isLocaleLanding = docsLocalePaths.includes(page.url);

    entries.set(loc, {
      ...(lastmod ? { lastmod } : {}),
      ...(cover
        ? {
            image: {
              loc: toAbsoluteUrl(origin, cover),
              title: typeof page.data.title === "string" ? page.data.title : undefined,
            },
          }
        : {}),
      alternates: isLocaleLanding ? docsLocaleAlternates : undefined,
      changefreq: getPageChangeFrequency(pageDate, pageIsIndex),
      loc,
      priority: isLocaleLanding ? 0.8 : pageIsIndex ? 0.7 : 0.6,
    });
  }

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...Array.from(entries.values()).map(renderEntry),
    "</urlset>",
  ].join("");

  return new Response(body, {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
