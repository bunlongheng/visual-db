import type { Metadata } from "next";
import { Orbitron, Sora, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const orbitron = Orbitron({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-orbitron",
});
const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sora",
});
const jet = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jet",
});

export const metadata: Metadata = {
  title: "Visual DB",
  description: "Interactive Postgres table profiler",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${orbitron.variable} ${sora.variable} ${jet.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
