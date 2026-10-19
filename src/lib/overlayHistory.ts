import { useCallback, useEffect, useRef } from 'react';

/**
 * Makes the browser / phone Back button close an open overlay (for example the fullscreen
 * product image viewer) instead of navigating away from the page underneath it.
 *
 * How it works: when an overlay opens it pushes one history entry with the SAME url. Pressing
 * Back pops that entry, `App` forwards the popstate event to `handlePopState()` here, and the
 * overlay is closed. The page, its scroll position and its state are untouched.
 * Closing with the X button or Escape calls `history.back()` so every way of closing behaves
 * the same and no stale entries pile up.
 */
type OverlayEntry = { id: number; onBack: () => void; pushTimer?: number };

const stack: OverlayEntry[] = [];
let nextId = 1;

export const overlayHistory = {
  /** Register an open overlay and push its history entry. Returns an id for close()/discard(). */
  open(onBack: () => void): number {
    const id = nextId++;
    const entry: OverlayEntry = { id, onBack };
    stack.push(entry);
    // The history entry is pushed on the next tick. In React development (StrictMode) an effect
    // is run, cleaned up and run again immediately; deferring the push means the discarded first
    // run never creates a stray entry that would need an extra Back press.
    entry.pushTimer = window.setTimeout(() => {
      entry.pushTimer = undefined;
      try {
        window.history.pushState({ ...(window.history.state || {}), vkOverlay: id }, '');
      } catch {
        // History API unavailable: the overlay still works, only the Back-to-close behaviour is lost.
      }
    }, 0);
    return id;
  },

  /** Close from the UI (X button / Escape). Goes back one entry; popstate then closes the overlay. */
  close(id: number): void {
    const top = stack[stack.length - 1];
    if (top && top.id === id && top.pushTimer === undefined) {
      window.history.back();
      // Safety net: if the popstate event never reaches us, still close the overlay.
      window.setTimeout(() => {
        const index = stack.findIndex((entry) => entry.id === id);
        if (index >= 0) {
          const [entry] = stack.splice(index, 1);
          entry.onBack();
        }
      }, 500);
      return;
    }
    // Not the top-most overlay (unexpected): just close it without touching history.
    const index = stack.findIndex((entry) => entry.id === id);
    if (index >= 0) {
      const [entry] = stack.splice(index, 1);
      if (entry.pushTimer !== undefined) window.clearTimeout(entry.pushTimer);
      entry.onBack();
    }
  },

  /**
   * Called by the app's popstate handler FIRST. Returns true when the event was a Back press
   * on an overlay (the overlay was closed) so the app must not change page or scroll position.
   */
  handlePopState(): boolean {
    const entry = stack.pop();
    if (!entry) return false;
    entry.onBack();
    return true;
  },

  /** Forget an overlay that was unmounted without going through close(). */
  discard(id: number): void {
    const index = stack.findIndex((entry) => entry.id === id);
    if (index >= 0) {
      const [entry] = stack.splice(index, 1);
      if (entry.pushTimer !== undefined) window.clearTimeout(entry.pushTimer);
    }
  },
};

/**
 * React hook: while `isOpen` is true the Back button closes the overlay.
 * Returns `requestClose`, which the overlay should call from its X button / Escape key.
 */
export function useOverlayBackButton(isOpen: boolean, onClose: () => void): () => void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const idRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const id = overlayHistory.open(() => {
      idRef.current = null;
      onCloseRef.current();
    });
    idRef.current = id;
    return () => {
      if (idRef.current !== null) {
        overlayHistory.discard(idRef.current);
        idRef.current = null;
      }
    };
  }, [isOpen]);

  return useCallback(() => {
    if (idRef.current !== null) overlayHistory.close(idRef.current);
    else onCloseRef.current();
  }, []);
}

/**
 * The type of page the user came from ('collection', 'home', ...), recorded in the current
 * history entry when they navigated. Lets an in-page "Back to ..." link use the browser's real
 * Back (which restores the scroll position) when the previous page really was the listing.
 */
export const getPreviousPageType = (): string | null => {
  try {
    const from = window.history.state?.vkFrom;
    return typeof from === 'string' ? from : null;
  } catch {
    return null;
  }
};
