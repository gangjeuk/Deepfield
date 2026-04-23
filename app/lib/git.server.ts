import { spawnSync } from "node:child_process";

const gitHistoryLimit = 8;
const gitDiffLineLimit = 80;
const gitDiffCharLimit = 6000;
const gitFieldSeparator = "\u001f";
const gitRecordSeparator = "\u001e";
const gitShortStatPattern =
  /^\d+\sfiles?\schanged(?:,\s\d+\sinsertions?\(\+\))?(?:,\s\d+\sdeletions?\(-\))?$/;

export type GitDiffSummary = {
  additions: number;
  deletions: number;
  filesChanged: number;
  patch: string;
  shortStat: string;
  truncated: boolean;
};

export type GitHistoryEntry = {
  author: string;
  date: string;
  diff: GitDiffSummary | null;
  hash: string;
  shortHash: string;
  subject: string;
};

export type DocGitHistoryManifest = Record<string, GitHistoryEntry[]>;

function parseShortStat(line: string): GitDiffSummary {
  const filesChanged = Number(line.match(/(\d+) files? changed/)?.[1] ?? 0);
  const additions = Number(line.match(/(\d+) insertions?\(\+\)/)?.[1] ?? 0);
  const deletions = Number(line.match(/(\d+) deletions?\(-\)/)?.[1] ?? 0);

  return {
    additions,
    deletions,
    filesChanged,
    patch: "",
    shortStat: line,
    truncated: false,
  };
}

function truncatePatch(value: string) {
  const lines = value.split("\n");
  const needsLineTrim = lines.length > gitDiffLineLimit;
  const trimmedLines = needsLineTrim ? lines.slice(0, gitDiffLineLimit) : lines;
  const joined = trimmedLines.join("\n");
  const needsCharTrim = joined.length > gitDiffCharLimit;
  const trimmed = needsCharTrim ? joined.slice(0, gitDiffCharLimit).trimEnd() : joined;
  const truncated = needsLineTrim || needsCharTrim;

  return {
    patch: truncated ? `${trimmed}\n...` : trimmed,
    truncated,
  };
}

function parseGitHistoryRecord(record: string): GitHistoryEntry | null {
  const [headerLine, ...bodyLines] = record.split("\n");
  const [hash, shortHash, date, author, subject] = headerLine.split(gitFieldSeparator);

  if (!hash || !shortHash || !date || !author || !subject) {
    return null;
  }

  const remainingLines = [...bodyLines];
  while (remainingLines[0]?.trim() === "") {
    remainingLines.shift();
  }

  let diff: GitDiffSummary | null = null;
  const shortStatLine = remainingLines[0]?.trim();

  if (shortStatLine && gitShortStatPattern.test(shortStatLine)) {
    diff = parseShortStat(shortStatLine);
    remainingLines.shift();
  }

  while (remainingLines[0]?.trim() === "") {
    remainingLines.shift();
  }

  const patchText = remainingLines.join("\n").trimEnd();
  if (patchText) {
    const { patch, truncated } = truncatePatch(patchText);
    diff = {
      ...(diff ?? parseShortStat("0 files changed")),
      patch,
      truncated,
    };
  }

  return {
    author,
    date,
    diff,
    hash,
    shortHash,
    subject,
  };
}

export function getGitHistoryForTargetPath(
  filePath: string,
  options: { limit?: number; repoDir: string },
) {
  const result = spawnSync(
    "git",
    [
      "log",
      `-${options.limit ?? gitHistoryLimit}`,
      "--follow",
      "--date=short",
      `--format=${gitRecordSeparator}%H${gitFieldSeparator}%h${gitFieldSeparator}%ad${gitFieldSeparator}%an${gitFieldSeparator}%s`,
      "--shortstat",
      "--patch",
      "--unified=1",
      "--",
      filePath,
    ],
    {
      cwd: options.repoDir,
      encoding: "utf8",
    },
  );

  if (result.status !== 0 || !result.stdout.trim()) {
    return [];
  }

  return result.stdout
    .split(gitRecordSeparator)
    .map((record) => record.trim())
    .filter(Boolean)
    .map(parseGitHistoryRecord)
    .filter((entry): entry is GitHistoryEntry => entry !== null);
}
