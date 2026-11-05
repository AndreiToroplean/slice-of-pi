import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import type { ReplayedGame } from '../replay/replay';
import { Background } from '../../ui/background';
import { BreakCountdown } from './break-countdown';
import { waitToEnd } from '../../game/grouping/wait-to-end';
import {
  boxIn,
  FIRST_LANDING,
  flyIntoWord,
  landsAt,
  leavesAt,
  slideDuration,
  SlotSnapshot,
  snapshotSlot,
} from './flight/flight';
import { slotBoxes } from './slots/slot-layout';
import { SlotHandover } from './slots/slots';
import { groupDigits, slotCount } from '../../game/grouping/groups';
import { Keypad, KeypadMark } from './keypad/keypad';
import { keyColorIndices, placeColors } from '../../game/layers/place-colors';
import { Pause } from './pause/pause';
import { PausesOnBack } from './pause-on-back';
import { isPiDecimal } from '../../game/pi/pi';
import { GameMode, isGameMode } from '../../game/modes/game-mode';
import { groupRuns, Run } from '../../player-data/run';
import { KeypadLayoutSetting } from '../../player-data/keypad-layout-setting';
import { RUN_CLOCK, RunRecorder } from '../../player-data/run-recorder';
import { LiveRun, RunSession } from '../../player-data/live-run';
import { newTouchLog, TouchLog } from '../../player-data/touch-log';
import { RunStore } from '../../player-data/run-store';
import { KeypadKey, KeypadPoint, KeypadTouch } from '../../game/layers/keypad-layout';
import { SeasonHeader } from './season-header/season-header';
import { seasonAt } from '../../game/layers/seasons';
import { Tweaks } from '../../developer-mode/tweaks';
import { Layout, layoutStyles } from '../../ui/layout';
import { LayoutEditor } from './layout-editor/layout-editor';
import { Slots } from './slots/slots';
import { SCROLL_BACK_DURATION, TypedDigits } from './typed-digits/typed-digits';
import { TIMER } from './timer';
import { Vibrator } from '../../feedback/vibrator';
import { Playing, Speaker } from '../../feedback/speaker';
import { Chime, Moment } from '../../game/layers/sound/sound-model';
import { SoundLog } from './sound-log/sound-log';
import { LONGEST_STEP, MOST_STEPS, Vibration } from '../../feedback/vibrations';

/** How many lines of what the keys played developer mode keeps. */
const SOUND_LOG_LINES = 200;

/** How long a vibration can last at most, in ms. */
const LONGEST_VIBRATION = LONGEST_STEP * MOST_STEPS;

/** How long a challenge's mistake shows before the game over dialog opens, in milliseconds. */
export const GAME_OVER_DELAY = 800;

/** How often what shows the wait for the group being typed running out is redrawn, in milliseconds: about every frame. */
const TICK = 16;

/**
 * The play screen: type the decimals of π on the keypad into the slots of the group being typed; each finished group
 * flies onto the tape as a word, as the seasons go by. Each typed digit takes the color its key showed.
 * The groups follow the player's timings, over all their runs and this one: the slots show the
 * player's own group where it's trusted, up to the trust horizon the earlier runs give, else 5 slots that grow until the
 * player pauses.
 * The phone vibrates on each digit typed, each mistake and each backspace, and as each slot's digit plucks itself off it
 * and lands on the tape, unless replaying a run.
 * Every digit is checked against π, unless developer mode turns that off: a wrong one, and any typed on after it, show
 * as mistakes in their slots, and never finish the group, until backspace deletes them.
 * Backspace deletes the last digit, reopening the last word when the slots are empty. Once it empties them, the last
 * word stays on the tape, and comes back into the slots only for a next digit typed fast enough to carry it on, until
 * the player breaks there again. Developer mode counts down, in the top right corner, to
 * when the group being typed ends, unless its settings hide that. Pausing offers to restart the game, stop it and
 * replay its run, or end it, back to the main menu; going back, as the browser's or the system's Back does, pauses
 * too, and resumes, and only ending the game leaves it. In developer mode, pausing also offers edit mode, which shows
 * 10 slots and the keypad's touch areas, but while previewing the layout as in the game, and leads back to the pause
 * dialog once done; going back from it asks whether to cancel the changes. Every touch on the keypad, and every key
 * typed, is recorded, with where and when, in the run's touch log, and so is every touch elsewhere on the screen,
 * typing nothing, but those on the pause button and its dialog; restarting or ending the game ends the run.
 *
 * The game mode comes from the route: free play unless it says otherwise. In a challenge, every digit is checked, the
 * keypad has no backspace, and the first mistake ends the game: the screen's edges turn red at once, the keypad takes
 * no more keys, and a moment later the game over dialog offers to play again or go back to the main menu.
 *
 * It also replays a run, given its touch log: the player can't type, nor pause, and nothing is recorded. Whatever
 * replays it hands it the touches one after the other, on the run's own clock (`TIMER` and `RUN_CLOCK`), and resets it
 * to replay them again from the start; the game plays them as it did, on the earlier runs, the run's keypad layout and
 * whether it checked digits.
 */
@Component({
  selector: 'app-play',
  imports: [
    BreakCountdown,
    Keypad,
    LayoutEditor,
    Pause,
    SeasonHeader,
    Slots,
    SoundLog,
    TypedDigits,
  ],
  // Replaying, within the replay's screen, which is the one that comes and goes.
  host: {
    '[class.screen]': 'replay() === undefined',
    '[class.replaying]': 'replay() !== undefined',
    '[style]': 'layout()',
    '(pointerdown)': 'touchDown($event)',
    '(pointerup)': 'touchUp($event)',
    '(pointercancel)': 'touchesElsewhere.delete($event.pointerId)',
  },
  template: `
    <h1 class="visually-hidden">Slice of Pi</h1>
    <app-season-header [view]="season()" />
    <app-typed-digits
      [words]="grouping().words"
      [digits]="digits()"
      [colors]="placeColors()"
      [arrival]="arrival()"
    />
    <app-slots
      class="slots"
      [digits]="grouping().current + mistakes()"
      [colors]="currentColors()"
      [size]="editedLayout() === undefined || previewing() ? size() : 10"
      [wrong]="mistakes().length"
      [emptyOpacity]="waitLeft()"
      [handover]="handover()"
    />
    <p class="visually-hidden" aria-live="assertive">
      @if (mistakes() !== '') {
        @if (lost()) {
          {{ mistakes() }} is wrong: game over.
        } @else {
          {{ mistakes().charAt(0) }} is wrong: delete back to it to go on.
        }
      }
    </p>
    <app-keypad
      class="keypad"
      [layout]="keypadLayout()"
      [colorIndices]="colorIndices()"
      [palette]="tweaks.palette()"
      [solid]="tweaks.solidKeys()"
      [showAreas]="editedLayout() !== undefined && !previewing()"
      [disabled]="replay() !== undefined || lost()"
      [backspace]="mode() === 'free'"
      [shown]="shownKey()"
      [marks]="marks()"
      (touched)="press($event)"
      (pressed)="sound($event)"
    >
      <!-- The pause key, in the keypad's empty corner left of 0. -->
      @if (replay() === undefined) {
        <app-pause
          [paused]="paused()"
          (pausedChange)="setPaused($event)"
          (edit)="editedLayout.set(tweaks.layout())"
          [replayable]="recorder.run() !== undefined"
          (restart)="restart()"
          (replay)="void replayRun()"
        />
      }
    </app-keypad>
    @if (lost()) {
      <div class="game-over" aria-hidden="true"></div>
    }
    @if (tweaks.soundNotes()) {
      <app-sound-log [lines]="soundLog()" />
    }
    @let wait = breakWait();
    @if (tweaks.countdown() && wait !== undefined) {
      <app-break-countdown [wait]="wait" />
    }
    @let edited = editedLayout();
    @if (edited !== undefined) {
      <app-layout-editor
        [layout]="edited"
        (layoutChange)="editedLayout.set($event)"
        [(previewing)]="previewing"
        (done)="doneEditing()"
      />
    }
  `,
  styleUrl: './play.css',
})
export class Play implements PausesOnBack {
  /** The touch log of a run to replay, if replaying one rather than playing. */
  readonly replay = input<TouchLog>();
  /** Replaying a run, the key of the touch replayed to show pressed, if any. */
  readonly shownKey = input<KeypadKey>();
  /** Replaying a run, the touches to mark on the keypad. */
  readonly marks = input<readonly KeypadMark[]>([]);
  /** Whether slots don't fly into their words, as while a replay skips ahead. */
  quiet = false;

  /** The decimals typed so far: one character per digit, so even a very long sequence takes little memory. */
  protected readonly digits = signal('');
  /**
   * A wrong digit typed after them, and any typed on after it, until backspace deletes them all: they all show as
   * mistakes, and none is recorded.
   */
  protected readonly mistakes = signal('');

  /** The colors tuned in developer mode, or the game's own, and whether to count down to the end of the group. */
  protected readonly tweaks = inject(Tweaks);
  /** What the keys played, and the words as they landed, one line each, oldest first, for developer mode to show. */
  protected readonly soundLog = signal<readonly string[]>([]);
  /** The layout being edited, in developer mode's edit mode, while the game stays paused. */
  protected readonly editedLayout = signal<Layout | undefined>(undefined);
  /** Whether edit mode hides its handles, the screen showing as in the game. */
  protected readonly previewing = signal(false);
  /** Where the header, tape, slots and keypad sit, as the lengths they lay out with. */
  protected readonly layout = computed(() =>
    layoutStyles(this.editedLayout() ?? this.tweaks.layout()),
  );

  /**
   * Whether the game is paused: keys typed on a keyboard meanwhile don't count, and the run's clock stops, so that the
   * time paused counts neither as a break nor between digits.
   */
  protected readonly paused = signal(false);
  protected readonly recorder = inject(RunRecorder);
  private readonly router = inject(Router);
  private readonly clock = inject(RUN_CLOCK);
  /** The run replayed so far, if replaying one. */
  private replayed: LiveRun | undefined;
  private readonly layoutSetting = inject(KeypadLayoutSetting).layout;
  /** The keypad layout the player picked, or the one of the run replayed. */
  protected readonly keypadLayout = computed(
    () => this.replay()?.keypadLayout ?? this.layoutSetting(),
  );
  /** The game mode the route asks for, free play unless it says otherwise. */
  private readonly routeMode: GameMode = modeOf(inject(ActivatedRoute).snapshot.data['mode']);
  /** The game mode, the route's. */
  protected readonly mode = signal(this.routeMode);
  /**
   * Whether digits are checked against π, as they are in a game started as a challenge, and in free play unless
   * developer mode turns that off, or were in the run replayed.
   */
  private readonly checking = computed(
    () => this.replay()?.checked ?? (this.routeMode === 'challenge' || this.tweaks.checking()),
  );
  /** Whether the game is lost, on a challenge's first mistake: no more keys until it restarts. */
  protected readonly lost = signal(false);
  /** Stops the wait for the game over dialog to open, once the game is lost. */
  private stopGameOver = (): void => undefined;
  /**
   * How long after the last digit the group being typed ends, in milliseconds, while the player may still pause:
   * `Infinity` if no pause up to the longest wait looked at ends it.
   */
  protected readonly breakWait = signal<number | undefined>(undefined);
  /** Ticks about every frame while the group being typed may end, for what shows its wait running out. */
  private readonly ticks = signal(0);
  /**
   * The share of the wait for the group being typed to end that's left, from 1 down to 0: its empty slots fade out with
   * it, as it may end before they're filled. Stopped while paused.
   */
  protected readonly waitLeft = computed(() => {
    this.ticks();
    const wait = this.breakWait();
    return wait === undefined || wait === Infinity
      ? 1
      : Math.max(0, wait - this.session.waited()) / wait;
  });
  /** The player's earlier runs, oldest first. */
  private readonly earlierRuns = signal<readonly Run[]>([]);
  /** How the break model plays the groups over the earlier runs that count in them, before this one. */
  private readonly gameplay = computed(() =>
    this.tweaks
      .breakModel()
      .play(
        groupRuns(this.earlierRuns(), this.tweaks.includeUnchecked(), this.tweaks.runOrder()).map(
          (run) => run.times,
        ),
      ),
  );

  /** The size of each finished group, in order. */
  private readonly sizes = signal<readonly number[]>([]);
  protected readonly grouping = computed(() => groupDigits(this.digits(), this.sizes()));
  /** How the group being typed is played. */
  private readonly plan = computed(() =>
    this.gameplay().groupAt(
      this.session.run()?.times ?? [],
      this.digits().length - this.grouping().current.length,
    ),
  );
  /**
   * The most digits the group being typed has held: it keeps the slots they took until it ends, those emptied by
   * backspace fading out with the wait, so that they never go at once. Not mistakes: theirs go with them.
   */
  private readonly held = linkedSignal<
    { readonly words: readonly number[]; readonly typed: number },
    number
  >({
    source: () => ({
      words: this.sizes(),
      typed: this.grouping().current.length,
    }),
    // Starting over with each group, as words come and go.
    computation: ({ words, typed }, previous) =>
      previous?.source.words === words ? Math.max(previous.value, typed) : typed,
  });
  /** The slots of the group being typed. */
  protected readonly size = computed(() =>
    Math.max(slotCount(this.plan(), this.grouping().current.length), this.held()),
  );

  /** The color of each typed place. */
  protected readonly placeColors = computed(() =>
    placeColors(this.digits(), this.tweaks.palette()),
  );
  /** The colors of the digits of the group being typed. */
  protected readonly currentColors = computed(() =>
    this.placeColors().slice(this.digits().length - this.grouping().current.length),
  );
  /** Each key's color index: where the color its digit takes when typed next is in the palette. */
  protected readonly colorIndices = computed(() => keyColorIndices(this.digits()));

  /** The season, and the background's colors, after the places typed so far. */
  protected readonly season = computed(() =>
    seasonAt(
      this.digits().length,
      this.tweaks.seasonBackgrounds(),
      this.tweaks.colorSpace(),
      this.tweaks.seasonTurn(),
    ),
  );

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);
  private readonly timer = inject(TIMER);
  private readonly typedDigits = viewChild.required(TypedDigits);
  private readonly keypad = viewChild.required(Keypad);
  private readonly pause = viewChild(Pause);
  private readonly layoutEditor = viewChild(LayoutEditor);
  /** Touches in progress elsewhere than on the keypad, the pause button and its dialog, by pointer: where they started. */
  protected readonly touchesElsewhere = new Map<number, KeypadPoint>();
  /** How long the next word takes to fly onto the tape, until its first slot lands, in ms. */
  protected readonly arrival = signal(FIRST_LANDING);
  /** How the slots of the group that just ended, flying off, hand over to the next group's, if they do. */
  protected readonly handover = signal<SlotHandover | undefined>(undefined);
  /** Slots flying into their word. */
  private flights: Animation[] = [];
  private readonly vibrator = inject(Vibrator);
  private readonly speaker = inject(Speaker);
  /** What each key touched is playing, until it's typed, to take it off if it turns out wrong. */
  private readonly ringing = new Map<KeypadKey, Playing>();
  /**
   * The vibrations of the slots flying, as they pluck themselves off and land: when the last one ends, on the run's
   * clock, and what stops those yet to start.
   */
  private flightVibrations: { readonly until: number; readonly stop: () => void }[] = [];
  /** Whether backspace has emptied the slots, since the last digit, so that the next one may carry the last word on. */
  private reopenable = false;
  /** Stops the timers of the wait for the player's pause to end the group: its end, and its ticks. */
  private stopTimers = (): void => undefined;

  constructor() {
    // Ending the game, back to the main menu, ends the run.
    inject(DestroyRef).onDestroy(() => {
      this.stopWatching();
      this.stopGameOver();
      this.session.end();
    });
    if (this.replay() === undefined) {
      this.recorder.challenge.set(this.routeMode === 'challenge');
    }
    void inject(RunStore)
      .runs()
      .then((runs) => {
        // Leaving out the run being played, already saved if a key came first, and those already added on restarts;
        // replaying a run, those played after it.
        const playing = this.recorder.run()?.id;
        const replayed = this.replay();
        this.earlierRuns.update((added) => [
          ...runs.filter((run) =>
            replayed === undefined
              ? run.id !== playing && !added.some(({ id }) => id === run.id)
              : run.startedAt < replayed.startedAt,
          ),
          ...added,
        ]);
      });
    const background = inject(Background);
    effect(() => {
      background.colors.set(this.season().background);
    });
  }

  /** What the run is recorded in: the recorder, or, replaying a run, the run replayed so far, never saved. */
  private get session(): RunSession {
    const log = this.replay();
    if (log === undefined) {
      return this.recorder;
    }
    this.replayed ??= new LiveRun(
      () => this.clock.now(),
      () => newTouchLog(log.id, log.startedAt, log.checked, log.keypadLayout),
    );
    return this.replayed;
  }

  protected press(touch: KeypadTouch): void {
    if (this.replay() !== undefined || this.lost()) {
      return;
    }
    if (!this.paused()) {
      this.play(touch);
    }
  }

  /**
   * Pauses or resumes the game: the run's clock stops, and so does the wait for the group being typed to end, which
   * goes on, once resumed, for what was left of it.
   */
  protected setPaused(paused: boolean): void {
    this.paused.set(paused);
    if (paused) {
      this.session.pause();
      this.stopTimers();
      this.stopTimers = () => undefined;
    } else {
      this.session.resume();
      this.watchForPause();
    }
  }

  leaveOnBack(): boolean {
    const pause = this.pause();
    if (pause === undefined || pause.ending || this.lost()) {
      return true;
    }
    const editor = this.layoutEditor();
    if (editor !== undefined) {
      editor.askToCancel();
      return false;
    }
    pause.back();
    return false;
  }

  /** Ends edit mode, back to the pause dialog it was opened from. */
  protected doneEditing(): void {
    this.editedLayout.set(undefined);
    this.previewing.set(false);
    this.pause()?.pause();
  }

  /** Notes a touch landing elsewhere than on the keypad, the pause button and its dialog, which handle their own. */
  protected touchDown(event: PointerEvent): void {
    if (
      event.button === 0 &&
      event.target instanceof Element &&
      event.target.closest('app-keypad, app-pause') === null
    ) {
      this.touchesElsewhere.set(event.pointerId, this.keypad().pointOf(event));
    }
  }

  /** Records a touch elsewhere than on the keypad as it's released, typing nothing, where it started from the keypad. */
  protected touchUp(event: PointerEvent): void {
    const start = this.touchesElsewhere.get(event.pointerId);
    if (start !== undefined) {
      this.touchesElsewhere.delete(event.pointerId);
      this.press({ key: null, ...start });
    }
  }

  /** Plays a touch of the run replayed, its key, if any, filled with the color its digit takes now. */
  replayTouch(touch: KeypadTouch): void {
    this.keypad().noteColor(touch.key);
    this.play(touch);
  }

  private play(touch: KeypadTouch): void {
    // Before the touch is recorded, which starts the wait for the next digit over.
    const carriesOn = touch.key !== null && touch.key !== 'backspace' && this.carriesOn();
    this.reopenable = false;
    this.session.record(touch);
    const key = touch.key;
    if (key === null) {
      return;
    }
    // Touches sounded as they landed on the key; keys typed on a keyboard sound now.
    if (key !== 'backspace' && !('x' in touch)) {
      this.sound(key);
    }
    const ringing = key === 'backspace' ? undefined : this.ringing.get(key);
    this.ringing.delete(key);
    // Keys are typed into the game, not into what has the focus, such as the typed digits once clicked or the pause
    // button once the game resumes: it gives the focus up rather than showing its ring as if typed into.
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    // Mistakes too bring the tape back from where the player scrolled it, though they never reach it.
    this.typedDigits().scrollToEnd(SCROLL_BACK_DURATION);
    if (this.mistakes() !== '') {
      if (key === 'backspace') {
        this.vibrate('backspace');
        this.mistakes.update((mistakes) => mistakes.slice(0, -1));
        this.afterBackspace();
      } else {
        this.vibrate('mistake');
        this.sour(ringing);
        this.mistakes.update((mistakes) => mistakes + key);
      }
      return;
    }
    if (key !== 'backspace' && this.checking() && !isPiDecimal(this.digits().length + 1, key)) {
      // A group never finishes on a mistake.
      this.stopWatching();
      this.vibrate('mistake');
      this.sour(ringing);
      this.mistakes.set(key);
      if (this.mode() === 'challenge' && this.replay() === undefined) {
        this.loseGame();
      }
      return;
    }
    this.vibrate(key === 'backspace' ? 'backspace' : 'digit');
    if (key === 'backspace') {
      this.landFlights();
      // On empty slots, it reopens the last word.
      const reopens = this.grouping().current === '';
      if (reopens) {
        this.sizes.update((sizes) => sizes.slice(0, -1));
      }
      this.digits.update((digits) => digits.slice(0, -1));
      // A word reopened and finished again at once never left its place: it has nothing to fly from.
      this.afterBackspace(!reopens);
    } else {
      if (carriesOn) {
        this.landFlights();
        this.sizes.update((sizes) => sizes.slice(0, -1));
      }
      this.digits.update((digits) => digits + key);
      this.watchForPause();
    }
  }

  /**
   * Once backspace has emptied the slots, lets the next digit carry the last word on (see {@link carriesOn}); else
   * watches for a break, as after any key, the group flying into its word if it ends at once and `flyNow`.
   */
  private afterBackspace(flyNow = true): void {
    this.reopenable =
      this.grouping().current === '' && this.mistakes() === '' && this.sizes().length > 0;
    this.watchForPause(flyNow);
  }

  /**
   * Whether a digit typed now carries the last word on, back in the slots, once backspace has emptied them: if it comes
   * as fast as it would have had to, had the word stayed in them, the clock back to its last digit. Otherwise, it starts
   * a new group, and the word never leaves the tape.
   */
  private carriesOn(): boolean {
    const size = this.sizes().at(-1);
    if (!this.reopenable || size === undefined) {
      return false;
    }
    const start = this.digits().length - size;
    const trusted = this.gameplay().groupAt(this.session.run()?.times ?? [], start).trusted;
    return !this.endsAfter(this.session.waited(), start, trusted);
  }

  /** Ends a challenge on its mistake: no more keys, and a moment later, the game over dialog. */
  private loseGame(): void {
    this.lost.set(true);
    this.stopGameOver = this.timer.after(GAME_OVER_DELAY, () => {
      this.stopGameOver = () => undefined;
      this.pause()?.gameOver();
    });
  }

  /** Starts a new game: no digits typed, back to the first spring, the run ended counting as an earlier one. */
  protected restart(): void {
    const ended = this.session.run();
    this.reset();
    if (ended !== undefined) {
      this.earlierRuns.update((runs) => [...runs, ended]);
    }
  }

  /**
   * Stops the game and replays its run, once saved, in place of the game: there's no going on with it after that, and
   * going back from the replay leads to the main menu, as ending the game does.
   */
  protected async replayRun(): Promise<void> {
    const id = this.recorder.run()?.id;
    if (id === undefined) {
      return;
    }
    const state: ReplayedGame = {
      menuBehind:
        this.router.lastSuccessfulNavigation()?.previousNavigation?.finalUrl?.toString() === '/',
    };
    await this.recorder.saved();
    await this.router.navigate(['/runs', id, 'replay'], { replaceUrl: true, state });
  }

  /** Back to the start, as if nothing had been typed, ending the run, such as to replay a run from its start. */
  reset(): void {
    this.stopWatching();
    this.stopGameOver();
    this.stopGameOver = () => undefined;
    this.lost.set(false);
    this.landFlights();
    this.digits.set('');
    this.mistakes.set('');
    this.sizes.set([]);
    this.reopenable = false;
    this.session.end();
  }

  /**
   * Finishes the group being typed as soon as the player breaks: where they usually do, within the trust horizon, or
   * where this run does, past it, its next digit timed as if typed then. Even a group with all its slots filled waits
   * for that: a next digit typed fast enough outweighs the break the earlier runs have there, and carries the group on.
   * The break model is asked once, as the digit is typed, how long a pause that takes, and the group ends once the
   * player has waited that long. Never while a mistake shows.
   */
  private watchForPause(flyNow = true): void {
    this.stopWatching();
    if (this.grouping().current === '' || this.mistakes() !== '') {
      return;
    }
    const trusted = this.plan().trusted;
    const start = this.digits().length - this.grouping().current.length;
    const wait = waitToEnd((waited) => this.endsAfter(waited, start, trusted));
    const left = wait - this.session.waited();
    if (left <= 0) {
      this.finishGroup(flyNow);
      return;
    }
    this.breakWait.set(wait);
    if (left < Infinity) {
      const end = this.timer.after(left, () => {
        this.stopWatching();
        this.finishGroup(true);
      });
      const tick = this.timer.every(TICK, () => {
        this.ticks.update((ticks) => ticks + 1);
      });
      this.stopTimers = () => {
        end();
        tick();
      };
    }
  }

  /** Stops waiting for the player's pause to end the group. */
  private stopWatching(): void {
    this.stopTimers();
    this.stopTimers = () => undefined;
    this.breakWait.set(undefined);
  }

  /**
   * Whether the group being typed, starting at index `start`, the player's own if `trusted`, ends before the next
   * digit, were it typed `wait` milliseconds after the last one.
   */
  private endsAfter(wait: number, start: number, trusted: boolean): boolean {
    const times = this.session.run()?.times ?? [];
    const last = times.at(-1);
    return last !== undefined && this.gameplay().groupEnds([...times, last + wait], start, trusted);
  }

  /** Turns the group being typed into a word, its slots flying into it if `fly`. */
  private finishGroup(fly: boolean): void {
    const length = this.grouping().current.length;
    const firstPlace = this.digits().length - length + 1;
    const slots = fly ? this.slotsToFly(length) : [];
    const slide = slideDuration(slots);
    this.arrival.set(slide + FIRST_LANDING);
    this.handover.set(
      slots.length === 0 ? undefined : { from: length, leftAt: (index) => leavesAt(index, slide) },
    );
    this.sizes.update((sizes) => [...sizes, length]);
    const model = this.tweaks.soundModel();
    const landing =
      this.tweaks.soundMix().landings > 0 ? model.landing(this.digits(), this.sizes()) : [];
    if (landing.length > 0 && fly && this.replay() === undefined) {
      this.log(model.describeLanding(this.digits(), this.sizes()));
    }
    if (slots.length === 0) {
      // Words that don't fly, as when the player prefers reduced motion, land at once; a word ending again at once,
      // reopened and finished as it was, never left.
      if (fly && landing.length > 0 && this.replay() === undefined) {
        this.speaker.play(landing, 0, 'landing');
      }
      return;
    }
    // Measured once the new word is laid out. The tape finishes making room for it as the first slot lands.
    afterNextRender(
      {
        read: () => {
          const word = this.host.querySelector<HTMLElement>(
            `app-typed-digits .word[data-first-place="${String(firstPlace)}"]`,
          );
          if (word !== null) {
            const shift = this.typedDigits().scrollToEnd(this.arrival());
            this.flights = [
              ...this.flights.filter((flight) => flight.playState === 'running'),
              ...flyIntoWord(this.host, slots, word, shift),
            ];
            this.vibrateFlights(slots.length, slide, landing);
          }
        },
      },
      { injector: this.injector },
    );
  }

  /**
   * Snapshots of the slots a group about to close fills, unless flights are off, each to slide where it would be were
   * they all the slots, rather than some of them, empty, left.
   */
  private slotsToFly(length: number): SlotSnapshot[] {
    const area = this.host.querySelector('app-slots');
    if (this.quiet || !canFly(this.host) || area === null) {
      return [];
    }
    const slots = Array.from(area.querySelectorAll('.slot'))
      .slice(0, length)
      .map((slot) => snapshotSlot(this.host, slot));
    const first = slots[0];
    if (first === undefined) {
      return [];
    }
    const box = boxIn(this.host, area);
    const padding = parseFloat(getComputedStyle(area).paddingLeft) || 0;
    const slid = slotBoxes(
      length,
      { ...box, left: box.left + padding, width: box.width - 2 * padding },
      first.box,
    );
    // The slot of the digit typed last isn't shown yet when that digit, typed past the slots, ends the group at once:
    // it flies from where it would have been shown, alike, as the others slide over to make room for it.
    return slid.map((box, i) => ({ ...(slots[i] ?? { ...first, box }), slid: box }));
  }

  /**
   * Plays the sound of a key, as soon as a touch lands on it, before it's typed, if it is: sliding off it types nothing,
   * so the player can listen to it before committing to it; keys typed on a keyboard sound as they're typed. Never
   * while paused nor replaying a run. The sound model never knows the next digit, so the sound gives nothing away.
   */
  protected sound(key: KeypadKey): void {
    if (key === 'backspace' || this.paused() || this.replay() !== undefined) {
      return;
    }
    const moment: Moment = {
      typed: this.digits(),
      words: this.sizes(),
      slots: this.size(),
      colors: this.colorIndices(),
      season: this.season().season,
    };
    const model = this.tweaks.soundModel();
    this.ringing.set(key, this.speaker.play(model.keys(moment)[key]));
    this.log(model.describe(moment, key));
  }

  /** Takes the note of a wrong key typed off as it rings, once typed: what the key sounded gave nothing away. */
  private sour(ringing: Playing | undefined): void {
    if (ringing !== undefined) {
      ringing.sour();
      this.log('wrong: goes off');
    }
  }

  /** Adds a line to what the keys played, for developer mode to show, if it does. */
  private log(line: string): void {
    if (this.tweaks.soundNotes()) {
      this.soundLog.update((lines) => [...lines.slice(1 - SOUND_LOG_LINES), line]);
    }
  }

  /** Vibrates on an event of the game, unless replaying a run. */
  private vibrate(vibration: Vibration): void {
    if (this.replay() === undefined) {
      this.vibrator.play(vibration);
    }
  }

  /**
   * Vibrates as each of `length` slots flying, after they slide for `slide` ms, plucks itself off, then lands, and plays
   * the word's `landing` as the last one lands.
   */
  private vibrateFlights(length: number, slide: number, landing: Chime): void {
    if (this.replay() !== undefined) {
      return;
    }
    const playing =
      landing.length > 0
        ? this.speaker.play(landing, landsAt(length - 1, slide), 'landing')
        : undefined;
    const indices = Array.from({ length }, (_, i) => i);
    const stopPlucks = this.vibrator.play(
      'pluck',
      indices.map((i) => leavesAt(i, slide)),
    );
    const stopLandings = this.vibrator.play(
      'landing',
      indices.map((i) => landsAt(i, slide)),
    );
    const now = this.clock.now();
    this.flightVibrations = [
      ...this.flightVibrations.filter(({ until }) => until > now),
      {
        until: now + landsAt(length - 1, slide) + LONGEST_VIBRATION,
        stop: () => {
          stopPlucks();
          stopLandings();
          playing?.stop();
        },
      },
    ];
  }

  /** Ends the flights at once, before a word they fly into may be reopened, and the slots' handover with them. */
  private landFlights(): void {
    for (const { stop } of this.flightVibrations) {
      stop();
    }
    this.flightVibrations = [];
    for (const flight of this.flights) {
      flight.cancel();
    }
    this.flights = [];
    this.handover.set(undefined);
  }
}

/** The game mode a route's data names, free play unless it names one. */
function modeOf(value: unknown): GameMode {
  return isGameMode(value) ? value : 'free';
}

/** Whether slots can fly: not when the player prefers reduced motion, nor where the Web Animations API is missing. */
function canFly(element: HTMLElement): boolean {
  return (
    typeof element.animate === 'function' &&
    typeof matchMedia === 'function' &&
    !matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
