import type { Metadata } from "next";
import "@xyflow/react/dist/style.css";
import "../styles.css";
export const metadata: Metadata = { title: "Kindred · The Family Archive", description: "A private family archive." };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: `try { const saved = localStorage.getItem("kindred-theme"); document.documentElement.dataset.theme = saved === "dark" || saved !== "light" && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"; } catch { document.documentElement.dataset.theme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"; }` }} /></head><body>{children}</body></html>;
}
