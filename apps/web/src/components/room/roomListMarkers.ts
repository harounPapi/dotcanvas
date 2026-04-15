"use client";

export type RoomListMarkerNode = {
  checked?: boolean;
  indent?: number;
  listRestartPolite?: number;
  listStart?: number;
  listStyleType?: string;
};

const BULLET_MARKERS: Record<string, string> = {
  circle: "◦",
  disc: "•",
  square: "▪",
};

const ORDERED_LIST_STYLES = new Set([
  "decimal",
  "lower-alpha",
  "upper-alpha",
  "lower-roman",
  "upper-roman",
]);

function isFinitePositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 1;
}

function formatAlphabeticMarker(value: number, uppercase: boolean): string {
  let current = value;
  let output = "";

  while (current > 0) {
    current -= 1;
    output = String.fromCharCode(97 + (current % 26)) + output;
    current = Math.floor(current / 26);
  }

  return uppercase ? output.toUpperCase() : output;
}

function formatRomanMarker(value: number, uppercase: boolean): string {
  const romanPairs: Array<[number, string]> = [
    [1000, "m"],
    [900, "cm"],
    [500, "d"],
    [400, "cd"],
    [100, "c"],
    [90, "xc"],
    [50, "l"],
    [40, "xl"],
    [10, "x"],
    [9, "ix"],
    [5, "v"],
    [4, "iv"],
    [1, "i"],
  ];
  let current = value;
  let output = "";

  for (const [amount, numeral] of romanPairs) {
    while (current >= amount) {
      output += numeral;
      current -= amount;
    }
  }

  return uppercase ? output.toUpperCase() : output;
}

function formatOrderedMarkerValue(value: number, listStyleType: string): string {
  switch (listStyleType) {
    case "lower-alpha":
      return formatAlphabeticMarker(value, false);
    case "upper-alpha":
      return formatAlphabeticMarker(value, true);
    case "lower-roman":
      return formatRomanMarker(value, false);
    case "upper-roman":
      return formatRomanMarker(value, true);
    case "decimal":
    default:
      return String(value);
  }
}

export function isRoomTodoListItem(node: RoomListMarkerNode): boolean {
  return node.listStyleType === "todo" || typeof node.checked === "boolean";
}

export function getRoomListIndentLevel(node: RoomListMarkerNode): number {
  if (typeof node.indent !== "number" || !Number.isFinite(node.indent)) {
    return 0;
  }

  return Math.max(Math.trunc(node.indent) - 1, 0);
}

function resolveRoomOrderedListValue(
  node: RoomListMarkerNode,
  siblings: readonly RoomListMarkerNode[],
  index: number,
): number {
  if (isFinitePositiveInteger(node.listStart)) {
    return node.listStart;
  }

  if (isFinitePositiveInteger(node.listRestartPolite)) {
    return node.listRestartPolite;
  }

  const currentIndent = node.indent ?? 0;
  const currentStyleType = node.listStyleType ?? "decimal";
  let offset = 1;

  for (let currentIndex = index - 1; currentIndex >= 0; currentIndex -= 1) {
    const previousNode = siblings[currentIndex];
    if (!previousNode) {
      continue;
    }
    const previousIndent = previousNode.indent ?? 0;

    if (previousIndent < currentIndent) {
      break;
    }

    if (previousIndent > currentIndent) {
      continue;
    }

    if (
      !previousNode.listStyleType ||
      previousNode.listStyleType !== currentStyleType ||
      isRoomTodoListItem(previousNode) ||
      !ORDERED_LIST_STYLES.has(previousNode.listStyleType)
    ) {
      break;
    }

    if (isFinitePositiveInteger(previousNode.listStart)) {
      return previousNode.listStart + offset;
    }

    if (isFinitePositiveInteger(previousNode.listRestartPolite)) {
      return previousNode.listRestartPolite + offset;
    }

    offset += 1;
  }

  return offset;
}

export function getRoomListMarkerLabel(
  node: RoomListMarkerNode,
  siblings: readonly RoomListMarkerNode[] = [],
  index = -1,
): string | null {
  if (!node.listStyleType || isRoomTodoListItem(node)) {
    return null;
  }

  if (node.listStyleType in BULLET_MARKERS) {
    return BULLET_MARKERS[node.listStyleType] ?? null;
  }

  if (!ORDERED_LIST_STYLES.has(node.listStyleType)) {
    return null;
  }

  const ordinalValue =
    index >= 0 ? resolveRoomOrderedListValue(node, siblings, index) : (node.listStart ?? 1);

  return `${formatOrderedMarkerValue(ordinalValue, node.listStyleType)}.`;
}
