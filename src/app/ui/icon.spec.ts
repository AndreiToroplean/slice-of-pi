import { TestBed } from '@angular/core/testing';
import { Icon } from './icon';

describe('Icon', () => {
  it('draws its symbol, by the name its font writes it with, hidden from screen readers and the text', async () => {
    const fixture = TestBed.createComponent(Icon);
    fixture.componentRef.setInput('name', 'more');
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(host.dataset['symbol']).toBe('more_vert');
    expect(host.textContent).toBe('');
  });
});
