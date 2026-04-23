import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import { RootProvider } from "fumadocs-ui/provider/react-router";

import "./app.css";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="min-h-screen bg-fd-background text-fd-foreground antialiased">
        <RootProvider
          theme={{
            defaultTheme: "light",
            enableSystem: false,
            disableTransitionOnChange: true,
          }}
          search={{
            links: [
              ["Home", "/"],
              ["Docs", "/docs"],
            ],
          }}
        >
          {children}
        </RootProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: { error: unknown }) {
  let message = "오류가 발생했습니다.";
  let details = "예상하지 못한 문제가 발생했습니다.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Request Error";
    details =
      error.status === 404 ? "요청한 페이지를 찾을 수 없습니다." : error.statusText || details;
  } else if (import.meta.env.DEV && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-4 px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-fd-muted-foreground">
        Deepfield
      </p>
      <h1 className="text-3xl font-semibold text-fd-foreground">{message}</h1>
      <p className="text-base text-fd-muted-foreground">{details}</p>
      {stack ? (
        <pre className="overflow-x-auto rounded-2xl border border-fd-border bg-fd-card p-4 text-sm text-fd-foreground">
          <code>{stack}</code>
        </pre>
      ) : null}
    </main>
  );
}
