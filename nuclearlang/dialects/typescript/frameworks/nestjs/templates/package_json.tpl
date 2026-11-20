{
  "name": "{{project|kebab}}",
  "version": "{{app.version|json}}",
{{#app.description}}
  "description": "{{app.description|json}}",
{{/app.description}}
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "start": "node dist/src/main.js",
    "dev": "tsc -p tsconfig.json && node --enable-source-maps --watch dist/src/main.js",
    "test": "node -e \"require('node:fs').rmSync('dist/test', { recursive: true, force: true })\" && tsc -p tsconfig.json && node --import ./dist/src/test_env.js --test \"dist/test/**/*.js\""
  },
  "dependencies": {
    "@nestjs/common": "^12.0.0",
    "@nestjs/core": "^12.0.0",
    "@nestjs/platform-express": "^12.0.0",
    "@nestjs/sequelize": "^12.0.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.15.1",
    "synapsis-nest": "^0.1.0",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.2",
    "sequelize": "^6.37.0",
    "sequelize-typescript": "^2.1.6"{{#plugins.packages}},
    "{{name|json}}": "{{version|json}}"{{/plugins.packages}}{{#dependencies}},
    "{{name|json}}": "{{#path}}file:{{path|json}}{{/path}}{{^path}}{{version|json}}{{/path}}"{{/dependencies}}
  },
  "devDependencies": {
    "@nestjs/testing": "^12.0.0",
    "@types/node": "^24.0.0",
    "sqlite3": "^6.0.0",
    "typescript": "^5.9.0"
  },
  "allowScripts": {
    "sqlite3": true
  }
}
