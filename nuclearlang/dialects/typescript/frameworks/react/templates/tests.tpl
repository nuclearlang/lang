{{decorators}}describe('{{name}}', () => {
  beforeEach(async () => {
    await SynapsisTest.start(synapsisConfig(), registerSynapsis);
{{#decor.mock.items}}
    SynapsisTest.mock({{.}});
{{/decor.mock.items}}
  });

  {{members}}
});
