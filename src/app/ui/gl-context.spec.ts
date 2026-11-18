import { DestroyRef } from '@angular/core';
import { keepGlContext } from './gl-context';

class FakeDestroyRef implements DestroyRef {
  readonly destroyed = false;
  private readonly callbacks: (() => void)[] = [];
  onDestroy(callback: () => void): () => void {
    this.callbacks.push(callback);
    return () => undefined;
  }
  destroy(): void {
    for (const callback of this.callbacks) {
      callback();
    }
  }
}

describe('keepGlContext', () => {
  function setup(): {
    canvas: HTMLCanvasElement;
    destroyRef: FakeDestroyRef;
    lost: ReturnType<typeof vi.fn>;
    restored: ReturnType<typeof vi.fn>;
  } {
    const canvas = document.createElement('canvas');
    const destroyRef = new FakeDestroyRef();
    const lost = vi.fn();
    const restored = vi.fn();
    keepGlContext(canvas, destroyRef, { lost, restored });
    return { canvas, destroyRef, lost, restored };
  }

  it('asks the browser for the context back when it is lost, and tells', () => {
    const { canvas, lost, restored } = setup();
    const event = new Event('webglcontextlost', { cancelable: true });

    canvas.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(lost).toHaveBeenCalledOnce();
    expect(restored).not.toHaveBeenCalled();
  });

  it('tells when the context is back', () => {
    const { canvas, restored } = setup();

    canvas.dispatchEvent(new Event('webglcontextrestored'));

    expect(restored).toHaveBeenCalledOnce();
  });

  it('stops listening once destroyed', () => {
    const { canvas, destroyRef, lost, restored } = setup();

    destroyRef.destroy();
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    canvas.dispatchEvent(new Event('webglcontextrestored'));

    expect(lost).not.toHaveBeenCalled();
    expect(restored).not.toHaveBeenCalled();
  });
});
