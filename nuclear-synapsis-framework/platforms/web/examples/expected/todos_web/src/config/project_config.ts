import { AppConfig, Connection, Http } from 'synapsis-web';

/** The connections and services of the whole app (nuclear help web). */
export class ProjectConfig extends AppConfig {
  override readonly connections: Connection[] = [
    new Http({ connectionName: 'todos', baseUrl: 'https://jsonplaceholder.typicode.com' }),
    new Http({ baseUrl: 'http://localhost:8000/', timeout: 5000 }),
  ];
}
