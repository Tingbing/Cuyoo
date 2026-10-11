import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cuyoo — A table for your people",
  description: "Play Wisconsin Cuyoo with four or six friends. Two teams, one shared table, first to seven.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
