# Changelog

## Unreleased — 2026-10-18

### Better Android handoff

- Include a native 1× Figma reference PNG (`reference/figma.png`) in new plugin exports so developers can compare the intended design with Android runtime screenshots. The manifest records capture time, pixel dimensions, and bounds policy.
- Add `HANDOFF.md` with integration steps, font/theme mapping responsibilities, and runtime verification guidance.
- Add `handoff-tasks.json`: per-framework tasks with priority, owner, evidence, generation blockers, and affected Figma layer IDs.
- Add `handoff-manifest.json`: source selection, file inventory, reference metadata, and verification limits.
- Use the same export contract in the plugin panel and offline regeneration script. Regeneration preserves an existing reference PNG and its original capture metadata; legacy captures without screenshots remain explicitly marked unavailable.

### Snapshot reliability

- Detect source hierarchy changes during artwork export and reference capture and reject the result instead of combining inconsistent snapshots.
- Validate reference PNG integrity, dimensions, and export limits (16 megapixels / 8 MB).
- Keep generated code available when reference capture fails, with an explicit explanation in the panel and exported report.

### Optional local MCP adapter

- Add a read-only stdio adapter for an extracted handoff directory: inspect readiness, find layers by ID/name, and read generated text files.
- Restrict reads to the configured directory, reject path traversal and symlink escapes, and omit embedded artwork bytes from layer search results.
- The adapter is optional: agents with filesystem access can read the export directly. It does not connect to the live Figma canvas and is not automatically configured in any client.

### Validation and limits

- `npm run check` passes type checking, 71 deterministic tests, one MCP subprocess integration test, and the plugin build.
- Tests cover screenshot packaging, native host export settings, failed captures, source edits during capture, and filesystem boundaries. Offline ZIP regeneration was also checked for byte-for-byte reference/metadata preservation and valid ZIP checksums.
- Verification used synthetic fixtures. No new live Figma-to-Android app integration or runtime visual comparison was performed. Generated Android code remains a draft, not build verified.

## Previous baseline — 0.5.0

- Analyze a Figma selection for Android handoff readiness separately for Compose and XML Views.
- Group actionable findings by cause and responsibility, with navigation to affected layers.
- Export draft Compose/XML, Android resources, 2× leaf artwork, source schema, and readiness diagnostics in one ZIP.
