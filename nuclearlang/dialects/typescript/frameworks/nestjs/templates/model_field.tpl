{{#optional}}
@IsOptional()
{{/optional}}
{{#tinfo.is.string}}
@IsString({{#tinfo.list}}{ each: true }{{/tinfo.list}})
{{/tinfo.is.string}}
{{#tinfo.is.int}}
@IsWhole({{#tinfo.list}}{ each: true }{{/tinfo.list}})
{{/tinfo.is.int}}
{{#tinfo.is.bigint}}
@IsBigInt({{#tinfo.list}}{ each: true }{{/tinfo.list}})
{{/tinfo.is.bigint}}
{{#tinfo.is.bigdouble}}
@IsBigDouble({{#tinfo.list}}{ each: true }{{/tinfo.list}})
{{/tinfo.is.bigdouble}}
{{#tinfo.is.double}}
@IsNumber({{#tinfo.list}}{ each: true }{{/tinfo.list}})
{{/tinfo.is.double}}
{{#tinfo.is.number}}
@IsNumber({{#tinfo.list}}{ each: true }{{/tinfo.list}})
{{/tinfo.is.number}}
{{#tinfo.is.boolean}}
@IsBoolean({{#tinfo.list}}{ each: true }{{/tinfo.list}})
{{/tinfo.is.boolean}}
{{#tinfo.is.DateTime}}
@IsDateTime({{#tinfo.list}}{ each: true }{{/tinfo.list}})
{{/tinfo.is.DateTime}}
{{#tinfo.list}}
@IsArray()
{{/tinfo.list}}
{{#tinfo.model}}
@ValidateNested({{#tinfo.list}}{ each: true }{{/tinfo.list}})
@Type(() => {{tinfo.item}})
{{/tinfo.model}}
{{#decor.required}}
@IsNotEmpty({{#decor.required.message}}{ message: {{decor.required.message}} }{{/decor.required.message}})
{{/decor.required}}
{{#decor.email}}
@IsEmail()
{{/decor.email}}
{{#decor.url}}
@IsUrl()
{{/decor.url}}
{{#decor.minLength}}
@MinLength({{decor.minLength.arg}})
{{/decor.minLength}}
{{#decor.maxLength}}
@MaxLength({{decor.maxLength.arg}})
{{/decor.maxLength}}
{{#decor.min}}
{{#tinfo.is.bigint or tinfo.is.bigdouble}}@MinExact({{decor.min.arg}}){{/tinfo.is.bigint or tinfo.is.bigdouble}}{{^tinfo.is.bigint or tinfo.is.bigdouble}}@Min({{decor.min.arg}}){{/tinfo.is.bigint or tinfo.is.bigdouble}}
{{/decor.min}}
{{#decor.max}}
{{#tinfo.is.bigint or tinfo.is.bigdouble}}@MaxExact({{decor.max.arg}}){{/tinfo.is.bigint or tinfo.is.bigdouble}}{{^tinfo.is.bigint or tinfo.is.bigdouble}}@Max({{decor.max.arg}}){{/tinfo.is.bigint or tinfo.is.bigdouble}}
{{/decor.max}}
{{#decor.key}}
@Expose({ name: {{decor.key.arg}} })
{{/decor.key}}
{{#decor.pattern}}
@Matches({{decor.pattern.arg}})
{{/decor.pattern}}
{{name}}{{#optional}}?{{/optional}}{{^optional}}{{^default}}!{{/default}}{{/optional}}: {{type}}{{#default}} = {{default}}{{/default}};
