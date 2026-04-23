"use client";

import type { MDXComponents } from "mdx/types";
import type { ComponentProps, CSSProperties, KeyboardEvent, MouseEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import * as ObsidianComponents from "fumadocs-obsidian/ui";
import defaultMdxComponents from "fumadocs-ui/mdx";

import { resolveDocumentAssetUrl, type SourcePageLike } from "~/lib/docs";

type ObsidianImageMeta = {
  align?: "center" | "left" | "right";
  classNames: string[];
  height?: number;
  width?: number;
};

function encodeAssetSrc(src: string) {
  try {
    return encodeURI(decodeURI(src));
  } catch {
    return encodeURI(src);
  }
}

function buildImageCandidates(src: string, page?: SourcePageLike) {
  const candidates = new Set<string>();
  const resolvedSrc = page ? resolveDocumentAssetUrl(src, page) : src;
  const encodedOriginalSrc = encodeAssetSrc(src.replace(/^<|>$/g, ""));

  const pushCandidate = (value?: string) => {
    if (!value) return;

    const encodedValue = encodeAssetSrc(value.replace(/^<|>$/g, ""));
    candidates.add(encodedValue);

    if (
      encodedValue.startsWith("/") &&
      !encodedValue.startsWith("/docs/") &&
      !encodedValue.startsWith("/docs-asset")
    ) {
      candidates.add(`/docs${encodedValue}`);
    }
  };

  pushCandidate(resolvedSrc);
  pushCandidate(encodedOriginalSrc);

  return [...candidates];
}

function parsePositiveInteger(value: string) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
}

function parseObsidianImageTitle(title: ComponentProps<"img">["title"]) {
  if (typeof title !== "string" || !title.startsWith("obsidian-")) return null;

  const meta: ObsidianImageMeta = { classNames: [] };
  for (const part of title.split(";")) {
    const [rawKey, ...rawValueParts] = part.split("=");
    const key = rawKey.trim();
    const value = rawValueParts.join("=").trim();

    if (key === "obsidian-width") {
      meta.width = parsePositiveInteger(value);
      continue;
    }

    if (key === "obsidian-height") {
      meta.height = parsePositiveInteger(value);
      continue;
    }

    if (
      key === "obsidian-align" &&
      (value === "center" || value === "left" || value === "right")
    ) {
      meta.align = value;
      continue;
    }

    if (key === "obsidian-class") {
      meta.classNames = value.split(/\s+/).filter(Boolean);
    }
  }

  return meta;
}

function toSafeClassName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildObsidianImageClassName(
  className: ComponentProps<"img">["className"],
  meta: ObsidianImageMeta | null,
) {
  if (!meta) return className;

  const classNames = [className, "obsidian-image"];
  for (const classToken of meta.classNames) {
    const safeClassName = toSafeClassName(classToken);
    if (safeClassName) classNames.push(`obsidian-image-${safeClassName}`);
  }

  return classNames.filter(Boolean).join(" ");
}

function buildObsidianImageStyle(
  style: ComponentProps<"img">["style"],
  meta: ObsidianImageMeta | null,
) {
  if (!meta) return style;

  const nextStyle: CSSProperties = { ...style };

  if (meta.width && nextStyle.width == null) {
    nextStyle.width = meta.width;
  }

  if (meta.width && nextStyle.maxWidth == null) {
    nextStyle.maxWidth = "100%";
  }

  if (meta.height && nextStyle.height == null) {
    nextStyle.height = meta.height;
  }

  if (meta.width && !meta.height && nextStyle.height == null) {
    nextStyle.height = "auto";
  }

  if (meta.align) {
    nextStyle.display ??= "block";

    if (meta.align === "center") {
      nextStyle.marginLeft ??= "auto";
      nextStyle.marginRight ??= "auto";
    } else if (meta.align === "left") {
      nextStyle.marginRight ??= "auto";
    } else {
      nextStyle.marginLeft ??= "auto";
    }
  }

  const metaClassNames = new Set(meta.classNames.map((value) => value.toLowerCase()));

  if (metaClassNames.has("round")) {
    nextStyle.borderRadius ??= "0.75rem";
    nextStyle.overflow ??= "hidden";
  }

  if (metaClassNames.has("masthead")) {
    nextStyle.display ??= "block";
    nextStyle.marginLeft ??= "auto";
    nextStyle.marginRight ??= "auto";
    nextStyle.maxWidth ??= "100%";
  }

  return nextStyle;
}

function ImageOverlay({
  alt,
  onClose,
  src,
}: {
  alt?: string;
  onClose: () => void;
  src: string;
}) {
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const originalOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div
      aria-label={alt ? `${alt} image preview` : "Image preview"}
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      onClick={onClose}
    >
      <button
        aria-label="Close image preview"
        className="absolute right-4 top-4 rounded-full border border-white/20 bg-black/40 px-3 py-1.5 text-sm font-medium text-white shadow-lg transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        type="button"
        onClick={onClose}
      >
        ESC
      </button>
      <img
        alt={alt ?? ""}
        className="max-h-[92vh] max-w-[96vw] rounded-xl object-contain shadow-2xl"
        src={src}
        onClick={(event) => event.stopPropagation()}
      />
    </div>,
    document.body,
  );
}

function MdxImage({ page, ...props }: ComponentProps<"img"> & { page?: SourcePageLike }) {
  const srcCandidates = useMemo(() => {
    if (typeof props.src !== "string") return [];
    return buildImageCandidates(props.src, page);
  }, [page, props.src]);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const src =
    typeof props.src === "string"
      ? (srcCandidates[candidateIndex] ?? encodeAssetSrc(props.src))
      : props.src;
  const obsidianMeta = parseObsidianImageTitle(props.title);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const canPreview = typeof src === "string" && src.length > 0;

  const openOverlay = () => {
    if (canPreview) setIsOverlayOpen(true);
  };

  const handleClick = (event: MouseEvent<HTMLImageElement>) => {
    props.onClick?.(event);
    if (event.defaultPrevented) return;
    event.preventDefault();
    event.stopPropagation();
    openOverlay();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLImageElement>) => {
    props.onKeyDown?.(event);
    if (event.defaultPrevented) return;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      openOverlay();
    }
  };

  return (
    <>
      <img
        {...props}
        aria-label={canPreview ? (props.alt ? `Open ${props.alt} image preview` : "Open image preview") : props["aria-label"]}
        className={[
          buildObsidianImageClassName(props.className, obsidianMeta),
          canPreview ? "mdx-previewable-image" : null,
        ]
          .filter(Boolean)
          .join(" ")}
        height={obsidianMeta?.height ?? props.height}
        role={canPreview ? "button" : props.role}
        src={src}
        style={buildObsidianImageStyle(props.style, obsidianMeta)}
        tabIndex={canPreview ? 0 : props.tabIndex}
        title={obsidianMeta ? undefined : props.title}
        width={obsidianMeta?.width ?? props.width}
        onClick={handleClick}
        onError={(event) => {
          props.onError?.(event);

          if (candidateIndex >= srcCandidates.length - 1) return;
          setCandidateIndex((current) => current + 1);
        }}
        onKeyDown={handleKeyDown}
      />
      {isOverlayOpen && canPreview ? (
        <ImageOverlay
          alt={typeof props.alt === "string" ? props.alt : undefined}
          src={src}
          onClose={() => setIsOverlayOpen(false)}
        />
      ) : null}
    </>
  );
}

export function getMDXComponents(page?: SourcePageLike, components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    ...ObsidianComponents,
    img: (props) => <MdxImage {...props} page={page} />,
    ...components,
  } satisfies MDXComponents;
}

export function useMDXComponents(components?: MDXComponents): MDXComponents {
  return getMDXComponents(undefined, components);
}
