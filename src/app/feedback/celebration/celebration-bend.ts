import {
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  viewChildren,
} from '@angular/core';
import { Tweaks } from '../../developer-mode/tweaks';
import { Celebrating, Celebration } from './celebration';
import { waveLifetime } from './milestone-wave';
import { displacementMap, screenBend } from './screen-bend';

/** How many points across the displacement map has: the bend is smooth, and the browser stretches it over the screen. */
const MAP_COLUMNS = 24;

/** The filter bending the screen, and the one splitting its colors too. */
const BEND = 'celebration-bend';
const SPLIT = 'celebration-bend-split';

/**
 * The screen bent under the milestones' waves, as tried in developer mode: SVG filters the app's screen goes through
 * while a wave plays (see {@link filter}), each of its points shown from elsewhere, as a displacement map, redrawn every
 * frame, tells. Each map is drawn on a small canvas, then decoded as an image before the filter takes it, so that it
 * never shows a map half there. The colors split, if the wave splits them, by bending the red, the green and the blue
 * each their own way, then putting them back together.
 */
@Component({
  selector: 'app-celebration-bend',
  host: { 'aria-hidden': 'true' },
  template: `
    <svg>
      @for (id of filters; track id) {
        <filter
          [id]="id"
          filterUnits="userSpaceOnUse"
          primitiveUnits="userSpaceOnUse"
          color-interpolation-filters="sRGB"
          x="0"
          y="0"
          [attr.width]="size().width"
          [attr.height]="size().height"
        >
          @for (part of id === split ? parts : greenOnly; track part.channel) {
            <feImage
              #map
              [attr.data-split]="part.split"
              [attr.result]="part.channel + '-map'"
              preserveAspectRatio="none"
              x="0"
              y="0"
              [attr.width]="size().width"
              [attr.height]="size().height"
            />
            <feDisplacementMap
              #shift
              in="SourceGraphic"
              [attr.in2]="part.channel + '-map'"
              xChannelSelector="R"
              yChannelSelector="G"
              [attr.result]="part.channel + '-bent'"
            />
          }
          @if (id === split) {
            <feColorMatrix in="red-bent" type="matrix" [attr.values]="keep.red" result="red" />
            <feColorMatrix
              in="green-bent"
              type="matrix"
              [attr.values]="keep.green"
              result="green"
            />
            <feColorMatrix in="blue-bent" type="matrix" [attr.values]="keep.blue" result="blue" />
            <feComposite in="red" in2="green" operator="arithmetic" k2="1" k3="1" result="yellow" />
            <feComposite in="yellow" in2="blue" operator="arithmetic" k2="1" k3="1" />
          }
        </filter>
      }
    </svg>
  `,
  styles: `
    :host,
    svg {
      position: fixed;
      width: 0;
      height: 0;
      overflow: hidden;
      pointer-events: none;
    }
  `,
})
export class CelebrationBend {
  private readonly celebration = inject(Celebration);
  private readonly tweaks = inject(Tweaks);
  private readonly maps = viewChildren<ElementRef<SVGFEImageElement>>('map');
  private readonly shifts = viewChildren<ElementRef<SVGFEDisplacementMapElement>>('shift');
  protected readonly filters = [BEND, SPLIT];
  protected readonly split = SPLIT;
  protected readonly greenOnly = [{ channel: 'green', split: 0 }] as const;
  protected readonly parts = [
    { channel: 'red', split: 1 },
    { channel: 'green', split: 0 },
    { channel: 'blue', split: -1 },
  ] as const;
  /** Each channel kept alone, opaque, for the three to add up to the screen. */
  protected readonly keep = {
    red: '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0 1',
    green: '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 0 1',
    blue: '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 0 1',
  };
  protected readonly size = signal({ width: window.innerWidth, height: window.innerHeight });
  /** The wave bending the screen, once its first maps are in. */
  private readonly bending = signal<Celebrating | undefined>(undefined);
  /** The filter the app's screen goes through, as a CSS `filter`, while a wave bends it. */
  readonly filter = computed(() => {
    const bending = this.bending();
    if (bending === undefined) {
      return null;
    }
    return `url(#${bending.wave.colorSplit > 0 ? SPLIT : BEND})`;
  });
  private frame: number | undefined;
  private readonly canvas = document.createElement('canvas');

  constructor() {
    effect(() => {
      const celebrating = this.celebration.celebrating();
      this.stop();
      if (
        celebrating !== undefined &&
        this.tweaks.bendScreen() &&
        celebrating.wave.distortion + celebrating.wave.colorSplit > 0
      ) {
        this.animate(celebrating);
      }
    });
    inject(DestroyRef).onDestroy(() => {
      this.stop();
    });
  }

  private animate(celebrating: Celebrating): void {
    const lifetime = waveLifetime(celebrating.wave) * 1000;
    // One map at a time: a frame whose map isn't in yet is skipped.
    let drawing = false;
    const step = (now: number): void => {
      const elapsed = now - celebrating.since;
      if (elapsed > lifetime) {
        this.stop();
        return;
      }
      this.frame = requestAnimationFrame(step);
      if (!drawing) {
        drawing = true;
        void this.draw(celebrating, elapsed / 1000).finally(() => {
          drawing = false;
        });
      }
    };
    this.frame = requestAnimationFrame(step);
  }

  /** Draws the maps of the wave `elapsed` seconds in, and has the filter take them once they're all decoded. */
  private async draw(celebrating: Celebrating, elapsed: number): Promise<void> {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const rows = Math.max(1, Math.round((MAP_COLUMNS * height) / width));
    const bend = screenBend(
      celebrating.wave,
      celebrating.first,
      elapsed,
      width,
      height,
      MAP_COLUMNS,
      rows,
    );
    const scale = Math.max(1, 2 * bend.reach);
    const context = this.canvas.getContext('2d');
    if (context === null) {
      return;
    }
    this.canvas.width = MAP_COLUMNS;
    this.canvas.height = rows;
    // The maps of the filter the wave goes through alone.
    const id = celebrating.wave.colorSplit > 0 ? SPLIT : BEND;
    const inFilter = (element: Element): boolean => element.closest('filter')?.id === id;
    const maps = this.maps()
      .map((ref) => ref.nativeElement)
      .filter(inFilter);
    const shifts = this.shifts()
      .map((ref) => ref.nativeElement)
      .filter(inFilter);
    const urls = await Promise.all(
      maps.map(async (map) => {
        const split = Number(map.dataset['split']) as -1 | 0 | 1;
        context.putImageData(
          new ImageData(displacementMap(bend, split, scale), MAP_COLUMNS, rows),
          0,
          0,
        );
        const url = this.canvas.toDataURL();
        const image = new Image();
        image.src = url;
        await image.decode();
        return url;
      }),
    );
    if (this.celebration.celebrating() !== celebrating) {
      return;
    }
    // The maps and how far they reach together, at once, rather than at the next change detection.
    maps.forEach((map, i) => {
      map.setAttribute('href', urls[i] ?? '');
    });
    for (const shift of shifts) {
      shift.setAttribute('scale', String(scale));
    }
    if (this.size().width !== width || this.size().height !== height) {
      this.size.set({ width, height });
    }
    this.bending.set(celebrating);
  }

  private stop(): void {
    if (this.frame !== undefined) {
      cancelAnimationFrame(this.frame);
      this.frame = undefined;
    }
    this.bending.set(undefined);
  }
}
