// Configuration: the connections of the app. `AppConfig.connections` (config/project_config.nuc) lists them; the
// database goes to SequelizeModule.forRoot, the others are opened when the app starts and closed when it stops.
// Values usually come from the environment: env('X', 'default').
import { readFileSync } from 'node:fs';
import type { SequelizeModuleOptions } from '@nestjs/sequelize';
import type { Guard } from './guards.js';

/**
 * Loads the app's `.env` (the one `nuclear build --env <environment>` writes beside the app, spec 021) into
 * `process.env`, without replacing a variable the process already has (production sets its secrets there). Lines:
 * `NAME=value` or `NAME="value"` with the escapes `\n`, `\r`, `\t`, `\"`, `\\`, `\$`; `#` comments.
 */
const ESCAPES: Record<string, string> = { n: '\n', r: '\r', t: '\t' };

export function loadEnvFile(path = '.env'): void {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return;
  }
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const eq = line.indexOf('=');
    if (!line || line.startsWith('#') || eq < 0) continue;
    const name = line.slice(0, eq).trim().replace(/^export\s+/, '');
    let value = line.slice(eq + 1).trim();
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1).replace(/\\(.)/g, (_, c: string) => ESCAPES[c] ?? c);
    }
    if (process.env[name] === undefined) process.env[name] = value;
  }
}

// the app's folder is where it runs (the build's folder): its .env, before any env() of the app is read
loadEnvFile();

/** The environment variable `name`, or `fallback`. */
export function env(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

/** Something the app opens at start and closes at stop. `name` tells two connections of a kind apart. */
export abstract class Connection {
  name = 'default';

  async open(): Promise<void> {}

  async close(): Promise<void> {}

  /** Called by configureApp with the Nest app before it starts (the app's WebSocket hooks in here). */
  instrument(_app: unknown): void {}
}

export interface DatabaseOptions {
  /** `postgres://user:pass@host:5432/db`, `mysql://...`, `mariadb://...`; SQLite uses `file` instead. */
  url?: string;
  /** SQLite file (`':memory:'` for tests). */
  file?: string;
  /** Creates the entities' tables at start (development). */
  createTables?: boolean;
  logging?: boolean;
  name?: string;
}

/** A SQL database through Sequelize. */
export abstract class Database extends Connection {
  abstract readonly dialect: 'postgres' | 'mysql' | 'sqlite' | 'mariadb';

  constructor(readonly options: DatabaseOptions = {}) {
    super();
    this.name = options.name ?? 'default';
  }

  /** What SequelizeModule.forRoot receives. SYNAPSIS_DATABASE=memory (the tests) uses SQLite in memory. */
  sequelize(): SequelizeModuleOptions {
    if (process.env.SYNAPSIS_DATABASE === 'memory') {
      return { dialect: 'sqlite', storage: ':memory:', autoLoadModels: true, synchronize: true, logging: false };
    }
    return {
      dialect: this.dialect,
      ...(this.options.url ? { uri: this.options.url } : {}),
      ...(this.options.file ? { storage: this.options.file } : {}),
      autoLoadModels: true,
      synchronize: this.options.createTables ?? false,
      logging: this.options.logging ?? false,
    };
  }
}

/** PostgreSQL (pg): new Postgres({ url: env('DATABASE_URL', 'postgres://localhost/app') }). */
export class Postgres extends Database {
  readonly dialect = 'postgres' as const;
}

/** MySQL (mysql2). */
export class MySQL extends Database {
  readonly dialect = 'mysql' as const;
}

/** MariaDB (mariadb). */
export class MariaDB extends Database {
  readonly dialect = 'mariadb' as const;
}

/** SQLite (sqlite3): new SQLite({ file: 'app.sqlite', createTables: true }). */
export class SQLite extends Database {
  readonly dialect = 'sqlite' as const;
}

/** The project configuration (config/project_config.nuc): its connections. */
export abstract class AppConfig {
  abstract readonly connections: Connection[];
  // the guards every route passes (ADR-synapsis-0007), when the project config lists them
  readonly guards?: Guard[];
}

/** The configuration of one component: connections only it uses. */
export abstract class ComponentConfig {
  readonly connections: Connection[] = [];
}

/** The options of the config's database for SequelizeModule.forRoot (the first Database, or the named one). */
export function databaseOf(config: AppConfig, name = 'default'): SequelizeModuleOptions {
  const db = config.connections.find((c): c is Database => c instanceof Database && c.name === name)
    ?? config.connections.find((c): c is Database => c instanceof Database);
  if (!db) throw new Error('the configuration has no database connection (Postgres, MySQL, MariaDB or SQLite)');
  return db.sequelize();
}
