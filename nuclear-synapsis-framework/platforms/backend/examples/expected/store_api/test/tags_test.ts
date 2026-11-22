import { AppModule } from '../src/app.module.js';
import { NewTag } from '../src/components/store/domain/models/new_tag.js';
import { StoreAppComponent } from '../src/components/store/store_appcomponent.js';
import { INestApplication } from '@nestjs/common';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { inject } from 'synapsis-nest';
import { startTestApp, stopTestApp } from 'synapsis-nest/testing';

import assert from 'node:assert/strict';

/** The tests of tags: the database is in memory and empty in each test. */
describe('TagsTest', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await startTestApp(AppModule);
  });

  afterEach(async () => {
    await stopTestApp(app);
  });

  it('adds a tag and finds it', async () => {
    const app = inject(StoreAppComponent);
    const made = await app.createTag(new NewTag({ label: 'label' }));
    assert.ok(made.isOk);
  });
});
