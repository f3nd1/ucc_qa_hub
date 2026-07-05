"use client";

import { useRef } from "react";
import type { ReactNode } from "react";

/**
 * An OS-style draggable window rendered as a DOM overlay above the 3D canvas
 * (not 3D geometry). Drag by the title bar; click anywhere to focus (raise).
 */
export function Window({
  title,
  accent,
  x,
  y,
  z,
  width = 440,
  testId,
  onClose,
  onFocus,
  onMove,
  children,
}: {
  title: string;
  accent?: string;
  x: number;
  y: number;
  z: number;
  width?: number;
  testId?: string;
  onClose: () => void;
  onFocus: () => void;
  onMove: (x: number, y: number) => void;
  children: ReactNode;
}) {
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  function onTitleDown(e: React.PointerEvent) {
    onFocus();
    drag.current = { dx: e.clientX - x, dy: e.clientY - y };
    (e.target as Element).setPointerCapture(e.pointerId);
  }
  function onTitleMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const nx = Math.max(0, e.clientX - drag.current.dx);
    const ny = Math.max(0, e.clientY - drag.current.dy);
    onMove(nx, ny);
  }
  function onTitleUp(e: React.PointerEvent) {
    drag.current = null;
    try {
      (e.target as Element).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      onPointerDown={onFocus}
      data-testid={testId}
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        zIndex: z,
        maxHeight: "82vh",
        display: "flex",
        flexDirection: "column",
        background: "#fff",
        border: "1px solid var(--border)",
        borderRadius: 8,
        boxShadow: "0 10px 34px rgba(20,30,45,.28)",
        overflow: "hidden",
      }}
    >
      <div
        onPointerDown={onTitleDown}
        onPointerMove={onTitleMove}
        onPointerUp={onTitleUp}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 10px",
          background: "var(--navy)",
          color: "#fff",
          cursor: "move",
          touchAction: "none",
          userSelect: "none",
        }}
      >
        {accent && (
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: accent, display: "inline-block" }} />
        )}
        <span style={{ fontSize: 12.5, fontWeight: 600 }}>{title}</span>
        <button
          onClick={onClose}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            marginLeft: "auto",
            background: "rgba(255,255,255,.15)",
            border: "none",
            color: "#fff",
            borderRadius: 4,
            width: 22,
            height: 22,
            fontSize: 15,
            lineHeight: "20px",
            cursor: "pointer",
          }}
          aria-label="Close window"
        >
          ×
        </button>
      </div>
      <div style={{ padding: 14, overflow: "auto" }}>{children}</div>
    </div>
  );
}
