# Neon Coast Studio

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/Brengsek27/gta6-cover-art-01-r3/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard)
[![reward](https://make.fun/badge/gta6-cover-art-01/Brengsek27/gta6-cover-art-01-r3/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

Ordinary photos. Extraordinary stories. Neon Coast Studio is an offline cover-art maker that turns your photos and a caption into a cinematic, multi-panel crime-poster cover. Build a collage, stack snapshots, or go full hero; give every scene the same warm sunset treatment, add glowing script and an edition seal, then export a full-resolution PNG. Photos stay on your device. No account, services, dependencies, or watermarks.

## Run it

Run `node serve.ts` and open the local address printed in your terminal. Load a photo (or try the bundled scenes), pick a layout and color grade, write your title, and select **Export cover**. Add multiple photos at once; click a loaded thumbnail to remove it. Layouts suggest a canvas format, and the format selector lets you change it. Every control updates the preview live.

Generate the four reproducible screenshots with `node tools/capture.mjs`. Package the static app, screenshots and dossier with `MAKEFUN_OUTPUT_DIR=out node main.ts`.

Anton and Pacifico are bundled in `app/fonts/` under the SIL Open Font License 1.1. UI text uses system fonts. The supplied sample images are bundled locally, and all cover treatment, composition and lettering are rendered by Canvas 2D.

Made for [make.fun](https://make.fun).
