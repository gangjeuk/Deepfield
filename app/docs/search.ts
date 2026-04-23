import type { LoaderFunctionArgs } from "react-router";

export async function loader({ request }: LoaderFunctionArgs) {
  const [{ createFromSource }, { source }] = await Promise.all([
    import("fumadocs-core/search/server"),
    import("~/lib/source.server"),
  ]);

  return createFromSource(source, {
    language: "english",
  }).GET(request);
}
