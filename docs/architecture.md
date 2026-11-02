# Architecture: Zone-Based In-Content Ad Platform

> Recovered from the original design session (Nov 2, 2026). This is the
> authoritative architecture; `design.md` holds product concept + open questions.

Working from the **patent-clean position**: authored zones + client-side
compositing + sponsor-per-creator matching.

## Component Overview

```
[1. Authoring Tool]      [2. Ingest]         [3. Ad Decisioning]
NLE plugin /             upload + transcode   campaigns, geo rules,
desktop app              to ABR (HLS/DASH)    sponsor matching
    | zone manifest          | clean stream       |
    v                        v                    v
              [4. Delivery / CDN]  →  [5. Player SDK]
                  same video to all     per-session creative
                  viewers               fetch + WebGL composite
                                              |
                                              v
                                   [6. Analytics/Beacons]
                                   [7. Billing / Marketplace]
```

## 1. Authoring Tool (desktop)

- Form: v1 = DaVinci Resolve or After Effects plugin (meets creators where
  they are). v2 = standalone Electron app with built-in planar tracker.
- Job: user draws zone quad → planar/homography tracking (OpenCV-class) →
  QA scrub view → export zone manifest.
- Zone manifest (JSON, per video):
  - zone ID, frame range, per-frame corner pins (homography)
  - occlusion mask references (baked matte clips), safe margins
  - aspect/size constraints for creative, screen-time %, click-through hotspot
- Deliberately **clean plate** — video is exported untouched; nothing baked in.

## 2. Ingest & Transcode

- Upload service (multipart) → object storage (S3/R2).
- Transcode to ABR ladder — **buy, don't build**: Mux, Cloudflare Stream, or
  Bitmovin. If building later: FFmpeg + shaka-packager.
- Zone manifest stored keyed to video ID; validated against frame
  count/duration post-transcode.

## 3. Ad Decisioning Service

- Sponsors submit campaigns: creative image/video, geo rules (country → DMA),
  flight dates, budget, target categories.
- v1: creator brings own sponsor (manual pairing, platform takes a fee).
- v2: rules engine picks creative per request: zone inventory + viewer geo +
  flight + frequency → creative ID.
- Keep the interface VAST-shaped (events/fields) so you can later bridge to
  real programmatic demand.

## 4. Delivery

- One clean ABR stream for everyone — full CDN cacheability, zero per-viewer
  video cost.
- Per-session, the player calls decisioning → gets back: creative asset URL +
  zone manifest subset + tracking config.

## 5. Player SDK (the hard part)

- Web first: hls.js (or platform player) + overlay render layer.
- Overlay: WebGL quad (or CSS 3D transform for cheap mode) driven by per-frame
  homography; occlusion mattes as alpha-mask video/textures; handles creative
  aspect-fit, min-size gating, click-through.
- Later: iOS/Android (AVPlayer + CoreImage overlay), tvOS, Chromecast.
- Quality ceiling: no relighting/3D — acceptable for signage, weak for complex
  surfaces. v1 restricts zone types to planar signage/screens/posters.

## 6. Analytics & Beacons

- Player fires: impression, quartiles, % on-screen (viewability), clicks,
  geo bucket.
- Server-side beacon collector → analytics store (Postgres → ClickHouse later).
- Sponsors get IAB-style reporting; this is what makes the money trustworthy.

## 7. Billing & Marketplace

- Stripe: creator SaaS subscription + payout ledger; rev-share split on
  placements.
- v3: open marketplace — sponsors browse creator/zone inventory, bid/book.

## Suggested stack

- Backend: Go + Postgres + Redis + S3/R2. Queue: SQS/Temporal for ingest jobs.
- Infra: Cloudflare Stream or Mux for video; API on Fly.io/AWS; CDN for
  creatives.
- Player: TypeScript, hls.js, raw WebGL (skip three.js — a textured quad needs
  little).
- Plugin: Resolve's scripting API (Lua/Python) or AE UXP — whichever your
  target creators use; standalone falls back to Electron + OpenCV.js tracking.

## Build phases

- **Phase 1 — proof**: authoring plugin → manifest; demo player compositing a
  static creative onto tracked footage. Validates the core illusion.
- **Phase 2 — MVP**: ingest + hosted player + manual sponsor pairing + basic
  beacons.
- **Phase 3 — business**: decisioning, geo rules, billing, reporting dashboard.
- **Phase 4 — scale**: marketplace, mobile SDKs, server-side baked variants
  (for platforms/TV apps where overlay isn't possible — revisit FTO then).

## Key open risks to design around

- **Occlusion realism** — mattes authored by creator limit quality; budget a
  "QA review" step where your team approves manifests before campaigns run.
- **Ad blockers** — overlay is detectable/blockable; baked server-side
  variants are the fallback for hostile clients.
- **Player performance** on low-end devices — homography-driven quad is cheap,
  but video-texture occlusion masks are not; ship a "simple mode" (CSS
  transform, no masks).
