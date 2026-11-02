# Phase 1 PoC — Run Guide

Goal: validate the core illusion — a zone authored in After Effects, exported
as a manifest, composited client-side in the demo player.

## Layout

- `authoring/ae/ExportZones.jsx` — AE script: Corner Pin effect → manifest JSON
- `player/` — demo web player (WebGL homography overlay)
- `assets/` — drop your demo video + exported manifest + creative here
- `main.go` — `go run .` serves everything at `http://localhost:8080`

## 1. Author a zone in After Effects

1. Import footage, create a comp from it. Keep footage at comp frame 0.
2. Select the footage layer → **Animation > Track in Mocha AE**.
3. In Mocha: draw an X-spline around the planar surface (billboard, screen,
   poster), track forward/backward.
4. **Export Tracking Data** → format **"After Effects Corner Pin
   [supports motion blur]"** → Copy to Clipboard.
5. Back in AE: Layer > New > Solid (comp-sized) → Edit > Paste. The solid gets
   a **Corner Pin** effect with animated corner points.
6. Select that solid → **File > Scripts > Run Script File** →
   `authoring/ae/ExportZones.jsx` → save as `assets/manifest.json`.

(Alternative without Mocha: apply **Effect > Distort > Corner Pin** to a solid
and keyframe the four corners manually.)

## 2. Stage the assets

- `assets/demo.mp4` — the same footage you tracked (clean plate)
- `assets/manifest.json` — from step 1
- `assets/creative.png|jpg|svg` — the ad creative (`example-creative.svg`
  is included)

## 3. Run

```sh
go run .
# open http://localhost:8080/player/
```

Query params override the defaults:

```
/player/?video=../assets/demo.mp4&manifest=../assets/manifest.json&creative=../assets/creative.png
```

## Verification checklist

- Creative appears glued to the surface through pans/zooms (the homography
  does the perspective; per-frame pins do the motion).
- Overlay hidden outside the manifest `in`/`out` range.
- If the creative looks mirrored or twisted, the quad is wound wrong —
  manifest order must be UL, UR, LR, LL.

## Known PoC limits (Phase 2+)

- No occlusion mattes yet — things crossing in front will go *under* the ad.
- Player assumes video frame 0 == comp frame 0 and matching aspect ratio.
- Static creative only; no click-through, no viewability beacons.
