import { Component, computed, input, linkedSignal, model } from '@angular/core';
import { hexToHsl, Hsl, hslToHex } from '../../game/color/color-spaces';
import { averageHsl } from '../../game/color/color-math';

/** The picker's sliders, in order. */
const SLIDERS = [
  { key: 'hue', label: 'Hue', max: 360, unit: '°' },
  { key: 'saturation', label: 'Saturation', max: 100, unit: '%' },
  { key: 'lightness', label: 'Lightness', max: 100, unit: '%' },
] as const;

/**
 * A color picker as wide as the screen: hue, saturation and lightness sliders, each track showing the colors it goes
 * through, under a top bar with the color, its name and, under it, its hex code, so that the bar stays narrow. With the
 * colors around it, the top bar can also set the color halfway between them, and bring back the game's own.
 */
@Component({
  selector: 'app-color-picker',
  template: `
    <div class="summary">
      <span class="swatch" [style.background]="color()"></span>
      <span class="title">
        <span class="name">{{ name() }}</span>
        <span class="hex">{{ color() }}</span>
      </span>
      @if (neighbors(); as around) {
        <button
          type="button"
          class="frosted average"
          [attr.aria-label]="'Average of ' + around[0] + ' and ' + around[1]"
          (click)="average(around)"
        >
          Average
          <span class="swatch small" [style.background]="around[0]"></span>
          <span class="swatch small" [style.background]="around[1]"></span>
        </button>
      }
      <button
        type="button"
        class="round"
        title="Back to Default"
        [disabled]="color() === defaultColor()"
        (click)="update(hexToHsl(defaultColor()))"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 14 4 9l5-5" />
          <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
        </svg>
      </button>
    </div>
    @for (slider of sliders; track slider.key) {
      <label class="slider">
        <span class="label">
          {{ slider.label }}
          <span class="value">{{ Math.round(hsl()[slider.key]) }}{{ slider.unit }}</span>
        </span>
        <input
          type="range"
          min="0"
          [max]="slider.max"
          step="1"
          [value]="hsl()[slider.key]"
          [style.--track]="tracks()[slider.key]"
          [attr.aria-label]="name() + ' ' + slider.label.toLowerCase()"
          (input)="set(slider.key, $event)"
        />
      </label>
    }
  `,
  styleUrl: './color-picker.css',
})
export class ColorPicker {
  /** The color picked, as `#rrggbb`. */
  readonly color = model.required<string>();
  /** What the color is, such as "Key 3" or "Spring top". */
  readonly name = input.required<string>();
  /** The colors around this one, to set it halfway between them. */
  readonly neighbors = input<readonly [string, string]>();
  /** The game's own color, to bring it back. */
  readonly defaultColor = input.required<string>();

  protected readonly sliders = SLIDERS;
  protected readonly Math = Math;
  protected readonly hexToHsl = hexToHsl;

  /**
   * The sliders' values. They follow the color when it's set from outside, and keep their exact values while the
   * sliders move them, rather than snapping to the nearest `#rrggbb`.
   */
  protected readonly hsl = linkedSignal<string, Hsl>({
    source: this.color,
    computation: (color, previous) =>
      previous !== undefined && hslToHex(previous.value) === color
        ? previous.value
        : hexToHsl(color),
  });

  /** Each slider's track: the colors it goes through, the other two values staying as they are. */
  protected readonly tracks = computed(() => {
    const { hue, saturation, lightness } = this.hsl();
    const css = (h: number, s: number, l: number): string =>
      `hsl(${String(h)} ${String(s)}% ${String(l)}%)`;
    return {
      hue: `linear-gradient(to right, ${[0, 60, 120, 180, 240, 300, 360].map((h) => css(h, saturation, lightness)).join(', ')})`,
      saturation: `linear-gradient(to right, ${css(hue, 0, lightness)}, ${css(hue, 100, lightness)})`,
      lightness: `linear-gradient(to right, ${css(hue, saturation, 0)}, ${css(hue, saturation, 50)}, ${css(hue, saturation, 100)})`,
    };
  });

  protected set(key: keyof Hsl, event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.update({ ...this.hsl(), [key]: Number(event.target.value) });
    }
  }

  protected average([first, second]: readonly [string, string]): void {
    this.update(averageHsl(hexToHsl(first), hexToHsl(second)));
  }

  protected update(hsl: Hsl): void {
    this.hsl.set(hsl);
    this.color.set(hslToHex(hsl));
  }
}
