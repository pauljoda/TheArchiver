"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { Terminal, ArrowDownToLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LogEntry {
  timestamp: string;
  source: string;
  level: string;
  message: string;
}

const POLL_INTERVAL = 3000;

const LEVEL_STYLES: Record<string, { label: string; msgColor: string }> = {
  ERROR: { label: "text-red-400", msgColor: "text-red-300" },
  WARN: { label: "text-amber-400", msgColor: "text-amber-200" },
  INFO: { label: "text-blue-400/60", msgColor: "text-zinc-400" },
  LOG: { label: "text-zinc-600", msgColor: "text-zinc-400" },
};

export function ConsoleLog() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchLogs() {
      try {
        const res = await fetch("/api/logs", { signal: controller.signal });
        const data = await res.json();
        setLogs(data);
      } catch {
        // ignore abort + network errors
      }
    }

    fetchLogs();
    const interval = setInterval(fetchLogs, POLL_INTERVAL);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const serverLogs = useMemo(
    () => logs.filter((e) => e.source === "Server"),
    [logs]
  );

  function handleScroll() {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 40);
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-border/50">
      {/* Terminal header */}
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="size-2.5 rounded-full bg-red-500/70" />
            <div className="size-2.5 rounded-full bg-amber-500/70" />
            <div className="size-2.5 rounded-full bg-emerald-500/70" />
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
            <Terminal className="size-3" />
            Server Console
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!autoScroll && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
              onClick={() => {
                setAutoScroll(true);
                scrollRef.current?.scrollTo({
                  top: scrollRef.current.scrollHeight,
                  behavior: "smooth",
                });
              }}
            >
              <ArrowDownToLine className="size-3" />
              Scroll to bottom
            </Button>
          )}
          <span className="text-[10px] font-mono text-zinc-600">
            {serverLogs.length} lines
          </span>
        </div>
      </div>

      {/* Terminal body */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="relative bg-zinc-950 h-[550px] overflow-y-auto vault-scroll scanlines"
      >
        <div className="p-4 font-mono text-xs leading-6">
          {serverLogs.length === 0 ? (
            <div className="flex items-center gap-2 text-zinc-600">
              <span className="inline-block size-1.5 rounded-full bg-zinc-700 animate-pulse" />
              Waiting for logs...
            </div>
          ) : (
            serverLogs.map((entry, i) => {
              const style = LEVEL_STYLES[entry.level] || LEVEL_STYLES.LOG;
              return (
                <div
                  key={i}
                  className="group flex gap-0 py-px hover:bg-zinc-900/60 -mx-4 px-4 rounded"
                >
                  <span className="text-zinc-700 shrink-0 w-20 select-none">
                    {entry.timestamp}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 w-14 font-bold uppercase text-[10px] leading-6",
                      style.label
                    )}
                  >
                    {entry.level}
                  </span>
                  <span className={cn("break-all", style.msgColor)}>
                    {entry.message}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Bottom gradient fade */}
        <div className="pointer-events-none sticky bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-zinc-950 to-transparent" />
      </div>
    </div>
  );
}
