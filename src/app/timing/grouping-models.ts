import { groupEnds } from '../groups/groups';
import { AVERAGE_MODEL } from './average-model';
import { breakModel, DEFAULT_BREAK_SETTINGS } from './break-model';
import { GroupingModel } from './grouping-model';

/** The break model (`break-model.ts`). */
const BREAK_MODEL: GroupingModel = {
  name: 'breaks',
  label: 'Breaks',
  settings: Object.keys(DEFAULT_BREAK_SETTINGS) as (keyof typeof DEFAULT_BREAK_SETTINGS)[],
  run: breakModel,
  groupEnds,
};

/** The models the groups can come from, picked on Your Runs in developer mode: the first is the game's. */
export const GROUPING_MODELS: readonly [GroupingModel, ...GroupingModel[]] = [
  BREAK_MODEL,
  AVERAGE_MODEL,
];

/** The model the game takes the groups from. */
export const GROUPING_MODEL = GROUPING_MODELS[0];

/** The model of that name, if any. */
export function groupingModelNamed(name: unknown): GroupingModel | undefined {
  return GROUPING_MODELS.find((model) => model.name === name);
}
