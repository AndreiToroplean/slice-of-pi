/** Stand-in for `ResizeObserver`, which jsdom lacks: tests resize observed elements by hand. */
export class FakeResizeObserver {
  static readonly instances: FakeResizeObserver[] = [];

  readonly observed: Element[] = [];
  disconnected = false;

  constructor(private readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }

  static install(): void {
    FakeResizeObserver.instances.length = 0;
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  }

  /** Reports a new content size for every element observed by every live observer. */
  static resizeAll(width: number, height: number): void {
    for (const observer of FakeResizeObserver.instances.filter(
      (instance) => !instance.disconnected,
    )) {
      observer.resize(width, height);
    }
  }

  observe(target: Element): void {
    this.observed.push(target);
  }

  unobserve(): void {
    // Not needed by the code under test.
  }

  disconnect(): void {
    this.disconnected = true;
  }

  private resize(width: number, height: number): void {
    const entries = this.observed.map(
      (target) =>
        ({ target, contentRect: { width, height } as DOMRectReadOnly }) as ResizeObserverEntry,
    );
    this.callback(entries, this);
  }
}
