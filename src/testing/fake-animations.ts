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

/**
 * Gives every element an `animate` method that records the animations it starts, on the elements `recorded` picks, and
 * `getAnimations`, those still running on it; undo with `uninstallAnimations`.
 */
export function installAnimations(
  recorded: (element: Element) => boolean = () => true,
): FakeAnimation[] {
  const animations: FakeAnimation[] = [];
  const all: FakeAnimation[] = [];
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
    all.push(animation);
    if (recorded(this)) {
      animations.push(animation);
    }
    return animation as unknown as Animation;
  };
  Element.prototype.getAnimations = function (this: Element): Animation[] {
    return all.filter(
      (animation) => animation.element === this && animation.playState === 'running',
    ) as unknown as Animation[];
  };
  return animations;
}

export function uninstallAnimations(): void {
  Reflect.deleteProperty(Element.prototype, 'animate');
  Reflect.deleteProperty(Element.prototype, 'getAnimations');
}
