# Current verification — Shim 0.5.0

- `npm run check`: **66 passed**, strict TypeScript and plugin bundles passed.
- Three built-host/UI scripts passed: startup/relay recovery, component and screen analysis, actual binary artwork ZIP bytes, copy controls, framework/resource tabs, selection invalidation, grouped locate/search and diagnostic restoration.
- AAPT2 compile/link and actual Kotlin/Compose compiler passed for **A/B/C/D/H**. D covers native layout plus bitmap outsets and responsive overlay anchors. H uses the real captured Halloween package, including 25 source PNGs. SHA-256 comparison confirms every delivered H Kotlin/resource file matches the compiled files.
- Native Figma Beta capture: 130 nodes, 25 artwork PNGs, no missing-artwork or overlay-flow generation blocker, Ready for Dev Review independently for Compose and XML, one optional text-box review. 259 original detector observations remain available. The archive was then regenerated with current rules without inventing artwork.
- Later native-window access failed with `cgWindowNotFound`; expanded leaf-style baking/outset changes were fixture/compiler tested, without a further live capture claim.
- Full Gradle assemble and ADB runtime/render checks were attempted but socket creation was denied (`Operation not permitted`). **No APK/device or Android visual-comparison verification is claimed.**

Artifacts and reproduction: [IMPLEMENTATION.md](IMPLEMENTATION.md), [delivered package](halloween-v0.5.0.zip), [compiler evidence](android-implementation-results.json), [Halloween summary](halloween-implementation-v050.json).

# Historical verification — Shim 0.4.0

- `npm run check`: **47 tests passed**, strict TypeScript and bundled plugin build passed. This retains all 29 parser/generator regressions and adds 18 focused readiness/navigation cases.
- Focused fixtures cover a valid screen, minor-only warnings, critical zero-size text, unsupported source artwork, explicit multiline overflow, real incomplete tap actions, generic unknown observations, scroll-boundary context, and framework-specific clipping in both directions. Confirmed group evidence cannot be downgraded by an earlier uncertain occurrence. Coexisting design and generator problems remain explicit.
- Built host/UI integration: startup recovery, component/full-screen analysis, stale response invalidation, failure/empty selection, resources, copy path, locate and ZIP export passed. Built HTML startup tests cover relayed messages, missing host and visible script failures.
- Critical-first DOM integration: Ready / Needs Attention / Cannot Generate Reliably, minor-only nonblocking readiness, independent design/generation verdicts, Compose/XML tab synchronization, first 3 of 5 actual designer actions and reveal-all, visible critical generator counts, collapsed secondary sections, 130 searchable/locatable layer references, diagnostic restoration and export passed. JSDOM was supplied externally; no plugin dependency was added.
- Real Figma Beta development plugin: analyzed **Home-Auto · Yearly selected**, 130 nodes. Both framework tabs show **Cannot Generate Reliably**, **Design handoff: Ready for Dev Review**, **1 optional improvement**, and **2 critical generation limitations**. Opening the generation section and locating its 28 artwork references changed the viewport while retaining the screen report and enabled export. The summary and expanded cards were visually inspected in the native app. No source design layers were edited.
- The real Halloween baseline was exported read-only from the existing plugin, then captured as `tests/fixtures/halloween-paywall.json`. Current generic rules retain all **315** observations and their per-framework impact audit. Renaming the screen does not change its verdict/actions. Byte-for-byte SHA-256 comparison passes for **every generated Kotlin/XML/resource file** against the baseline. See [halloween-readiness-vnext.json](halloween-readiness-vnext.json).
- Parser / Compose / XML source hashes match the pre-overhaul hashes. Existing A/B/C hierarchy and XML-resource structural checks pass. This release makes no generator changes and does not claim a new Android compile/build or visual-fidelity verification.

Halloween’s two critical generator topics are source artwork replaced with placeholders (28 layers) and overlay children inserted into layout flow (9 layer references including affected parents). The report preserves all other details without turning them into mandatory design cleanup. Counts are observations of this captured screen, not policy thresholds or hardcoded expectations.

**Not build verified:** arbitrary exports and the Halloween screen have not been compiled as an Android app or rendered/compared. Earlier A/B/C direct compiler evidence appears below; it does not certify these exports. No timed five-second usability study was performed. Typography mapping, assets, advanced layouts/visuals, and runtime app behavior still require developer review.

## Historical verification — Shim 0.2.0


These results apply to the checked-in deterministic examples generated by the current code. They do not certify arbitrary Figma selections or visual fidelity.

| Check | Result | Scope |
| --- | --- | --- |
| `npm run typecheck` | Passed | Strict TypeScript source and tests |
| `npm test` | 29 passed, 0 failed | Parser, validators, generators, host handshake, regression and screen fixtures |
| `npm run build` | Passed | Bundled Figma host script and self-contained UI |
| A / simple component | 2/2 visible nodes preserved; 0 blockers | 2 supported elements; original parent relationships retained |
| B / nested component | 5/5 visible nodes preserved; 0 blockers | Instance / Auto Layout hierarchy retained; 5 supported elements |
| C / full screen | 23/23 visible nodes preserved | 19 supported elements, 4 partial/unsupported elements, 4 blockers, 1 warning, 18 needs-confirmation findings, 31 passed checks |
| XML structure / resources | Passed A/B/C | Standard XML parser, local resource reference resolution, exact source-ID/parent hierarchy; synthetic wrappers ignored |
| Kotlin structure | Passed A/B/C | Balanced Kotlin structure and every source layer represented |
| UI DOM + built host/message bridge | Passed | Ready handshake (early selection deliberately dropped), parent/null-source dispatch, A/C analysis, mode changes, overview, issue locate, code/resource tabs, copy, ZIP, stale results, failure and empty-selection invalidation |
| UI-export ZIP | Passed | Standard ZIP CRC check, 23-node schema/report, implementations and both placeholder drawables present |
| AAPT2 34.0.0 compile + link | Passed A/B/C | Actual generated XML/resources linked against android-35; generated R.java compiled with javac |
| Kotlin 2.0.21 + Compose compiler | Passed A/B/C | Actual generated source compiled against Compose 1.7.5 / Material3 1.3.1 and generated R classes; includes screen weights, scroll, oval and image placeholder references |
| Offline Gradle assembleDebug | Could not complete | Sandbox denied daemon socket bind: `java.net.SocketException: Operation not permitted` |
| APK / device build | **Not build verified** | No completed Gradle/APK package or device test |
| Live Figma plugin import / execution | Not tested | Figma Desktop Bridge reported no active connection |
| Android or UI pixel rendering / comparison | Not tested | No visual-fidelity claim |

A/B have zero blockers, but font mapping and component/state requirements still need confirmation. C intentionally contains unsupported image artwork, complex vector, shadow, and gradient; those four real nodes each have an explicit blocker. Its touch-target warning comes from the 40dp-high instance with a declared ON_CLICK prototype reaction, not its name. The schema retains source image hash, gradient stops, effect parameters, instance variants, and prototype action details.

The full-screen root uses a declared host-viewport-fill assumption. Unsupported artwork is not claimed to match the source image. Neither successful resource linking nor Kotlin compilation establishes runtime scroll measurement, font metrics, accessibility completeness, responsiveness or visual fidelity.

Machine-readable direct compilation evidence: [android-direct-results.json](android-direct-results.json). Reproduction commands and prerequisites are in [README.md](../README.md). Temporary compiler/resource outputs live under ignored `.android-verification/`; examples and this evidence remain inspectable in the project.

## UI follow-up 0.2.1

After the reported inactive UI, the relay-source scenario first failed with Analyze still disabled. It passes after removing the unsupported source identity filter. `npm run check` remains 29/29 passing. The complete UI DOM/message integration passes with relay and null-source messages. Built-HTML inline-script execution passes three startup scenarios: a valid relayed selection, absent host replies with refresh, and visible script-error reporting. No actual Figma session was available to confirm the user's runtime, so a live retest remains necessary.

## Readiness UX 0.3.0

- 40 tests passed (29 existing pipeline regressions plus 11 readiness/classification/navigation cases); strict TypeScript and plugin bundle build passed.
- Existing validation conditions and severities were retained; stable rule IDs were added. The C-fixture technical results remain 4 blockers, 1 warning, 18 confirmations and 1 informational observation.
- A 130-layer repeated-clipping fixture produces one generator-limitation topic, preserves all 130 layer IDs and original diagnostic objects, and distinguishes 131 occurrences from 130 unique layers when a repeated occurrence is added.
- UI integration verifies default collapsed groups, category ownership, searchable full layer list, group and individual locate, original technical details, next-action navigation, and grouped plus raw ZIP export.
- Real Figma Beta: the already-selected 130-node screen successfully analyzed with v0.3.0. The report shows Needs Review, 1 design fix, 7 decisions, and 9 generator limitations instead of 315 severity-first rows. Its technical report still identifies 315 original findings. Native screenshots were visually inspected; source design layers were not modified.
- Parser / Compose / XML generator source hashes match the pre-overhaul hashes. No Android code-generation change was made, so the earlier fixture compiler results are not misrepresented as a new Android or visual-fidelity verification.

The UI is optimized for scanning; no timed designer usability study has been performed. Live grouped-report rendering was verified; bulk locate and diagnostic completeness are covered by deterministic host/DOM tests.
