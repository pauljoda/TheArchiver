"use client";

import Link from "next/link";
import { Archive, Settings, Activity, FolderOpen } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="group flex items-center gap-3">
          <div className="relative flex items-center justify-center size-9 rounded-lg bg-primary/10 ring-1 ring-primary/20 transition-all group-hover:bg-primary/15 group-hover:ring-primary/40 group-hover:shadow-[0_0_15px_var(--amber-glow)]">
            <Archive className="size-4 text-primary" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-heading font-bold tracking-tight">
              THE ARCHIVER
            </span>
            <span className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground/60 tracking-widest uppercase">
              <Activity className="size-2.5" />
              System Active
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground hover:bg-primary/10"
                asChild
              >
                <Link href="/files">
                  <FolderOpen className="size-4" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Files</TooltipContent>
          </Tooltip>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground hover:bg-primary/10"
            asChild
          >
            <Link href="/settings">
              <Settings className="size-4" />
            </Link>
          </Button>
          <Separator orientation="vertical" className="mx-1 h-6" />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
