# Shim 0.5.0 — implementation evidence

The plugin was extended in place. No backend, AI calls, runtime dependencies, authentication, design-layer edits, or whole-screen rasterization were introduced.

## Fixed behavior

The previous generator used placeholder resources for artwork and put absolute children into ordinary layout flow. It also treated nested Slot nodes as unsupported, omitted Compose clipping, and relied on XML's default clipping even when Figma allowed overflow.

Native artwork export now produces validated 2× PNG resources. Image/vector leaves and unsupported visual styles on leaf shapes can be baked. Layout and text remain native. Bounds come from Figma's rendered/bounding rectangles in an untransformed parent coordinate system; no bounds are guessed when native metadata does not match. PNG signature, chunk CRCs, dimensions and resource/package limits are checked. Export failures preserve explicit limitations.

Overlay containers preserve one contiguous Auto Layout flow block between the original background/foreground siblings. Bounded end/center/stretch anchors are generated. Compose uses Box/BoxWithConstraints with a real Row/Column; XML uses FrameLayout with a real LinearLayout. Source hierarchy and draw order remain intact. Interleaved flow blocks, scroll overlays and unsupported constraints remain limited rather than being silently reordered.

Baked appearances are applied once. Logical dimensions remain independent of bitmap density. Ink outside a flow slot uses an overflow wrapper without enlarging the slot. D exercises this case; a focused test also checks regeneration of older raster captures. Declared clipping maps in both frameworks, and technical diagnostics no longer claim it is unimplemented.

Nested SLOT nodes use their actual container/child data. Native dynamic-page startup avoids the documentchange subscription that requires loading unrelated pages. A snapshot comparison invalidates edits made while artwork is exporting.

## Executed checks

| Check | Result |
| --- | --- |
| Strict TypeScript, 66 tests, plugin bundles | Passed |
| Existing parser, hierarchy, escaping, XML/resource regressions | Passed |
| PNG corruption/export failures, real binary ZIP bytes, crop/render bounds, Hug density and baked padding | Passed |
| Background/flow/foreground order, anchors, unsupported interleaving, outsets, Slot text hierarchy | Passed |
| Built UI handshake, selection/mode invalidation, copy/resource tabs, grouped locate/search and technical details | Passed |
| A/B/C/D generated XML and resources: AAPT2 compile/link | Passed |
| A/B/C/D actual Kotlin with Compose compiler | Passed |
| Captured Halloween generated XML/resources + Kotlin/Compose | Passed |
| Delivered H source/resource hashes vs compiled H files | Exact match |
| Gradle APK assemble | Blocked: daemon socket bind returned Operation not permitted |
| ADB/device rendering and screenshot comparison | Blocked: ADB listener socket denied; not performed |

Compiler evidence: [android-implementation-results.json](android-implementation-results.json). Compiler configuration remains Kotlin/Compose compiler 2.0.21, Compose 1.7.5, Material3 1.3.1, Android SDK 35, AAPT2 34.0.0, min API 28.

## Halloween package

The native Figma Beta plugin analyzed Home-Auto · Yearly selected: 130 visible nodes, 25 actual PNG resources, both framework verdicts Ready for Dev Review, no critical generation topics and one optional text-box review. The delivered regenerated report retains 259 technical observations. All source nodes remain represented; XML hierarchy/resource checks pass.

The original native capture is recorded by SHA-256 `dd9e35a5a877c03f425e73c6531775acab4ed9f2ccca1a7feebd216e1b8c80fb`. The delivered archive was regenerated from its normalized schema and captured PNGs with current rules. It did not invent additional artwork. Every generated Kotlin/resource file is checked against the successful compiler run, and the archive regenerates byte-for-byte in the regression suite.

- [Implementation ZIP](halloween-v0.5.0.zip)
- [Readiness, provenance and compilation summary](halloween-implementation-v050.json)

Native capture/selection, framework switching, artwork export and ZIP download were exercised in Figma. Later native-window control returned cgWindowNotFound even after reconnect/reset. The final extended leaf-style and outset paths are therefore fixture/compiler verified, without a further live-session claim. The plugin source and dist outputs include those fixes; close/reopen the development plugin to load them.

## Reproduction

```sh
npm run check
SHIM_JSDOM=/path/to/jsdom/lib/api.js node scripts/ui-smoke.mjs
SHIM_JSDOM=/path/to/jsdom/lib/api.js node scripts/readiness-ui-check.mjs
SHIM_JSDOM=/path/to/jsdom/lib/api.js node scripts/ui-boot-check.mjs
node scripts/android-fixtures.mjs --prepare-only
python3 scripts/import-android-handoff.py verification/halloween-v0.5.0.zip
python3 scripts/android-direct.py --handoff
```

To refresh a saved native capture without fabricating assets:

```sh
node scripts/refresh-handoff.mjs /path/to/native-capture.zip /path/to/regenerated-handoff.zip
```

Synchronous `analyze()` fixtures have no Figma renderer, so absent artwork remains explicit. The native host uses `analyzeWithAssets()`; D supplies a deterministic PNG with explicit ink bounds. Neither path invents image bytes.

## Remaining scope limits

Custom licensed fonts still require app resources; generated fallback fonts can change wrapping. Theme, accessibility roles, actions, app insets and required feature states need app integration. Context-dependent masks/blends, transformed ancestors, transformed artwork inside flow, image-filled containers with children, interleaved overlay/flow layouts, unsupported scrolling and advanced typography/container visuals remain explicit limitations. Raster artwork is captured at the measured design size; resized/cropped appearance must be reviewed in the target app.

The source and resources compile. No APK/device execution, Android rendering comparison, or arbitrary-selection production verification is claimed. Ready for Dev Review describes handoff readiness under the available checks.
