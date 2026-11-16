import { TodoRepository } from '../src/components/todos/data/todo_repository';
import { ListTodos } from '../src/components/todos/domain/usecases/list_todos';
import { registerSynapsis, synapsisConfig } from '../src/synapsis.g';
import { Ok, inject } from 'synapsis-web';
import { SynapsisTest, okOf, when } from 'synapsis-web/testing';
import { beforeEach, describe, expect, test } from 'vitest';

/** The tests of todos: the repository is a mock; everything else is the real code. */
describe('TodosTest', () => {
  beforeEach(async () => {
    await SynapsisTest.start(synapsisConfig(), registerSynapsis);
    SynapsisTest.mock(TodoRepository);
  });

  beforeEach(async () => {
    when(inject(TodoRepository).all).thenReturn(Ok([]));
  });

  test('ListTodos answers the todos of the API', async () => {
    const result = await inject(ListTodos).exec();
    expect(okOf(result)).toEqual([]);
  });
});
