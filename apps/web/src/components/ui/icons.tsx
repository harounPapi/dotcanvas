import {
  Add01Icon as Add01IconSvg,
  Alert01Icon as Alert01IconSvg,
  AlertCircleIcon as AlertCircleIconSvg,
  ArchiveIcon as ArchiveIconSvg,
  ArchiveOff03Icon as ArchiveOff03IconSvg,
  ArrowDown01Icon as ArrowDown01IconSvg,
  ArrowLeft01Icon as ArrowLeft01IconSvg,
  ArrowRight01Icon as ArrowRight01IconSvg,
  ArrowUp01Icon as ArrowUp01IconSvg,
  ArrowUpDownIcon as ArrowUpDownIconSvg,
  BotIcon as BotIconSvg,
  Bug01Icon as Bug01IconSvg,
  Cancel01Icon as Cancel01IconSvg,
  CheckmarkCircle01Icon as CheckmarkCircle01IconSvg,
  CloudLoadingIcon as CloudLoadingIconSvg,
  CloudUploadIcon as CloudUploadIconSvg,
  ComputerTerminal01Icon as ComputerTerminal01IconSvg,
  Copy01Icon as Copy01IconSvg,
  Delete02Icon as Delete02IconSvg,
  Download01Icon as Download01IconSvg,
  Edit01Icon as Edit01IconSvg,
  File01Icon as File01IconSvg,
  FileAddIcon as FileAddIconSvg,
  LegalHammerIcon as LegalHammerIconSvg,
  Folder01Icon as Folder01IconSvg,
  Folder02Icon as Folder02IconSvg,
  FolderOpenIcon as FolderOpenIconSvg,
  FolderSearchIcon as FolderSearchIconSvg,
  GitCommitIcon as GitCommitIconSvg,
  GitForkIcon as GitForkIconSvg,
  GitPullRequestIcon as GitPullRequestIconSvg,
  GlobeIcon as GlobeIconSvg,
  InformationCircleIcon as InformationCircleIconSvg,
  LayoutGridIcon as LayoutGridIconSvg,
  LayoutThreeRowIcon as LayoutThreeRowIconSvg,
  LayoutTwoColumnIcon as LayoutTwoColumnIconSvg,
  Loading01Icon as Loading01IconSvg,
  Loading02Icon as Loading02IconSvg,
  Loading03Icon as Loading03IconSvg,
  LockIcon as LockIconSvg,
  MoreHorizontalIcon as MoreHorizontalIconSvg,
  PackageIcon as PackageIconSvg,
  PanelLeftCloseIcon as PanelLeftCloseIconSvg,
  PanelLeftIcon as PanelLeftIconSvg,
  PanelRightCloseIcon as PanelRightCloseIconSvg,
  PencilEdit02Icon as PencilEdit02IconSvg,
  PlayIcon as PlayIconSvg,
  Plug01Icon as Plug01IconSvg,
  PlusSignIcon as PlusSignIconSvg,
  Refresh01Icon as Refresh01IconSvg,
  RotateClockwiseIcon as RotateClockwiseIconSvg,
  RotateLeft01Icon as RotateLeft01IconSvg,
  RotateRight01Icon as RotateRight01IconSvg,
  Search01Icon as Search01IconSvg,
  Setting06Icon as Setting06IconSvg,
  Settings01Icon as Settings01IconSvg,
  SplitIcon as SplitIconSvg,
  SquareUnlock01Icon as SquareUnlock01IconSvg,
  TaskDone01Icon as TaskDone01IconSvg,
  TaskEdit01Icon as TaskEdit01IconSvg,
  TerminalIcon as TerminalIconSvg,
  TestTubeIcon as TestTubeIconSvg,
  TextWrapIcon as TextWrapIconSvg,
  Tick01Icon as Tick01IconSvg,
  Undo02Icon as Undo02IconSvg,
  ViewIcon as ViewIconSvg,
  WorkHistoryIcon as WorkHistoryIconSvg,
  Wrench01Icon as Wrench01IconSvg,
  ZapIcon as ZapIconSvg,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type HugeiconsIconProps, type IconSvgElement } from "@hugeicons/react";
import { forwardRef, type ForwardRefExoticComponent, type RefAttributes } from "react";

export type { IconSvgElement };

export type AppIconDefinition = IconSvgElement;
export type AppIconProps = Omit<HugeiconsIconProps, "icon">;
export type AppIconComponent = ForwardRefExoticComponent<
  AppIconProps & RefAttributes<SVGSVGElement>
>;

export const AppIcon = forwardRef<SVGSVGElement, HugeiconsIconProps>(function AppIcon(props, ref) {
  return <HugeiconsIcon ref={ref} {...props} />;
});

function createAppIcon(name: string, icon: IconSvgElement): AppIconComponent {
  const Component = forwardRef<SVGSVGElement, AppIconProps>(function AppIconComponent(props, ref) {
    return <HugeiconsIcon ref={ref} icon={icon} {...props} />;
  });
  Component.displayName = name;
  return Component;
}

export const AlertTriangle = createAppIcon("AlertTriangle", Alert01IconSvg);
export const ArchiveIcon = createAppIcon("ArchiveIcon", ArchiveIconSvg);
export const ArchiveX = createAppIcon("ArchiveX", ArchiveOff03IconSvg);
export const ArrowLeftIcon = createAppIcon("ArrowLeftIcon", ArrowLeft01IconSvg);
export const BotIcon = createAppIcon("BotIcon", BotIconSvg);
export const BugIcon = createAppIcon("BugIcon", Bug01IconSvg);
export const CheckIcon = createAppIcon("CheckIcon", Tick01IconSvg);
export const ChevronDownIcon = createAppIcon("ChevronDownIcon", ArrowDown01IconSvg);
export const ChevronLeftIcon = createAppIcon("ChevronLeftIcon", ArrowLeft01IconSvg);
export const ChevronRightIcon = createAppIcon("ChevronRightIcon", ArrowRight01IconSvg);
export const ChevronsUpDownIcon = createAppIcon("ChevronsUpDownIcon", ArrowUpDownIconSvg);
export const ChevronUpIcon = createAppIcon("ChevronUpIcon", ArrowUp01IconSvg);
export const CircleAlertIcon = createAppIcon("CircleAlertIcon", AlertCircleIconSvg);
export const CircleCheckIcon = createAppIcon("CircleCheckIcon", CheckmarkCircle01IconSvg);
export const CloudOff = createAppIcon("CloudOff", CloudLoadingIconSvg);
export const CloudUploadIcon = createAppIcon("CloudUploadIcon", CloudUploadIconSvg);
export const Columns2Icon = createAppIcon("Columns2Icon", LayoutTwoColumnIconSvg);
export const CopyIcon = createAppIcon("CopyIcon", Copy01IconSvg);
export const EllipsisIcon = createAppIcon("EllipsisIcon", MoreHorizontalIconSvg);
export const EyeIcon = createAppIcon("EyeIcon", ViewIconSvg);
export const FileIcon = createAppIcon("FileIcon", File01IconSvg);
export const FilePlus2Icon = createAppIcon("FilePlus2Icon", FileAddIconSvg);
export const FlaskConicalIcon = createAppIcon("FlaskConicalIcon", TestTubeIconSvg);
export const FolderClosedIcon = createAppIcon("FolderClosedIcon", Folder02IconSvg);
export const FolderIcon = createAppIcon("FolderIcon", Folder01IconSvg);
export const FolderSearchIcon = createAppIcon("FolderSearchIcon", FolderSearchIconSvg);
export const GitCommitIcon = createAppIcon("GitCommitIcon", GitCommitIconSvg);
export const GitForkIcon = createAppIcon("GitForkIcon", GitForkIconSvg);
export const GlobeIcon = createAppIcon("GlobeIcon", GlobeIconSvg);
export const HammerIcon = createAppIcon("HammerIcon", LegalHammerIconSvg);
export const HistoryIcon = createAppIcon("HistoryIcon", WorkHistoryIconSvg);
export const InfoIcon = createAppIcon("InfoIcon", InformationCircleIconSvg);
export const ListChecksIcon = createAppIcon("ListChecksIcon", TaskDone01IconSvg);
export const ListTodoIcon = createAppIcon("ListTodoIcon", TaskEdit01IconSvg);
export const Loader2Icon = createAppIcon("Loader2Icon", Loading02IconSvg);
export const LoaderCircle = createAppIcon("LoaderCircle", Loading03IconSvg);
export const LoaderCircleIcon = createAppIcon("LoaderCircleIcon", Loading03IconSvg);
export const LoaderIcon = createAppIcon("LoaderIcon", Loading01IconSvg);
export const LockIcon = createAppIcon("LockIcon", LockIconSvg);
export const LockOpenIcon = createAppIcon("LockOpenIcon", SquareUnlock01IconSvg);
export const MoreHorizontalIcon = createAppIcon("MoreHorizontalIcon", MoreHorizontalIconSvg);
export const PackageIcon = createAppIcon("PackageIcon", PackageIconSvg);
export const PanelLeftCloseIcon = createAppIcon("PanelLeftCloseIcon", PanelLeftCloseIconSvg);
export const PanelLeftIcon = createAppIcon("PanelLeftIcon", PanelLeftIconSvg);
export const PanelRightCloseIcon = createAppIcon("PanelRightCloseIcon", PanelRightCloseIconSvg);
export const PanelsTopLeftIcon = createAppIcon("PanelsTopLeftIcon", LayoutGridIconSvg);
export const PlayIcon = createAppIcon("PlayIcon", PlayIconSvg);
export const PlugIcon = createAppIcon("PlugIcon", Plug01IconSvg);
export const Plus = createAppIcon("Plus", Add01IconSvg);
export const PlusIcon = createAppIcon("PlusIcon", Add01IconSvg);
export const RefreshCwIcon = createAppIcon("RefreshCwIcon", Refresh01IconSvg);
export const RotateCcwIcon = createAppIcon("RotateCcwIcon", RotateLeft01IconSvg);
export const RotateCw = createAppIcon("RotateCw", RotateRight01IconSvg);
export const Rows3Icon = createAppIcon("Rows3Icon", LayoutThreeRowIconSvg);
export const SearchIcon = createAppIcon("SearchIcon", Search01IconSvg);
export const SettingsIcon = createAppIcon("SettingsIcon", Settings01IconSvg);
export const SquarePenIcon = createAppIcon("SquarePenIcon", Edit01IconSvg);
export const SquareSplitHorizontal = createAppIcon("SquareSplitHorizontal", SplitIconSvg);
export const TerminalIcon = createAppIcon("TerminalIcon", TerminalIconSvg);
export const TerminalSquare = createAppIcon("TerminalSquare", ComputerTerminal01IconSvg);
export const TextWrapIcon = createAppIcon("TextWrapIcon", TextWrapIconSvg);
export const Trash2 = createAppIcon("Trash2", Delete02IconSvg);
export const TriangleAlertIcon = createAppIcon("TriangleAlertIcon", Alert01IconSvg);
export const Undo2Icon = createAppIcon("Undo2Icon", Undo02IconSvg);
export const WrenchIcon = createAppIcon("WrenchIcon", Wrench01IconSvg);
export const XIcon = createAppIcon("XIcon", Cancel01IconSvg);
export const ZapIcon = createAppIcon("ZapIcon", ZapIconSvg);

export const Alert01Icon = createAppIcon("Alert01Icon", Alert01IconSvg);
export const ArrowLeft01Icon = createAppIcon("ArrowLeft01Icon", ArrowLeft01IconSvg);
export const ArrowRight01Icon = createAppIcon("ArrowRight01Icon", ArrowRight01IconSvg);
export const ArrowUpDownIcon = createAppIcon("ArrowUpDownIcon", ArrowUpDownIconSvg);
export const Cancel01Icon = createAppIcon("Cancel01Icon", Cancel01IconSvg);
export const Download01Icon = createAppIcon("Download01Icon", Download01IconSvg);
export const FolderOpenIcon = createAppIcon("FolderOpenIcon", FolderOpenIconSvg);
export const GitPullRequestIcon = createAppIcon("GitPullRequestIcon", GitPullRequestIconSvg);
export const PencilEdit02Icon = createAppIcon("PencilEdit02Icon", PencilEdit02IconSvg);
export const PlusSignIcon = createAppIcon("PlusSignIcon", PlusSignIconSvg);
export const RotateClockwiseIcon = createAppIcon("RotateClockwiseIcon", RotateClockwiseIconSvg);
export const Setting06Icon = createAppIcon("Setting06Icon", Setting06IconSvg);
