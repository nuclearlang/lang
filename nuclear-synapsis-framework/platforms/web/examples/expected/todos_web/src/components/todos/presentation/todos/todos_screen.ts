import { TodosManager } from './managers/todos_manager';
import { TodosStateBuilder } from './state_models/todos_state';
import { Element, Providers, StatelessView, createElement, h1, li, main, p, statelessOf, ul } from 'synapsis-web';

/** The todos, as a list. */
/** @screen: builds TodosManager once for this screen and provides them to its views. */
export function TodosScreen(props: TodosScreenProps = {}): Element {
  return createElement(Providers, {
    managers: [TodosManager],
    children: createElement(TodosScreenView, props),
  });
}

export interface TodosScreenProps {
  key?: string | number;
}

const TodosScreenView = statelessOf(
  class extends StatelessView<TodosScreenProps> {
    override build(): Element {
      return main({
        children: [
          h1({ children: 'Todos' }),
          TodosStateBuilder({
            loading: () => p({ children: 'Loading...' }),
            full: (items) => ul({ children: items.map((item) => li({ key: item.id, children: item.title })) }),
            error: (e) => p({ className: 'error', children: e.message }),
          }),
        ],
      });
    }
  },
);
