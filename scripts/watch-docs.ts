import chokidar from "chokidar";

import { syncDocs, vaultDir } from "./generate";

const debounceMs = Number(process.env.DOCS_WATCH_DEBOUNCE ?? 120);
const awaitWriteMs = Number(process.env.DOCS_WATCH_STABILITY ?? 150);

let timer: NodeJS.Timeout | undefined;
let running = false;
let rerunRequested = false;
let lastReason = "startup";

function runSync(reason: string) {
  if (running) {
    rerunRequested = true;
    lastReason = reason;
    return;
  }

  running = true;
  console.log(`[docs:watch] syncing (${reason})`);

  void syncDocs()
    .then(() => {
      console.log("[docs:watch] sync complete");
      return 0;
    })
    .catch((error) => {
      console.error("[docs:watch] sync failed", error);
      return 1;
    })
    .then((code) => {
      running = false;

      if (rerunRequested) {
        rerunRequested = false;
        queueSync(`queued after ${lastReason}`);
      }
      return code;
    });
}

function queueSync(reason: string) {
  lastReason = reason;

  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = undefined;
    runSync(reason);
  }, debounceMs);
}

function shutdown() {
  if (timer) clearTimeout(timer);
  void watcher.close();
  process.exit(0);
}

const watcher = chokidar.watch(vaultDir, {
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilityThreshold: awaitWriteMs,
    pollInterval: 25,
  },
  ignored: [
    /(^|[/\\])\.git([/\\]|$)/,
    /(^|[/\\])\.obsidian([/\\]|$)/,
    /(^|[/\\])\.trash([/\\]|$)/,
    /(^|[/\\])\.DS_Store$/,
  ],
});

watcher.on("all", (event, file) => {
  queueSync(`${event}: ${file}`);
});

console.log(`[docs:watch] watching ${vaultDir}`);
console.log("[docs:watch] press Ctrl+C to stop");

runSync("startup");

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
