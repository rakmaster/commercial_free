# commercial_free — Design Notes

> Reconstructed from a lost chat session, Nov 2, 2026. Living document.
> **Authoritative architecture: see `architecture.md`** (recovered from the
> original session). This doc holds the product concept and open questions.

## Concept

A platform where streaming creators designate "ad zones" — blank spaces inside
their video content (billboards, walls, product spots, lower thirds) — and have
advertiser creative composited into those zones **at playback time, client-side**.
Viewers see integrated, non-interruptive advertising instead of commercial
breaks; the video itself stays clean (the "patent-clean" position).

## Core Workflow

1. Creator authors zones in an NLE plugin (Resolve/AE): draws a quad, planar
   tracker follows it across frames, exports a **zone manifest**. The video
   file stays untouched (clean plate).
2. Creator uploads video → transcode to ABR ladder (**buy**: Mux, Cloudflare
   Stream, or Bitmovin — not FFmpeg in-house).
3. Sponsors pair campaigns with zones — v1 manual (creator brings own
   sponsor); v2 rules engine: geo, flight dates, frequency → creative ID.
4. Player SDK fetches manifest + creative per session and composites via a
   WebGL quad driven by per-frame homography.
5. Beacons → analytics store → billing (SaaS + rev-share; marketplace later).

## Zone Selection (authoring tool)

- v1: creator draws a quad; a planar/homography tracker (OpenCV-class)
  produces per-frame corner pins; QA scrub view; occlusion handled by
  authored matte clips exported alongside the manifest.
- Enhancement idea: **SAM 2** (promptable video segmentation) could
  auto-suggest zone masks from a single click — a "magic wand" assist inside
  the plugin. Optional; not required for the planar-signage v1 scope.
- v1 restricts zones to planar surfaces (signage, screens, posters).

## Compositing Model

- **Client-side** (chosen, patent-clean): player fetches creative + manifest
  per session; the same clean ABR stream serves all viewers → full CDN
  cacheability, zero per-viewer video cost.
- Server-side baked variants deferred to Phase 4 (platforms/TV apps where
  overlay isn't possible — revisit FTO then).

## Components — see `architecture.md`

Authoring plugin → zone manifest; Ingest/transcode (buy); Ad decisioning
(VAST-shaped); CDN delivery; Player SDK (WebGL homography overlay);
Analytics/beacons (IAB-style); Billing/marketplace (Stripe).

## Monetization (open)

Candidates, probably a mix:

- Creator SaaS subscription (Stripe) + payout ledger.
- Rev-share split on placements; take-rate on creator↔sponsor deals.
- Per-placement or per-campaign fees as an alternative to rev-share.
- v3: marketplace — sponsors browse/book zone inventory; take on spend.

## Open Questions

- Which NLE first — Resolve (free tier, Lua/Python scripting) or AE (UXP)?
- Live vs VOD only? (Current design assumes VOD/uploaded content.)
- QA review staffing: who approves manifests before campaigns run?
- Ad-blocker mitigation: how far before falling back to baked variants?
- FTO diligence: confirm client-side overlay + authored zones really is
  patent-clean before Phase 4 revisits baked variants.
- Disclosure/compliance (ad markers for platforms/regulators)?

## MVP — see `architecture.md` build phases

Phase 1 (proof): authoring plugin → manifest + demo player compositing a
static creative onto tracked footage. Phase 2 (MVP): ingest + hosted player +
manual sponsor pairing + basic beacons.
