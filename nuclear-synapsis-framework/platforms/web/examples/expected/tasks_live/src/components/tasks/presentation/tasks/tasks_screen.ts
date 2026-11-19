import { TasksManager } from './managers/tasks_manager';
import { TasksStateBuilder } from './state_models/tasks_state';
import { Element, Providers, StatelessView, createElement, h1, li, main, p, statelessOf, ul } from 'synapsis-web';

/** The tasks, as a list. */
/** @screen: builds TasksManager once for this screen and provides them to its views. */
export function TasksScreen(props: TasksScreenProps = {}): Element {
  return createElement(Providers, {
    managers: [TasksManager],
    children: createElement(TasksScreenView, props),
  });
}

export interface TasksScreenProps {
  key?: string | number;
}

const TasksScreenView = statelessOf(
  class extends StatelessView<TasksScreenProps> {
    override build(): Element {
      return main({
        children: [
          h1({ children: 'Tasks' }),
          TasksStateBuilder({
            loading: () => p({ children: 'Loading...' }),
            full: (items) => ul({ children: items.map((item) => li({ key: item.id, children: item.title })) }),
            error: (e) => p({ className: 'error', children: e.message }),
          }),
        ],
      });
    }
  },
);
