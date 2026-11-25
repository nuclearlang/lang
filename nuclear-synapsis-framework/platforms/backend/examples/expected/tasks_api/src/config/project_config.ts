import { SQLite } from '../plugins/sqlite.js';
import { AppConfig, Connection, Guard, Http, NoOrigin, Token, env } from 'synapsis-nest';
import { Ollama } from 'synapsis-nest/ai';
import { WebSocketServer } from 'synapsis-nest/sockets';

/**
 * The connections of the app: the tasks database, the local Ollama model, the public holidays API and the app's
 * WebSocket at /ws (the same routes, and the events it publishes to the clients subscribed to them).
 */
export class ProjectConfig extends AppConfig {
  readonly connections: Connection[] = [
    new SQLite({ file: env('DATABASE', 'tasks.sqlite'), createTables: true }),
    new Ollama({
      model: env('CHAT_MODEL', 'qwen3.5:4b'),
      baseUrl: env('OLLAMA_URL', 'http://localhost:11434'),
    }),
    new Http({ baseUrl: env('HOLIDAYS_URL', 'https://date.nager.at/api/v3'), timeout: 5 }),
    new WebSocketServer({ path: 'ws' }),
  ];
  /** Every route and the WebSocket: no request from a web page, and the token of TASKS_TOKEN in X-Tasks-Token. */
  readonly guards: Guard[] = [
    new NoOrigin(),
    new Token({ value: env('TASKS_TOKEN'), header: 'X-Tasks-Token' }),
  ];
}
