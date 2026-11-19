import { TodoRepository } from '../src/components/todos/data/todo_repository';
import { ListTodos } from '../src/components/todos/domain/usecases/list_todos';
import { registerSynapsis, synapsisConfig } from '../src/synapsis.g';
import { cleanup } from '@testing-library/react';
import { Ok, inject } from 'synapsis-web';
import { SynapsisTest, okOf, when } from 'synapsis-web/testing';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

/** The tests of todos: the repository is a mock; everything else is the real code. */
describe('TodosTest', () => {
  beforeEach(async () => {
    await SynapsisTest.start(synapsisConfig(), registerSynapsis);
    SynapsisTest.mock(TodoRepository);
  });

  // a screen a test rendered leaves the page before the next test
  afterEach(() => {
    cleanup();
  });

  beforeEach(async () => {
    when(inject(TodoRepository).all).thenReturn(Ok([]));
  });

  test('ListTodos answers the todos of the API', async () => {
    const result = await inject(ListTodos).exec();
    expect(okOf(result)).toEqual([]);
  });
});
