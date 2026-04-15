"use client";

function isRoomElementNode(value: unknown): value is {
  children: unknown[];
  id?: string;
  type: string;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    typeof value.type === "string" &&
    "children" in value &&
    Array.isArray(value.children)
  );
}

export function createRoomElementId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `room-${Math.random().toString(36).slice(2, 10)}`;
}

export function withRoomElementIds<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => withRoomElementIds(entry)) as T;
  }

  if (!isRoomElementNode(value)) {
    if (typeof value === "object" && value !== null) {
      return Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [key, withRoomElementIds(entry)]),
      ) as T;
    }

    return value;
  }

  return {
    ...value,
    children: value.children.map((child) => withRoomElementIds(child)),
    id: typeof value.id === "string" && value.id.length > 0 ? value.id : createRoomElementId(),
  } as T;
}

export function cloneRoomElementWithFreshIds<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneRoomElementWithFreshIds(entry)) as T;
  }

  if (!isRoomElementNode(value)) {
    if (typeof value === "object" && value !== null) {
      return Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [key, cloneRoomElementWithFreshIds(entry)]),
      ) as T;
    }

    return value;
  }

  return {
    ...value,
    children: value.children.map((child) => cloneRoomElementWithFreshIds(child)),
    id: createRoomElementId(),
  } as T;
}

export function assignMissingRoomElementIds(editor: {
  api: {
    nodes: (options: {
      at?: [];
      match: (node: unknown) => boolean;
    }) => Iterable<[unknown, unknown]>;
  };
  tf: {
    setNodes: (properties: { id: string }, options: { at: unknown }) => void;
    withoutNormalizing: (callback: () => void) => void;
  };
}): boolean {
  const entries = Array.from(
    editor.api.nodes({
      at: [],
      match: (node) => isRoomElementNode(node) && typeof node.id !== "string",
    }),
  );

  if (entries.length === 0) {
    return false;
  }

  editor.tf.withoutNormalizing(() => {
    for (const [, path] of entries) {
      editor.tf.setNodes({ id: createRoomElementId() }, { at: path });
    }
  });

  return true;
}
