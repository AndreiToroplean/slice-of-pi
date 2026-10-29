import { CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { menuItem, menuItems, openMenu } from '../../testing/menus';
import { ContextMenu, Dropdown, MenuTrigger } from './menu';
import { MoreButton } from './more-button';
import { OverlayHost } from './overlay-host';

@Component({
  imports: [CdkMenuItem, ContextMenu, Dropdown, MenuTrigger, MoreButton, OverlayHost],
  template: `
    <button
      type="button"
      class="opener"
      [appMenuTrigger]="menu"
      [appMenuTriggerData]="{ $implicit: 'a' }"
    >
      Open
    </button>
    <button class="more" title="More" [appMore]="menu" [appMoreData]="{ $implicit: 'b' }"></button>
    <button type="button" class="corner-more" appMenuTriggerMore [appMenuTrigger]="menu">⋮</button>
    <article [appContextMenu]="menu" [appContextMenuData]="{ $implicit: 'c' }">A run</article>
    <section class="host" appOverlayHost>
      <button type="button" class="inner" [appMenuTrigger]="menu">Open within</button>
    </section>
    <ng-template #menu let-id>
      <div appDropdown aria-label="Things">
        <button type="button" cdkMenuItem (cdkMenuItemTriggered)="chosen.set(id ?? 'none')">
          Choose {{ id }}
        </button>
        <hr />
        <button type="button" cdkMenuItem>Other</button>
      </div>
    </ng-template>
  `,
})
class Host {
  readonly chosen = signal('');
}

describe('menus', () => {
  async function setUp(): Promise<{
    host: HTMLElement;
    chosen: () => string;
    stable: () => Promise<void>;
  }> {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    return {
      host: fixture.nativeElement as HTMLElement,
      chosen: fixture.componentInstance.chosen,
      stable: () => fixture.whenStable(),
    };
  }

  function button(host: HTMLElement, selector: string): HTMLButtonElement {
    const found = host.querySelector<HTMLButtonElement>(selector);
    if (found === null) {
      throw new Error(`No ${selector}`);
    }
    return found;
  }

  it('opens from its button, given what it holds, and closes once an item is chosen', async () => {
    const { host, chosen, stable } = await setUp();
    const opener = button(host, '.opener');
    expect(opener.getAttribute('aria-haspopup')).toBe('menu');
    expect(openMenu()).toBeNull();

    opener.click();
    await stable();

    expect(opener.getAttribute('aria-expanded')).toBe('true');
    expect(openMenu()?.getAttribute('role')).toBe('menu');
    expect(openMenu()?.getAttribute('aria-label')).toBe('Things');
    expect(menuItems()).toEqual(['Choose a', 'Other']);

    menuItem('Choose').click();
    await stable();

    expect(chosen()).toBe('a');
    expect(openMenu()).toBeNull();
    expect(opener.getAttribute('aria-expanded')).toBe('false');
  });

  it('closes when its button is pressed again', async () => {
    const { host, stable } = await setUp();

    button(host, '.opener').click();
    await stable();
    button(host, '.opener').click();
    await stable();

    expect(openMenu()).toBeNull();
  });

  it('opens from a plain ⋮ button, given what it holds', async () => {
    const { host, chosen, stable } = await setUp();
    const more = button(host, '.more');
    expect(more.getAttribute('type')).toBe('button');
    expect(more.querySelector('svg')).not.toBeNull();

    more.click();
    await stable();
    menuItem('Choose').click();

    expect(chosen()).toBe('b');
  });

  it('opens as a context menu where it was asked for, given what it holds', async () => {
    const { host, chosen, stable } = await setUp();
    const article = host.querySelector('article');
    const request = new MouseEvent('contextmenu', { cancelable: true, clientX: 40, clientY: 50 });

    article?.dispatchEvent(request);
    await stable();

    expect(request.defaultPrevented).toBe(true);
    expect(menuItems()).toEqual(['Choose c', 'Other']);
    menuItem('Choose').click();
    expect(chosen()).toBe('c');
  });

  it('squares its corner pointing at what it opened from', async () => {
    const { host, stable } = await setUp();

    button(host, '.opener').click();
    await stable();

    expect(openMenu()?.closest('.cdk-overlay-pane')?.className).toMatch(
      /\bmenu-corner-(top|bottom)-(left|right)\b/,
    );
  });

  it('lines up with the right edge of a ⋮ first, and with the left edge of any other button', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const first = (selector: string): unknown =>
      fixture.debugElement.query(By.css(selector)).injector.get(CdkMenuTrigger).menuPosition[0]
        ?.panelClass;

    expect(first('.opener')).toBe('menu-corner-top-left');
    expect(first('.more')).toBe('menu-corner-top-right');
    expect(first('.corner-more')).toBe('menu-corner-top-right');
  });

  it('notes where it is in the window, to draw the background under it there', async () => {
    const { host, stable } = await setUp();

    button(host, '.opener').click();
    await stable();

    expect(openMenu()?.style.getPropertyValue('--window-x')).toMatch(/^-?[\d.]+px$/);
    expect(openMenu()?.style.getPropertyValue('--window-y')).toMatch(/^-?[\d.]+px$/);
  });

  it('opens within the element keeping its menus in it, and elsewhere outside it', async () => {
    const { host, stable } = await setUp();
    const within = host.querySelector('.host');

    button(host, '.inner').click();
    await stable();
    expect(within?.contains(openMenu())).toBe(true);
    button(host, '.inner').click();
    await stable();

    button(host, '.opener').click();
    await stable();
    expect(within?.contains(openMenu())).toBe(false);
  });
});
