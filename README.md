# commercial_free

A zone-based in-content advertising platform for video creators. Creators
mark blank spaces in their footage (billboards, screens, posters, walls);
advertiser creative is composited into those zones **at playback time,
client-side** — viewers see integrated, non-interruptive ads instead of
commercial breaks, and the video itself stays clean.

## Status

**Phase 1 — proof of concept.** Validates the core illusion: a zone authored
in After Effects is exported as a manifest and composited onto the video in
a WebGL demo player via per-frame homography.

## Quickstart

```sh
go run .
# open http://localhost:8080/player/
```

Drop an mp4 at `assets/demo.mp4`, author a zone in AE (Mocha AE track →
Corner Pin → run `authoring/ae/ExportZones.jsx`), save it as
`assets/manifest.json`, refresh.

Full walkthrough: **[docs/phase1-poc.md](docs/phase1-poc.md)**

## Docs

- **[docs/architecture.md](docs/architecture.md)** — authoritative system
  architecture (authoring tool, ingest, decisioning, player SDK, beacons,
  billing) and the patent-clean design rationale
- **[docs/design.md](docs/design.md)** — product concept and open questions
- **[docs/phase1-poc.md](docs/phase1-poc.md)** — PoC run guide

## Layout

```
authoring/ae/   After Effects authoring scripts (ExtendScript)
player/         WebGL compositing demo player
assets/         manifest + creative assets (large footage gitignored)
docs/           architecture, design notes, run guides
main.go         static dev server
```
