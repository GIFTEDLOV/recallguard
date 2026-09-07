import type { SVGProps } from "react";

export type IconName = "grid" | "box" | "scan" | "shield" | "activity" | "arrow" | "plus" | "external" | "menu" | "close" | "chevron" | "refresh" | "search" | "filter" | "copy" | "check" | "alert" | "link" | "network";

const paths: Record<IconName, string> = {
  grid: "M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z",
  box: "M12 3 20 7.5v9L12 21l-8-4.5v-9L12 3Zm0 0v9m8-4.5-8 4.5m-8-4.5 8 4.5",
  scan: "M4 8V5a1 1 0 0 1 1-1h3m8 0h3a1 1 0 0 1 1 1v3m0 8v3a1 1 0 0 1-1 1h-3m-8 0H5a1 1 0 0 1-1-1v-3m4-8h8v8H8V8Z",
  shield: "M12 3 20 6v5c0 5-3.4 8.2-8 10-4.6-1.8-8-5-8-10V6l8-3Zm-3 8 2 2 4-4",
  activity: "M3 12h4l2-6 4 12 2-6h6",
  arrow: "M5 12h13m-5-5 5 5-5 5",
  plus: "M12 5v14m-7-7h14",
  external: "M14 5h5v5m0-5-8 8m-6-5v8a2 2 0 0 0 2 2h8",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "m6 6 12 12M18 6 6 18",
  chevron: "m7 10 5 5 5-5",
  refresh: "M20 11a8 8 0 1 0 1 4m-1-9v5h-5",
  search: "m20 20-4.4-4.4m2.4-5.1a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z",
  filter: "M4 6h16M7 12h10m-7 6h4",
  copy: "M8 8V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2M6 8h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z",
  check: "m5 12 4 4L19 6",
  alert: "M12 9v4m0 4h.01M10.3 4.2 2.6 18a1.4 1.4 0 0 0 1.2 2h16.4a1.4 1.4 0 0 0 1.2-2L13.7 4.2a2 2 0 0 0-3.4 0Z",
  link: "M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1m-1 5a5 5 0 0 0-7.1-.1l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1",
  network: "M12 12v8m-6 0h12M5 8a7 7 0 0 1 14 0m-11 0a4 4 0 0 1 8 0",
};

export function Icon({ name, size = 18, ...props }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}><path d={paths[name]} /></svg>;
}
