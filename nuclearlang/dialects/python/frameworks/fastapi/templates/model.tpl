{{decorators}}class {{name}}(Model):
    {{#doc}}{{doc}}

    {{/doc}}{{#body}}{{body}}{{/body}}{{^body}}{{^doc}}pass{{/doc}}{{/body}}
