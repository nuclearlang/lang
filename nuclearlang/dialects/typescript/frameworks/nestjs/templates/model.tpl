{{decorators}}export class {{name}} {
  {{body}}{{#body}}

{{/body}}
  constructor(values?: Partial<{{name}}>) {
    if (values) {
      Object.assign(this, values);
      checkModel(this);
    }
  }
}
