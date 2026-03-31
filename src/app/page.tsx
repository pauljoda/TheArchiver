"use client";

import { useCallback } from "react";
import {
  ListOrdered,
  AlertTriangle,
  Clock,
  Puzzle,
  Terminal,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { QueueTable } from "@/components/queue/queue-table";
import { FailedTable } from "@/components/failed/failed-table";
import { PluginList } from "@/components/plugins/plugin-list";
import { ConsoleLog } from "@/components/dashboard/console-log";
import { useFetch } from "@/hooks/use-fetch";
import { useSSE } from "@/hooks/use-sse";

export default function Home() {
  const queue = useFetch("/api/queue", []);
  const failed = useFetch("/api/failed", []);
  const history = useFetch("/api/history", []);
  const plugins = useFetch("/api/plugins", []);

  const refreshAll = useCallback(() => {
    queue.refresh();
    failed.refresh();
    history.refresh();
  }, [queue.refresh, failed.refresh, history.refresh]);

  useSSE(refreshAll);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
    <div className="flex flex-col gap-8">
      {/* Stats row */}
      <div className="animate-vault-enter" style={{ animationDelay: "0ms" }}>
        <StatsCards
          queueCount={queue.data.length}
          failedCount={failed.data.length}
          historyCount={history.data.length}
          pluginCount={plugins.data.length}
        />
      </div>

      {/* Main content tabs */}
      <div className="animate-vault-enter" style={{ animationDelay: "100ms" }}>
        <Tabs defaultValue="queue" className="flex flex-col gap-4">
          <TabsList className="h-auto w-full justify-start gap-1 rounded-lg bg-secondary/50 p-1.5">
            <TabsTrigger
              value="queue"
              className="gap-2 rounded-md px-2 py-2 text-xs font-heading font-medium uppercase tracking-wider sm:px-4 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm"
            >
              <ListOrdered className="size-4 sm:size-3.5" />
              <span className="hidden sm:inline">Queue</span>
              {queue.data.length > 0 && (
                <span className="ml-1 hidden size-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary sm:flex">
                  {queue.data.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="failed"
              className="gap-2 rounded-md px-2 py-2 text-xs font-heading font-medium uppercase tracking-wider sm:px-4 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm"
            >
              <AlertTriangle className="size-4 sm:size-3.5" />
              <span className="hidden sm:inline">Failed</span>
              {failed.data.length > 0 && (
                <span className="ml-1 hidden size-5 items-center justify-center rounded-full bg-destructive/15 text-[10px] font-bold text-destructive sm:flex">
                  {failed.data.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="gap-2 rounded-md px-2 py-2 text-xs font-heading font-medium uppercase tracking-wider sm:px-4 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm"
            >
              <Clock className="size-4 sm:size-3.5" />
              <span className="hidden sm:inline">History</span>
            </TabsTrigger>
            <TabsTrigger
              value="plugins"
              className="gap-2 rounded-md px-2 py-2 text-xs font-heading font-medium uppercase tracking-wider sm:px-4 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm"
            >
              <Puzzle className="size-4 sm:size-3.5" />
              <span className="hidden sm:inline">Plugins</span>
            </TabsTrigger>
            <TabsTrigger
              value="logs"
              className="gap-2 rounded-md px-2 py-2 text-xs font-heading font-medium uppercase tracking-wider sm:px-4 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm"
            >
              <Terminal className="size-4 sm:size-3.5" />
              <span className="hidden sm:inline">Logs</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="queue" className="animate-vault-fade">
            <QueueTable items={queue.data} onRefresh={refreshAll} />
          </TabsContent>

          <TabsContent value="failed" className="animate-vault-fade">
            <FailedTable items={failed.data} onRefresh={refreshAll} />
          </TabsContent>

          <TabsContent value="history" className="animate-vault-fade">
            <RecentActivity items={history.data} onRefresh={refreshAll} />
          </TabsContent>

          <TabsContent value="plugins" className="animate-vault-fade">
            <PluginList plugins={plugins.data} onRefresh={plugins.refresh} />
          </TabsContent>

          <TabsContent value="logs" className="animate-vault-fade">
            <ConsoleLog />
          </TabsContent>
        </Tabs>
      </div>
    </div>
    </div>
  );
}
