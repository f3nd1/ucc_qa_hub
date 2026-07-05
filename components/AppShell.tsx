"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { store } from "@/lib/store/store";
import { useToast } from "./Toast";
import { DemoWorkbench } from "./phase1/DemoWorkbench";

// Code-split the 3D office (three.js) so flat mode never loads it, and so the
// WebGL canvas only ever renders on the client.
const Office3D = dynamic(() => import("./office/Office3D").then((m) => m.Office3D), {
  ssr: false,
  loading: () => (
    <div style={{ padding: 24, fontSize: 12.5, color: "var(--muted)" }}>Loading the 3D office…</div>
  ),
});

export type Mode = "3d" | "flat";
const MODE_KEY = "qmr_mode";

/**
 * Top-level shell. Owns the 3D / flat mode and the shared toast, and hydrates
 * the store once. The 3D office is the delight layer; flat mode is always one
 * click away and is the same UI proven in Phases 1 and 2.
 */
export function AppShell() {
  const { notify, toastNode } = useToast();
  const [mode, setMode] = useState<Mode>("3d");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    store.hydrate();
    // Respect a saved choice; default to flat when the user prefers reduced motion.
    const saved = window.localStorage.getItem(MODE_KEY) as Mode | null;
    if (saved === "3d" || saved === "flat") setMode(saved);
    else if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) setMode("flat");
    setReady(true);
  }, []);

  function changeMode(m: Mode) {
    setMode(m);
    try {
      window.localStorage.setItem(MODE_KEY, m);
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      {mode === "flat" || !ready ? (
        <DemoWorkbench notify={notify} onSetMode={() => changeMode("3d")} />
      ) : (
        <Office3D notify={notify} onSetMode={() => changeMode("flat")} />
      )}
      {toastNode}
    </>
  );
}
