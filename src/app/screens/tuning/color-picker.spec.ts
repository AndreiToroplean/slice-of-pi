import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { hexToHsl, hslToHex } from '../../game/color/color-spaces';
import { ColorPicker } from './color-picker';

@Component({
  imports: [ColorPicker],
  template: `<app-color-picker [(color)]="color" name="Key 0" [neighbors]="neighbors()" />`,
})
class Host {
  readonly color = signal('#de3e2d');
  readonly neighbors = signal<readonly [string, string] | undefined>(['#ff0000', '#ffff00']);
}

describe('ColorPicker', () => {
  async function setUp(): Promise<{
    host: Host;
    element: HTMLElement;
    stable: () => Promise<void>;
  }> {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    return {
      host: fixture.componentInstance,
      element: fixture.nativeElement as HTMLElement,
      stable: () => fixture.whenStable(),
    };
  }

  function slider(element: HTMLElement, label: string): HTMLInputElement {
    const input = element.querySelector<HTMLInputElement>(`input[aria-label="Key 0 ${label}"]`);
    if (input === null) {
      throw new Error(`No ${label} slider`);
    }
    return input;
  }

  async function slide(
    element: HTMLElement,
    label: string,
    value: number,
    stable: () => Promise<void>,
  ): Promise<void> {
    const input = slider(element, label);
    input.value = String(value);
    input.dispatchEvent(new Event('input'));
    await stable();
  }

  it('shows the color with hue, saturation and lightness sliders', async () => {
    const { element } = await setUp();
    const { hue, saturation, lightness } = hexToHsl('#de3e2d');

    expect(element.querySelector('.hex')?.textContent).toBe('#de3e2d');
    expect(element.querySelector('.contrast')).toBeNull();
    expect(Number(slider(element, 'hue').value)).toBeCloseTo(hue, 0);
    expect(Number(slider(element, 'saturation').value)).toBeCloseTo(saturation, 0);
    expect(Number(slider(element, 'lightness').value)).toBeCloseTo(lightness, 0);
    expect(slider(element, 'hue').style.getPropertyValue('--track')).toContain('linear-gradient');
  });

  it('sets the color as the sliders move, keeping their exact values', async () => {
    const { host, element, stable } = await setUp();

    await slide(element, 'hue', 200, stable);
    await slide(element, 'saturation', 37, stable);
    await slide(element, 'lightness', 41, stable);

    expect(host.color()).toBe(hslToHex({ hue: 200, saturation: 37, lightness: 41 }));
    expect(slider(element, 'hue').value).toBe('200');
    expect(slider(element, 'saturation').value).toBe('37');
  });

  it('follows a color set from outside', async () => {
    const { host, element, stable } = await setUp();

    host.color.set('#00ff00');
    await stable();

    expect(slider(element, 'hue').value).toBe('120');
    expect(slider(element, 'saturation').value).toBe('100');
    expect(slider(element, 'lightness').value).toBe('50');
  });

  it('sets the color halfway between its neighbors', async () => {
    const { host, element, stable } = await setUp();

    const average = element.querySelector<HTMLButtonElement>('.summary button.average');
    expect(average?.getAttribute('aria-label')).toBe('Average of #ff0000 and #ffff00');
    average?.click();
    await stable();

    expect(host.color()).toBe('#ff8000');
  });

  it('has no average without neighbors', async () => {
    const { host, element, stable } = await setUp();

    host.neighbors.set(undefined);
    await stable();

    expect(element.querySelector('button.average')).toBeNull();
  });
});
