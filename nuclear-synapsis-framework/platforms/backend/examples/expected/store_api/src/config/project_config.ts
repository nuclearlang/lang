import { SQLite } from '../plugins/sqlite.js';
import { AppConfig, Connection, env } from 'synapsis-nest';

/**
 * The connections of the whole app: databases, chat models, Kafka, Redis (nuclear help backend, §2.8).
 * Each one needs its plugin in config.nuc.
 */
export class ProjectConfig extends AppConfig {
  readonly connections: Connection[] = [new SQLite({ file: env('DATABASE', 'app.sqlite'), createTables: true })];
}
