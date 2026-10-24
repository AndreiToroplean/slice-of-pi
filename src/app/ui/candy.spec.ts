import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Candy } from './candy';

@Component({
  imports: [Candy],
  template: `
    <button type="button" appCandy>White</button>
    <a appCandy="primary" href="/">Primary</a>
    <label appCandy="danger">Danger <input type="file" /></label>
    <button type="button" appCandy="clear">Clear</button>
  `,
})
class Host {}

describe('Candy', () => {
  it('makes a button, a link or a label a candy button, white unless given a look, or see-through', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const [white, primary, danger, clear] = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.candy'),
    );

    expect(white?.classList.value).toBe('candy');
    expect(primary?.classList).toContain('primary');
    expect(danger?.classList).toContain('danger');
    expect(danger?.classList).not.toContain('primary');
    expect(clear?.classList).toContain('clear');
  });
});
