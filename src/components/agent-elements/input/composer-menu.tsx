import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "../utils/cn";

export type ComposerMenuItem = {
  id: string;
  label: string;
  /** Secondary text rendered right-aligned (e.g. a file's directory path). */
  hint?: string;
  icon?: ReactNode;
  /** Rendered but not selectable — used for "no results" hint rows. */
  disabled?: boolean;
};

/**
 * A host-provided source for one composer menu (the "@" mention menu or the
 * "/" prompt menu). `getItems` is called (debounced) as the trigger token
 * changes; `onSelect` returns the text that replaces the token (mention menu)
 * or the whole draft (prompt menu), or null to leave the draft untouched.
 */
export type ComposerMenuSource = {
  getItems: (query: string) => Promise<ComposerMenuItem[]> | ComposerMenuItem[];
  onSelect: (item: ComposerMenuItem, query: string) => string | null;
};

export type ComposerMenuProps = {
  items: ComposerMenuItem[];
  activeIndex: number;
  onSelect: (item: ComposerMenuItem) => void;
  onHover: (index: number) => void;
  className?: string;
};

/**
 * The floating list itself: absolutely positioned above the input inside the
 * composer's relative wrapper. Purely presentational — open/close, filtering
 * and keyboard state live in the InputBar that owns the textarea.
 */
export function ComposerMenu({
  items,
  activeIndex,
  onSelect,
  onHover,
  className,
}: ComposerMenuProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // Keyboard navigation can move the active row out of a scrolled list.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const active = list.querySelector<HTMLElement>("[data-active='true']");
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, items]);

  if (items.length === 0) return null;

  return (
    <div
      ref={listRef}
      role="listbox"
      className={cn(
        "absolute bottom-full left-0 right-0 z-30 mb-1.5 max-h-64 overflow-y-auto",
        "rounded-[10px] border border-an-border-color bg-an-background p-1 shadow-lg",
        className,
      )}
    >
      {items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          role="option"
          aria-selected={index === activeIndex && !item.disabled}
          data-active={index === activeIndex && !item.disabled ? "true" : undefined}
          disabled={item.disabled}
          // preventDefault keeps focus in the textarea so the composer's
          // blur-close never races the click.
          onMouseDown={(e) => e.preventDefault()}
          onMouseEnter={() => {
            if (!item.disabled) onHover(index);
          }}
          onClick={() => {
            if (!item.disabled) onSelect(item);
          }}
          className={cn(
            "flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-[13px] leading-4 text-an-foreground",
            index === activeIndex && !item.disabled && "bg-an-background-secondary",
            item.disabled && "cursor-default text-an-foreground-muted",
          )}
        >
          {item.icon && (
            <span className="inline-flex shrink-0 text-an-foreground-muted">
              {item.icon}
            </span>
          )}
          <span className="min-w-0 truncate">{item.label}</span>
          {item.hint && (
            <span className="ml-auto min-w-0 shrink truncate pl-2 text-[11px] text-an-foreground-muted/80">
              {item.hint}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
