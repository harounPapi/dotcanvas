import { useEffect, useState } from "react";
import { FilePlus2Icon, FolderSearchIcon, HistoryIcon, FolderIcon } from "~/components/ui/icons";
import { isElectron } from "../env";
import { readNativeApi } from "../nativeApi";
import { useAssistProjectFlow } from "../hooks/useAssistProjectFlow";
import { LogoMark } from "./branding/LogoMark";
import { Button } from "./ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { toastManager } from "./ui/toast";

export function StartFromScratchProjectForm(props: {
  className?: string;
  open?: boolean;
  submitLabel?: string;
  onCancel?: (() => void) | undefined;
  onCreated?: (() => void) | undefined;
}) {
  const { createProjectFromScratch } = useAssistProjectFlow();
  const [parentPath, setParentPath] = useState("");
  const [projectName, setProjectName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (props.open !== false) {
      return;
    }
    setParentPath("");
    setProjectName("");
    setIsCreating(false);
    setError(null);
  }, [props.open]);

  const handlePickParent = async () => {
    const api = readNativeApi();
    if (!api) return;
    const pickedPath = await api.dialogs.pickFolder().catch(() => null);
    if (!pickedPath) {
      return;
    }
    setParentPath(pickedPath);
    setError(null);
  };

  const handleCreate = async () => {
    if (isCreating) return;
    setIsCreating(true);
    setError(null);
    try {
      await createProjectFromScratch({ parentPath, projectName });
      props.onCreated?.();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Failed to create .assist project.";
      setError(message);
      toastManager.add({
        type: "error",
        title: "Project creation failed",
        description: message,
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <form
      className={props.className}
      onSubmit={(event) => {
        event.preventDefault();
        void handleCreate();
      }}
    >
      <div className="grid gap-4">
        <div className="grid gap-1.5">
          <label className="text-xs font-medium text-foreground/80">Parent folder</label>
          <div className="flex gap-2">
            <Input
              value={parentPath}
              onChange={(event) => {
                setParentPath(event.target.value);
                setError(null);
              }}
              placeholder={isElectron ? "Choose where the project should live" : "/path/to/folder"}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handlePickParent()}
              disabled={isCreating}
            >
              <FolderIcon className="size-4" />
              Browse
            </Button>
          </div>
        </div>

        <div className="grid gap-1.5">
          <label className="text-xs font-medium text-foreground/80">Project name</label>
          <Input
            value={projectName}
            onChange={(event) => {
              setProjectName(event.target.value);
              setError(null);
            }}
            placeholder="Research paper, business plan, diligence..."
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void handleCreate();
              }
            }}
          />
        </div>

        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        <div className="flex flex-col items-start justify-between gap-3 border-t pt-4 sm:flex-row sm:items-center">
          <p className="max-w-md text-xs text-muted-foreground">
            .assist will create the workspace, write `AGENTS.md` plus `.context/`, and open a
            bootstrap thread that understands the goal before reorganizing the project.
          </p>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            {props.onCancel ? (
              <Button
                type="button"
                variant="outline"
                onClick={props.onCancel}
                disabled={isCreating}
              >
                Cancel
              </Button>
            ) : null}
            <Button
              type="submit"
              disabled={
                isCreating || parentPath.trim().length === 0 || projectName.trim().length === 0
              }
            >
              {isCreating ? "Creating..." : (props.submitLabel ?? "Create project")}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}

export function StartFromScratchProjectDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  submitLabel?: string;
}) {
  return (
    <Dialog onOpenChange={props.onOpenChange} open={props.open}>
      <DialogPopup className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{props.title ?? "Start from scratch"}</DialogTitle>
          <DialogDescription>
            {props.description ??
              "Create a new .assist project folder and let the agent bootstrap the room through a real first conversation, an explicit bootstrap plan, and approved workspace organization."}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel scrollFade={false}>
          <StartFromScratchProjectForm
            open={props.open}
            onCancel={() => props.onOpenChange(false)}
            onCreated={() => props.onOpenChange(false)}
            {...(props.submitLabel ? { submitLabel: props.submitLabel } : {})}
          />
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
}

export function ProjectCreationSurface() {
  const [startDialogOpen, setStartDialogOpen] = useState(false);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
        <LogoMark size="lg" className="text-foreground" title=".assist" variant="foreground" />
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground">
          Start a project room, not a blank chat.
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          .assist is designed for source-heavy projects that need to become a reliable deliverable.
          Choose how you want to begin.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-primary/20 shadow-primary/8">
          <CardHeader className="gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2 text-primary">
                <FilePlus2Icon className="size-5" />
              </div>
              <CardTitle className="text-base">Start from scratch</CardTitle>
            </div>
            <CardDescription>
              Create a brand-new workspace and let .assist bootstrap the room around the real
              project goal, context, and root structure.
            </CardDescription>
          </CardHeader>
          <CardFooter className="pt-0">
            <Button onClick={() => setStartDialogOpen(true)}>Start here</Button>
          </CardFooter>
        </Card>

        <Card className="opacity-80">
          <CardHeader className="gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-secondary p-2 text-muted-foreground">
                <FolderSearchIcon className="size-5" />
              </div>
              <CardTitle className="text-base">Import existing project</CardTitle>
            </div>
            <CardDescription>
              Bring an existing workspace and let .assist reconstruct the room around the real
              project brief, context, and next structure.
            </CardDescription>
          </CardHeader>
          <CardFooter className="pt-0">
            <Button variant="outline" disabled>
              Coming soon
            </Button>
          </CardFooter>
        </Card>

        <Card className="opacity-80">
          <CardHeader className="gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-secondary p-2 text-muted-foreground">
                <HistoryIcon className="size-5" />
              </div>
              <CardTitle className="text-base">Resume old project</CardTitle>
            </div>
            <CardDescription>
              Re-open a stalled workspace and let .assist rebuild the room around unresolved work,
              recovered context, and next steps.
            </CardDescription>
          </CardHeader>
          <CardFooter className="pt-0">
            <Button variant="outline" disabled>
              Coming soon
            </Button>
          </CardFooter>
        </Card>
      </div>

      <StartFromScratchProjectDialog open={startDialogOpen} onOpenChange={setStartDialogOpen} />
    </div>
  );
}
