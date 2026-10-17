# Shim: direction

**Brief (self-authored from the user's answers):** Figma plugin that turns a selected frame into Android handoff code and a readiness verdict. Feel: playful with personality, crafted and precise. Existing look (dark, lime #b5f5a2, Inter) is dropped.

**Concept: Shim is a feeler gauge** (object). A shim is the thin wedge that closes a gap; a feeler gauge is the stack of steel leaves used to measure it. Readiness is shown as leaves: one per action, long and orange for blockers, outlined for confirmations.

**Explored:** A feeler gauge (object / light / grotesque / orange / shape), B lumber stamp (place / colour-field / slab / yellow / colour-material), C sticker sheet (play / dark / rounded / pink / illustration). Renders in `design/shots/`.
**Why A won:** it turns the verdict into the product's own data, stays calm for long reading of code and findings. B: full yellow ground is loud for a work tool and repeats a previous yellow row. C: reads as a kids' app, and dark-teal-with-pink is its own cliché.
**Refused default:** dark panel + lime accent + Inter, the generic dev-tool look.

**Tokens** (light / dark): bg #E4E7E5 / #151B1E, ink #1B2226 / #E6EBE8, ink2 #56636A / #93A1A8, rule #B5BCBA / #2C373C, accent #E8570C / #FF7A33 (text use #B23F08 / #FF9459), code #1B2226 / #0C1113.
**Type:** Avenir Next (fallback Helvetica Neue, system-ui) 800 for display, 13px body; ui-monospace 11px for metadata. System stacks only: the plugin has no network access and ships no font files.
**Mark:** two blocks with an orange wedge seated in the gap.
**Signature:** on analysis, the gauge leaves slide in staggered (380ms, 45ms apart). Disabled under prefers-reduced-motion.
**Not verified:** rendering inside real Figma (fonts on Windows fall back), motion feel.

---
## Revision 2 (2026-10-17): Stranger.exe style
Designer: the feeler-gauge look read as AI slop; wanted the Stranger.exe style (`~/Downloads/dating/explore/stranger-exe`). Replaced wholesale. Tokens: bone #ECE8DC + dot grid, white windows, ink #10131C, cobalt #2336FF, 2px ink borders, hard 4–6px offset shadows, square corners. Type: Archivo (embedded variable woff2, wdth 108%, 900) for hero; ui-monospace for system voice. Sections are windows (`selection.fig`, `readiness.log`, `implementation`). Logo: the two faces with a cobalt wedge between them. Gauge leaves became dithered progress bars (blockers cobalt). Light only, as in Stranger.exe. Same look as history row "Stranger.exe (quiet)": chosen by the designer, not by the process.

## Revision 3 (2026-10-17): less blue
Blue was on every title bar, prompt and marker, which read as too much. Blue now means three things only: the primary action (Analyze), the verdict that needs attention, and blockers. Title bars, prompts, markers, messages and the connection dot are ink. Community icon and cover follow the same rule: bone ground, ink bars, the blue wedge as the one accent.
