---
status: approved
owner: Julian Molina
updated: 2026-11-20
related: [requirements.md, design.md, ../../../tools/mcp/docs/08-guides/mcp.md]
---
# Spec 022 — What an agent can do through the MCP server

Requirement 9. The list of what an agent does through `nuclear-mcp`, what it cannot and where that is done instead
is the MCP guide's section 4, ["What the editor does and this server does not"](../../../tools/mcp/docs/08-guides/mcp.md#4-what-the-editor-does-and-this-server-does-not):
an installed agent reads it with `nuclear_doc("mcp")`, which a file of this tree never reaches (root rule 14). A row
is updated there in the change that adds the tool.
