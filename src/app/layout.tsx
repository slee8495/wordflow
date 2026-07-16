import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ChatWidget } from "./ChatWidget";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Wordflow",
  description: "Daily 5-10 minute Bible reading — story-style, with context and today's message.",
  appleWebApp: {
    capable: true,
    title: "Wordflow",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1e1b4b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-100">
        <header
          className="sticky top-0 z-10 border-b border-zinc-200 bg-zinc-50/90 backdrop-blur dark:border-zinc-800 dark:bg-black/90"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div className="mx-auto flex max-w-2xl items-center px-4 py-3">
            <span className="text-lg font-semibold tracking-tight">📖 Wordflow</span>
          </div>
        </header>
        <main
          className="mx-auto w-full max-w-2xl flex-1 px-4 py-6"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {children}
        </main>
        <ChatWidget />
      </body>
    </html>
  );
}
