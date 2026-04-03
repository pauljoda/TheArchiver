"use client";

import { ChangelogDialog } from "./changelog-dialog";

export function Footer({ version }: { version: string }) {
  return (
    <footer className="border-t border-border/50 py-4">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-center text-xs font-mono text-muted-foreground/50 tracking-wider uppercase">
          <ChangelogDialog version={version}>
            <button className="hover:text-primary transition-colors cursor-pointer">
              v{version}
            </button>
          </ChangelogDialog>
          {" "}&middot; Archive Engine Online
        </p>
      </div>
    </footer>
  );
}
