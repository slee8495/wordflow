import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppNav } from "./AppNav";
import { FontScaleProvider } from "./FontScaleProvider";
import { NowPlayingBar } from "./NowPlayingBar";
import { PlaybackProvider } from "./PlaybackProvider";
import { UiLanguageProvider } from "./UiLanguageProvider";
import { UserProvider } from "./UserProvider";
import { SettingsLink } from "./SettingsLink";
import { FONT_SCALE_STORAGE_KEY } from "@/lib/fontScale";
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf3e6" },
    { media: "(prefers-color-scheme: dark)", color: "#221a14" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem(${JSON.stringify(
              FONT_SCALE_STORAGE_KEY,
            )});if(s)document.documentElement.style.setProperty("--font-scale",s);}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--paper)] text-[var(--ink)]">
        <FontScaleProvider>
          <UiLanguageProvider>
            <PlaybackProvider>
              <UserProvider>
                <header
                  className="sticky top-0 z-10 border-b border-[var(--line)] bg-[var(--paper)]/90 backdrop-blur"
                  style={{ paddingTop: "env(safe-area-inset-top)" }}
                >
                  <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
                    <span className="text-lg font-semibold tracking-tight text-[var(--clay-deep)]">📖 Wordflow</span>
                    <div className="flex items-center gap-2">
                      <AppNav />
                      <SettingsLink />
                    </div>
                  </div>
                </header>
                <main
                  className="mx-auto w-full max-w-2xl flex-1 px-4 py-6"
                  style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
                >
                  {children}
                </main>
                <NowPlayingBar />
              </UserProvider>
            </PlaybackProvider>
          </UiLanguageProvider>
        </FontScaleProvider>
      </body>
    </html>
  );
}
