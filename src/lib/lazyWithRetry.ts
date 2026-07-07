import { lazy, ComponentType } from "react";

export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(() =>
    factory().catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      const isChunkLoadError = /chunk|dynamically imported module|failed to fetch|loading css chunk/i.test(message);
      if (!isChunkLoadError) {
        throw err;
      }

      const key = "chunk_reload_" + window.location.pathname;
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        window.location.reload();
        return new Promise<never>(() => {});
      }
      sessionStorage.removeItem(key);
      throw err;
    })
  );
}
