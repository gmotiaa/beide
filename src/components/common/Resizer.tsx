import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

interface ResizerProps {
  direction: "vertical" | "horizontal";
  onResize: (delta: number) => void;
  onResizeEnd?: () => void;
}

export function Resizer({ direction, onResize, onResizeEnd }: ResizerProps) {
  const [dragging, setDragging] = useState(false);
  const lastPos = useRef(0);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      lastPos.current = direction === "vertical" ? e.clientX : e.clientY;
      setDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [direction],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragging) return;
      const pos = direction === "vertical" ? e.clientX : e.clientY;
      const delta = pos - lastPos.current;
      lastPos.current = pos;
      if (delta !== 0) onResize(delta);
    },
    [dragging, direction, onResize],
  );

  const endDrag = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragging) return;
      setDragging(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
      onResizeEnd?.();
    },
    [dragging, onResizeEnd],
  );

  useEffect(() => {
    if (!dragging) return;
    const prev = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    document.body.style.cursor = direction === "vertical" ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.cursor = prev;
      document.body.style.userSelect = prevSelect;
    };
  }, [dragging, direction]);

  return (
    <div
      className={`resizer resizer--${direction}${dragging ? " is-dragging" : ""}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      role="separator"
      aria-orientation={direction === "vertical" ? "vertical" : "horizontal"}
    />
  );
}
