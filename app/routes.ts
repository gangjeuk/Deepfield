import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("sitemap.xml", "routes/sitemap.ts"),
  route("robots.txt", "routes/robot.ts"),
  route("docs-asset", "routes/docs-asset.ts"),
  route("docs/*", "docs/page.tsx"),
  route("api/search", "docs/search.ts"),
  route(":locale", "routes/locale-home.tsx"),
] satisfies RouteConfig;
