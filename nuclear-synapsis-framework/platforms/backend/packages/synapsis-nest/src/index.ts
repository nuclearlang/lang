// The base of the runtime. The optional parts are their own entry points, imported only by the projects whose
// config.nuc enables their plugin: 'synapsis-nest/ai' (LangChain.js, LangGraph.js), 'synapsis-nest/events'
// (Kafka, Redis), 'synapsis-nest/testing' (the generated tests: @nestjs/testing is a dev dependency).
export * from './result.js';
export * from './errors.js';
export * from './model.js';
// (not the class BigDouble: the generated code writes its own in each file that uses it)
export {
  BIGINT_MAX, BIGINT_MIN, IsBigDouble, IsBigInt, MaxExact, MinExact, PRECISION, SCALE, columnText, exactColumn, exactText, fitsBigDouble,
  isBigDouble, parseBigDouble, parseBigInt, type Decimalish,
} from './exact.js';
export * from './config.js';
export * from './repository.js';
export * from './http.js';
export * from './guards.js';
export * from './web.js';
export * from './app.js';
