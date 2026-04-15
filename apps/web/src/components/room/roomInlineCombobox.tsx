"use client";

import { filterWords } from "@platejs/combobox";
import { useComboboxInput, useHTMLInputCursorState } from "@platejs/combobox/react";
import {
  Combobox,
  ComboboxGroup,
  ComboboxGroupLabel,
  ComboboxItem,
  ComboboxPopover,
  ComboboxProvider,
  Portal,
  useComboboxContext,
  useComboboxStore,
  type ComboboxItemProps,
} from "@ariakit/react";
import { cva } from "class-variance-authority";
import { useComposedRef, useEditorRef } from "platejs/react";
import type { TElement } from "platejs";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "~/lib/utils";

type FilterFn = (
  item: { group?: string; keywords?: string[]; label?: string; value: string },
  search: string,
) => boolean;

type InlineComboboxContextValue = {
  filter: FilterFn | false;
  inputProps: ReturnType<typeof useComboboxInput>["props"];
  inputRef: React.RefObject<HTMLInputElement | null>;
  removeInput: ReturnType<typeof useComboboxInput>["removeInput"];
  setHasEmpty: (hasEmpty: boolean) => void;
  showTrigger: boolean;
  trigger: string;
};

const InlineComboboxContext = createContext<InlineComboboxContextValue | null>(null);

function useInlineComboboxContext(): InlineComboboxContextValue {
  const value = useContext(InlineComboboxContext);
  if (!value) {
    throw new Error("Inline combobox components must be used inside InlineCombobox.");
  }
  return value;
}

const defaultFilter: FilterFn = ({ group, keywords = [], label, value }, search) => {
  const searchTerms = new Set([value, label, group, ...keywords].filter(Boolean));
  return Array.from(searchTerms).some((term) => filterWords(term!, search));
};

export function InlineCombobox(props: {
  children: React.ReactNode;
  element: TElement;
  filter?: FilterFn | false;
  hideWhenNoValue?: boolean;
  showTrigger?: boolean;
  trigger: string;
}) {
  const {
    children,
    element,
    filter = defaultFilter,
    hideWhenNoValue = false,
    showTrigger = true,
    trigger,
  } = props;
  const editor = useEditorRef();
  const inputRef = useRef<HTMLInputElement>(null);
  const cursorState = useHTMLInputCursorState(inputRef);
  const [value, setValue] = useState("");
  const [hasEmpty, setHasEmpty] = useState(false);
  const insertPointRef = useRef<ReturnType<typeof editor.api.pointRef> | null>(null);

  useEffect(() => {
    insertPointRef.current?.unref();
    insertPointRef.current = null;

    const path = editor.api.findPath(element);
    if (!path) {
      return;
    }

    const point = editor.api.before(path);
    if (!point) {
      return;
    }

    const pointRef = editor.api.pointRef(point);
    insertPointRef.current = pointRef;

    return () => {
      if (insertPointRef.current === pointRef) {
        insertPointRef.current = null;
      }
      pointRef.unref();
    };
  }, [editor, element]);

  const { props: inputProps, removeInput } = useComboboxInput({
    autoFocus: true,
    cancelInputOnBlur: true,
    cursorState,
    onCancelInput: (cause) => {
      if (cause !== "backspace") {
        const insertAt = insertPointRef.current?.current;
        editor.tf.insertText(
          trigger + value,
          insertAt
            ? {
                at: insertAt,
              }
            : undefined,
        );
      }

      if (cause === "arrowLeft" || cause === "arrowRight") {
        editor.tf.move({
          distance: 1,
          reverse: cause === "arrowLeft",
        });
      }
    },
    ref: inputRef,
  });

  const contextValue = useMemo(
    () => ({
      filter,
      inputProps,
      inputRef,
      removeInput,
      setHasEmpty,
      showTrigger,
      trigger,
    }),
    [filter, inputProps, removeInput, showTrigger, trigger],
  );

  const store = useComboboxStore({
    setValue: (nextValue) => {
      setValue(nextValue);
    },
  });
  const items = store.useState("items");

  useEffect(() => {
    if (!store.getState().activeId) {
      store.setActiveId(store.first());
    }
  }, [items, store]);

  return (
    <span contentEditable={false}>
      <ComboboxProvider
        open={(items.length > 0 || hasEmpty) && (!hideWhenNoValue || value.length > 0)}
        store={store}
      >
        <InlineComboboxContext.Provider value={contextValue}>
          {children}
        </InlineComboboxContext.Provider>
      </ComboboxProvider>
    </span>
  );
}

export function InlineComboboxInput(
  props: React.HTMLAttributes<HTMLInputElement> & {
    ref?: React.RefObject<HTMLInputElement | null>;
  },
) {
  const { className, ref: propRef, ...rest } = props;
  const { inputProps, inputRef: contextRef, showTrigger, trigger } = useInlineComboboxContext();
  const store = useComboboxContext();
  if (!store) {
    throw new Error("Inline combobox input requires a combobox store.");
  }
  const value = store.useState("value");
  const ref = useComposedRef(propRef, contextRef);

  return (
    <>
      {showTrigger ? trigger : null}
      <span className="relative min-h-[1lh]">
        <span aria-hidden="true" className="invisible overflow-hidden text-nowrap">
          {value || "\u200B"}
        </span>
        <Combobox
          ref={ref}
          autoSelect
          className={cn("absolute inset-0 bg-transparent outline-none", className)}
          value={value}
          {...(inputProps as any)}
          {...(rest as any)}
        />
      </span>
    </>
  );
}

export function InlineComboboxContent(props: React.ComponentProps<typeof ComboboxPopover>) {
  const { className, ...rest } = props;
  const store = useComboboxContext();
  if (!store) {
    throw new Error("Inline combobox content requires a combobox store.");
  }

  return (
    <Portal>
      <ComboboxPopover
        className={cn(
          "z-50 max-h-72 w-[300px] overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md",
          className,
        )}
        onKeyDownCapture={(event) => {
          if (!store) {
            return;
          }

          const state = store.getState();
          const currentIndex = state.items.findIndex((item) => item.id === state.activeId);
          if (event.key === "ArrowUp" && currentIndex <= 0) {
            event.preventDefault();
            store.setActiveId(store.last());
          } else if (event.key === "ArrowDown" && currentIndex >= state.items.length - 1) {
            event.preventDefault();
            store.setActiveId(store.first());
          }
        }}
        {...rest}
      />
    </Portal>
  );
}

const comboboxItemVariants = cva(
  "relative mx-1 flex h-7 select-none items-center rounded-sm px-2 text-sm text-foreground outline-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    defaultVariants: {
      interactive: true,
    },
    variants: {
      interactive: {
        false: "",
        true: "cursor-pointer transition-colors hover:bg-accent hover:text-accent-foreground data-[active-item=true]:bg-accent data-[active-item=true]:text-accent-foreground",
      },
    },
  },
);

export function InlineComboboxItem(
  props: {
    focusEditor?: boolean;
    group?: string;
    keywords?: string[];
    label?: string;
  } & ComboboxItemProps &
    Required<Pick<ComboboxItemProps, "value">>,
) {
  const { className, focusEditor = true, group, keywords, label, onClick, value, ...rest } = props;
  const { filter, removeInput } = useInlineComboboxContext();
  const store = useComboboxContext();
  if (!store) {
    throw new Error("Inline combobox item requires a combobox store.");
  }
  const search = filter && store.useState("value");

  const visible = useMemo(
    () =>
      !filter ||
      filter(
        {
          ...(group ? { group } : {}),
          ...(keywords ? { keywords } : {}),
          ...(label ? { label } : {}),
          value,
        },
        search as string,
      ),
    [filter, group, keywords, label, search, value],
  );

  if (!visible) {
    return null;
  }

  return (
    <ComboboxItem
      className={cn(comboboxItemVariants(), className)}
      onClick={(event) => {
        removeInput(focusEditor);
        onClick?.(event);
      }}
      value={value}
      {...rest}
    />
  );
}

export function InlineComboboxEmpty(props: React.HTMLAttributes<HTMLDivElement>) {
  const { children, className } = props;
  const { setHasEmpty } = useInlineComboboxContext();
  const store = useComboboxContext();
  if (!store) {
    throw new Error("Inline combobox empty state requires a combobox store.");
  }
  const items = store.useState("items");

  useEffect(() => {
    setHasEmpty(true);
    return () => {
      setHasEmpty(false);
    };
  }, [setHasEmpty]);

  if (items.length > 0) {
    return null;
  }

  return (
    <div className={cn(comboboxItemVariants({ interactive: false }), className)}>{children}</div>
  );
}

export function InlineComboboxGroup(props: React.ComponentProps<typeof ComboboxGroup>) {
  const { className, ...rest } = props;
  return (
    <ComboboxGroup
      className={cn("hidden py-1.5 not-last:border-b [&:has([role=option])]:block", className)}
      {...rest}
    />
  );
}

export function InlineComboboxGroupLabel(props: React.ComponentProps<typeof ComboboxGroupLabel>) {
  const { className, ...rest } = props;
  return (
    <ComboboxGroupLabel
      className={cn("mt-1.5 mb-2 px-3 text-xs font-medium text-muted-foreground", className)}
      {...rest}
    />
  );
}
