/**
 * Geometry of the digit tape: typed digits lie on rows receding towards a horizon near the top of the screen.
 *
 * The main row is at the bottom, with the newest digit in its center column. Older digits run to the left and wrap onto
 * the row above, which is further away: each row is smaller than the one in front of it, so it holds more digits, as
 * many as it takes to span the screen. Rows are also fainter with distance, as if seen through haze that becomes opaque
 * at a finite distance: rows beyond it are not drawn at all, so only a bounded number of digits is ever on screen.
 */

/** Width of a digit cell relative to the font size. */
const CELL_WIDTH_EM = 0.65;
/** Height of a row relative to the font size. */
const LINE_HEIGHT_EM = 1.3;
/** Main row font size: 14% of the screen width, within these bounds (px). */
const MIN_FONT_SIZE = 40;
const MAX_FONT_SIZE = 72;
/** Fewest columns on the main row; always odd so that there is a center column. */
const MIN_COLUMNS = 5;
/** Gap between the main row and the bottom of the tape, in main row heights. */
const BOTTOM_MARGIN = 0.25;
/** Where the horizon sits, as a fraction of the tape height from its top. */
const HORIZON = 0.04;
/** Bounds on the size ratio between consecutive rows. */
const MIN_ROW_RATIO = 0.5;
const MAX_ROW_RATIO = 0.92;
/** Haze density: light fades as `exp(-HAZE * distance)`, distance being 0 for the main row and 1 for half-size rows. */
const HAZE = 0.3;
/** Fraction of light below which the haze is fully opaque, so that it reaches zero visibility at a finite distance. */
const HAZE_CUTOFF = 0.03;
/** Rows smaller than this are not drawn. */
const MIN_VISIBLE_FONT_SIZE = 3;
/** Hard cap on the number of rows, whatever the screen size. */
const MAX_ROWS = 40;

export interface RowGeometry {
  /** 0 for the main row, increasing away from the player. */
  readonly index: number;
  /** Size relative to the main row. */
  readonly scale: number;
  /** Number of digit cells on the row: enough to span the screen. */
  readonly columns: number;
  /** Number of cells on the rows between this one and the main row, exclusive (0 for the main and second rows). */
  readonly cellsInFront: number;
  /** Vertical center of the row, in px from the top of the tape. */
  readonly centerY: number;
  /** Between 0 and 1, never 0: rows the haze hides entirely are left out. */
  readonly opacity: number;
}

export interface TapeGeometry {
  readonly width: number;
  /** Column of the newest digit on the main row. */
  readonly centerColumn: number;
  /** Main row cell size, in px; other rows are scaled from it. */
  readonly cellWidth: number;
  readonly lineHeight: number;
  readonly fontSize: number;
  /** Visible rows, main row first. */
  readonly rows: readonly RowGeometry[];
}

/** Opacity of a row of the given scale: haze density over its distance, reaching exactly 0 at the cutoff. */
export function hazeOpacity(scale: number): number {
  const light = Math.exp(-HAZE * (1 / scale - 1));
  return Math.max(0, (light - HAZE_CUTOFF) / (1 - HAZE_CUTOFF));
}

/** Lays out the rows for a tape of the given size (px). */
export function tapeGeometry(width: number, height: number): TapeGeometry {
  const targetFontSize = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, width * 0.14));
  const fittingColumns = Math.floor(width / (targetFontSize * CELL_WIDTH_EM));
  const mainColumns = Math.max(
    MIN_COLUMNS,
    fittingColumns % 2 === 1 ? fittingColumns : fittingColumns - 1,
  );
  const cellWidth = width / mainColumns;
  const fontSize = cellWidth / CELL_WIDTH_EM;
  const lineHeight = fontSize * LINE_HEIGHT_EM;

  // Row r has scale q^r and rows are stacked without overlapping, so they converge at a distance of
  // lineHeight * (1/2 + q / (1 - q)) above the main row's center. Pick q so that this is where the horizon is.
  const mainCenterY = height - lineHeight * (0.5 + BOTTOM_MARGIN);
  const horizonY = height * HORIZON;
  const depth = Math.max(0, (mainCenterY - horizonY) / lineHeight - 0.5);
  const ratio = Math.min(MAX_ROW_RATIO, Math.max(MIN_ROW_RATIO, depth / (1 + depth)));

  const rows: RowGeometry[] = [
    { index: 0, scale: 1, columns: mainColumns, cellsInFront: 0, centerY: mainCenterY, opacity: 1 },
  ];
  for (let index = 1; index < MAX_ROWS; index++) {
    const front = rows[index - 1];
    if (front === undefined) {
      break;
    }
    const scale = ratio ** index;
    const opacity = hazeOpacity(scale);
    const centerY = front.centerY - (lineHeight * (front.scale + scale)) / 2;
    if (opacity === 0 || fontSize * scale < MIN_VISIBLE_FONT_SIZE || centerY < 0) {
      break;
    }
    rows.push({
      index,
      scale,
      columns: Math.ceil(width / (cellWidth * scale)),
      // The main row only holds digits up to its center column; the rows behind it are full.
      cellsInFront: index === 1 ? 0 : front.cellsInFront + front.columns,
      centerY,
      opacity,
    });
  }

  return { width, centerColumn: (mainColumns - 1) / 2, cellWidth, lineHeight, fontSize, rows };
}

/**
 * The run of digits drawn on a row: positions `first` to `last` (none if `first > last`), position p in column
 * `p + offset`, fractional while moving. It includes digits only partly on the row, so a digit wrapping between two rows
 * is drawn on both, each copy clipped by its row.
 */
export interface RowPlacement {
  readonly first: number;
  readonly last: number;
  readonly offset: number;
}

/**
 * Places a sequence of `count` digits on the rows, when the view is centered on position `head` (fractional while
 * moving). Only digits at least partly visible are placed, so the result is small however long the sequence is.
 */
export function placeRows(geometry: TapeGeometry, count: number, head: number): RowPlacement[] {
  return geometry.rows.map((row) => {
    // Older digits go left, then onto the row behind, filling it from its right end.
    const offset =
      row.index === 0
        ? geometry.centerColumn - head
        : geometry.centerColumn - head + row.cellsInFront + row.columns;
    return {
      first: Math.max(0, Math.floor(-1 - offset) + 1),
      last: Math.min(count - 1, Math.ceil(row.columns - offset) - 1),
      offset,
    };
  });
}

/**
 * Moves `current` towards `target` with exponential smoothing over `elapsed` ms, `timeConstant` being the time it takes
 * to cover 63% of the distance. Snaps to the target once within a negligible distance.
 */
export function approach(
  current: number,
  target: number,
  elapsed: number,
  timeConstant: number,
): number {
  const next = target + (current - target) * Math.exp(-elapsed / timeConstant);
  return Math.abs(next - target) < 0.001 ? target : next;
}
