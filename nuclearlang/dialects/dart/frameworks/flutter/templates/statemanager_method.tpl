{{#decor.state}}
{{#async}}Future<void>{{/async}}{{^async}}void{{/async}} {{name}}({{params}}){{#async}} async{{/async}} {
{{#decor.before}}
  {{decor.before.arg}}();
{{/decor.before}}
{{#async}}
  final turn$ = stateTurn();
{{/async}}
{{#ret_info.result}}
  final result = {{#async}}await {{/async}}_{{name}}({{call_args}});
{{#async}}
  if (!isLatestTurn(turn$)) return;
{{/async}}
  emit(result.match({{owner_decor.stateModel.arg}}.error, {{decor.state.arg}}));
{{/ret_info.result}}
{{^ret_info.result}}
  final value = {{#async}}await {{/async}}_{{name}}({{call_args}});
{{#async}}
  if (!isLatestTurn(turn$)) return;
{{/async}}
  emit({{decor.state.arg}}(value));
{{/ret_info.result}}
{{#decor.after}}
  {{decor.after.arg}}();
{{/decor.after}}
}

{{ret}} _{{name}}({{params}}){{#async}} async{{/async}} {
  {{body}}
}
{{/decor.state}}
{{^decor.state}}
{{#override}}
@override
{{/override}}
{{#ret}}{{ret}} {{/ret}}{{name}}({{params}}){{#async}} async{{/async}} {
{{#decor.before}}
  {{decor.before.arg}}();
{{/decor.before}}
{{#decor.after}}
  try {
    {{body}}
  } finally {
    {{decor.after.arg}}();
  }
{{/decor.after}}
{{^decor.after}}
  {{body}}
{{/decor.after}}
}
{{/decor.state}}
