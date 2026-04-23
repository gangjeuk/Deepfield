import type { LoaderFunctionArgs } from "react-router";

const aiCrawlerAgents = [
  "AI2Bot",
  "Amazonbot",
  "anthropic-ai",
  "Applebot-Extended",
  "Bytespider",
  "CCBot",
  "ChatGPT-User",
  "Claude-Web",
  "ClaudeBot",
  "cohere-ai",
  "Diffbot",
  "FacebookBot",
  "GPTBot",
  "Google-Extended",
  "Meta-ExternalAgent",
  "Meta-ExternalFetcher",
  "OAI-SearchBot",
  "Perplexity-User",
  "PerplexityBot",
] as const;

function getSiteOrigin(request: Request) {
  const configuredOrigin =
    process.env.SITE_URL ?? process.env.APP_URL ?? process.env.PUBLIC_SITE_URL;

  const origin = configuredOrigin || new URL(request.url).origin;

  return origin.endsWith("/") ? origin.slice(0, -1) : origin;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const origin = getSiteOrigin(request);
  const sitemapUrl = new URL("/sitemap.xml", `${origin}/`).toString();

  const body = [
    "User-agent: *",
    "Allow: /",
    "",
    ...aiCrawlerAgents.flatMap((agent) => [`User-agent: ${agent}`, "Disallow: /", ""]),
    `Sitemap: ${sitemapUrl}`,
  ].join("\n");

  return new Response(body, {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
