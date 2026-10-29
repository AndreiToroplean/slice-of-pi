import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Segmented } from './segmented';

@Component({
  imports: [Segmented],
  template: `
    <app-segmented label="Size" [segments]="segments" [(value)]="size" />
    <app-segmented label="View" panels="view" [segments]="views" [(value)]="view" />
  `,
})
class Host {
  protected readonly segments = [
    { value: 'small', label: 'Small' },
    { value: 'medium', label: 'Medium' },
    { value: 'large', label: 'Large' },
  ] as const;
  protected readonly views = [
    { value: 'chart', label: 'Chart' },
    { value: 'list', label: 'List' },
  ] as const;
  readonly size = signal<'small' | 'medium' | 'large'>('small');
  readonly view = signal<'chart' | 'list'>('chart');
}

/** The legacy key codes of the keys pressed, which the CDK's key managers read. */
const KEY_CODES: Readonly<Record<string, number>> = {
  End: 35,
  Home: 36,
  ArrowLeft: 37,
  ArrowRight: 39,
  ArrowDown: 40,
};

/** Presses a key on what has the focus. */
function arrow(key: string): void {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  Object.defineProperty(event, 'keyCode', { value: KEY_CODES[key] });
  document.activeElement?.dispatchEvent(event);
}

describe('Segmented', () => {
  async function setUp(): Promise<{
    sizes: HTMLElement;
    views: HTMLElement;
    component: Host;
    stable: () => Promise<void>;
  }> {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const [sizes, views] = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('app-segmented'),
    );
    if (sizes === undefined || views === undefined) {
      throw new Error('No segmented controls');
    }
    return {
      sizes,
      views,
      component: fixture.componentInstance,
      stable: () => fixture.whenStable(),
    };
  }

  function buttons(control: HTMLElement): HTMLButtonElement[] {
    return Array.from(control.querySelectorAll('button'));
  }

  function chosen(control: HTMLElement): string[] {
    return buttons(control)
      .filter(
        (button) =>
          button.getAttribute('aria-checked') === 'true' ||
          button.getAttribute('aria-selected') === 'true',
      )
      .map((button) => button.textContent.trim());
  }

  function press(control: HTMLElement, text: string): void {
    buttons(control)
      .find((button) => button.textContent.trim() === text)
      ?.click();
  }

  it('is a group of radio buttons named for screen readers, with the value given chosen', async () => {
    const { sizes } = await setUp();

    expect(sizes.getAttribute('role')).toBe('radiogroup');
    expect(sizes.getAttribute('aria-label')).toBe('Size');
    expect(buttons(sizes).map((button) => button.getAttribute('role'))).toEqual([
      'radio',
      'radio',
      'radio',
    ]);
    expect(chosen(sizes)).toEqual(['Small']);
  });

  it('chooses another value when pressed, and stays on a value pressed again', async () => {
    const { sizes, component, stable } = await setUp();

    press(sizes, 'Large');
    await stable();
    expect(component.size()).toBe('large');
    expect(chosen(sizes)).toEqual(['Large']);

    press(sizes, 'Large');
    await stable();
    expect(component.size()).toBe('large');
    expect(chosen(sizes)).toEqual(['Large']);
  });

  it('stops Tab on the one chosen, left and right choosing the one before or after it, round', async () => {
    const { sizes, component, stable } = await setUp();
    expect(buttons(sizes).map((button) => button.tabIndex)).toEqual([0, -1, -1]);
    buttons(sizes)[0]?.focus();

    arrow('ArrowLeft');
    await stable();
    expect(component.size()).toBe('large');
    expect(document.activeElement?.textContent.trim()).toBe('Large');

    arrow('ArrowRight');
    arrow('ArrowRight');
    await stable();
    expect(component.size()).toBe('medium');
    expect(buttons(sizes).map((button) => button.tabIndex)).toEqual([-1, 0, -1]);
  });

  it('chooses the first and the last on Home and End, and leaves up and down alone', async () => {
    const { sizes, component, stable } = await setUp();
    buttons(sizes)[0]?.focus();

    arrow('End');
    await stable();
    expect(component.size()).toBe('large');
    expect(document.activeElement?.textContent.trim()).toBe('Large');

    arrow('Home');
    await stable();
    expect(component.size()).toBe('small');

    arrow('ArrowDown');
    await stable();
    expect(component.size()).toBe('small');
  });

  it('scrolls the strip to show the whole of the one pressed', async () => {
    const { sizes } = await setUp();
    const last = buttons(sizes).at(-1);
    // A strip 200 pixels wide, its last button 30 pixels past its right edge.
    sizes.getBoundingClientRect = () => new DOMRect(0, 0, 200, 40);
    if (last !== undefined) {
      last.getBoundingClientRect = () => new DOMRect(170, 0, 60, 40);
    }

    last?.click();

    expect(sizes.scrollLeft).toBe(30);
  });

  it('slides its pill under the one chosen, fitting it', async () => {
    const { sizes, component, stable } = await setUp();
    const pill = sizes.querySelector<HTMLElement>('.chosen-pill');
    buttons(sizes).forEach((button, i) => {
      Object.defineProperties(button, {
        offsetLeft: { value: 3 + 70 * i },
        offsetWidth: { value: 60 + 5 * i },
      });
    });

    component.size.set('large');
    await stable();

    expect(pill?.style.translate).toBe('143px');
    expect(pill?.style.width).toBe('70px');
    expect(pill?.style.transition).toBe('');
  });

  it('makes tabs, given the panels they show, each labelling its panel', async () => {
    const { views, component, stable } = await setUp();

    expect(views.getAttribute('role')).toBe('tablist');
    expect(
      buttons(views).map((button) => [
        button.getAttribute('role'),
        button.id,
        button.getAttribute('aria-controls'),
      ]),
    ).toEqual([
      ['tab', 'view-tab-chart', 'view-chart'],
      ['tab', 'view-tab-list', 'view-list'],
    ]);
    expect(chosen(views)).toEqual(['Chart']);

    press(views, 'List');
    await stable();
    expect(component.view()).toBe('list');
    expect(chosen(views)).toEqual(['List']);
  });
});
