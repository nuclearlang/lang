{{decorators}}describe('{{name}}', () => {
  beforeEach(async () => {
    await SynapsisTest.start(synapsisConfig(), registerSynapsis);
{{#decor.mock.items}}
    SynapsisTest.mock({{.}});
{{/decor.mock.items}}
  });

  // a screen a test rendered leaves the page before the next test
  afterEach(() => {
    cleanup();
  });

  {{members}}
});
