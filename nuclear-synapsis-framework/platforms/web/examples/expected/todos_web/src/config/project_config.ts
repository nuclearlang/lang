import { env } from '../nuclear_env';
import { AppConfig, Connection, Http } from 'synapsis-web';

/**
 * The connections and services of the whole app (nuclear help web). API_URL: the backend of each environment
 * (.env, .env.<environment>: nuclear env set API_URL <url> --env <environment>).
 */
export class ProjectConfig extends AppConfig {
  override readonly connections: Connection[] = [
    new Http({ connectionName: 'todos', baseUrl: 'https://jsonplaceholder.typicode.com' }),
    new Http({ baseUrl: env('API_URL', 'http://localhost:8000/'), timeout: 5000 }),
  ];
}
