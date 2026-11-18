import { DestroyRef } from '@angular/core';

/**
 * Keeps a WebGL canvas drawing through the loss of its context: the browser can take back what it holds on the GPU, as
 * a phone does with an app sent to the background, and then shows the canvas as broken unless it's told the page will
 * draw again. Then `lost` is called, to stop drawing with what no longer exists, and once the context is back,
 * `restored`, to build it all anew on it (the canvas's `getContext` gives it back) and draw.
 */
export function keepGlContext(
  canvas: HTMLCanvasElement,
  destroyRef: DestroyRef,
  handlers: { readonly lost: () => void; readonly restored: () => void },
): void {
  const lost = (event: Event): void => {
    // Without it, the browser never gives the context back.
    event.preventDefault();
    handlers.lost();
  };
  const restored = (): void => {
    handlers.restored();
  };
  canvas.addEventListener('webglcontextlost', lost);
  canvas.addEventListener('webglcontextrestored', restored);
  destroyRef.onDestroy(() => {
    canvas.removeEventListener('webglcontextlost', lost);
    canvas.removeEventListener('webglcontextrestored', restored);
  });
}
