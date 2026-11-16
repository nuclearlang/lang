// The base of the runtime. The optional parts are their own entry points, imported only by the projects whose
// config.nuc enables their plugin: 'synapsis-nest/ai' (LangChain.js, LangGraph.js), 'synapsis-nest/events'
// (Kafka, Redis), 'synapsis-nest/testing' (the generated tests: @nestjs/testing is a dev dependency).
export * from './result.js';
export * from './errors.js';
export * from './config.js';
export * from './repository.js';
export * from './http.js';
export * from './web.js';
export * from './app.js';
