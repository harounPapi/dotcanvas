import { memo } from "react";
import { BotIcon, PanelsTopLeftIcon } from "lucide-react";

import { type ThreadViewMode } from "../../diffRouteSearch";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../ui/breadcrumb";
import { SidebarTrigger } from "../ui/sidebar";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";

interface ChatHeaderProps {
  activeThreadTitle: string;
  activeProjectName: string | undefined;
  viewMode: ThreadViewMode;
  onViewModeChange: (nextView: ThreadViewMode) => void;
}

export const ChatHeader = memo(function ChatHeader({
  activeThreadTitle,
  activeProjectName,
  viewMode,
  onViewModeChange,
}: ChatHeaderProps) {
  return (
    <div className="@container/header-actions flex min-w-0 flex-1 items-center gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden sm:gap-3">
        <SidebarTrigger className="size-7 shrink-0 md:hidden [-webkit-app-region:no-drag]" />
        <Breadcrumb
          data-thread-breadcrumbs="true"
          aria-label="Thread breadcrumbs"
          className="min-w-0 overflow-hidden"
        >
          <BreadcrumbList className="min-w-0 flex-nowrap overflow-hidden">
            {activeProjectName ? (
              <>
                <BreadcrumbItem className="min-w-0 shrink overflow-hidden">
                  <span
                    className="block min-w-0 truncate text-sm text-muted-foreground"
                    title={activeProjectName}
                  >
                    {activeProjectName}
                  </span>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="shrink-0 text-muted-foreground/35">
                  <span>/</span>
                </BreadcrumbSeparator>
              </>
            ) : null}
            <BreadcrumbItem className="min-w-0 shrink overflow-hidden">
              <BreadcrumbPage
                className="min-w-0 truncate text-sm font-medium"
                title={activeThreadTitle}
              >
                {activeThreadTitle}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div
        data-thread-surface-switcher="true"
        className="flex shrink-0 items-center justify-end [-webkit-app-region:no-drag]"
      >
        <Tabs
          className="shrink-0"
          value={viewMode}
          onValueChange={(value) => {
            if (value === "agent" || value === "room") {
              onViewModeChange(value);
            }
          }}
        >
          <TabsList className="h-8 gap-1 rounded-lg border border-border/70 bg-muted/55 p-1">
            <TabsTrigger
              aria-label="Show agent view"
              className="min-w-20 gap-1.5 px-2 py-1 text-xs"
              value="agent"
            >
              <BotIcon className="size-3.5" />
              <span>Agent</span>
            </TabsTrigger>
            <TabsTrigger
              aria-label="Show room view"
              className="min-w-20 gap-1.5 px-2 py-1 text-xs"
              value="room"
            >
              <PanelsTopLeftIcon className="size-3.5" />
              <span>Room</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
    </div>
  );
});
