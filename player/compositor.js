/*
 * compositor.js — commercial_free Phase 1 PoC player
 *
 * Loads a zone manifest (per-frame corner pins exported from After Effects)
 * and composites a static creative onto the video via a WebGL textured quad
 * driven by the per-frame homography implied by the pins.
 *
 * Config via query params (paths relative to player/):
 *   ?video=../assets/demo.mp4
 *   &manifest=../assets/example-manifest.json
 *   &creative=../assets/example-creative.svg
 */
(function () {
  var params = new URLSearchParams(location.search);
  var CFG = {
    video: params.get("video") || "../assets/demo.mp4",
    manifest: params.get("manifest") || "../assets/example-manifest.json",
    creative: params.get("creative") || "../assets/example-creative.svg"
  };

  var video = document.getElementById("video");
  var canvas = document.getElementById("overlay");
  var hud = document.getElementById("hud");
  var cfgEl = document.getElementById("cfg");
  cfgEl.innerHTML = "video: <code>" + CFG.video + "</code> · manifest: <code>" +
    CFG.manifest + "</code> · creative: <code>" + CFG.creative + "</code>";

  // ---------- homography: unit square -> quad (8x8 DLT, h33 = 1) ----------
  // src = [[0,0],[1,0],[1,1],[0,1]], dst = 4 corner points [x,y]
  function solveHomography(dst) {
    var src = [[0, 0], [1, 0], [1, 1], [0, 1]];
    var A = [], b = [], i;
    for (i = 0; i < 4; i++) {
      var sx = src[i][0], sy = src[i][1], dx = dst[i][0], dy = dst[i][1];
      A.push([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy]); b.push(dx);
      A.push([0, 0, 0, sx, sy, 1, -dy * sx, -dy * sy]); b.push(dy);
    }
    // Gaussian elimination with partial pivoting
    var n = 8;
    for (var col = 0; col < n; col++) {
      var piv = col;
      for (var r = col + 1; r < n; r++) {
        if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
      }
      var tmp = A[col]; A[col] = A[piv]; A[piv] = tmp;
      var tb = b[col]; b[col] = b[piv]; b[piv] = tb;
      var d = A[col][col];
      if (Math.abs(d) < 1e-12) return null;
      for (r = 0; r < n; r++) {
        if (r === col) continue;
        var f = A[r][col] / d;
        for (var c = col; c < n; c++) A[r][c] -= f * A[col][c];
        b[r] -= f * b[col];
      }
    }
    var h = [];
    for (i = 0; i < n; i++) h.push(b[i] / A[i][i]);
    h.push(1); // h33
    return h;
  }

  // ---------- manifest: interpolated quad at fractional frame ----------
  function quadAt(m, frame) {
    var ks = m.keyframes;
    if (frame <= ks[0].f) return ks[0].q;
    if (frame >= ks[ks.length - 1].f) return ks[ks.length - 1].q;
    var lo = 0, hi = ks.length - 1;
    while (hi - lo > 1) {
      var mid = (lo + hi) >> 1;
      if (ks[mid].f <= frame) lo = mid; else hi = mid;
    }
    var a = ks[lo], bK = ks[hi];
    var t = (frame - a.f) / (bK.f - a.f);
    var q = [];
    for (var i = 0; i < 4; i++) {
      q.push([a.q[i][0] + (bK.q[i][0] - a.q[i][0]) * t,
              a.q[i][1] + (bK.q[i][1] - a.q[i][1]) * t]);
    }
    return q;
  }

  // ---------- WebGL setup ----------
  var gl = canvas.getContext("webgl", { premultipliedAlpha: true });
  if (!gl) { hud.textContent = "WebGL unavailable"; return; }

  var VS =
    "attribute vec2 a_pos;attribute vec3 a_tex;varying vec3 v_tex;" +
    "void main(){gl_Position=vec4(a_pos,0.,1.);v_tex=a_tex;}";
  var FS =
    "precision mediump float;uniform sampler2D u_tex;varying vec3 v_tex;" +
    "void main(){gl_FragColor=texture2D(u_tex,v_tex.xy/v_tex.z);}";

  function shader(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(s));
    }
    return s;
  }
  var prog = gl.createProgram();
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog); gl.useProgram(prog);
  var aPos = gl.getAttribLocation(prog, "a_pos");
  var aTex = gl.getAttribLocation(prog, "a_tex");

  var vbuf = gl.createBuffer();
  var ibuf = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibuf);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,
                new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  var tex = gl.createTexture();
  var texReady = false;
  var img = new Image();
  img.onload = function () {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA,
                  gl.UNSIGNED_BYTE, img);
    texReady = true;
  };
  img.src = CFG.creative;

  // ---------- sizing ----------
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  function resize() {
    var r = canvas.getBoundingClientRect();
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
  }
  window.addEventListener("resize", resize);

  var manifest = null;
  fetch(CFG.manifest)
    .then(function (r) { return r.json(); })
    .then(function (m) {
      manifest = m;
      hud.textContent = "zone '" + m.zone.id + "' · frames " +
        m["in"] + "–" + m.out;
    })
    .catch(function (e) { hud.textContent = "manifest error: " + e; });

  video.src = CFG.video;
  video.addEventListener("error", function () {
    hud.textContent = "video not found — drop a file at " + CFG.video +
      " (see docs/phase1-poc.md)";
  });

  function draw() {
    requestAnimationFrame(draw);
    if (!manifest || !texReady || !video.videoWidth) return;
    resize();

    var frame = video.currentTime * manifest.source.fps;
    if (frame < manifest["in"] - 0.5 || frame > manifest.out + 0.5) {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return;
    }

    // Displayed video rect inside the canvas (object-fit: contain)
    var cw = canvas.width, ch = canvas.height;
    var scale = Math.min(cw / video.videoWidth, ch / video.videoHeight);
    var rw = video.videoWidth * scale, rh = video.videoHeight * scale;
    var rx = (cw - rw) / 2, ry = (ch - rh) / 2;

    // Comp-space pins -> device px on canvas
    var k = rw / manifest.source.width;
    var q = quadAt(manifest, frame).map(function (p) {
      return [rx + p[0] * k, ry + p[1] * k];
    });

    var h = solveHomography(q);
    if (!h) return;

    // Positions (clip space) + projective texcoords (u*w, v*w, w)
    var uv = [[0, 0], [1, 0], [1, 1], [0, 1]];
    var verts = new Float32Array(4 * 5);
    for (var i = 0; i < 4; i++) {
      var u = uv[i][0], v = uv[i][1];
      var w = h[6] * u + h[7] * v + 1;
      verts[i * 5 + 0] = (q[i][0] / cw) * 2 - 1;
      verts[i * 5 + 1] = 1 - (q[i][1] / ch) * 2;
      verts[i * 5 + 2] = u * w;
      verts[i * 5 + 3] = v * w;
      verts[i * 5 + 4] = w;
    }

    gl.viewport(0, 0, cw, ch);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbuf);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(aTex);
    gl.vertexAttribPointer(aTex, 3, gl.FLOAT, false, 20, 8);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  }
  resize();
  draw();
})();
