import { createRequestHandler } from "react-router";

type CloudflareEnv = {
  DOCS_ASSETS?: unknown;
  DOCS_ASSET_SOURCE?: string;
};

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  async fetch(request: Request, env: CloudflareEnv, ctx: unknown) {
    return requestHandler(request, {
      cloudflare: { env, ctx },
    });
  },
};
