"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createLibrary,
  readLibrary,
  STORAGE_KEY,
  type Library,
} from "./library";

export function useLibrary() {
  const [library, setLibrary] = useState<Library>(createLibrary);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState("");
  const canSave = useRef(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setLibrary(readLibrary(JSON.parse(saved)));
      canSave.current = true;
    } catch {
      setStorageError(
        "Your saved library could not be loaded. The original data is preserved until you make a change. Import a backup to restore it.",
      );
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || !canSave.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
      setStorageError("");
    } catch {
      setStorageError(
        "Browser storage is unavailable or full. Changes are in memory only — export a backup before closing this tab.",
      );
    }
  }, [library, ready]);

  const updateLibrary = useCallback(
    (update: Library | ((current: Library) => Library)) => {
      canSave.current = true;
      setLibrary(update);
    },
    [],
  );

  return { library, updateLibrary, ready, storageError };
}
