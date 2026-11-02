/*
 * ExportZones.jsx — commercial_free Phase 1 PoC
 *
 * After Effects ExtendScript. Finds a layer carrying a Corner Pin effect
 * (typically produced by Mocha AE's "After Effects Corner Pin" tracking
 * export onto a comp-sized solid) and exports per-frame corner positions,
 * converted to comp space, as a zone manifest JSON file.
 *
 * Manifest quad order: [UpperLeft, UpperRight, LowerRight, LowerLeft].
 *
 * Usage: select the tracked layer (optional; script scans for the first
 * layer with a Corner Pin effect), then File > Scripts > Run Script File.
 */

(function () {
    var MANIFEST_VERSION = 1;

    function alertErr(msg) {
        alert("ExportZones: " + msg);
    }

    function findCornerPinEffect(layer) {
        var fx = layer.property("ADBE Effect Parade");
        for (var i = 1; i <= fx.numProperties; i++) {
            var eff = fx.property(i);
            if (eff.matchName === "ADBE Corner Pin") {
                return eff;
            }
        }
        return null;
    }

    function findTrackedLayer(comp) {
        var i, l;
        // Prefer a selected layer
        for (i = 0; i < comp.selectedLayers.length; i++) {
            l = comp.selectedLayers[i];
            if (findCornerPinEffect(l)) return l;
        }
        // Otherwise first layer that has the effect
        for (i = 1; i <= comp.numLayers; i++) {
            l = comp.layer(i);
            if (findCornerPinEffect(l)) return l;
        }
        return null;
    }

    // Return the 4 pin properties in AE's effect order:
    //   1=UpperLeft, 2=UpperRight, 3=LowerLeft, 4=LowerRight
    function pinProps(eff) {
        var names = ["Upper Left", "Upper Right", "Lower Left", "Lower Right"];
        var props = [];
        for (var n = 0; n < 4; n++) {
            var p = null;
            try { p = eff.property(names[n]); } catch (e) { p = null; }
            if (!p) p = eff.property(n + 1); // fallback: positional
            props.push(p);
        }
        return props;
    }

    function keyRange(props) {
        var lo = null, hi = null;
        for (var i = 0; i < props.length; i++) {
            var p = props[i];
            for (var k = 1; k <= p.numKeys; k++) {
                var t = p.keyTime(k);
                if (lo === null || t < lo) lo = t;
                if (hi === null || t > hi) hi = t;
            }
        }
        return [lo, hi];
    }

    function main() {
        var comp = app.project.activeItem;
        if (!(comp instanceof CompItem)) {
            alertErr("open/select the comp containing the tracked layer first.");
            return;
        }

        var layer = findTrackedLayer(comp);
        if (!layer) {
            alertErr("no layer with a Corner Pin effect found.\n\n" +
                     "Track in Mocha AE, then Export Tracking Data > " +
                     "'After Effects Corner Pin' onto a solid in this comp.");
            return;
        }

        var eff = findCornerPinEffect(layer);
        var props = pinProps(eff);
        var range = keyRange(props);
        var t0 = range[0], t1 = range[1];
        if (t0 === null) {
            t0 = comp.workAreaStart;
            t1 = comp.workAreaStart + comp.workAreaDuration;
        }

        var fd = comp.frameDuration;
        var f0 = Math.round(t0 / fd);
        var f1 = Math.round(t1 / fd);

        var keyframes = [];
        for (var f = f0; f <= f1; f++) {
            var t = f * fd;
            // AE prop order is UL, UR, LL, LR — we emit UL, UR, LR, LL
            var order = [0, 1, 3, 2];
            var q = [];
            for (var i = 0; i < 4; i++) {
                var v = props[order[i]].valueAtTime(t, false);
                var c = layer.toComp([v[0], v[1]], t);
                q.push([Math.round(c[0] * 100) / 100,
                        Math.round(c[1] * 100) / 100]);
            }
            keyframes.push({ f: f, q: q });
        }

        var manifest = {
            version: MANIFEST_VERSION,
            zone: { id: layer.name.replace(/\s+/g, "_"), name: layer.name },
            source: {
                width: comp.width,
                height: comp.height,
                fps: Math.round((1 / fd) * 1000) / 1000
            },
            "in": f0,
            out: f1,
            keyframes: keyframes
        };

        var file = File.saveDialog("Export zone manifest",
                                   "JSON:*.json");
        if (!file) return;
        file.open("w");
        file.write(JSON.stringify(manifest, null, 2));
        file.close();

        alert("Exported " + keyframes.length + " frames for '" +
              layer.name + "'\n→ " + file.fsName);
    }

    app.beginUndoGroup("Export Zones");
    try { main(); } catch (e) { alertErr(e.toString()); }
    app.endUndoGroup();
})();
