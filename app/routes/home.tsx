import { redirect, type LoaderFunctionArgs } from "react-router";

function detectLocale(request: Request) {
  const header = request.headers.get("accept-language")?.toLowerCase() ?? "";

  if (header.includes("ko")) return "kr";
  if (header.includes("ja")) return "jp";
  if (header.includes("en")) return "en";

  return "kr";
}

export async function loader({ request }: LoaderFunctionArgs) {
  return redirect(`/${detectLocale(request)}`);
}

export default function HomeRedirect() {
  return null;
}
