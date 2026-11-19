import { TaskRepository } from '../src/components/tasks/data/task_repository';
import { ListTasks } from '../src/components/tasks/domain/usecases/list_tasks';
import { registerSynapsis, synapsisConfig } from '../src/synapsis.g';
import { cleanup } from '@testing-library/react';
import { Ok, inject } from 'synapsis-web';
import { SynapsisTest, okOf, when } from 'synapsis-web/testing';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

/** The tests of tasks: the repository is a mock; everything else is the real code. */
describe('TasksTest', () => {
  beforeEach(async () => {
    await SynapsisTest.start(synapsisConfig(), registerSynapsis);
    SynapsisTest.mock(TaskRepository);
  });

  // a screen a test rendered leaves the page before the next test
  afterEach(() => {
    cleanup();
  });

  beforeEach(async () => {
    when(inject(TaskRepository).all).thenReturn(Ok([]));
  });

  test('ListTasks answers the tasks of the API', async () => {
    const result = await inject(ListTasks).exec();
    expect(okOf(result)).toEqual([]);
  });
});
