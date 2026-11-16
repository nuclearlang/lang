# Decisions of the MCP server

Cited as `ADR-mcp-NNNN`. The format is `docs/03-adr/0000-template.md` of the tree's root. An accepted ADR is not
edited: a new one replaces it and the old one is marked `superseded by ADR-mcp-NNNN`.

No decision has been recorded here yet. The decisions that created the server are kept by other projects:

| Decision | What it says of the server |
|---|---|
| `ADR-platform-0003` | The AI loop: one MCP server for every client, beside the private knowledge base, the local agents and the pipeline tool |
| `ADR-codegen-0001` | The server exposes the generators and what a model needs to fill them (`project_inspect`, `generate_*`, `api_inspect`, `web_search`, `web_read`), and tells every client to generate first |

The server installed alone on a machine of remote agents only, without the `graph_*` and `developer_*` tools:
ADR-installer-0002.

A decision cited by its old platform-wide number (`ADR-00NN`, in code or commits before 2026-11-16): see
[the table of old numbers](../../../../docs/03-adr/old-numbers.md).
