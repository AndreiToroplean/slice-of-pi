import { TestBed } from '@angular/core/testing';
import { IDBFactory } from 'fake-indexeddb';
import { INDEXED_DB, IS_PREVIEW, RunStore } from '../../player-data/run-store';
import { GroupPerspective } from './group-perspective';
import { loadMyGroupings, MyGroupings } from './my-groupings';

describe('GroupPerspective', () => {
  function setUp() {
    TestBed.configureTestingModule({
      providers: [
        { provide: IS_PREVIEW, useValue: false },
        { provide: INDEXED_DB, useValue: new IDBFactory() },
      ],
    });
    const fixture = TestBed.createComponent(GroupPerspective);
    fixture.componentRef.setInput('groups', [
      { start: 0, digits: '141', trusted: true },
      { start: 3, digits: '592', trusted: false },
    ]);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const textarea = host.querySelector('textarea');
    if (textarea === null) {
      throw new Error('No groupings');
    }
    return {
      host,
      textarea,
      type: (text: string) => {
        textarea.value = text;
        textarea.dispatchEvent(new Event('input'));
        fixture.detectChanges();
      },
    };
  }

  it("shows the game's groups, dotted past the trust horizon", () => {
    const { host } = setUp();

    expect(
      Array.from(host.querySelectorAll('.groups li'), (li) => [
        li.textContent.trim(),
        li.classList.contains('unsure'),
      ]),
    ).toEqual([
      ['141', false],
      ['592', true],
    ]);
  });

  it('takes the groupings typed, only digits and spaces, and keeps them', async () => {
    const { textarea, type } = setUp();
    type('14a15, 926');

    expect(textarea.value).toBe('1415 926');
    expect(TestBed.inject(MyGroupings).groups()).toEqual(['1415', '926']);
    await vi.waitFor(async () => {
      expect(await loadMyGroupings(TestBed.inject(RunStore))).toBe('1415 926');
    });
  });

  it('says where the groupings aren’t π', () => {
    const { host, textarea, type } = setUp();
    type('1415 927');

    expect(host.querySelector('#my-groupings-status')?.textContent.trim()).toBe(
      'At place 7, π goes …15926.',
    );
    expect(textarea.getAttribute('aria-invalid')).toBe('true');
  });
});
