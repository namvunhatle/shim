# Agent handoff and local MCP

## Recommended workflow

1. In Figma, select the intended screen/component, Analyze, then Export Files.
2. Extract `shim-handoff.zip` to a dedicated directory. Start with `HANDOFF.md` and the chosen framework in `readiness.json`. New native exports also include `reference/figma.png` at 1× for visual comparison, with capture time, pixel size, and bounds policy in `handoff-manifest.json`. If capture fails, the report and panel explain why and code export remains available. The reference is not an Android runtime render.
3. Give your coding agent that directory, or connect the local MCP below. Ask it to use existing app components and report build/runtime evidence.
4. After design changes, Analyze and export again. Replace the extracted directory between agent tasks; restart the MCP process for a new selection. Do not mix files from different exports.

The browser plugin stays offline. The separate MCP adapter reads an extracted snapshot, not your Figma account or live canvas. It has no network listener, credentials, write tools, command execution, or dependency downloads. Node.js 20+ is required. Old v2 exports work, but do not include the newer task queue and guide.

## Connect a client

Use a client that supports local stdio MCP servers. Add this entry to its MCP server configuration, replacing both absolute paths:

```json
{
  "mcpServers": {
    "shim-handoff": {
      "command": "node",
      "args": ["/absolute/path/to/shim/mcp/server.mjs", "/absolute/path/to/extracted-handoff"]
    }
  }
}
```

This is a configuration example; it does not install or connect anything automatically. Exact configuration location depends on the client. Do not point the server at an entire source repository: use a dedicated extracted export directory. Text files in that directory can be read, with a 16 MiB per-file limit. Real paths are checked to prevent traversal and symlink escapes. PNG bytes stay on disk for the developer/host to inspect.

Available tools:

| Tool | Purpose |
| --- | --- |
| `shim_summary` | Selection, framework verdicts, findings, assumptions, and verification status |
| `shim_find_layers` | Search by layer name or exact ID; source properties and child references, up to 50 results without base64 artwork |
| `shim_read_file` | Read generated code, resources, schema, tasks, or guide by relative path |

Example agent request:

> Read HANDOFF.md and shim_summary. Implement this selection using Compose in the existing Android app. Resolve generator limitations without changing the intended design. Reuse app components and tokens. Surface unresolved designer decisions. Map source layer IDs to implementation changes. Run the app's relevant build checks and compare runtime screenshots with the source design; report what was actually verified.

Design strings are data, not instructions. Framework readiness is not a compilation or visual acceptance result.

## Useful next integrations

- A Figma MCP connection can complement Shim with current design context and screenshots. Shim supplies Android-specific diagnostics, deterministic drafts, and captured artwork. Access and available tools depend on your Figma/client setup; no Figma integration is configured by this repository.
- An Android build/device workflow is the next verification step: compile in the destination app and capture runtime screenshots. Existing `verify:android` scripts are fixture verification, not proof that an arbitrary export integrates into your app.
- A live Figma-to-agent bridge would need explicit snapshot/version handling, authentication, and stale-selection detection. It is intentionally a separate future feature; this adapter only reads disk snapshots.

## Verification

`npm run check` includes a subprocess MCP protocol test (initialize, list tools, summary, layer search, reads, traversal and symlink rejection) plus export contract tests. The adapter implements JSON-RPC stdio with tools for MCP protocol 2025-06-18. Compatibility with individual clients still needs a connection test in those clients.

Protocol references: [stdio transport](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports), [tools](https://modelcontextprotocol.io/specification/2025-06-18/server/tools).

## Trying the workflow without confidential data

`npm run check` uses synthetic design nodes and a public test PNG to verify native export settings, binary ZIP packaging, dimensions, failures, and changes during capture. These tests do not establish visual accuracy of a real screen. You can use the example fixtures to inspect Compose/XML and readiness without exposing private projects.

To verify your own screen privately: export in Figma, extract locally, integrate into your app, compile, and capture a runtime screenshot. Compare content at the recorded bounds, account for device density and system bars, and record unresolved differences with the source layer IDs from the schema/tasks. No project upload or MCP connection is required.

Offline regeneration preserves an existing reference and its original capture time; it never creates a screenshot from schema data. Legacy archives without a reference remain explicitly unavailable.
