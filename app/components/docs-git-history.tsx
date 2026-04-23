import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { History, X } from "lucide-react";

import type { GitHistoryEntry } from "~/lib/git.server";

type DocsGitHistoryProps = {
  compact?: boolean;
  createdAt?: string | null;
  entries: GitHistoryEntry[];
  updatedAt?: string | null;
};

type DiffRow = {
  leftContent: string;
  leftLine: number | null;
  leftType: "add" | "context" | "delete" | "empty";
  rightContent: string;
  rightLine: number | null;
  rightType: "add" | "context" | "delete" | "empty";
};

type DiffHunk = {
  rows: DiffRow[];
  title: string;
};

type DiffFile = {
  fromFile: string;
  hunks: DiffHunk[];
  toFile: string;
};

const gitPathDecoder = new TextDecoder();

function formatDateLabel(value?: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("en-CA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function parseHunkHeader(header: string) {
  const match = header.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/);
  if (!match) {
    return null;
  }

  return {
    leftLine: Number(match[1]),
    rightLine: Number(match[2]),
    title: match[3].trim(),
  };
}

function decodeGitQuotedPath(value: string) {
  if (!value.startsWith('"') || !value.endsWith('"')) {
    return value;
  }

  const bytes: number[] = [];
  const content = value.slice(1, -1);

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];

    if (char !== "\\") {
      bytes.push(char.charCodeAt(0));
      continue;
    }

    const next = content[index + 1];
    if (!next) {
      bytes.push(char.charCodeAt(0));
      continue;
    }

    if (/^[0-7]{3}$/.test(content.slice(index + 1, index + 4))) {
      bytes.push(Number.parseInt(content.slice(index + 1, index + 4), 8));
      index += 3;
      continue;
    }

    switch (next) {
      case '"':
        bytes.push(34);
        break;
      case "\\":
        bytes.push(92);
        break;
      case "n":
        bytes.push(10);
        break;
      case "r":
        bytes.push(13);
        break;
      case "t":
        bytes.push(9);
        break;
      default:
        bytes.push(next.charCodeAt(0));
        break;
    }

    index += 1;
  }

  return gitPathDecoder.decode(new Uint8Array(bytes));
}

function normalizeGitFilePath(raw: string) {
  if (!raw || raw === "/dev/null") {
    return raw;
  }

  const decoded = decodeGitQuotedPath(raw.trim());
  return decoded.replace(/^[ab]\//, "");
}

function parseDiffGitLine(line: string) {
  const tokens = line.match(/(?:"(?:\\.|[^"])*"|[^\s]+)/g);
  if (!tokens || tokens.length < 4) {
    return null;
  }

  return {
    fromFile: normalizeGitFilePath(tokens[2]),
    toFile: normalizeGitFilePath(tokens[3]),
  };
}

function flushPendingDiffRows(
  rows: DiffRow[],
  pendingDeletes: Array<{ content: string; line: number }>,
  pendingAdds: Array<{ content: string; line: number }>,
) {
  const count = Math.max(pendingDeletes.length, pendingAdds.length);

  for (let index = 0; index < count; index += 1) {
    const left = pendingDeletes[index];
    const right = pendingAdds[index];

    rows.push({
      leftContent: left?.content ?? "",
      leftLine: left?.line ?? null,
      leftType: left ? "delete" : "empty",
      rightContent: right?.content ?? "",
      rightLine: right?.line ?? null,
      rightType: right ? "add" : "empty",
    });
  }

  pendingDeletes.length = 0;
  pendingAdds.length = 0;
}

function parseDiffPatch(patch?: string) {
  if (!patch) {
    return [];
  }

  const lines = patch.split("\n");
  const files: DiffFile[] = [];
  let currentFile: DiffFile | null = null;
  let currentHunk: DiffHunk | null = null;
  let leftLine = 0;
  let rightLine = 0;
  let pendingDeletes: Array<{ content: string; line: number }> = [];
  let pendingAdds: Array<{ content: string; line: number }> = [];

  for (const line of lines) {
    if (line.startsWith("diff --git ")) {
      if (currentHunk) {
        flushPendingDiffRows(currentHunk.rows, pendingDeletes, pendingAdds);
      }

      const diffLine = parseDiffGitLine(line);
      currentFile = {
        fromFile: diffLine?.fromFile ?? "",
        hunks: [],
        toFile: diffLine?.toFile ?? "",
      };
      currentHunk = null;
      files.push(currentFile);
      continue;
    }

    if (!currentFile) {
      continue;
    }

    if (line.startsWith("--- ")) {
      currentFile.fromFile = normalizeGitFilePath(line.slice(4));
      continue;
    }

    if (line.startsWith("+++ ")) {
      currentFile.toFile = normalizeGitFilePath(line.slice(4));
      continue;
    }

    if (line.startsWith("@@ ")) {
      if (currentHunk) {
        flushPendingDiffRows(currentHunk.rows, pendingDeletes, pendingAdds);
      }

      const parsedHeader = parseHunkHeader(line);
      if (!parsedHeader) {
        continue;
      }

      leftLine = parsedHeader.leftLine;
      rightLine = parsedHeader.rightLine;
      currentHunk = {
        rows: [],
        title: parsedHeader.title,
      };
      currentFile.hunks.push(currentHunk);
      continue;
    }

    if (!currentHunk) {
      continue;
    }

    if (line.startsWith("-")) {
      pendingDeletes.push({ content: line.slice(1), line: leftLine });
      leftLine += 1;
      continue;
    }

    if (line.startsWith("+")) {
      pendingAdds.push({ content: line.slice(1), line: rightLine });
      rightLine += 1;
      continue;
    }

    if (line.startsWith(" ")) {
      flushPendingDiffRows(currentHunk.rows, pendingDeletes, pendingAdds);
      currentHunk.rows.push({
        leftContent: line.slice(1),
        leftLine,
        leftType: "context",
        rightContent: line.slice(1),
        rightLine,
        rightType: "context",
      });
      leftLine += 1;
      rightLine += 1;
      continue;
    }

    if (line.startsWith("\\")) {
      flushPendingDiffRows(currentHunk.rows, pendingDeletes, pendingAdds);
    }
  }

  if (currentHunk) {
    flushPendingDiffRows(currentHunk.rows, pendingDeletes, pendingAdds);
  }

  return files;
}

function getDiffCellClassName(type: DiffRow["leftType"], part: "code" | "gutter") {
  const base =
    part === "gutter"
      ? "w-[4.6rem] select-none border-r border-slate-200 px-3 py-1.5 text-right align-top font-mono text-[0.86rem] leading-7 text-slate-500 dark:border-white/10 dark:text-slate-400"
      : "px-4 py-1.5 align-top font-mono text-[0.86rem] leading-7 whitespace-pre-wrap break-words";

  switch (type) {
    case "add":
      return `${base} bg-emerald-50 text-emerald-900 group-hover/line:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-100`;
    case "delete":
      return `${base} bg-rose-50 text-rose-900 group-hover/line:bg-rose-100 dark:bg-rose-950/25 dark:text-rose-100`;
    case "empty":
      return `${base} bg-slate-50 text-transparent dark:bg-slate-950/50`;
    default:
      return `${base} bg-white text-slate-700 group-hover/line:bg-slate-50 dark:bg-slate-900 dark:text-slate-100 dark:group-hover/line:bg-slate-800/70`;
  }
}

function renderDiffFiles(entry: GitHistoryEntry) {
  const files = parseDiffPatch(entry.diff?.patch);

  if (files.length === 0) {
    return (
      <pre className="overflow-x-auto rounded-2xl bg-fd-muted/60 p-4 text-[11px] leading-5 text-fd-foreground">
        <code>{entry.diff?.patch}</code>
      </pre>
    );
  }

  return (
    <div className="grid gap-4">
      {files.map((file, fileIndex) => (
        <section
          key={`${file.fromFile}-${file.toFile}-${fileIndex}`}
          className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_20px_48px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-slate-900 dark:shadow-none"
        >
          <div className="border-b border-slate-200 bg-slate-50 px-6 py-4 dark:border-white/10 dark:bg-slate-950">
            <code className="font-mono text-[0.88rem] leading-6 break-words text-slate-600 dark:text-slate-400">
              {file.toFile || file.fromFile}
            </code>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] table-fixed border-collapse font-mono text-[0.86rem] leading-7 text-slate-800 dark:text-slate-100">
              <colgroup>
                <col className="w-[4.6rem]" />
                <col className="w-[calc(50%-4.6rem)]" />
                <col className="w-[4.6rem]" />
                <col className="w-[calc(50%-4.6rem)]" />
              </colgroup>
              <thead>
                <tr>
                  <th
                    colSpan={2}
                    className="border-b border-r border-slate-200 bg-white px-5 py-3 text-left font-sans text-[0.72rem] font-semibold tracking-[0.24em] text-slate-500 uppercase dark:border-white/10 dark:bg-slate-900 dark:text-slate-400"
                  >
                    Before
                  </th>
                  <th
                    colSpan={2}
                    className="border-b border-slate-200 bg-white px-5 py-3 text-left font-sans text-[0.72rem] font-semibold tracking-[0.24em] text-slate-500 uppercase dark:border-white/10 dark:bg-slate-900 dark:text-slate-400"
                  >
                    After
                  </th>
                </tr>
              </thead>
              {file.hunks.map((hunk, hunkIndex) => (
                <tbody key={`${hunk.title}-${hunkIndex}`}>
                  <tr>
                    <td
                      colSpan={4}
                      className="border-b border-slate-200 bg-slate-50 px-6 py-3 font-sans text-[0.72rem] font-bold tracking-[0.24em] text-slate-500 uppercase dark:border-white/10 dark:bg-slate-950 dark:text-slate-400"
                    >
                      <span>{hunk.title || `Hunk ${hunkIndex + 1}`}</span>
                    </td>
                  </tr>
                  {hunk.rows.map((row, rowIndex) => (
                    <tr
                      key={`${hunkIndex}-${rowIndex}`}
                      className="group/line border-b border-slate-200/70 last:border-b-0 dark:border-white/10"
                    >
                      <td className={getDiffCellClassName(row.leftType, "gutter")}>
                        {row.leftLine ?? ""}
                      </td>
                      <td className={getDiffCellClassName(row.leftType, "code")}>
                        <span>{row.leftContent || " "}</span>
                      </td>
                      <td className={getDiffCellClassName(row.rightType, "gutter")}>
                        {row.rightLine ?? ""}
                      </td>
                      <td className={getDiffCellClassName(row.rightType, "code")}>
                        <span>{row.rightContent || " "}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

export function DocsGitHistory({
  compact = false,
  createdAt,
  entries,
  updatedAt,
}: DocsGitHistoryProps) {
  const visibleEntries = compact ? entries.slice(0, 4) : entries;
  const [selectedEntry, setSelectedEntry] = useState<GitHistoryEntry | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!selectedEntry) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedEntry(null);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedEntry]);

  return (
    <>
      <section className="mt-6 border-t border-fd-border/70 pt-5">
        <div className="mb-1 inline-flex items-center gap-1.5 text-sm text-fd-muted-foreground">
          <History className="size-4" />
          <span>Changelog</span>
        </div>
        {createdAt || updatedAt ? (
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fd-muted-foreground">
            {createdAt ? <span>Created at {formatDateLabel(createdAt)}</span> : null}
            {createdAt && updatedAt ? <span>·</span> : null}
            {updatedAt ? <span>Last modified at {formatDateLabel(updatedAt)}</span> : null}
          </div>
        ) : null}
        {visibleEntries.length > 0 ? (
          <div className={compact ? "space-y-2" : "max-h-80 space-y-2 overflow-y-auto pe-1"}>
            {visibleEntries.map((entry) => (
              <button
                key={entry.hash}
                type="button"
                onClick={() => setSelectedEntry(entry)}
                className="block w-full rounded-xl border border-fd-border/70 bg-fd-card/80 px-3 py-3 text-left transition-colors hover:bg-fd-card"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm leading-5 text-fd-foreground">{entry.subject}</p>
                  <time
                    dateTime={entry.date}
                    className="shrink-0 text-[11px] font-medium uppercase tracking-[0.12em] text-fd-muted-foreground"
                  >
                    {entry.date}
                  </time>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-fd-border/70 bg-fd-card/50 px-3 py-3 text-sm text-fd-muted-foreground">
            No tracked commits for this document yet.
          </p>
        )}
      </section>
      {isHydrated && selectedEntry
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-sm"
              onClick={() => setSelectedEntry(null)}
            >
              <div
                className="flex max-h-[88vh] w-full max-w-[1400px] flex-col overflow-hidden rounded-[32px] border border-black/8 bg-[#f8f8f7] shadow-2xl dark:border-white/10 dark:bg-fd-background"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-4 border-b border-black/8 px-7 py-5 dark:border-white/10">
                  <div>
                    <p className="text-base font-medium text-fd-foreground">
                      {selectedEntry.subject}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-fd-muted-foreground">
                      <time dateTime={selectedEntry.date}>{selectedEntry.date}</time>
                      <span>·</span>
                      <span>{selectedEntry.author}</span>
                      <span>·</span>
                      <code>{selectedEntry.shortHash}</code>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Close git diff overlay"
                    onClick={() => setSelectedEntry(null)}
                    className="rounded-full border border-black/8 bg-white p-2 text-fd-muted-foreground transition-colors hover:bg-fd-muted hover:text-fd-foreground dark:border-white/10 dark:bg-fd-card"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <div className="overflow-y-auto px-7 py-6">
                  {selectedEntry.diff ? (
                    <>
                      {renderDiffFiles(selectedEntry)}
                      {selectedEntry.diff.truncated ? (
                        <p className="mt-3 text-xs text-fd-muted-foreground">
                          Diff output was truncated for readability.
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-sm text-fd-muted-foreground">
                      No diff was captured for this commit.
                    </p>
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
