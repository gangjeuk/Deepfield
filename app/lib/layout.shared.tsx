import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: "Deepfield",
      url: "/",
    },
    themeSwitch: {
      enabled: true,
      mode: "light-dark",
    },
  };
}
