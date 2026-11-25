{{decorators}}class {{name}}(Database):
    {{#doc}}{{doc}}

    {{/doc}}driver = "{{package.driver}}"{{#decor.retries}}
    retries = {{decor.retries.arg}}{{/decor.retries}}
