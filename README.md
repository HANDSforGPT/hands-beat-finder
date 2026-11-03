# Beat Finder for HANDS

Beat Finder is a free optional HANDS audio add-on with a separately installed localhost workspace. No Node packages are required. The Tool Store module is a recipe/instructions package; the installed runtime provides the UI.

## Features

- Dark/lime studio design, large expandable beat cards, producer identity, preview, BPM, musical key and genre.
- Beat purchase link and separate producer stem/track-out purchase link when supplied.
- Genre, key (24 major/minor choices), search and BPM-proximity filters.
- Tap-tempo via button or Space (rolling median, resets after a 2.4-second pause).
- Upload a song locally to approximate the key using FFmpeg and harmonic chroma, then filter beats by the result.
- Import/export producer-supplied beat-list JSON.
- Authorized direct audio HTTPS link to MP3 320 kbps CBR or WAV 24-bit PCM. This does not restore quality missing from a compressed input.

## Install on macOS

Requires Node.js, FFmpeg and a browser. Clone https://github.com/HANDSforGPT/hands-beat-finder.git into an authorized directory and run:

    bash install.sh

The installer copies code into the user's Library Application Support / HANDS for GPT / Beat Finder folder without changing the separate personal beat catalog.

To launch, double-click Applications / HANDS Beat Finder.command in Finder, or run:

    bash "$HOME/Library/Application Support/HANDS for GPT/Beat Finder/launch.command"

UI runs at http://127.0.0.1:58983/ . The HANDS tool module can use the existing hands_start_process permission to start it. This UI is a browser workspace, not yet an embedded HANDS sidebar panel.

## Catalog JSON

Each producer-submitted entry has fields: title, producer, genre, key, bpm (integer 40-240), storeUrl (HTTPS required), optional previewUrl, optional stemsUrl, optional description. Import a JSON array or an object with a beats array. Use Export to back up your catalog.

Persistent catalog is stored in ~/Library/Application Support/HANDS Beat Finder/catalog.json. The included C-major WAV fixture is synthetically generated original test audio, not a commercially listed beat. Beat Finder deliberately does not fabricate producer data or crawl private marketplace APIs; the catalog starts empty.

## Download rights and protection

- Direct public HTTPS audio-file links only; no ripping streaming platform pages, paywalled beat previews, protected streams or video pages.
- The user must affirm authorization to download or convert the linked file.
- Reject private IPs, private/metadata DNS and redirects there, files larger than 150MB, and unsupported audio.
- Temporary audio uploads are deleted after analysis. Processing runs on the Mac.
- Conversion changes container/codec, not underlying source fidelity. WAV does not become higher fidelity merely by choosing 24 bits.
- Actual purchasing, prices, stem availability and licenses are handled by the linked producer store.

## Validation

Run: node --test tests/smoke.test.mjs

This covers catalog validation, unsafe URLs, SSRF IP denial, major/minor key support, silence and original synthesized C-major chord detection. Key detection remains approximate, especially for complex or atonal songs.

No user beat listings are included with the add-on. Add them manually or import an authorized producer catalog.
