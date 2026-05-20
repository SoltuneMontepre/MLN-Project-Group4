import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Git-Leap Compiler",
  description:
    "A philosophical CloudIDE that turns quantity-to-quality dialectics into a software engineering study simulator.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
