import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { Header } from "@/components/header";
import { TooltipProvider } from "@/components/ui/tooltip";
import pkg from "../../package.json";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Archiver",
  description: "Plugin-based web content archiver",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider>
            <div className="relative flex min-h-screen flex-col">
              <Header />
              <main className="flex-1">
                {children}
              </main>
              <footer className="border-t border-border/50 py-4">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                  <p className="text-center text-xs font-mono text-muted-foreground/50 tracking-wider uppercase">
                    v{pkg.version} &middot; Archive Engine Online
                  </p>
                </div>
              </footer>
            </div>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
