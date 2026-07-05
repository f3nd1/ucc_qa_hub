"use client";

import { useCallback, useRef, useState } from "react";
import type { Notify, ToastKind } from "./useWorkbench";

/** Shared bottom-centre toast. Returns a notify() and the node to render once. */
export function useToast(): { notify: Notify; toastNode: React.ReactNode } {
  const [toast, setToast] = useState<{ text: string; kind: ToastKind } | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const notify = useCallback<Notify>((text, kind = "info") => {
    setToast({ text, kind });
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), kind === "err" ? 6000 : 3600);
  }, []);

  const toastNode = toast ? (
    <div
      style={{
        position: "fixed",
        bottom: 18,
        left: "50%",
        transform: "translateX(-50%)",
        background: toast.kind === "err" ? "var(--err)" : toast.kind === "ok" ? "var(--ok)" : "var(--navy)",
        color: "#fff",
        borderRadius: 6,
        padding: "9px 16px",
        fontSize: 12.5,
        maxWidth: "80vw",
        boxShadow: "0 4px 14px rgba(0,0,0,.3)",
        zIndex: 1000,
      }}
    >
      {toast.text}
    </div>
  ) : null;

  return { notify, toastNode };
}
