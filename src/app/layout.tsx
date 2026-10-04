import type { Metadata } from "next";
import "@xyflow/react/dist/style.css";
import "../styles.css";
export const metadata: Metadata = { title: "Kindred · The Family Archive", description: "A private family archive." };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
