"use client";

import { useEffect } from "react";

export default function DisableContextMenu() {
  useEffect(() => {
    const contextMenuHandler = (e: MouseEvent) => e.preventDefault();
    const keydownHandler = (e: KeyboardEvent) => {
      if (
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "i") ||
        (e.ctrlKey && e.key.toLowerCase() === "u")
      ) {
        e.preventDefault();
      }
    };

    document.addEventListener("contextmenu", contextMenuHandler);
    document.addEventListener("keydown", keydownHandler);

    return () => {
      document.removeEventListener("contextmenu", contextMenuHandler);
      document.removeEventListener("keydown", keydownHandler);
    };
  }, []);

  return null;
}