import { TestBed } from '@angular/core/testing';
import { MARS } from '../../game/grouping/break-models/mars';
import type { Steps } from '../../game/grouping/break-models/steps';
import { PlacePerspective } from './place-perspective';

describe('PlacePerspective', () => {
  /** The times of a run typed about 200 ms apart, pausing 700 ms before every third digit. */
  function run(digits: number): number[] {
    let time = 0;
    return Array.from({ length: digits }, (_, i) => {
      if (i > 0) {
        time += i % 3 === 0 ? 700 : ([180, 200, 230][i % 3] ?? 0);
      }
      return time;
    });
  }

  function steps(): Steps {
    const found = MARS.steps?.({}, [run(30), run(30), run(24)]);
    if (found === undefined) {
      throw new Error('No steps');
    }
    return found;
  }

  function render(place: number) {
    const fixture = TestBed.createComponent(PlacePerspective);
    fixture.componentRef.setInput('steps', steps());
    fixture.componentRef.setInput('place', place);
    fixture.componentRef.setInput('digitCount', 30);
    fixture.componentRef.setInput('titles', ['first', 'second', 'third']);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    return {
      host,
      heading: () => host.querySelector('h3')?.textContent.replace(/\s+/g, ' ').trim(),
      press: (label: string) => {
        host.querySelector<HTMLButtonElement>(`button[title="${label}"]`)?.click();
        fixture.detectChanges();
      },
    };
  }

  it('says whether the place is a break, between which digits of π', () => {
    const { host, heading } = render(6);

    expect(heading()).toBe('Places 6 | 7 Break');
    expect(host.querySelector('.digits')?.textContent.replace(/\s+/g, '')).toBe('141592|653589');
    expect(render(7).heading()).toBe('Places 7 | 8 No break');
  });

  it('steps from place to place, and from one usual break spot to the next', () => {
    const { heading, press } = render(6);

    press('The place after');
    expect(heading()).toContain('Places 7 | 8');
    press('The usual break spot after');
    expect(heading()).toContain('Places 9 | 10');
    press('The usual break spot before');
    expect(heading()).toContain('Places 6 | 7');
  });

  it('lists every run at the place', () => {
    const { host } = render(6);

    expect(
      Array.from(host.querySelectorAll('tbody tr'), (row) =>
        row.querySelector('td')?.textContent.trim(),
      ).sort(),
    ).toEqual(['first', 'second', 'third']);
  });
});
