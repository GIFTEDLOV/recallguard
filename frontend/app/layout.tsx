import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RecallGuard | Evidence-bound recall decisions",
  description: "A GenLayer application for product-recall applicability and listing safety.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
