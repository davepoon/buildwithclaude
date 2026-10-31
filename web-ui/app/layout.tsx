import type { Metadata } from "next";
import { Outfit, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import { Navigation } from "@/components/navigation";
import { BANNER_DISMISSED_KEY } from "@/lib/create-marketplace-banner";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: 'swap',
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: 'swap',
});

export const metadata: Metadata = {
  title: "Build with Claude - Plugin Marketplace",
  description: "The plugin marketplace for Claude Code. Browse plugins, subagents, commands, skills, and hooks to enhance your AI development workflow.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body
        className={`${outfit.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        {/* Hide a dismissed banner before paint, so no layout shift moves the restored scroll */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem(${JSON.stringify(BANNER_DISMISSED_KEY)})==='true')document.documentElement.dataset.cmbDismissed=''}catch(e){}`,
          }}
        />
        <Navigation />
        <div className="h-16" />
        {children}
        <footer className="border-t border-border/40 mt-12">
          <div className="container mx-auto px-4 py-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
              <p>
                Made by <a href="https://github.com/davepoon" className="inline-block py-1 -my-1 hover:text-foreground transition-colors">Dave Poon</a>
              </p>
              <div className="flex items-center gap-6">
                <a
                  href="https://github.com/davepoon/buildwithclaude/blob/main/LICENSE"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-1 -my-1 hover:text-foreground transition-colors"
                >
                  MIT License
                </a>
                <a
                  href="https://github.com/davepoon/buildwithclaude"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-1 -my-1 hover:text-foreground transition-colors"
                >
                  GitHub
                </a>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
