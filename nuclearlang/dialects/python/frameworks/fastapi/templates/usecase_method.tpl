{{#plugins.telemetry}}{{^owner_decor.untraced}}{{^decor.untraced}}{{#is.exec}}@traced("{{#site.component}}{{site.component}}{{/site.component}}{{^site.component}}app{{/site.component}} › usecase › {{owner}}.{{name}}")
{{/is.exec}}{{/decor.untraced}}{{/owner_decor.untraced}}{{/plugins.telemetry}}{{decorators}}{{#mods.static}}@staticmethod
{{/mods.static}}{{#mods.get}}@property
{{/mods.get}}{{#mods.set}}@{{name}}.setter
{{/mods.set}}{{#override}}@override
{{/override}}{{#async}}async {{/async}}def {{name}}{{generics}}({{^mods.static}}self{{#params}}, {{/params}}{{/mods.static}}{{params}}){{#ret}} -> {{ret}}{{/ret}}{{^ret}}{{#mods.set}} -> None{{/mods.set}}{{/ret}}:
    {{#doc}}{{doc}}
    {{/doc}}{{body}}