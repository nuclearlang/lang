import { Annotation } from '@langchain/langgraph';

/** The state of the planner graph. */
export const PlanState = Annotation.Root({
  goal: Annotation<string>,
  titles: Annotation<string[]>,
  created: Annotation<number>,
  failed: Annotation<string[]>,
});
export type PlanState = typeof PlanState.State;
