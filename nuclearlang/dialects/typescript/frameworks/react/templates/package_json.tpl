{
  "name": "{{project|kebab}}",
  "version": "{{app.version|json}}",
{{#app.description}}
  "description": "{{app.description|json}}",
{{/app.description}}
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -p tsconfig.json && vite build",
    "build:embed": "tsc -p tsconfig.json && vite build -c vite.embed.config.ts",
    "preview": "vite preview",
    "test": "vitest run --passWithNoTests"
  },
  "dependencies": {
    "synapsis-web": "^0.1.0",
    "react": "^19.3.0",
    "react-dom": "^19.3.0",
    "react-router": "^7.18.0"{{#plugins.packages}},
    "{{name|json}}": "{{version|json}}"{{/plugins.packages}}{{#dependencies}},
    "{{name|json}}": "{{#path}}file:{{path|json}}{{/path}}{{^path}}{{version|json}}{{/path}}"{{/dependencies}}
  },
  "devDependencies": {
    "@testing-library/react": "^16.3.0",
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0",
    "jsdom": "^28.0.0",
    "typescript": "^5.9.0",
    "vite": "^7.3.0",
    "vitest": "^4.1.0"
  }
}
