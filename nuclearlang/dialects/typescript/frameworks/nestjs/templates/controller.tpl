{{decorators}}@Controller({{#decor.controller.arg}}{{decor.controller.arg}}{{/decor.controller.arg}}{{^decor.controller.arg}}'{{name|strip_suffix:"Controller"|kebab}}'{{/decor.controller.arg}})
{{#decor.controller.guards}}@guardedBy({{decor.controller.guards}})
{{/decor.controller.guards}}export class {{name}} {
  {{body}}
}
