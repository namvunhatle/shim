# Shim reliability audit and screen extension

The existing project was inspected and extended in place. No backend, runtime dependencies or replacement application framework were introduced.

## Reproduced original problems

1. **Mixed typography could crash all analysis.** The parser detected `figma.mixed` but still multiplied a Symbol font size by percentage line height/letter spacing. A new regression test failed with `TypeError: Cannot convert a Symbol value to a number` before the fix. Mixed/incomplete metrics now create a layer-linked blocker and bounds-preserving placeholder, retain original text, and never fabricate a 14sp/400 font.
2. **Startup depended on an unacknowledged iframe message.** No ready/request-state handler existed. A simulated host that discarded early messages did not recover. Figma documents queuing initial host messages until the iframe loads, so this simulation alone does not establish a live Figma startup race. A new test dropped the early message and proved there was no recovery. The UI now requests state after installing its listener; the host answers `ready`. Parent and null-source bridge messages are covered by the DOM integration check. A live Figma source-message trace was unavailable, so the specific runtime occurrence is not claimed as observed.
3. **Nested Group/Instance mappings were incomplete.** Both were classified as unsupported rather than layout containers; the root selection gate rejected them. They now preserve their hierarchy, basic layouts and instance metadata. Nested components/instances generate private Compose functions with parent-scope modifiers applied at call sites.
4. **Validation/generation omitted relevant layout intent.** No explicit scroll mapping, instance metadata, screen viewport mode, per-child alignment, usable overview or needs-confirmation category existed. Static responsive constraints were blanket blockers even in Auto Layout, and the root Hug/Fill exception needed mode-aware handling. Mappings and targeted regression coverage now distinguish these cases.
5. **Error handling could expose stale output.** Re-analysis did not clear previous files, generic errors left previous export enabled, and messages had no request ID. Selection/mode changes and analysis failures now invalidate output; stale responses are ignored. Locate failures do not unnecessarily erase an otherwise valid analysis.
6. **Coverage was narrower than prior completion wording.** Earlier tests used plain component fixtures and output substrings; they did not exercise full-screen hierarchy, the built UI/host bridge, XML reference integrity or Android compilation. New tests and compiler checks provide those specific forms of evidence, with live/rendering limits recorded separately.

The simple component pipeline passed all 15 then-current tests, strict TypeScript, and plugin build **before** full-screen parser/generator expansion began.

## What changed

- `src/parser.ts`, `src/schema.ts`: explicit screen/component mode; Frame/Component/Instance/Group traversal; 10,000-layer / 100-level safety bounds; real node diagnostics; finite metrics; legacy sizing mapping; per-child alignment; scroll eligibility; image, effects, constraints, prototype, styles/variables and source metadata. Every visible node remains represented, including unsupported content.
- `src/validator.ts`: layer-linked impact/resolution, needs-confirmation findings, overflow/clipping/scroll checks, actual-trigger touch-target checks, font/line-height/accessibility checks, state/theme/insets confirmations and scoped passed checks.
- `src/compose.ts`, `src/xml.ts`: screen roots, hierarchy-preserving containers, reusable nested Compose parts, explicit scroll containers, consistent sizing/alignment, oval backgrounds, placeholder resources, safe literal/comment handling and source-node mapping comments.
- `src/main.ts`, `src/ui.ts`, `src/ui.html`, `src/pipeline.ts`: ready handshake, request IDs, mode selection, invalidation/error states, overview, report categories, impact/resolution/locate affordances and complete export metadata.
- `tests/fixtures.ts`, `tests/pipeline.test.ts`, `tests/regression.test.ts`, `tests/screen.test.ts`: A/B/C fixtures, regression and hierarchy/structural checks.
- `scripts/test.mjs`, `scripts/example.mjs`, `scripts/verify-xml.py`, `scripts/ui-smoke.mjs`, `scripts/android-fixtures.mjs`, `scripts/android-direct.py`: deterministic fixture generation and focused verification. Generated directories are cleaned before checks to prevent stale resource/class files from hiding errors.
- `package.json`, `package-lock.json`, `.gitignore`, `README.md`, `AUDIT.md`, `verification/`, `examples/`: version, verification commands, documentation and inspectable output. Plugin manifest, ZIP implementation, and existing bundler architecture are retained.

## Unsupported / unverified

Source image extraction/cropping, complex vectors, gradients/effects, advanced text/visual/layout properties, responsive non-Auto-Layout constraints, and unsupported scroll configurations remain explicit blockers/placeholders. Prototype business logic, required state sets, accessibility descriptions, font/theme mapping and WindowInsets require confirmation rather than invented behavior.

Compilation is not rendering. Full Gradle APK build is blocked by the environment's daemon socket restriction. The Figma Desktop Bridge was disconnected, so no live Figma execution/import/viewport or host clipboard/download test is claimed. See [verification/RESULTS.md](verification/RESULTS.md) for exact executed checks.

## Follow-up: inactive UI (0.2.1)

The user reported the UI remaining at the default selection prompt. Live console access was unavailable. A test with a distinct host-relay MessageEvent source reproduced the disabled Analyze state: the UI rejected the valid pluginMessage envelope because the source was neither parent nor null. Removed that unsupported identity assumption and validated the envelope instead, matching the official Figma messaging pattern. This reproduces a mechanism for the symptom, not a confirmed live trace from the user's Figma session.

Added versioned connection status, a Refresh selection action, a host-response timeout, independent startup/unhandled-error reporting, and responsive empty code tabs. The built HTML is now tested with actual inline-script execution, not only manual eval: relay selection enables Analyze; absent host replies show retry instructions; synthetic script failure displays its exact error. All 29 existing tests and the full UI DOM/message test also pass. Android generation is unchanged by this patch.

## Readiness UX 0.3.0

A new `readiness.ts` presentation model groups stable validation rule IDs by designer action and responsibility, keeping raw diagnostics immutable. `readiness-ui.ts` renders a handoff status, prioritized next step, Fix in Figma / Needs Your Decision / Generation Limitations disclosures, complete searchable affected layers, and technical detail expansions. `validator.ts` only gains rule IDs; its conditions, severity logic, explanations and generation flow are preserved. `main.ts` adds safe locate-many support without changing selection or discarding a report; stale/missing layer lookup reports an error instead of silently skipping nodes.

Not Ready is based on exact unusable dimensions of text or an explicit tap target, not raw severity or number of findings. Ambiguities remain decisions, and generator feature gaps remain generator limitations. Ready is scoped to design handoff under the available checks, never Android build verification.

The live Figma Beta screen displayed 315 original findings before the redesign and 17 grouped topics afterward (1 fix, 7 decisions, 9 limitations). All 315 diagnostics remain accessible. Tests and evidence are listed in verification/RESULTS.md.

## Critical-first vNext (0.4.0)

The 0.3.0 grouping reduced rows without correcting evaluation: routine per-layer confirmations still became designer decisions, any decision forced Needs Review, and material generator omissions did not affect the headline. Generic clipping flags also ignored whether any content escaped and whether XML already supplied clipping.

The smallest change is an impact evaluator in `src/readiness.ts`, plus its renderer and existing UI integration. Raw validator conditions remain intact. Each observation receives P0–P3 impact and ownership per framework. Only confirmed P0/P1 designer fixes/decisions enter the primary list. Potential concerns and minor suggestions do not block handoff. Unknown rules remain visible technical observations without manufacturing a confirmed defect. Root/action grouping retains every original diagnostic and affected path; confirmed evidence cannot be downgraded by an earlier potential occurrence.

Contextual checks inspect actual content, viewport bounds, explicit scrolling and generator behavior. XML default rectangular clipping is distinguished from Compose’s missing clipping and from intentional Figma overflow. Missing source artwork, unsupported content-bearing layout/scroll behavior and flow-changing overlays are explicit generation risks; fonts, app insets, expanded hit areas, themes and wired interactions are developer responsibilities. No requirements are inferred from names or a single component variant.

The main UI shows the selected framework’s verdict, separate design-handoff verdict where generation fails, at most three primary actions initially, remaining critical counts, and a persistent list/count of critical generation topics. Optional improvements and developer/generator details are collapsed. Original technical details can be restored after inspecting one topic. Exports retain both framework evaluations and raw observations. Main host changes only the release version; parser, schema, validator, XML and Compose source are unchanged in this iteration.

Changed files: `src/readiness.ts`, `src/readiness-ui.ts`, `src/ui.ts`, `src/ui.html`, `src/main.ts` (version); readiness fixtures/tests including the captured Halloween schema; three existing UI verification scripts; package version/lock, generated `dist/` and example reports; README, this audit and verification evidence. No dependencies were added.

See the current verification section for executed results. Earlier audit sections describe historical releases and their historical limitations.

## Implementation reliability 0.5.0

The next audit followed actual source generation rather than changing readiness labels. Artwork had no native export step and OutputFile/ZIP assumed UTF-8 text; absolute children entered Row/Column flow; SLOT was treated as a visual placeholder despite preserved children; Compose omitted clipping and XML did not explicitly preserve intentional overflow. Native Figma testing also exposed the dynamic-page documentchange restriction; that subscription was removed in favor of snapshot comparison.

`assets.ts` adds validated native PNG transport. `capabilities.ts` centralizes supported overlay/anchor decisions and captured-schema reconciliation. The existing parser adds SLOT container support; schema gains optional asset metadata and binary encoding; pipeline/main add asynchronous export without replacing the parser/validator/generator architecture. Compose/XML now reference real artwork, separate overlay flow, map bounded anchors, apply clipping, and preserve layout slots around baked visual outsets. PNG appearance is not applied twice and Hug images retain logical dimensions. ZIP/UI handle binary resources. The validator's clipping diagnostic and image-accessibility wording were corrected to reflect actual generated behavior.

Focused regressions cover failures, sizing, source hierarchy, drawing order, source bytes, anchors, outsets, snapshot edits and current generation of a real saved capture. The live Halloween capture contains 25 PNGs and no critical generation topics, and its actual resources/Kotlin compile. Expanded leaf-style/outset changes are fixture/compiler checked; subsequent native-window control failed with cgWindowNotFound. Gradle and ADB socket permissions prevented APK/render verification. See verification/IMPLEMENTATION.md for exact evidence and remaining scope.

Files changed in this iteration: src/assets.ts, capabilities.ts, parser.ts, schema.ts, figma.d.ts, pipeline.ts, main.ts, compose.ts, xml.ts, validator.ts, readiness.ts, zip.ts, ui.ts and ui.html; tests/generation-next.test.ts, fixtures.ts, readiness.test.ts, regression.test.ts, screen.test.ts and fixtures/artwork.png; the existing UI/Android verification scripts plus import-android-handoff.py and refresh-handoff.mjs; package version/lock, generated examples/dist and documentation/evidence. No project dependency was added.
