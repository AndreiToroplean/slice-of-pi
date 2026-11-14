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
  untracked,
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
import { ScaledTimer } from './scaled-timer';
import { gameTurnShare, switchedShare } from './turn-shown';
import { Light, LightLayer } from '../../ui/light-layer';
import { DiscoveryHalo } from './discovery-halo';
import { Point } from '../../ui/handles/light-handles';
import { groupDigits, slotCount } from '../../game/grouping/groups';
import { CornerKey, KeyPress, Keypad, KeypadMark } from './keypad/keypad';
import { keyColorIndices, placeColors } from '../../game/layers/place-colors';
import { Pause } from './pause/pause';
import { PausesOnBack } from './pause-on-back';
import { isPiDecimal } from '../../game/pi/pi';
import { GameMode, isGameMode } from '../../game/modes/game-mode';
import { groupRuns, Run } from '../../player-data/run';
import { KeypadLayoutSetting } from '../../player-data/keypad-layout-setting';
import { RUN_CLOCK, RunRecorder } from '../../player-data/run-recorder';
import { LiveRun, RunSession } from '../../player-data/live-run';
import { newTouchLog, startOf, TouchLog } from '../../player-data/touch-log';
import { Checkpoint } from '../../player-data/checkpoint';
import { groupStart, wordsUpTo } from '../../game/grouping/prefilled-words';
import {
  checkpointsAhead,
  laggingCheckpoint,
  completeRound,
  moveTo,
  newRounds,
} from '../../game/modes/discovery-rounds';
import { paceInterval } from '../../game/modes/discovery-pace';
import { DiscoveryPaceSetting } from '../../player-data/discovery-pace-setting';
import { DiscoveryRecorder } from '../../player-data/discovery-recorder';
import { GroupSizeSetting } from '../../player-data/group-size-setting';
import { Digit, isDigit } from '../../game/pi/digit';
import { Candy } from '../../ui/candy';
import { PI_DECIMALS } from '../../game/pi/pi-decimals';
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
import { atTempo, Chime, Moment } from '../../game/layers/sound/sound-model';
import { SoundLog } from './sound-log/sound-log';
import { LONGEST_STEP, MOST_STEPS, Vibration } from '../../feedback/vibrations';
import { MergeSetting } from '../../player-data/merge-setting';

/** How many lines of what the keys played developer mode keeps. */
const SOUND_LOG_LINES = 200;

/** How long a vibration can last at most, in ms. */
const LONGEST_VIBRATION = LONGEST_STEP * MOST_STEPS;

/** How long a challenge's mistake shows before the game over dialog opens, in milliseconds. */
export const GAME_OVER_DELAY = 800;

/** How long a key Discovery plays shows pressed, as a share of the time between two digits. */
const KEY_SHOWN = 0.6;

/** Whose turn it is in Discovery: the game's, showing the round, or the player's, typing; always the player's otherwise. */
type Turn = 'game' | 'player';

/**
 * How long the pause key or the turn key must be held, in milliseconds, for its release to do nothing more: a hold,
 * which stands the game still, or fast forwards it, while held, rather than a tap, which pauses, or switches turns.
 */
export const HOLD = 300;

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
 * A game starts from the checkpoint picked on the main menu, if any, or rather from where the group holding it starts,
 * never splitting a group: the digits before it are on the tape, as if typed, in the player's groups where the break
 * model knows them, and in groups of their group size elsewhere; the run starts there, the player's groups worked out
 * from it as usual. Discovery's rounds move on to a checkpoint likewise. Backspace deletes them as any other digit: the
 * next digit then starts the run anew, from where it goes on.
 *
 * The game mode comes from the route: free play unless it says otherwise. In a challenge, every digit is checked, the
 * keypad has no backspace, and the first mistake ends the game: the screen's edges turn red at once, the keypad takes
 * no more keys, and a moment later the game over dialog offers to play again, to continue the run in free play from the
 * mistake, backspace and all, or to go back to the main menu. Restarting goes back to the route's game mode.
 *
 * It also replays a run, given its touch log: the player can't type, nor pause, and nothing is recorded. Whatever
 * replays it hands it the touches one after the other, on the run's own clock (`TIMER` and `RUN_CLOCK`), and resets it
 * to replay them again from the start; the game plays them as it did, on the earlier runs, the run's keypad layout and
 * whether it checked digits, and sounds them as they're typed, at the replay's tempo, unless muted.
 */
@Component({
  selector: 'app-play',
  providers: [DiscoveryRecorder],
  imports: [
    BreakCountdown,
    Candy,
    Keypad,
    LayoutEditor,
    LightLayer,
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
    '[attr.data-turn]': 'discovering ? turn() : null',
    '(pointerdown)': 'touchDown($event)',
    '(pointerup)': 'touchUp($event)',
    '(pointercancel)': 'touchesElsewhere.delete($event.pointerId)',
    '(document:keydown)': 'shift($event, true)',
    '(document:keyup)': 'shift($event, false)',
    '(window:blur)': 'letGoOfShift()',
  },
  template: `
    <h1 class="visually-hidden">Slice of Pi</h1>
    <!-- Behind everything else on the screen. -->
    @if (discovering) {
      <canvas
        class="halo"
        [appLightLayer]="haloLights()"
        [settings]="halo().light"
        [style.opacity]="haloShown()"
      ></canvas>
    }
    <app-season-header [view]="season()" />
    <app-typed-digits
      [words]="grouping().words"
      [digits]="digits()"
      [colors]="placeColors()"
      [arrival]="arrival()"
      [faintFrom]="faintFrom()"
      [fadeOut]="fadeOut()"
      [faintOpacity]="tweaks.faintOpacity()"
    />
    @if (checkpoints().length > 0) {
      <div class="checkpoints">
        @for (place of checkpoints(); track place) {
          <button
            type="button"
            appCandy
            class="checkpoint"
            [attr.aria-label]="'Start the rounds from place ' + place"
            [disabled]="lost()"
            [attr.aria-pressed]="picked() === place || null"
            (click)="startFrom(place)"
          >
            {{ place }}
          </button>
        }
      </div>
    }
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
      [actionKeys]="tweaks.actionKeys()"
      [solid]="tweaks.solidKeys()"
      [mergeKeys]="mergeSetting.enabled()"
      [plain]="editedLayout() !== undefined"
      [motion]="tweaks.keyMotion()"
      [showAreas]="editedLayout() !== undefined && !previewing()"
      [disabled]="replay() !== undefined || lost()"
      [corner]="cornerKey()"
      [cornerDisabled]="cornerDisabled()"
      [linger]="linger()"
      [shown]="playedKey() ?? shownKey()"
      [marks]="marks()"
      (touched)="press($event)"
      (pressed)="touchKey($event)"
      [fastForwards]="gamePlaying()"
      (turnKey)="useTurnKey($event)"
      [pausable]="replay() === undefined"
      (pauseKey)="usePauseKey($event)"
    >
      <!-- The dialogs the pause key opens. -->
      @if (replay() === undefined) {
        <app-pause
          [paused]="paused()"
          (pausedChange)="setPaused($event)"
          (edit)="edit()"
          [replayable]="recorder.run() !== undefined"
          [continuable]="mode() !== 'discovery'"
          (restart)="restart()"
          (freePlay)="continueInFreePlay()"
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
        [halo]="halo()"
        (haloChange)="editedHalo.set($event)"
        [haloAt]="discovering ? haloAt() : undefined"
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
  /** Replaying a run, how many times as fast: the keys' notes ring for as much less or more time, at their own pitch. */
  readonly tempo = input(1);
  /** Replaying a run, whether it plays no sounds. */
  readonly muted = input(false);
  /** Whether slots don't fly into their words, nor anything sounds, as while a replay skips ahead. */
  quiet = false;

  private readonly checkpointSetting = inject(Checkpoint);
  /**
   * The checkpoint the main menu asked the game to start from (`from` in the route's query), if not from the start of
   * π, as far as it's unlocked.
   */
  private readonly checkpoint = this.checkpointSetting.reachable(
    Number(inject(ActivatedRoute).snapshot.queryParamMap.get('from') ?? 0),
  );
  /** The place the game starts from: that of the checkpoint picked's group, or that of the run replayed. */
  private readonly startPlace = computed(() => {
    const log = this.replay();
    if (log !== undefined) {
      return startOf(log);
    }
    return this.discovering ? this.rounds().from : this.checkpointStart();
  });
  /** How far back backspace has deleted the digits the game started with, if it has. */
  private readonly deletedTo = signal<number | undefined>(undefined);
  /** The place the run goes from: where the game started, or as far back as backspace deleted the digits before it. */
  private readonly runStart = computed(() =>
    Math.min(this.startPlace(), this.deletedTo() ?? Infinity),
  );
  /**
   * The decimals typed so far, those up to the place the game starts from given: one character per digit, so even a
   * very long sequence takes little memory.
   */
  protected readonly digits = linkedSignal(() => PI_DECIMALS.slice(0, this.startPlace()));
  /**
   * A wrong digit typed after them, and any typed on after it, until backspace deletes them all: they all show as
   * mistakes, and none is recorded.
   */
  protected readonly mistakes = signal('');

  /** The colors tuned in developer mode, or the game's own, and whether to count down to the end of the group. */
  protected readonly tweaks = inject(Tweaks);
  /** Whether the keys of the same color side by side merge, as the player set it. */
  protected readonly mergeSetting = inject(MergeSetting);
  /**
   * How long a digit key's color lingers once released, in milliseconds of the page's clock: the tuned linger, longer
   * as Discovery's game plays the keys (see `GAME_LINGER`), at a replay's tempo.
   */
  protected readonly linger = computed(
    () =>
      (this.tweaks.keyLinger() * (this.turn() === 'game' ? this.tweaks.gameLinger() : 1)) /
      this.tempo(),
  );
  /** What the keys played, and the words as they landed, one line each, oldest first, for developer mode to show. */
  protected readonly soundLog = signal<readonly string[]>([]);
  /** The layout being edited, in developer mode's edit mode, while the game stays paused. */
  protected readonly editedLayout = signal<Layout | undefined>(undefined);
  /** The Discovery Halo edit mode is editing, if it is (see `DiscoveryHalo`). */
  protected readonly editedHalo = signal<DiscoveryHalo | undefined>(undefined);
  /** The Discovery Halo, as tuned, or as edited. */
  protected readonly halo = computed(() => this.editedHalo() ?? this.tweaks.discoveryHalo());
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
  /** The game mode: the route's, until a lost challenge continues in free play. */
  protected readonly mode = signal(this.routeMode);
  /**
   * Whether digits are checked against π, as they are in a game started as a challenge, and in free play unless
   * developer mode turns that off, or were in the run replayed.
   */
  private readonly checking = computed(
    () =>
      this.replay()?.checked ??
      (this.routeMode === 'challenge' || this.discovering || this.tweaks.checking()),
  );
  /** Whether it's Discovery: the game plays each round, then the player retypes it. */
  protected readonly discovering = this.routeMode === 'discovery';
  /** Where Discovery is, round after round, from the checkpoint picked. */
  private readonly rounds = signal(newRounds(0));
  /**
   * Whose turn it is in Discovery; always the player's otherwise. It alone tells what's shown as whose: the digits the
   * game shows, faint, the keypad, and what the player's own place makes the slots, the keys' colors and the season.
   */
  protected readonly turn = signal<Turn>(this.discovering ? 'game' : 'player');
  /** The place from which the digits are those Discovery's game shows, faint: from where its rounds start, on its turn. */
  protected readonly faintFrom = computed(() =>
    this.turn() === 'game' ? this.rounds().from : undefined,
  );
  /** The key Discovery is playing, shown pressed. */
  protected readonly playedKey = signal<KeypadKey | undefined>(undefined);
  /**
   * The hand over going on in Discovery, if any, from one turn to the other (see {@link handOver}): from which place the
   * digits fade out of the tape, and since when, on Discovery's time (see {@link discoveryTimer}).
   */
  private readonly handingOver = signal<
    { readonly from: number; readonly since: number } | undefined
  >(undefined);
  /** Ticks about every frame while a turn is handed over, or switched. */
  private readonly fadeTicks = signal(0);
  /** The digits fading out of the tape as a turn is handed over, from where, and how much of it is left, from 1 to 0. */
  protected readonly fadeOut = computed(() => {
    this.fadeTicks();
    const handingOver = this.handingOver();
    if (handingOver === undefined) {
      return undefined;
    }
    const handOver = this.tweaks.handOver();
    const waited = this.discoveryTimer.time() - handingOver.since;
    return { from: handingOver.from, left: handOver > 0 ? Math.max(0, 1 - waited / handOver) : 0 };
  });
  /**
   * How many digits the player is to retype in Discovery's round, up to the place the game showed it to; or, as they
   * took the turn before it was done showing it, the round's end, once they get there: past the place reached, as a
   * group lands.
   */
  private readonly target = signal<number | 'end' | undefined>(undefined);
  /** Whether the player has retyped Discovery's round, on their turn: the game then shows the next one, soon. */
  protected readonly done = computed(() => {
    const target = this.target();
    return this.turn() === 'player' && typeof target === 'number' && this.digits().length >= target;
  });
  /** The checkpoint picked, which the rounds start at from the game's next turn, shown pressed until then. */
  protected readonly picked = signal<number | undefined>(undefined);
  /** Stops the hand over going on, if any. */
  private stopHandOver = (): void => undefined;
  /** What the key in backspace's place is: the turn key in Discovery, backspace otherwise. */
  protected readonly cornerKey = computed((): CornerKey =>
    this.mode() === 'discovery' ? 'turn' : 'backspace',
  );
  /**
   * The switch from showing one turn to showing the other, as the player switches turns themselves, if one is going on:
   * from how much the game's turn showed, and since when, on the run's clock (see `TURN_SWITCH`).
   */
  private readonly turnSwitching = signal<
    { readonly from: number; readonly since: number } | undefined
  >(undefined);
  /** Stops the turn switch going on, if any. */
  private stopTurnSwitch = (): void => undefined;
  /**
   * How much the keypad shows Discovery's game turn, from 0 to 1, the Discovery Halo lighting up behind it as it does, so
   * that the player looks on rather than types: steadily over a hand over, as the turn switches by itself (see
   * `gameTurnShare`), or over a short switch as the player switches it themselves.
   */
  /** Where key 5 is, in CSS pixels from the screen's top left corner, as last measured: the Discovery Halo's middle. */
  protected readonly haloAt = signal<Point | undefined>(undefined);
  /** The Discovery Halo's light, round key 5, once it's measured (see `DiscoveryHalo`). */
  protected readonly haloLights = computed((): readonly Light[] => {
    const at = this.haloAt();
    return at === undefined ? [] : [{ ...at, color: this.halo().color, seed: 5 }];
  });
  /** How much of the Discovery Halo shows: as much as the game's turn does, or all of it while the layout is edited. */
  protected readonly haloShown = computed(() =>
    this.editedLayout() === undefined ? this.gameTurnShown() : 1,
  );
  protected readonly gameTurnShown = computed(() => {
    this.fadeTicks();
    const share = gameTurnShare(this.turn(), this.fadeOut()?.left);
    const switching = this.turnSwitching();
    return switching === undefined
      ? share
      : switchedShare(
          switching.from,
          share,
          this.clock.now() - switching.since,
          this.tweaks.turnSwitch(),
        );
  });
  /** Whether the game plays its round, on its turn, before handing it over: holding the turn key fast forwards it. */
  protected readonly gamePlaying = computed(
    () => this.turn() === 'game' && this.handingOver() === undefined,
  );
  /**
   * The turn key's press going on, if any: when it started, on the run's clock, and whether a tap of it may switch
   * turns, as it may unless it started as the game played its round.
   */
  private turnPress: { readonly since: number; readonly switches: boolean } | undefined;
  /** Whether the player holds the turn key down to fast forward the game. */
  private readonly fastForwarding = signal(false);
  /** When the pause key's press going on started, on the run's clock, if one is. */
  private pauseKeyDown: number | undefined;
  /** Whether the player holds the pause key down, which stands the game still as pausing does, without the pause. */
  private readonly pauseHeld = signal(false);
  /** Whether Shift is held down, which stands the game still as the pause key does. */
  private readonly shiftHeld = signal(false);
  /**
   * Whether the game stands still: paused, or held, as the player holds the pause key, or Shift, to look, or think,
   * for longer. Everything stops but what's on the screen: the run's clock, the wait for the group being typed to end,
   * Discovery's time, and keys typed count for nothing; only a pause shows its dialog.
   */
  private readonly still = computed(() => this.paused() || this.pauseHeld() || this.shiftHeld());
  /** Whether the game stood still, the last time it was told to stop or start again (see {@link standStill}). */
  private stood = false;
  /**
   * How many times faster than the clock's Discovery's time runs, the game playing and handing turns over on it: not at
   * all while the game stands still, and faster while the player holds the turn key to fast forward the game's round.
   */
  private readonly discoveryRate = computed(() => {
    if (this.still()) {
      return 0;
    }
    return this.fastForwarding() ? this.tweaks.fastForward() : 1;
  });
  /**
   * Whether it doesn't work: backspace in a challenge, the turn key on the player's turn until they have
   * retyped the round.
   */
  protected readonly cornerDisabled = computed(
    () =>
      this.mode() === 'challenge' ||
      (this.mode() === 'discovery' && this.turn() === 'player' && !this.done()),
  );
  /** The checkpoints Discovery's rounds have reached, which they can start from, if the player picks them. */
  protected readonly checkpoints = computed(() =>
    this.discovering && this.tweaks.manualCheckpoints() ? checkpointsAhead(this.rounds()) : [],
  );
  private readonly pace = inject(DiscoveryPaceSetting).pace;
  private readonly discoveryRecorder = inject(DiscoveryRecorder);
  /** Stops what Discovery has scheduled: the digits yet to play, or the next round. */
  private stopRound: (() => void)[] = [];
  /**
   * Discovery's round as the player retypes it, never saved: the session is (see `DiscoveryRecorder`). Its times never
   * count in the groups, which are the player's own from their earlier runs, as the game played them.
   */
  private readonly retyped = new LiveRun(
    () => this.clock.now(),
    () => newTouchLog('discovery', 0, true, this.layoutSetting(), { start: this.rounds().from }),
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
  /** The player's runs as the screen opened, oldest first: those it plays from then on aren't among them. */
  private readonly storedRuns = untracked(inject(RunStore).runs);
  /** The runs played on this screen since it opened, ended by restarting the game, oldest first. */
  private readonly playedHere = signal<readonly Run[]>([]);
  /** The player's earlier runs, oldest first: replaying a run, those played before it. */
  private readonly earlierRuns = computed(() => {
    const replayed = this.replay();
    return [
      ...(replayed === undefined
        ? this.storedRuns
        : this.storedRuns.filter((run) => run.startedAt < replayed.startedAt)),
      ...this.playedHere(),
    ];
  });
  /** The earlier runs that count in the groups, oldest first. */
  private readonly countedRuns = computed(() =>
    groupRuns(this.earlierRuns(), this.tweaks.includeUnchecked(), this.tweaks.runOrder()),
  );
  /** How the break model plays the groups over the earlier runs that count in them, before this one. */
  private readonly groupSize = inject(GroupSizeSetting).size;
  private readonly gameplay = computed(() =>
    this.tweaks.breakModel().play(this.countedRuns(), this.groupSize(), this.runStart()),
  );

  /**
   * The groups of the earlier runs, as the break model knows them, which the words given are cut in: in Discovery, as far
   * as the model trusts them for it.
   */
  private readonly knownGroups = computed(() => {
    const stats = this.tweaks.breakModel().stats(this.countedRuns());
    return this.discovering ? stats.discoveryGroups : stats.groups;
  });
  /**
   * Where the group holding the checkpoint picked starts, in the player's groups: the game starts there, so that it
   * never splits a group.
   */
  private readonly checkpointStart = computed(() =>
    groupStart([], this.checkpoint, this.knownGroups(), this.groupSize()),
  );
  /** The size of each finished group, in order, those given before the place the game starts from first. */
  private readonly sizes = linkedSignal<readonly number[]>(() =>
    this.wordsUpTo([], this.startPlace()),
  );
  protected readonly grouping = computed(() => groupDigits(this.digits(), this.sizes()));
  /** How the group being typed is played. */
  private readonly plan = computed(() =>
    this.gameplay().groupAt(this.runTimes(), this.planStart()),
  );
  /** Where the group being typed starts. */
  private readonly planStart = computed(
    () => this.digits().length - this.grouping().current.length,
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
  /** What Discovery schedules, at the rate it plays (see {@link discoveryRate}). */
  private readonly discoveryTimer = new ScaledTimer(this.timer, () => this.clock.now());
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
    this.rounds.set(newRounds(this.checkpointStart(), this.checkpoint));
    // Ending the game, back to the main menu, ends the run.
    inject(DestroyRef).onDestroy(() => {
      this.stopWatching();
      this.stopGameOver();
      this.session.end();
    });
    inject(DestroyRef).onDestroy(() => {
      this.stopRounds();
      this.stopHandOver();
      this.stopTurnSwitch();
      this.discoveryRecorder.end();
    });
    if (this.discovering) {
      afterNextRender(() => {
        this.startGameTurn();
        this.watchHalo();
      });
    }
    if (this.replay() === undefined) {
      this.recorder.challenge.set(this.routeMode === 'challenge');
      this.recorder.start.set(this.checkpointStart());
    }
    effect(() => {
      this.discoveryTimer.setRate(this.discoveryRate());
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
      return this.discovering ? this.retyped : this.recorder;
    }
    this.replayed ??= new LiveRun(
      () => this.clock.now(),
      () =>
        newTouchLog(log.id, log.startedAt, log.checked, log.keypadLayout, {
          start: startOf(log),
        }),
    );
    return this.replayed;
  }

  /** Sounds a key a touch lands on, which first takes the player's turn in Discovery (see {@link takeTurn}). */
  protected touchKey(key: KeypadKey): void {
    this.takeTurn(key);
    this.sound(key);
  }

  /**
   * Takes the player's turn in Discovery at once, as they type a key on the game's turn, or touch it, before anything
   * else comes of the touch.
   */
  private takeTurn(key: KeypadKey | null): void {
    if (this.turn() === 'game' && key !== null && isDigit(key) && !this.still() && !this.lost()) {
      this.switchTurn(false);
      // The key takes, and lingers in, the color of the player's place, not that of the round shown.
      this.keypad().noteColor(key, this.tweaks.palette()[this.colorIndices()[key]]);
    }
  }

  protected press(touch: KeypadTouch): void {
    if (this.replay() !== undefined || this.lost()) {
      return;
    }
    this.takeTurn(touch.key);
    if (!this.still()) {
      this.play(touch);
      return;
    }
    // Held still, a key only sounds, as touches did as they landed, typing nothing; keys typed on a keyboard sound now.
    if (touch.key !== null) {
      this.ringing.delete(touch.key);
      if (!('x' in touch)) {
        this.sound(touch.key);
      }
    }
  }

  /** Pauses or resumes the game, which stands still meanwhile (see {@link standStill}). */
  protected setPaused(paused: boolean): void {
    this.paused.set(paused);
    this.standStill();
  }

  /**
   * Stops the game as it starts standing still, or starts it again once it no longer does (see {@link still}): the
   * run's clock stops, and so does the wait for the group being typed to end, which goes on, once started again, for
   * what was left of it; Discovery's time stands still, and goes on from where it was, never showing a round again.
   */
  private standStill(): void {
    const still = this.still();
    if (still !== this.stood) {
      this.stood = still;
      if (still) {
        this.session.pause();
        this.discoveryRecorder.pause();
        this.stopTimers();
        this.stopTimers = () => undefined;
      } else {
        this.session.resume();
        this.discoveryRecorder.resume();
        this.watchForPause();
      }
    }
    this.discoveryTimer.setRate(this.discoveryRate());
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

  /**
   * Keeps the Discovery Halo round key 5, measuring where it is now, and again as the screen, the keypad or the key
   * change size, as when the layout is edited.
   */
  private watchHalo(): void {
    const keypad = this.host.querySelector('app-keypad');
    const key = keypad?.querySelector('[data-key="5"]');
    const measure = (): void => {
      if (key === null || key === undefined) {
        return;
      }
      const frame = this.host.getBoundingClientRect();
      const box = key.getBoundingClientRect();
      this.haloAt.set({
        x: box.left + box.width / 2 - frame.left,
        y: box.top + box.height / 2 - frame.top,
      });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(measure);
    for (const element of [this.host, keypad, key]) {
      if (element !== null && element !== undefined) {
        observer.observe(element);
      }
    }
    this.injector.get(DestroyRef).onDestroy(() => {
      observer.disconnect();
    });
  }

  /** Starts edit mode, on the layout and the Discovery Halo as tuned. */
  protected edit(): void {
    this.editedLayout.set(this.tweaks.layout());
    this.editedHalo.set(this.tweaks.discoveryHalo());
  }

  /** Ends edit mode, back to the pause dialog it was opened from. */
  protected doneEditing(): void {
    this.editedLayout.set(undefined);
    this.editedHalo.set(undefined);
    this.previewing.set(false);
    this.pause()?.pause();
  }

  /** Notes a touch landing elsewhere than on the keypad, its pause dialogs included, which handle their own. */
  protected touchDown(event: PointerEvent): void {
    if (
      event.button === 0 &&
      event.target instanceof Element &&
      event.target.closest('app-keypad') === null
    ) {
      this.touchesElsewhere.set(event.pointerId, this.keypad().pointOf(event));
    }
  }

  /**
   * Stands the game still for as long as the pause key is held, as pausing does, but without the pause (see
   * {@link still}); a tap of it pauses the game as it's released on the key, unless it was held down for
   * {@link HOLD} or longer, a hold.
   */
  protected usePauseKey(press: KeyPress): void {
    const now = this.clock.now();
    if (press === 'down') {
      this.pauseKeyDown = now;
      this.pauseHeld.set(true);
      this.standStill();
      return;
    }
    const held = now - (this.pauseKeyDown ?? now);
    this.pauseKeyDown = undefined;
    this.pauseHeld.set(false);
    this.standStill();
    if (press === 'up' && held < HOLD) {
      this.pause()?.pause();
    }
  }

  /** Notes Shift held down, or let go, which stands the game still as the pause key does. */
  protected shift(event: KeyboardEvent, down: boolean): void {
    if (event.key === 'Shift') {
      this.shiftHeld.set(down);
      this.standStill();
    }
  }

  /** Lets go of Shift, as the page loses the focus. */
  protected letGoOfShift(): void {
    this.shiftHeld.set(false);
    this.standStill();
  }

  /**
   * Fast forwards the game for as long as the turn key is held, whatever happens meanwhile: its round, a turn's hand
   * over, and the round after it. A tap of it, released on the key within {@link HOLD}, switches turns at once, if a
   * turn is being handed over by then, unless it started as the game played its round, where it only fast forwards.
   */
  protected useTurnKey(press: KeyPress): void {
    const now = this.clock.now();
    if (press === 'down') {
      this.turnPress = { since: now, switches: !this.gamePlaying() };
      this.fastForwarding.set(true);
      return;
    }
    const turnPress = this.turnPress;
    this.turnPress = undefined;
    this.fastForwarding.set(false);
    const tapped =
      press === 'up' &&
      turnPress !== undefined &&
      turnPress.switches &&
      now - turnPress.since < HOLD;
    if (tapped && this.handingOver() !== undefined && !this.still() && !this.lost()) {
      this.switchTurn();
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

  /**
   * Plays a touch of the run replayed, its key, if any, filled with the color its digit takes now, and sounding as it's
   * typed, as from a keyboard: the replay never shows where the touch first landed.
   */
  replayTouch(touch: KeypadTouch): void {
    this.keypad().noteColor(touch.key);
    if (touch.key !== null) {
      this.sound(touch.key);
    }
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
    if (key !== 'backspace' && !('x' in touch) && this.replay() === undefined) {
      this.sound(key);
    }
    const ringing = key === 'backspace' ? undefined : this.ringing.get(key);
    this.ringing.delete(key);
    // Keys are typed into the game, not into what has the focus, such as the typed digits once clicked or the pause
    // button once the game resumes: it gives the focus up rather than showing its ring as if typed into. Replaying, the
    // player types nothing, and keeps the focus, such as on a menu of the replay, which would close without it.
    if (this.replay() === undefined && document.activeElement instanceof HTMLElement) {
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
    if (key !== 'backspace' && this.checking() && !isPiDecimal(this.digits().length, key)) {
      // A group never finishes on a mistake.
      this.stopWatching();
      this.vibrate('mistake');
      this.sour(ringing);
      this.mistakes.set(key);
      if (this.mode() !== 'free' && this.replay() === undefined) {
        this.loseGame();
      }
      return;
    }
    if (key === 'backspace' && this.digits().length === 0) {
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
      if (this.digits().length < this.runStart()) {
        // Into the digits the game started with: the run goes on from here, anew.
        this.deletedTo.set(this.digits().length);
        this.recorder.start.set(this.digits().length);
      }
      // A word reopened and finished again at once never left its place: it has nothing to fly from.
      this.afterBackspace(!reopens);
    } else {
      if (carriesOn) {
        this.landFlights();
        this.sizes.update((sizes) => sizes.slice(0, -1));
      }
      const place = this.digits().length;
      this.digits.update((digits) => digits + key);
      if (this.discovering) {
        this.discoveryRecorder.record(touch, place, this.rounds().start);
        this.landIfFull();
        if (this.done()) {
          this.handOver();
        }
        return;
      }
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
    const trusted = this.gameplay().groupAt(this.runTimes(), start).trusted;
    return !this.endsAfter(this.session.waited(), start, trusted);
  }

  /** Ends a challenge on its mistake: no more keys, and a moment later, the game over dialog. */
  private loseGame(): void {
    this.lost.set(true);
    this.stopHandOver();
    this.discoveryRecorder.end();
    this.stopGameOver = this.timer.after(GAME_OVER_DELAY, () => {
      this.stopGameOver = () => undefined;
      this.pause()?.gameOver();
    });
  }

  /** Carries a lost challenge's run on in free play, from its mistake, for backspace to delete. */
  protected continueInFreePlay(): void {
    this.stopGameOver();
    this.stopGameOver = () => undefined;
    this.lost.set(false);
    this.mode.set('free');
  }

  /**
   * Plays Discovery's round from the place the rounds start from, on the game's turn: the game types each digit at the
   * pace picked, its key shown pressed, in its color, and sounding, the groups landing as they fill, up to the place
   * reached, then on to the end of the group the slots show there: as many digits as there are slots, a little longer
   * between groups (see `GROUP_PAUSE`). Then it hands the turn over (see {@link handOver}). The rounds start at the
   * checkpoint picked meanwhile, if any, or, unless the player picks them in developer mode, at the one so many behind
   * the farthest reached (see `laggingCheckpoint`).
   */
  private startGameTurn(): void {
    this.stopRounds();
    const picked = this.tweaks.manualCheckpoints()
      ? this.picked()
      : laggingCheckpoint(this.rounds(), this.tweaks.checkpointLag());
    if (picked !== undefined) {
      this.picked.set(undefined);
      this.moveRoundsTo(picked);
    }
    this.backToRoundStart();
    this.turn.set('game');
    this.target.set('end');
    this.vibrate('turn');
    this.playNext(paceInterval(this.pace(), this.tweaks.discoverySpeed(), this.tweaks.paceStep()));
  }

  /** Plays the next digit of Discovery's round after `delay`, if the round goes on, or hands the turn over. */
  private playNext(interval: number, delay = interval): void {
    this.afterRound(delay, () => {
      const typed = this.digits().length;
      if (typed <= this.rounds().reached || this.grouping().current !== '') {
        const grouped = this.playDigit(PI_DECIMALS.charAt(typed) as Digit, interval);
        this.playNext(
          interval,
          grouped ? interval * (1 + this.tweaks.groupPause() / 100) : interval,
        );
      } else {
        this.handOver();
      }
    });
  }

  /**
   * Hands Discovery's turn over to the other, once the game has shown the round, or the player has retyped it: the digits
   * of the turn fade out of the tape over the hand over (see `HAND_OVER`), on Discovery's time, so that it goes faster or
   * stops as that does, the slots, keys and season still those of the turn, so that the player can still read them, or
   * think; then the turn switches (see {@link switchTurn}). The game's turn leaves the player the round to retype up to
   * where it showed it; each digit the player types on starts theirs over.
   */
  private handOver(): void {
    if (this.turn() === 'game') {
      this.playedKey.set(undefined);
      this.target.set(this.digits().length);
    }
    this.stopHandOver();
    this.handingOver.set({ from: this.rounds().from, since: this.discoveryTimer.time() });
    const stopTicks = this.timer.every(TICK, () => {
      this.fadeTicks.update((ticks) => ticks + 1);
    });
    const stopWait = this.discoveryTimer.after(this.tweaks.handOver(), () => {
      this.switchTurn();
    });
    this.stopHandOver = () => {
      stopTicks();
      stopWait();
    };
  }

  /**
   * Switches Discovery's turn, as the hand over ends, or before, as the player takes theirs typing on the game's: the
   * digits of the turn gone, it's the other's. Vibrates if `vibrate`, as the turn switches by itself.
   */
  private switchTurn(vibrate = true): void {
    const shown = this.gameTurnShown();
    if (this.turn() === 'game') {
      this.startPlayerTurn(vibrate);
    } else {
      this.startGameTurn();
    }
    this.showSwitch(shown);
  }

  /**
   * Shows the turn switching from how much the game's turn showed, `from`, over a short switch, unless the hand over
   * ending already showed it all (see {@link gameTurnShown}).
   */
  private showSwitch(from: number): void {
    this.stopTurnSwitch();
    this.turnSwitching.set(undefined);
    if (from === this.gameTurnShown()) {
      return;
    }
    this.turnSwitching.set({ from, since: this.clock.now() });
    const stopTicks = this.timer.every(TICK, () => {
      this.fadeTicks.update((ticks) => ticks + 1);
    });
    const stopWait = this.timer.after(this.tweaks.turnSwitch(), () => {
      this.stopTurnSwitch();
      this.turnSwitching.set(undefined);
    });
    this.stopTurnSwitch = () => {
      stopTicks();
      stopWait();
    };
  }

  /**
   * Starts the player's turn in Discovery: taking it before the game is done showing the round, the round is all the
   * same, to its end, as they show they know it.
   */
  private startPlayerTurn(vibrate: boolean): void {
    this.stopRounds();
    this.backToRoundStart();
    this.turn.set('player');
    this.discoveryRecorder.newTurn();
    if (vibrate) {
      this.vibrate('turn');
    }
  }

  /**
   * Types a digit of Discovery's round, as the game plays it, never recorded: its group lands once its slots are full.
   * Gives whether it did.
   */
  private playDigit(digit: Digit, interval: number): boolean {
    this.keypad().noteColor(digit);
    this.sound(digit);
    this.playedKey.set(digit);
    this.afterRound(interval * KEY_SHOWN, () => {
      this.playedKey.set(undefined);
    });
    this.digits.update((digits) => digits + digit);
    if (this.grouping().current.length >= this.size()) {
      this.finishGroup(true);
      return true;
    }
    return false;
  }

  /**
   * Lands the group the player is typing in Discovery once its slots are full, as the game played it, never as their
   * timing says; each whole group typed past the place reached takes it on, as if the game had shown it.
   */
  private landIfFull(): void {
    if (this.grouping().current.length < this.size()) {
      return;
    }
    this.finishGroup(true);
    if (this.target() === 'end' && this.digits().length > this.rounds().reached) {
      this.target.set(this.digits().length);
    }
    this.rounds.update((rounds) => completeRound(rounds, this.digits().length));
  }

  /** Takes Discovery's round back to the place the rounds start from, the digits before it given. */
  private backToRoundStart(): void {
    this.stopWatching();
    this.landFlights();
    this.playedKey.set(undefined);
    this.handingOver.set(undefined);
    this.stopHandOver();
    this.stopHandOver = () => undefined;
    this.mistakes.set('');
    this.digits.set(PI_DECIMALS.slice(0, this.rounds().from));
    this.sizes.set(this.wordsUpTo(this.sizes(), this.rounds().from));
    this.reopenable = false;
    this.retyped.end();
  }

  /**
   * Picks a checkpoint they've reached for Discovery's rounds to start at from the game's next turn, which shows the
   * player what to type from there; or, picked already, takes it back.
   */
  protected startFrom(checkpoint: number): void {
    if (this.lost() || this.paused()) {
      return;
    }
    this.picked.update((picked) => (picked === checkpoint ? undefined : checkpoint));
  }

  /** Starts Discovery's rounds at a checkpoint they've reached, from their next start. */
  private moveRoundsTo(checkpoint: number): void {
    // Where Discovery starts from next time, too.
    void this.checkpointSetting.pick('discovery', checkpoint);
    const from = groupStart(this.sizes(), checkpoint, this.knownGroups(), this.groupSize());
    this.rounds.update((rounds) => moveTo(rounds, checkpoint, from));
  }

  private afterRound(delay: number, callback: () => void): void {
    this.stopRound.push(this.discoveryTimer.after(delay, callback));
  }

  /** Stops what Discovery has scheduled. */
  private stopRounds(): void {
    for (const stop of this.stopRound) {
      stop();
    }
    this.stopRound = [];
    this.playedKey.set(undefined);
  }

  /** Starts a new game: no digits typed, back to the first spring, the run ended counting as an earlier one. */
  protected restart(): void {
    const ended = this.session.run();
    this.reset();
    if (ended !== undefined) {
      this.playedHere.update((runs) => [...runs, ended]);
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
    this.mode.set(this.routeMode);
    if (this.discovering) {
      // Playing again, a new session from where the rounds started, its first round played as the game goes on.
      this.stopRounds();
      this.stopHandOver();
      this.target.set(undefined);
      this.discoveryRecorder.end();
      this.rounds.update((rounds) => newRounds(rounds.from, rounds.checkpoint));
      this.turn.set('game');
      this.picked.set(undefined);
    }
    this.landFlights();
    this.deletedTo.set(undefined);
    if (this.replay() === undefined) {
      this.recorder.start.set(this.startPlace());
    }
    this.digits.set(PI_DECIMALS.slice(0, this.startPlace()));
    this.mistakes.set('');
    this.sizes.set(this.wordsUpTo([], this.startPlace()));
    this.reopenable = false;
    this.session.end();
    if (this.discovering) {
      this.startGameTurn();
    }
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
    const times = this.runTimes();
    const last = times.at(-1);
    return last !== undefined && this.gameplay().groupEnds([...times, last + wait], start, trusted);
  }

  /** The times of the run so far, from its start, as the break model takes them. */
  private runTimes(): readonly number[] {
    // Discovery's own typing never counts: its groups are the player's, as the game plays them.
    return this.discovering ? [] : (this.session.run()?.times ?? []);
  }

  /** The words on the tape up to a place: those of `kept` that end by it, then the player's groups (see `wordsUpTo`). */
  private wordsUpTo(kept: readonly number[], to: number): number[] {
    return wordsUpTo(kept, to, this.knownGroups(), this.groupSize());
  }

  /** Turns the group being typed into a word, its slots flying into it if `fly`. */
  private finishGroup(fly: boolean): void {
    const length = this.grouping().current.length;
    const firstPlace = this.digits().length - length;
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
    if (landing.length > 0 && fly && !this.silent()) {
      this.log(model.describeLanding(this.digits(), this.sizes()));
    }
    if (slots.length === 0) {
      // Words that don't fly, as when the player prefers reduced motion, land at once; a word ending again at once,
      // reopened and finished as it was, never left.
      if (fly && landing.length > 0 && !this.silent()) {
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
   * so the player can listen to it before committing to it; keys typed on a keyboard, and those of a run replayed, sound
   * as they're typed. While the game is held still (see {@link still}), keys sound all the same, typing nothing, for the
   * player to try their notes before typing them; never while paused nor {@link silent}. The sound model never knows the
   * next digit, so the sound gives nothing away.
   */
  protected sound(key: KeypadKey): void {
    if (!isDigit(key) || this.paused() || this.silent()) {
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
    this.ringing.set(key, this.speaker.play(atTempo(model.keys(moment)[key], this.tempo())));
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

  /** Whether nothing sounds: replaying a run muted, or skipping ahead in it. */
  private silent(): boolean {
    return this.muted() || this.quiet;
  }

  /** Vibrates on an event of the game, unless replaying a run. */
  private vibrate(vibration: Vibration): void {
    if (this.replay() === undefined) {
      this.vibrator.play(vibration);
    }
  }

  /**
   * Vibrates as each of `length` slots flying, after they slide for `slide` ms, plucks itself off, then lands, unless
   * replaying a run, and plays the word's `landing` as the last one lands, unless {@link silent}. The flights take
   * their own time, whatever the replay's tempo, and so does the landing.
   */
  private vibrateFlights(length: number, slide: number, landing: Chime): void {
    const playing =
      landing.length > 0 && !this.silent()
        ? this.speaker.play(landing, landsAt(length - 1, slide), 'landing')
        : undefined;
    const indices = Array.from({ length }, (_, i) => i);
    const vibrations =
      this.replay() === undefined
        ? [
            this.vibrator.play(
              'pluck',
              indices.map((i) => leavesAt(i, slide)),
            ),
            this.vibrator.play(
              'landing',
              indices.map((i) => landsAt(i, slide)),
            ),
          ]
        : [];
    const now = this.clock.now();
    this.flightVibrations = [
      ...this.flightVibrations.filter(({ until }) => until > now),
      {
        until: now + landsAt(length - 1, slide) + LONGEST_VIBRATION,
        stop: () => {
          for (const stop of vibrations) {
            stop();
          }
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
