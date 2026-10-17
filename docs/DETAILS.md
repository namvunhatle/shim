# Shim: implementation notes and history

Android readiness checking and code generation for a selected **full Figma screen or individual component**. The existing parser → normalized `AndroidUISchema` → validator → Compose/XML pipeline is retained. No backend, AI, authentication, or runtime network access.

## Implementation reliability (0.5.0)

The native plugin now exports real leaf artwork and preserves overlays instead of feeding them into layout flow.

- **Artwork:** source image/vector leaves and leaf shapes with unsupported visual styles can be exported through Figma as 2× sRGB PNGs. The package includes binary `res/drawable-nodpi/` resources referenced by both generators. CRC, pixel dimensions, parent-relative render bounds and package limits are checked. Rotation/flips are baked only with verified bounds; masks, contextual blends and transformed ancestors remain explicit limitations. Export failures keep the original layer and diagnostics. Text, nested UI and whole screens are never flattened into images.
- **Layout:** a real Row/Column or LinearLayout remains inside an overlay Box/FrameLayout. Background and foreground order is preserved when the flow children form one contiguous block. End, center and stretch constraints map at bounded static/overlay boundaries. Unsupported interleaving, scale constraints or unbounded dependencies remain explicit.
- **Raster sizing:** image density does not change the logical size of Hug artwork. Baked padding/corners/effects are applied once. Ink outside an Auto Layout slot draws in a separate wrapper without enlarging that slot or pushing neighboring content. Saved schemas retain original bounds for regeneration.
- **Clipping and slots:** declared clipping maps in both outputs, including uniform rounded outlines. Nested Figma `SLOT` nodes are native containers, with their text and child hierarchy retained.
- **Reliability:** edits during artwork export invalidate the snapshot. Dynamic-page mode does not register a document-wide event handler or force unrelated pages to load. Binary files are exported as bytes and cannot be copied as code.

A captured real-world screen (not included in this repository) retains all **130 nodes**, includes **25 real artwork PNGs**, and has **0 critical generation topics** for both frameworks. It reports **Ready for Dev Review**, with one optional text-box review. This does not certify fonts, business logic, device behavior, or visual fidelity.

`npm run check` covers 66 deterministic tests. Actual AAPT2 resource linking and Kotlin/Compose compilation passed for A/B/C, the D artwork/overlay/outset fixture, and the captured Halloween implementation. Full Gradle APK assembly and ADB/device rendering were blocked by local socket permissions (`Operation not permitted`). The native capture was verified before the final leaf-style/outset extension; after that, the computer-control service returned `cgWindowNotFound`. Those final extensions are covered by fixtures and direct compilation; no further live or pixel-comparison result is claimed. See [verification/IMPLEMENTATION.md](verification/IMPLEMENTATION.md).

Close and reopen the development plugin after building; the header/connection should show **0.5.0**. The plugin still labels arbitrary exports **Not build verified**.

API references: [Figma export settings](https://developers.figma.com/docs/plugins/api/ExportSettings/), [SlotNode](https://developers.figma.com/docs/plugins/api/SlotNode/).

## Critical-first readiness (0.4.0 history)

Readiness answers what must change before developer review. It evaluates **Compose and XML Views separately**, using the same parsed schema and the actual capabilities of the existing generators.

- **Ready for Dev Review:** no confirmed critical or important designer-owned issue. Minor improvements may remain. This does not certify generated code.
- **Needs Attention:** a confirmed design concern or missing decision needs attention, such as zero-size text, explicitly overflowing text lines, or a declared tap trigger with no outcome.
- **Cannot Generate Reliably:** a critical generation gap would omit source content or materially change behavior. The UI separately shows whether design handoff needs attention and explains who should act.

Internally, P0 means critical, P1 important, P2 minor, and P3 informational. Only confirmed, high-impact designer fixes and decisions appear as primary actions. The first three actions are visible initially; the summary indicates every remaining critical action. Optional improvements, developer notes, generator limitations, and original technical observations start collapsed. Critical generator topics remain explicitly listed above those disclosures.

Routine font/theme mapping, insets, accessible hit areas, and implementing declared navigation belong to developer notes. Missing states are never inferred from a single component. Fixed dimensions, static positioning, clipping flags, nested frames, and unbound tokens do not automatically indicate a design defect. Speculative text scaling and cropping concerns remain optional.

Duplicate observations share an action topic, retaining all affected layer IDs, hierarchy paths, root references, and diagnostic objects. Each card provides Locate in Figma, guidance, and technical details. The full original report can always be restored after inspecting one topic. ZIP exports retain raw `issues`, both framework evaluations under `handoff.frameworks`, the occurrence-level impact audit, schema, and verification status.

At the 0.4.0 baseline, a captured real-world paywall screen had **130 nodes and 315 original observations**. Generic evaluation at that time yielded **0 required designer actions, 1 optional improvement, and 2 critical generator topics** for each framework: missing source artwork and overlays incorrectly placed into layout flow. It was **Cannot Generate Reliably**, with **Design handoff: Ready for Dev Review**. No outcome is hardcoded by screen identity. See a private capture (not included in this repository).

For that historical release, the connection/header showed **0.4.0**. Refresh selection can recover host state; startup errors and missing replies are displayed explicitly.

## Setup

Requires Node.js 20.19+, npm, Python 3 (XML verification tests), and Figma desktop for development-plugin import.

```sh
cd /Users/namvunhatle/Downloads/Plugin
npm ci
npm run check
```

Import `manifest.json` using **Figma → Plugins → Development → Import plugin from manifest…**, then run Shim. Build outputs are `dist/code.js` and self-contained `dist/ui.html`. The manifest contains a local development ID; use your Figma-assigned plugin ID if required for import and before publication. See the [Figma manifest documentation](https://developers.figma.com/docs/plugins/manifest/).

Select one Frame, Component, Instance, or Group. Choose **Full Screen** or **Individual Component**, then **Analyze selection**. Frames default to screen mode; components, instances and groups default to component mode. The choice is explicit and can be changed for any accepted root.

The overview reports total visible nodes, elements mapped to the supported subset, and partial/unsupported elements. Readiness presents the selected framework’s status and prioritized designer actions. Internal severities and passed checks remain in expandable technical details. Every issue names a real layer and includes an Android impact, resolution, and locate action. Select a generated file in the Compose/XML tabs, copy it, or export the complete ZIP.

**Analysis is a snapshot. Re-analyze after edits.** Export contains both implementations, XML resources, normalized schema, readiness report with passed checks, and verification status. Errors clear previous results; stale responses cannot reactivate exports for a changed selection or mode.

## Supported mapping

| Figma data | Compose | XML Views |
| --- | --- | --- |
| Nested Frames, Components, Instances, Groups | Nested containers; private composables for nested components/instances | Nested LinearLayout / FrameLayout |
| Vertical / horizontal Auto Layout | Column / Row | LinearLayout |
| Fixed-position containers | Box with physical absolute offsets | FrameLayout with physical margins |
| Fixed / Hug / Fill sizing | dp / wrap / fill or main-axis weight | dp / wrap_content / match_parent or weight |
| Padding, gap, alignment, per-child alignment, space-between | Modifiers / arrangement | Padding, margins, gravity, weighted spaces |
| Uniform text | Material3 Text | TextView and string/color resources |
| Solid fill, uniform rounded corners / inside border | Background / border shape | Shape drawable |
| Full ellipses | Oval path shape | Oval drawable |
| Explicit supported prototype scroll axis | verticalScroll / horizontalScroll | ScrollView / HorizontalScrollView |

Hierarchy is never globally flattened. Hidden nodes and their descendants are excluded; visible unsupported nodes retain their positions in the schema and generated hierarchy. Unsupported text retains its original characters in the schema and TODO comments. Invalid geometry identifies its node instead of silently substituting bounds. Figma getter-backed nodes are read directly.

Scroll generation requires a matching Auto Layout axis, bounded viewport, no main-axis Fill children or fixed/sticky children, and no nested same-axis scrolling. Unspecified scroll, two-axis scroll, and unsupported configurations are not guessed. Overflow alone never invents scrolling; potential content cropping is optional rather than a confirmed defect. Canvas presentation-mode automatic scrolling is not inferred.

In screen mode the root fills the host viewport; measured child sizes and layout intent are retained. This assumption appears in the schema/report. Component mode preserves root sizing. Unit mapping is explicitly 1 Figma px → 1dp and text px → 1sp. Auto Layout padding/alignment maps to logical start/end in both outputs; fixed positions remain physical coordinates. Confirm RTL behavior in the host app.

## Readiness scope

Actual data drives findings: out-of-bounds children, enabled clipping, fixed text bounds, finite typography/line height, supported fills/borders/shapes, declared prototype triggers, component/variant metadata, style/variable bindings, and explicit scrolling. Low contrast is checked only against an opaque immediate-parent solid fill; overlapping artwork is not analyzed. A small decorative shape is never labeled a small touch target merely because of its name. Touch-target warnings require a declared click/press/tap trigger.

Unknown requirements remain developer notes rather than confirmed design defects: Android font/theme mapping, image semantics and content descriptions, runtime interpretation of prototype actions, required states of observed components, and screen WindowInsets/safe-area policy. No click handlers, missing states, safe-area sizes, or business logic are invented.

Unsupported properties remain explicit limitations/TODOs rather than silently disappearing. Their implementation impact determines readiness, independently of legacy detector severities. Current limitations include:

- Artwork that cannot be exported faithfully (contextual masks/blends, transformed ancestors, failed exports, or image-filled containers with children): explicit placeholders remain. Supported leaves are native-rendered PNG assets; complex vectors are rasterized, not converted to VectorDrawable.
- Container gradients, multiple paints, effects, masks, mixed radii and advanced borders still need manual matching. Leaf artwork can bake many of these styles into PNGs; contextual effects remain limited.
- Mixed/invalid typography, custom font axes/features, decoration/case transformations, paragraph/list formatting, hyperlinks, truncation, and non-top text-box vertical alignment.
- Grid/wrapping Auto Layout, interleaved flow/overlay blocks, scroll overlays, baseline alignment, reversed stacking, negative gaps, min/max sizing, scale constraints and unbounded responsive relationships.
- Fixed/sticky and unsupported/nested scroll configurations. Declared non-scrolling clipping maps to Compose shape clipping and explicit XML child clipping; uniform rounded XML outlines use a background drawable and clipToOutline. Enabled clipping is no longer reported as a missing generator feature.

The parser preserves observed paints, effects, constraints, styles, image hashes, component/variant metadata, and relevant source properties for developer inspection. Detection is not claimed to cover every possible Figma property. An export with critical generation limitations is a **partial draft**. Enabled clipping and static layouts are not automatically treated as invalid designs simply because they require confirmation.

## Android integration

XML uses API **28+** for text weight/line height. Compose uses Material3. Generated Kotlin starts with `package shim.generated`; change that package and the `R` namespace for your app. Merge exported `res/` alongside the Kotlin file, particularly image placeholder resources referenced by Compose. Map licensed fonts, review the exported PNGs, and replace any remaining placeholders before judging fidelity. Generated resources use `dr_` names; rename when merging multiple independent exports to prevent collisions.

Arbitrary selections are labeled **Not build verified**. Fixture compilation does not make every plugin export production-ready. No Android rendering/comparison or APK/device test has been completed. The readiness UI, framework switching and locate action were exercised in the existing live Figma Beta development plugin. See [AUDIT.md](AUDIT.md) and [verification/RESULTS.md](verification/RESULTS.md) for evidence and limits.

## Deterministic fixtures and verification

`tests/fixtures.ts` contains focused valid/minor/critical/asset/framework-difference readiness cases as well as:

- **A:** Simple component with text and solid card background.
- **B:** Nested Auto Layout component containing a component instance.
- **C:** Full screen with header, group/oval/vector, image, explicit scroll viewport, content, text, nested cards, prototype button instance, and footer. The image, vector, gradient and shadow deliberately exercise unsupported-property reporting.

```sh
npm run check
node scripts/example.mjs
```

`npm run check` runs strict TypeScript, targeted tests, and the plugin build. Tests compare every visible source ID/parent relationship with the schema, inspect Kotlin structure, parse all generated XML, resolve local resource references, and compare XML node hierarchy (ignoring synthetic scroll wrappers/spacers). This is deeper than TypeScript compilation and does not claim visual fidelity. Generated examples are in [examples/a-simple](examples/a-simple), [examples/b-nested](examples/b-nested), and [examples/c-screen](examples/c-screen). The synchronous A/B/C examples intentionally have no native Figma exporter, so unavailable artwork remains a placeholder. D uses a deterministic PNG and explicit render bounds. The example script replaces only these designated generated output folders and `examples/pricing-card`.

Optional UI DOM/message verification uses JSDOM as an external test tool; it is not a plugin dependency:

```sh
npm install --prefix /tmp/shim-qa jsdom@29.1.1
SHIM_JSDOM=/tmp/shim-qa/node_modules/jsdom/lib/api.js node scripts/ui-smoke.mjs
SHIM_JSDOM=/tmp/shim-qa/node_modules/jsdom/lib/api.js node scripts/ui-boot-check.mjs
SHIM_JSDOM=/tmp/shim-qa/node_modules/jsdom/lib/api.js node scripts/readiness-ui-check.mjs
```

Critical-first UI checks also cover non-blocking minor warnings, visible generation blockers, top-three action disclosure, framework/code-tab synchronization, and 130 searchable/locatable references. This checks the built host/UI handshake, component and screen analysis, null-source host messages, mode changes, issue navigation, code/resource tabs, clipboard path, ZIP download, stale-result rejection, and error/empty-selection states. It does not render pixels or exercise the actual Figma host.

Optional Android fixture project generation and offline Gradle build:

```sh
SHIM_GRADLE=/path/to/gradle-8.9/bin/gradle npm run verify:android
```

The isolated A/B/C/D `.android-verification/` project pins AGP 8.7.3, Kotlin/Compose compiler 2.0.21, Compose 1.7.5, Material3 1.3.1, compile SDK 35 and min SDK 28. Requires those dependencies already cached because the command uses `--offline`. Set `ANDROID_SDK_ROOT` and `JAVA_HOME` for your installation. The fixture generator replaces only generated module source directories.

Here the Gradle daemon could not bind its local socket under the sandbox. Direct fixture compilation succeeded using the installed Android SDK and cached Kotlin/Compose libraries:

```sh
node scripts/android-fixtures.mjs --prepare-only
python3 scripts/android-direct.py
```

The direct script is a local-cache verification helper, not a dependency installer or APK builder. It requires the documented cached versions (plus compiler runtime dependencies), macOS Java discovery or `JAVA_HOME`, AAPT2 34.0.0 and android-35. It runs AAPT2 compile/link, compiles generated `R.java`, and compiles actual Kotlin with the Compose compiler. Each run clears prior direct outputs/results. It writes `.android-verification/direct-results.json` only after all selected fixture compilations pass. To verify the saved native handoff, run `python3 scripts/import-android-handoff.py verification/halloween-v0.5.0.zip`, then `python3 scripts/android-direct.py --handoff`. Source hashes are recorded.

## Modules

The existing source modules remain: `parser.ts`, `schema.ts`, `validator.ts`, `compose.ts`, `xml.ts`, `pipeline.ts`, `main.ts`, and `ui.*`. ZIP generation and build tooling are retained. New work extends these modules with regression/screen tests and focused verification scripts; it does not introduce a new application stack.
