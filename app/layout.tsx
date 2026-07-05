import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QMR Agent Office",
  description:
    "United Ceres College Quality Monitoring Records workbench (EduTrust GD4). Phase 1: ported engine.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}
