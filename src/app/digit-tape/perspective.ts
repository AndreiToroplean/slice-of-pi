/**
 * Geometry of the digit tape: typed digits lie on a grid of rows receding towards a horizon near the top of the screen.
 *
 * The main row is at the bottom, with the newest digit in its center column. Older digits run to the left and wrap onto
 * the row above, which is further away: every row has the same number of columns but is smaller than the one in front of
 * it, scaled around the vanishing point at the center of the screen, and fainter, as if seen through haze.
 */

/** Width of a digit cell relative to the font size. */
const CELL_WIDTH_EM = 0.65;
/** Height of a row relative to the font size. */
const LINE_HEIGHT_EM = 1.3;
/** Main row font size: 14% of the screen width, within these bounds (px). */
const MIN_FONT_SIZE = 40;
const MAX_FONT_SIZE = 72;
/** Fewest columns per row; always odd so that there is a center column. */
const MIN_COLUMNS = 5;
/** Gap between the main row and the bottom of the tape, in main row heights. */
const BOTTOM_MARGIN = 0.25;
/** Where the horizon sits, as a fraction of the tape height from its top. */
const HORIZON = 0.04;
/** Bounds on the size ratio between consecutive rows. */
const MIN_ROW_RATIO = 0.5;
const MAX_ROW_RATIO = 0.92;
/** Haze density: opacity is `exp(-HAZE * distance)`, distance being 0 for the main row and 1 where rows are half size. */
const HAZE = 0.3;
/** Rows smaller or fainter than this are not drawn. */
const MIN_VISIBLE_FONT_SIZE = 3;
const MIN_VISIBLE_OPACITY = 0.03;
/** Hard cap on the number of rows, whatever the screen size. */
const MAX_ROWS = 40;

export interface RowGeometry {
  /** 0 for the main row, increasing away from the player. */
  readonly index: number;
  /** Size relative to the main row. */
  readonly scale: number;
  /** Vertical center of the row, in px from the top of the tape. */
  readonly centerY: number;
  readonly opacity: number;
}

export interface TapeGeometry {
  readonly width: number;
  readonly columns: number;
  /** Column of the newest digit on the main row. */
  readonly centerColumn: number;
  /** Main row cell size, in px; other rows are scaled from it. */
  readonly cellWidth: number;
  readonly lineHeight: number;
  readonly fontSize: number;
  /** Visible rows, main row first. */
  readonly rows: readonly RowGeometry[];
}

/** Lays out the rows for a tape of the given size (px). */
export function tapeGeometry(width: number, height: number): TapeGeometry {
  const targetFontSize = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, width * 0.14));
  const fittingColumns = Math.floor(width / (targetFontSize * CELL_WIDTH_EM));
  const columns = Math.max(
    MIN_COLUMNS,
    fittingColumns % 2 === 1 ? fittingColumns : fittingColumns - 1,
  );
  const cellWidth = width / columns;
  const fontSize = cellWidth / CELL_WIDTH_EM;
  const lineHeight = fontSize * LINE_HEIGHT_EM;

  // Row r has scale q^r and rows are stacked without overlapping, so they converge at a distance of
  // lineHeight * (1/2 + q / (1 - q)) above the main row's center. Pick q so that this is where the horizon is.
  const mainCenterY = height - lineHeight * (0.5 + BOTTOM_MARGIN);
  const horizonY = height * HORIZON;
  const depth = Math.max(0, (mainCenterY - horizonY) / lineHeight - 0.5);
  const ratio = Math.min(MAX_ROW_RATIO, Math.max(MIN_ROW_RATIO, depth / (1 + depth)));

  const rows: RowGeometry[] = [];
  let centerY = mainCenterY;
  for (let index = 0; index < MAX_ROWS; index++) {
    const scale = ratio ** index;
    const opacity = Math.exp(-HAZE * (1 / scale - 1));
    if (index > 0) {
      centerY -= (lineHeight * (scale / ratio + scale)) / 2;
    }
    if (
      index > 0 &&
      (fontSize * scale < MIN_VISIBLE_FONT_SIZE || opacity < MIN_VISIBLE_OPACITY || centerY < 0)
    ) {
      break;
    }
    rows.push({ index, scale, centerY, opacity });
  }

  return { width, columns, centerColumn: (columns - 1) / 2, cellWidth, lineHeight, fontSize, rows };
}

/** A digit placed on a row. A digit wrapping between two rows is placed on both, each copy clipped by its row. */
export interface PlacedDigit {
  /** Position in the typed sequence (0-based). */
  readonly position: number;
  /** Column on the row, fractional while moving; from -1 to `columns`, exclusive, so possibly partly clipped. */
  readonly column: number;
}

/**
 * Places the digits of a sequence of `count` digits on each row, when the view is centered on position `head`
 * (fractional while moving). Only digits at least partly visible are placed, so the result is small however long the
 * sequence is.
 */
export function placeDigits(geometry: TapeGeometry, count: number, head: number): PlacedDigit[][] {
  const { columns, centerColumn } = geometry;
  return geometry.rows.map((row) => {
    // Column of a position p on this row: centerColumn + p - head + row.index * columns.
    const offset = centerColumn - head + row.index * columns;
    const first = Math.max(0, Math.floor(-1 - offset) + 1);
    const last = Math.min(count - 1, Math.ceil(columns - offset) - 1);
    const placed: PlacedDigit[] = [];
    for (let position = first; position <= last; position++) {
      placed.push({ position, column: position + offset });
    }
    return placed;
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
