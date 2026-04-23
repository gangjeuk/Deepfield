import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, posix, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { frontmatter } from "fumadocs-core/content/md/frontmatter";
import type { VaultFile } from "fumadocs-obsidian";
import { convertVaultFiles, readVaultFiles, writeVaultFiles } from "fumadocs-obsidian";
import GithubSlugger from "github-slugger";
import { visit } from "unist-util-visit";

import { getGitHistoryForTargetPath } from "../app/lib/git.server";

export const vaultDir = process.env.DOCS_VAULT_DIR ?? "../Anecdote";

const defaultExcludedPaths = ["kr/private", "사업"];
const envExcludedPaths = (process.env.DOCS_EXCLUDE_PATHS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

export const excludedVaultPaths = [...new Set([...defaultExcludedPaths, ...envExcludedPaths])];

export const vaultInclude = [
  "**/*",
  "!**/.git/**",
  "!**/.obsidian/**",
  "!**/.trash/**",
  "!**/.DS_Store",
];

export const filterDgPublish =
  (process.env.DOCS_FILTER_DG_PUBLISH ?? "true").toLowerCase() !== "false";

const publishFrontmatterKey = "dg-publish";
const gitHistoryOutputPath = "app/lib/generated/doc-git-history.json";
const assetManifestOutputPath = "app/lib/generated/doc-assets.json";
const frontmatterManifestOutputPath = "app/lib/generated/doc-frontmatter.json";
const coverAssetExtensions = new Set([".avif", ".gif", ".jpeg", ".jpg", ".png", ".svg", ".webp"]);
const markdownExtensions = new Set([".md", ".mdx"]);

type VaultFileIndex = {
  byName: Map<string, VaultFile>;
  byPath: Map<string, VaultFile>;
};

type ParsedWikilink = {
  alias?: string;
  heading?: string;
  name: string;
};

type ObsidianImageOptions = {
  align?: "center" | "left" | "right";
  alt?: string;
  classNames: string[];
  height?: number;
  width?: number;
};

function normalizeRelativePath(value: string) {
  return value
    .replaceAll("\\", "/")
    .replace(/^\.?\//, "")
    .replace(/\/+$/, "");
}

function normalizeUnicode(value: string) {
  return value.normalize("NFC");
}

function normalizeLookupKey(value: string) {
  return normalizeUnicode(normalizeRelativePath(value)).toLowerCase();
}

function isExcludedPath(filePath: string) {
  const normalizedPath = normalizeRelativePath(filePath);

  return excludedVaultPaths.some((prefix) => {
    const normalizedPrefix = normalizeRelativePath(prefix);
    return normalizedPath === normalizedPrefix || normalizedPath.startsWith(`${normalizedPrefix}/`);
  });
}

function isMarkdownFile(filePath: string) {
  const extension = extname(filePath).toLowerCase();
  return markdownExtensions.has(extension);
}

function isTruthyFrontmatterValue(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value !== "string") return false;

  const normalized = value
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .toLowerCase();
  return normalized === "true" || normalized === "yes" || normalized === "on" || normalized === "1";
}

function parseFrontmatterData(content: string) {
  const { data } = frontmatter(content);
  return typeof data === "object" && data !== null ? (data as Record<string, unknown>) : null;
}

function isPublishedDocument(content: string) {
  const data = parseFrontmatterData(content);
  return isTruthyFrontmatterValue(data?.[publishFrontmatterKey]);
}

function normalizeNestedHeadingWikilinks(content: string) {
  return content.replaceAll(/(!?\[\[)([^\]\n]+)(\]\])/g, (_match, open, body, close) => {
    const pipeIndex = body.indexOf("|");
    const target = pipeIndex === -1 ? body : body.slice(0, pipeIndex);
    const alias = pipeIndex === -1 ? "" : body.slice(pipeIndex);
    const headingParts = normalizeUnicode(target).split("#");

    if (headingParts.length < 3) {
      return `${open}${normalizeUnicode(target)}${alias}${close}`;
    }

    const [file, ...sections] = headingParts;
    const finalSection = sections.at(-1);
    if (!file || !finalSection) {
      return `${open}${normalizeUnicode(target)}${alias}${close}`;
    }

    return `${open}${file}#${finalSection}${alias}${close}`;
  });
}

function normalizeMarkdownContentEmbeds(content: string) {
  return content.replaceAll(
    /!\[\[([^\]|#\n]+\.(?:md|mdx))(#[^\]\n]*)?(?:\|([^\]\n]+))?\]\]/gi,
    (_match, target: string, fragment = "", alias = "") => {
      const normalizedTarget = normalizeUnicode(target);
      const normalizedFragment = normalizeUnicode(fragment);
      const normalizedAlias = alias ? `|${normalizeUnicode(alias)}` : "";

      return `[[${normalizedTarget}${normalizedFragment}${normalizedAlias}]]`;
    },
  );
}

function normalizeCodeFenceLanguages(content: string) {
  return content.replaceAll(
    /^(```+|~~~+)(embed-cpp|embed-c)\b/gm,
    (_match, fence: string, language: string) => {
      const normalizedLanguage = language === "embed-cpp" ? "cpp" : "c";
      return `${fence}${normalizedLanguage}`;
    },
  );
}

function parseWikilinkContent(content: string): ParsedWikilink | null {
  let name = "";
  let heading: string | undefined;
  let alias: string | undefined;
  let section: "name" | "heading" | "alias" = "name";
  let escaped = false;

  for (const char of content) {
    if (escaped) {
      const value = char === "#" || char === "|" ? char : `\\${char}`;

      if (section === "alias") alias = `${alias ?? ""}${value}`;
      else if (section === "heading") heading = `${heading ?? ""}${value}`;
      else name += value;

      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === "#" && section === "name") {
      section = "heading";
      heading = "";
      continue;
    }

    if (char === "|" && section !== "alias") {
      section = "alias";
      alias = "";
      continue;
    }

    if (section === "alias") alias = `${alias ?? ""}${char}`;
    else if (section === "heading") heading = `${heading ?? ""}${char}`;
    else name += char;
  }

  if (escaped) {
    if (section === "alias") alias = `${alias ?? ""}\\`;
    else if (section === "heading") heading = `${heading ?? ""}\\`;
    else name += "\\";
  }

  return {
    alias,
    heading,
    name: normalizeUnicode(name.trim()),
  };
}

function buildVaultFileIndex(files: VaultFile[]): VaultFileIndex {
  const byName = new Map<string, VaultFile>();
  const byPath = new Map<string, VaultFile>();

  for (const file of files) {
    const normalizedPath = normalizeUnicode(file.path);
    const extension = extname(normalizedPath);
    const fileName = basename(normalizedPath, extension);

    byPath.set(normalizeLookupKey(normalizedPath), file);
    byPath.set(normalizeLookupKey(normalizedPath.slice(0, -extension.length)), file);
    byName.set(normalizeLookupKey(fileName), file);
    byName.set(normalizeLookupKey(basename(normalizedPath)), file);

    if (!isMarkdownFile(normalizedPath)) {
      const keyWithoutHostSuffix = basename(normalizedPath).replace(
        /-KangJeuk.+?(?=\.[^.]+$)/,
        "",
      );
      byName.set(normalizeLookupKey(keyWithoutHostSuffix), file);
    }

    if (!isMarkdownFile(normalizedPath)) continue;

    const content = typeof file.content === "string" ? file.content : file.content.toString("utf8");
    const data = parseFrontmatterData(content);
    const aliases = data?.aliases;

    if (Array.isArray(aliases)) {
      for (const alias of aliases) {
        if (typeof alias === "string" && alias.trim()) {
          byName.set(normalizeLookupKey(alias), file);
        }
      }
    }
  }

  return { byName, byPath };
}

function resolveIndexedWikilink(
  name: string,
  sourcePath: string,
  index: VaultFileIndex,
): VaultFile | null {
  const normalizedName = normalizeUnicode(name.trim());
  if (!normalizedName) return null;

  const sourceDir = dirname(normalizeUnicode(sourcePath));
  const extension = extname(normalizedName);
  const pathCandidates = [
    normalizedName,
    posix.join(sourceDir, normalizedName),
    extension ? normalizedName.slice(0, -extension.length) : `${normalizedName}.md`,
    extension ? posix.join(sourceDir, normalizedName.slice(0, -extension.length)) : posix.join(sourceDir, `${normalizedName}.md`),
  ];

  for (const candidate of pathCandidates) {
    const resolved = index.byPath.get(normalizeLookupKey(candidate));
    if (resolved) return resolved;
  }

  const nameCandidates = [normalizedName];
  if (extension) {
    nameCandidates.push(normalizedName.slice(0, -extension.length));
  }

  for (const candidate of nameCandidates) {
    const resolved = index.byName.get(normalizeLookupKey(candidate));
    if (resolved) return resolved;
  }

  return null;
}

function isContentFile(file: VaultFile) {
  return isMarkdownFile(file.path);
}

function isImageFile(file: VaultFile) {
  return coverAssetExtensions.has(extname(file.path).toLowerCase());
}

function getRelativeVaultLinkTarget(fromPath: string, targetPath: string) {
  const fromDir = dirname(normalizeUnicode(fromPath));
  let relativeTarget = normalizeOutputPath(posix.relative(fromDir, normalizeUnicode(targetPath)));

  if (!relativeTarget.startsWith(".")) {
    relativeTarget = `./${relativeTarget}`;
  }

  return relativeTarget;
}

function getUnresolvedWikilinkText(parsed: ParsedWikilink) {
  const fallback = parsed.alias?.trim() || parsed.heading?.trim() || parsed.name.trim();
  return fallback || "";
}

function unquoteObsidianOption(value: string) {
  const trimmed = value.trim();
  const quote = trimmed[0];

  if ((quote === '"' || quote === "'") && trimmed.endsWith(quote)) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function parseObsidianImageOptions(alias?: string): ObsidianImageOptions {
  const options: ObsidianImageOptions = { classNames: [] };
  const classNames = new Set<string>();

  for (const rawToken of alias?.split("|") ?? []) {
    const token = unquoteObsidianOption(normalizeUnicode(rawToken.trim()));
    if (!token) continue;

    const dimension = token.match(/^(\d+)(?:\s*[xX]\s*(\d+))?$/);
    if (dimension) {
      options.width = Number(dimension[1]);
      if (dimension[2]) options.height = Number(dimension[2]);
      continue;
    }

    const normalizedToken = token.toLowerCase();
    if (
      normalizedToken === "center" ||
      normalizedToken === "left" ||
      normalizedToken === "right"
    ) {
      options.align = normalizedToken;
      continue;
    }

    if (/^[a-z][\w-]*$/i.test(token)) {
      classNames.add(normalizedToken);
      continue;
    }

    options.alt ??= token;
  }

  options.classNames = [...classNames];
  return options;
}

function escapeMarkdownAlt(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("[", "\\[").replaceAll("]", "\\]");
}

function escapeMarkdownTitle(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function escapeMarkdownLinkTarget(value: string) {
  return value.replaceAll(">", "%3E").replaceAll("\n", " ");
}

function serializeObsidianImageTitle(options: ObsidianImageOptions) {
  const parts: string[] = [];

  if (options.width) parts.push(`obsidian-width=${options.width}`);
  if (options.height) parts.push(`obsidian-height=${options.height}`);
  if (options.align) parts.push(`obsidian-align=${options.align}`);
  if (options.classNames.length > 0) {
    parts.push(`obsidian-class=${options.classNames.join(" ")}`);
  }

  return parts.join(";");
}

function buildMarkdownImageEmbed(
  filePath: string,
  targetPath: string,
  parsed: ParsedWikilink,
) {
  const options = parseObsidianImageOptions(parsed.alias);
  const target = escapeMarkdownLinkTarget(getRelativeVaultLinkTarget(filePath, targetPath));
  const alt = escapeMarkdownAlt(options.alt ?? basename(parsed.name));
  const title = serializeObsidianImageTitle(options);
  const titleSuffix = title ? ` "${escapeMarkdownTitle(title)}"` : "";

  return `![${alt}](<${target}>${titleSuffix})`;
}

function normalizeResolvableWikilinks(
  content: string,
  filePath: string,
  publishedIndex: VaultFileIndex,
  vaultIndex: VaultFileIndex,
) {
  return content.replaceAll(/(!?)\[\[([^\]\n]+)]]/g, (match, embedPrefix: string, rawContent: string) => {
    const parsed = parseWikilinkContent(rawContent);
    if (!parsed) return match;

    const isHeadingOnly = parsed.name.length === 0 && parsed.heading;
    if (isHeadingOnly) return match;

    const publishedTarget = resolveIndexedWikilink(parsed.name, filePath, publishedIndex);
    if (publishedTarget) {
      if (embedPrefix === "!" && isImageFile(publishedTarget)) {
        return buildMarkdownImageEmbed(filePath, publishedTarget.path, parsed);
      }

      const heading = parsed.heading ? `#${parsed.heading}` : "";
      const alias = parsed.alias ? `|${parsed.alias}` : "";
      const target = isContentFile(publishedTarget)
        ? getRelativeVaultLinkTarget(filePath, publishedTarget.path)
        : publishedTarget.path;
      const normalizedEmbedPrefix = embedPrefix === "!" && isContentFile(publishedTarget)
        ? ""
        : embedPrefix;

      return `${normalizedEmbedPrefix}[[${target}${heading}${alias}]]`;
    }

    const vaultTarget = resolveIndexedWikilink(parsed.name, filePath, vaultIndex);
    const fallbackText = getUnresolvedWikilinkText(parsed);

    if (vaultTarget && embedPrefix === "!" && isImageFile(vaultTarget)) {
      return buildMarkdownImageEmbed(filePath, vaultTarget.path, parsed);
    }

    if (vaultTarget && !isContentFile(vaultTarget)) {
      const heading = parsed.heading ? `#${parsed.heading}` : "";
      const alias = parsed.alias ? `|${parsed.alias}` : "";
      return `${embedPrefix}[[${vaultTarget.path}${heading}${alias}]]`;
    }

    return fallbackText;
  });
}

function normalizeVaultMarkdownContent<T extends VaultFile>(
  file: T,
  publishedIndex: VaultFileIndex,
  vaultIndex: VaultFileIndex,
): T {
  const normalizedPath = normalizeUnicode(file.path);

  if (!isMarkdownFile(file.path)) {
    if (normalizedPath === file.path) {
      return file;
    }

    return {
      ...file,
      path: normalizedPath,
    };
  }

  const rawContent =
    typeof file.content === "string" ? file.content : file.content.toString("utf8");
  const normalizedContent = normalizeCodeFenceLanguages(
    normalizeResolvableWikilinks(
      normalizeMarkdownContentEmbeds(normalizeNestedHeadingWikilinks(rawContent)),
      normalizedPath,
      publishedIndex,
      vaultIndex,
    ),
  );

  if (normalizedContent === rawContent && normalizedPath === file.path) {
    return file;
  }

  return {
    ...file,
    path: normalizedPath,
    content: normalizedContent,
  };
}

function encodeDocumentUri(value: string) {
  let sanitizedValue = value;

  try {
    sanitizedValue = decodeURI(value);
  } catch {
    sanitizedValue = value.replace(/%(?![0-9A-Fa-f]{2})/g, "%25");
  }

  return encodeURI(sanitizedValue);
}

function sanitizeMalformedUriPlugin() {
  return (tree: unknown) => {
    visit(tree as any, ["link", "image"], (node: any) => {
      if (!node.url) return;
      node.url = encodeDocumentUri(node.url);
    });
  };
}

function sanitizeMdxTextPlugin() {
  return (tree: unknown) => {
    visit(tree as any, "text", (node: any) => {
      if (typeof node.value !== "string") return;

      node.value = node.value.replace(/(?<!\\)[{}]/g, "\\$&");
    });
  };
}

function normalizeOutputPath(value: string) {
  return value.replaceAll("\\", "/");
}

function getContentOutputPath(filePath: string) {
  return normalizeOutputPath(filePath).replace(/\.(md|mdx)$/i, ".mdx");
}

async function listMarkdownFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        return listMarkdownFiles(fullPath);
      }

      return isMarkdownFile(fullPath) ? [fullPath] : [];
    }),
  );

  return files.flat();
}

function extractHeadingSlugs(content: string) {
  const slugger = new GithubSlugger();
  const slugs = new Set<string>();
  const lines = content.split(/\r?\n/);
  let isInFrontmatter = false;
  let frontmatterDone = false;
  let fenceChar: "`" | "~" | null = null;

  for (const line of lines) {
    if (!frontmatterDone && line.trim() === "---") {
      isInFrontmatter = !isInFrontmatter;
      if (!isInFrontmatter) frontmatterDone = true;
      continue;
    }

    if (isInFrontmatter) continue;

    const fenceMatch = line.match(/^(```+|~~~+)/);
    if (fenceMatch) {
      const nextFenceChar = fenceMatch[1][0] as "`" | "~";
      fenceChar = fenceChar === nextFenceChar ? null : nextFenceChar;
      continue;
    }

    if (fenceChar) continue;

    const headingMatch = line.match(/^#{1,6}\s+(.*?)\s*#*\s*$/);
    if (!headingMatch) continue;

    const headingText = headingMatch[1].trim();
    if (!headingText) continue;

    slugs.add(slugger.slug(headingText));
  }

  return slugs;
}

function resolveOutputReferencePath(currentFilePath: string, referencePath: string) {
  const normalizedReferencePath = referencePath.trim().replace(/^<|>$/g, "");
  if (!/\.(md|mdx)$/i.test(normalizedReferencePath)) return null;

  if (normalizedReferencePath.startsWith("/")) {
    return normalizedReferencePath.replace(/^\/+/, "").replace(/\.md$/i, ".mdx");
  }

  return normalizeOutputPath(
    posix.normalize(posix.join(dirname(currentFilePath), normalizedReferencePath)),
  ).replace(/\.md$/i, ".mdx");
}

function resolveHeadingFragment(
  currentFilePath: string,
  referencePath: string,
  fragment: string,
  headingSlugsByPath: Map<string, Set<string>>,
) {
  const resolvedPath = resolveOutputReferencePath(currentFilePath, referencePath);
  if (!resolvedPath) return fragment;

  const headingSlugs = headingSlugsByPath.get(resolvedPath);
  if (!headingSlugs || headingSlugs.has(fragment)) return fragment;

  const suffixMatch = [...headingSlugs]
    .filter((candidate) => fragment.endsWith(candidate))
    .sort((left, right) => right.length - left.length)[0];

  return suffixMatch ?? fragment;
}

function normalizeOutputContentReferences(
  currentFilePath: string,
  content: string,
  headingSlugsByPath: Map<string, Set<string>>,
) {
  const includePattern = /(<include>\s*)([^<\n]+?\.mdx)#([^\s<]+)(\s*<\/include>)/g;
  const linkPattern = /((?:\.\.?\/|\/)[^)\s"'<>]+?\.mdx)#([A-Za-z0-9\-._~%\u00C0-\uFFFF]+)/g;

  const normalizeReference = (referencePath: string, fragment: string) => {
    const normalizedFragment = resolveHeadingFragment(
      currentFilePath,
      referencePath,
      fragment,
      headingSlugsByPath,
    );

    return `${referencePath}#${normalizedFragment}`;
  };

  return content
    .replace(
      includePattern,
      (_, prefix: string, referencePath: string, fragment: string, suffix: string) => {
        return `${prefix}${normalizeReference(referencePath, fragment)}${suffix}`;
      },
    )
    .replace(linkPattern, (_match: string, referencePath: string, fragment: string) => {
      return normalizeReference(referencePath, fragment);
    });
}

async function listPublicAssetFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) return listPublicAssetFiles(fullPath);

      return coverAssetExtensions.has(extname(entry.name).toLowerCase()) ? [fullPath] : [];
    }),
  );

  return files.flat();
}

async function writeGitHistoryManifest(sourcePathsByOutputPath: Map<string, string>) {
  const manifest = Object.fromEntries(
    [...sourcePathsByOutputPath.entries()].map(([relativePath, sourcePath]) => [
      relativePath,
      getGitHistoryForTargetPath(sourcePath, { repoDir: vaultDir }),
    ]),
  );

  await mkdir("app/lib/generated", { recursive: true });
  await writeFile(gitHistoryOutputPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
}

async function writeAssetManifest(publicDir: string) {
  const assetFiles = await listPublicAssetFiles(publicDir);
  const manifest = assetFiles.reduce<Record<string, string[]>>((acc, filePath) => {
    const key = basename(filePath);
    const publicPath = `/${normalizeOutputPath(relative(publicDir, filePath))}`;

    acc[key] ??= [];
    acc[key].push(publicPath);

    return acc;
  }, {});

  for (const assetPaths of Object.values(manifest)) {
    assetPaths.sort();
  }

  await mkdir("app/lib/generated", { recursive: true });
  await writeFile(assetManifestOutputPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
}

async function writeFrontmatterManifest(contentDir: string) {
  const collectMarkdownFiles = async (dir: string): Promise<string[]> => {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          return collectMarkdownFiles(fullPath);
        }

        return isMarkdownFile(fullPath) ? [fullPath] : [];
      }),
    );

    return files.flat();
  };

  const markdownFiles = await collectMarkdownFiles(contentDir);
  const manifest = Object.fromEntries(
    await Promise.all(
      markdownFiles.map(async (filePath) => {
        const content = await readFile(filePath, "utf8");
        const data = parseFrontmatterData(content);
        const relativePath = normalizeOutputPath(relative(contentDir, filePath));

        return [
          relativePath,
          {
            cover: typeof data?.cover === "string" ? data.cover : null,
          },
        ] as const;
      }),
    ),
  );

  await mkdir("app/lib/generated", { recursive: true });
  await writeFile(frontmatterManifestOutputPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
}

export async function syncDocs() {
  const contentRoot = "content";
  const contentDir = `${contentRoot}/docs`;
  const syncId = `${process.pid}-${Date.now()}`;
  const stagedContentDir = `${contentRoot}/.docs-next-${syncId}`;
  const previousContentDir = `${contentRoot}/.docs-prev-${syncId}`;

  await mkdir(contentRoot, { recursive: true });
  await rm(stagedContentDir, { recursive: true, force: true });
  await rm(previousContentDir, { recursive: true, force: true });

  const rawFiles = await readVaultFiles({
    dir: vaultDir,
    include: vaultInclude,
  });

  const filteredFiles = rawFiles.filter((file) => {
    if (isExcludedPath(file.path)) return false;
    if (!filterDgPublish) return true;
    if (!isMarkdownFile(file.path)) return true;
    if (typeof file.content !== "string" && !Buffer.isBuffer(file.content)) return false;

    return isPublishedDocument(file.content.toString("utf8"));
  });
  const vaultIndex = buildVaultFileIndex(
    rawFiles
      .filter((file) => !isExcludedPath(file.path))
      .map((file) => ({
        ...file,
        path: normalizeUnicode(file.path),
      })),
  );
  const publishedIndex = buildVaultFileIndex(
    filteredFiles.map((file) => ({
      ...file,
      path: normalizeUnicode(file.path),
    })),
  );
  const normalizedFiles = filteredFiles.map((file) =>
    normalizeVaultMarkdownContent(file, publishedIndex, vaultIndex),
  );

  const sourcePathsByOutputPath = new Map(
    normalizedFiles
      .filter((file) => isMarkdownFile(file.path))
      .map((file) => [getContentOutputPath(file.path), normalizeOutputPath(file.path)]),
  );

  const outputFiles = await convertVaultFiles(normalizedFiles, {
    outputPath: "ignore",
    remarkPlugins: [sanitizeMalformedUriPlugin, sanitizeMdxTextPlugin],
  });
  const headingSlugsByPath = new Map(
    outputFiles.flatMap((file) => {
      if (file.type !== "content" || typeof file.content !== "string") return [];
      return [[file.path, extractHeadingSlugs(file.content)] as const];
    }),
  );
  const normalizedOutputFiles = outputFiles.map((file) => {
    if (file.type !== "content" || typeof file.content !== "string") return file;

    return {
      ...file,
      content: normalizeOutputContentReferences(file.path, file.content, headingSlugsByPath),
    };
  });

  await writeVaultFiles(normalizedOutputFiles, {
    publicDir: "public",
    contentDir: stagedContentDir,
  });
  await writeGitHistoryManifest(sourcePathsByOutputPath);
  await writeAssetManifest("public");
  await writeFrontmatterManifest(stagedContentDir);

  await rename(contentDir, previousContentDir).catch(() => undefined);
  await rename(stagedContentDir, contentDir);
  await rm(previousContentDir, { recursive: true, force: true });
}

const isEntrypoint = process.argv[1] === fileURLToPath(import.meta.url);

if (isEntrypoint) {
  await syncDocs();
}
