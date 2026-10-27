import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ContextMenu } from './context-menu';

@Component({
  imports: [ContextMenu],
  template: `<div (appContextMenu)="points.push($event)"></div>`,
})
class Host {
  points: { x: number; y: number }[] = [];
}

describe('ContextMenu', () => {
  let host: Host;
  let element: HTMLElement;

  beforeEach(() => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    host = fixture.componentInstance;
    element = (fixture.nativeElement as HTMLElement).querySelector('div') as HTMLElement;
  });

  it('tells where the browser asked for the context menu', () => {
    element.dispatchEvent(new MouseEvent('contextmenu', { clientX: 30, clientY: 40 }));

    expect(host.points).toEqual([{ x: 30, y: 40 }]);
  });

  it('takes no mouse held down for a long press', async () => {
    element.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'mouse', button: 0 }));
    await new Promise((resolve) => setTimeout(resolve, 600));
    element.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'mouse', button: 0 }));

    expect(host.points).toEqual([]);
  });
});
