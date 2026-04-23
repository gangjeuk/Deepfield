import type { LoaderFunctionArgs } from "react-router";

type R2ObjectBodyLike = {
  body: BodyInit | null;
  httpMetadata?: {
    contentType?: string;
  };
};

type R2BucketLike = {
  get(key: string): Promise<R2ObjectBodyLike | null>;
};

type DocsAssetEnv = {
  DOCS_ASSETS?: R2BucketLike;
  DOCS_ASSET_SOURCE?: "public" | "r2" | string;
};

type CloudflareLoadContext = {
  cloudflare?: {
    env?: DocsAssetEnv;
  };
};

const contentTypes: Record<string, string> = {
  ".avif": "image/avif",
  ".bin": "application/octet-stream",
  ".c": "text/plain; charset=utf-8",
  ".cpp": "text/plain; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
  ".webp": "image/webp",
  ".zip": "application/zip",
};

function tryDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function buildPathCandidates(value: string) {
  const normalized = value.replace(/^\/+/, "").replace(/^docs\//, "");
  const decoded = tryDecode(normalized);
  const decodedTwice = tryDecode(decoded);

  return [
    ...new Set(
      [normalized, decoded, decodedTwice].flatMap((entry) => [
        entry,
        entry.normalize("NFC"),
        entry.normalize("NFD"),
      ]),
    ),
  ];
}

function getExtname(pathname: string) {
  const fileName = pathname.split("/").pop() ?? "";
  const dotIndex = fileName.lastIndexOf(".");

  return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : "";
}

function getContentType(pathname: string, contentType?: string) {
  return contentType ?? contentTypes[getExtname(pathname)] ?? "application/octet-stream";
}

function isSafeAssetKey(candidate: string) {
  return !candidate
    .split("/")
    .some((segment) => segment === ".." || segment.includes("\\") || segment.includes("\0"));
}

async function readPublicAsset(pathname: string) {
  const [{ access, readFile }, { resolve, sep }] = await Promise.all([
    import("node:fs/promises"),
    import("node:path"),
  ]);
  const publicRoot = resolve("public");

  for (const candidate of buildPathCandidates(pathname)) {
    if (!isSafeAssetKey(candidate)) continue;

    const absolutePath = resolve(publicRoot, candidate);
    if (absolutePath !== publicRoot && !absolutePath.startsWith(`${publicRoot}${sep}`)) continue;

    try {
      await access(absolutePath);
      return {
        content: await readFile(absolutePath),
        path: absolutePath,
      };
    } catch {
      // try next candidate
    }
  }

  return null;
}

async function readR2Asset(bucket: R2BucketLike, pathname: string) {
  for (const candidate of buildPathCandidates(pathname)) {
    if (!isSafeAssetKey(candidate)) continue;

    const object = await bucket.get(candidate);
    if (!object) continue;

    return {
      content: object.body,
      contentType: object.httpMetadata?.contentType,
      path: candidate,
    };
  }

  return null;
}

function getDocsAssetEnv(context: LoaderFunctionArgs["context"]) {
  return (context as CloudflareLoadContext).cloudflare?.env;
}

export async function loader({ context, request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const assetPath = url.searchParams.get("path");

  if (!assetPath) {
    throw new Response("Missing asset path", { status: 400 });
  }

  const env = getDocsAssetEnv(context);
  const asset =
    env?.DOCS_ASSET_SOURCE === "r2" && env.DOCS_ASSETS
      ? await readR2Asset(env.DOCS_ASSETS, assetPath)
      : await readPublicAsset(assetPath);

  if (!asset) {
    throw new Response("Asset not found", { status: 404 });
  }

  return new Response(asset.content, {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Content-Type": getContentType(asset.path, "contentType" in asset ? asset.contentType : undefined),
    },
  });
}
