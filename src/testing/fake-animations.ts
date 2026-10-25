/** Stand-in for a Web Animation, which jsdom lacks: tests finish or cancel it by hand. */
export class FakeAnimation {
  playState: AnimationPlayState = 'running';
  onfinish: (() => void) | null = null;
  oncancel: (() => void) | null = null;

  constructor(
    readonly element: Element,
    readonly keyframes: Keyframe[],
    readonly options: KeyframeAnimationOptions | undefined,
  ) {}

  finish(): void {
    this.playState = 'finished';
    this.onfinish?.();
  }

  cancel(): void {
    this.playState = 'idle';
    this.oncancel?.();
  }
}

/** Gives every element an `animate` method that records the animations it starts; undo with `uninstallAnimations`. */
export function installAnimations(): FakeAnimation[] {
  const animations: FakeAnimation[] = [];
  Element.prototype.animate = function (
    this: Element,
    keyframes: Keyframe[] | PropertyIndexedKeyframes | null,
    options?: number | KeyframeAnimationOptions,
  ): Animation {
    const animation = new FakeAnimation(
      this,
      keyframes as Keyframe[],
      typeof options === 'number' ? { duration: options } : options,
    );
    animations.push(animation);
    return animation as unknown as Animation;
  };
  return animations;
}

export function uninstallAnimations(): void {
  Reflect.deleteProperty(Element.prototype, 'animate');
}
