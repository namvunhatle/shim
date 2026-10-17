# Shim.exe: Community listing

**Name:** Shim.exe (check "Shim" is free in Community before submitting)
**Tagline (max ~100 chars):** Check a frame for Android handoff, then draft Jetpack Compose and XML.
**Category:** Developer tools / Code
**Assets:** `icon-128.png` (128×128), `cover-1920x1080.png` (1920×1080)

## Description

Shim.exe fills the gap between a Figma frame and Android code.

Select one Frame, Component, Instance or Group and press Analyze. Shim:

- lists what to fix before handoff, ranked, with a button that selects the affected layers in Figma
- separates design problems from limits of the generator, so you are not asked to redesign things only code can solve
- drafts Jetpack Compose and Android XML for the selection, with artwork exported as PNG
- exports everything as a .zip: code, resources, readiness report and the schema it was generated from

**What it is not.** The code is a draft. It is not build verified and it does not render or compare against Android. Fonts need mapping, and unsupported layers (for example complex vectors) become placeholders and are reported.

**Privacy.** Deterministic: no AI, no network access, nothing is sent anywhere. All analysis runs inside the plugin.

**Units.** 1 Figma px becomes 1 dp (text px become sp).

## Notes for Figma review
- manifest: `networkAccess.allowedDomains: ["none"]`, `editorType: ["figma"]`, `documentAccess: "dynamic-page"`.
- Font: Archivo (SIL OFL), embedded in the UI.
- Support contact: namvunhatle@outlook.com
