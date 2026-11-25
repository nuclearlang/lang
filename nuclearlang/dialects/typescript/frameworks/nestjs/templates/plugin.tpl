{{decorators}}export class {{name}} extends Database {
  readonly dialect = '{{package.dialect}}';{{#decor.retries}}
  override readonly retries = {{decor.retries.arg}};{{/decor.retries}}
}
