import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { pickThreadViewSearch } from "../diffRouteSearch";
import { readNativeApi } from "../nativeApi";
import { useUiStateStore } from "../uiStateStore";

export function useDotCanvasProjectFlow() {
  const navigate = useNavigate();
  const setProjectExpanded = useUiStateStore((store) => store.setProjectExpanded);

  const createProjectFromScratch = useCallback(
    async (input: { parentPath: string; projectName: string }) => {
      const api = readNativeApi();
      if (!api) {
        throw new Error("DotCanvas API is unavailable.");
      }

      const projectName = input.projectName.trim();
      if (!projectName) {
        throw new Error("Project name is required.");
      }

      const result = await api.projects.bootstrapStart({
        parentPath: input.parentPath,
        projectName,
      });

      setProjectExpanded(result.projectId, true);
      await navigate({
        to: "/$threadId",
        params: { threadId: result.threadId },
        search: (previous) => pickThreadViewSearch(previous),
      });

      return result;
    },
    [navigate, setProjectExpanded],
  );

  return {
    createProjectFromScratch,
  };
}
