"use client";

import { useEffect } from "react";

/** Lock background scrolling and contain keyboard focus only for overlays. */
export function useWorkspaceOverlay(editorOpen: boolean, menuOpen: boolean, close: () => void) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const docked = window.matchMedia("(min-width: 1500px)");
    const mobile = window.matchMedia("(max-width: 700px)");
    const short = window.matchMedia("(max-height: 500px)");
    const previousOverflow = document.body.style.overflow;
    const target = () => editorOpen && (!docked.matches || short.matches)
      ? document.querySelector<HTMLElement>(".editor")
      : menuOpen && mobile.matches ? document.querySelector<HTMLElement>(".sidebar") : null;
    const sync = () => { document.body.style.overflow = target() ? "hidden" : previousOverflow; };
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && (editorOpen || menuOpen)) {
        event.preventDefault();
        close();
        return;
      }
      const region = target();
      if (event.key !== "Tab" || !region) return;
      const items = Array.from(region.querySelectorAll<HTMLElement>("button,input,select,textarea,summary,a[href],[tabindex]"))
        .filter(element => element.tabIndex >= 0 && !element.hasAttribute("disabled") && element.getClientRects().length > 0);
      const first = items[0], last = items[items.length - 1];
      if (!first) return;
      if (!region.contains(document.activeElement) || (!event.shiftKey && document.activeElement === last)) {
        event.preventDefault(); first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      }
    };
    sync();
    docked.addEventListener("change", sync);
    mobile.addEventListener("change", sync);
    short.addEventListener("change", sync);
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = previousOverflow;
      docked.removeEventListener("change", sync);
      mobile.removeEventListener("change", sync);
      short.removeEventListener("change", sync);
      document.removeEventListener("keydown", keydown);
    };
  }, [editorOpen, menuOpen, close]);
}
