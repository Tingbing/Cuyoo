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
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{__html:"try{document.documentElement.dataset.theme=localStorage.getItem('cuyoo-theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')}catch{document.documentElement.dataset.theme='light'}"}} /></head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
