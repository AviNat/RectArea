/*
 * Copyright (c) 2026 Avi Nathan. All rights reserved.
 * No part of this file may be copied, modified or distributed without the written permission of the copyright holder.
 */
/*
 * RectArea (version 1.2.0 - RectArea.version)
 * Drawing of right-angled polygons for area / perimeter questions in Moodle Formulas.
 * Presentation only: the question calculates and checks the answers and gives their feedback.
 *
 * The shape starts at (0,0); every step is [dx, dy] from the previous point and
 * one of dx, dy must be 0 (all edges parallel to the axes). If the last step does
 * not return to (0,0), the closing edge is added (it must be parallel to an axis).
 * Edges are numbered 1, 2, 3 ... in the order of the steps; the closing edge is last.
 *
 *   RectArea.render(target, config)  -> instance { model, show(k), element }
 *     target: element, element id, or the <script> element of the Moodle snippet
 *             (a <div> is then created just before the script).
 *   RectArea.analyse(config)         -> model { ok, errors, warnings, width, height,
 *                                       edges, ways, subtract }
 *
 * config:
 *   steps:     [[dx,dy], ...]   or "dx,dy dx,dy ..."   (path: "R5 D5 L2 D5 L3" also works)
 *   hide:      [3, 4]  edges drawn without their length   or  {3: "a", 4: "b"} (with a label)
 *              at most one horizontal and one vertical edge, so they can be found.
 *   revealHidden: false  true = hidden edges in blue with their length (for the feedback)
 *   helper:    "none"     - no slider
 *              "divide"   - slider shows the ways to divide, no numbers
 *              "dims"     - as divide, plus the sides of every rectangle
 *   lang:      "en" | "he" | "ar"   texts: { key: "own text" } overrides
 *   width:     420  (px, largest size of the drawing)
 *   grid:      false  unit grid behind the shape
 *   startView: 0      slider position at start (0 = shape only)
 *   maxWays:   8      most ways to divide shown (plus "big rectangle minus missing parts")
 *   sizeRange: [8,12] warning (console) when the bounding rectangle is outside it; null = off
 *   edgeNumbers: false  small edge numbers (for the teacher while building)
 *
 * The rectangles get new letters in every way to divide: A, B in the first, C, D in the next ...
 *
 * Moodle snippet: data + tiny loader, one line, without < > & characters inside the script.
 * Code that the student page runs lives here, not in the question text.
 */
(function (root) {
"use strict";

var VERSION = "1.2.0";
var EPS = 1e-7;
var TIMES = "×";
var PALETTE = ["#4e79a7", "#f28e2b", "#59a14f", "#b07aa1", "#76b7b2", "#edc948", "#e15759", "#9c755f"];
var HIDDEN_COLOR = "#2b4fd8";

// A, B, ... Z, AA, AB, ...
function letter(i) {
    var s = "";
    i++;
    while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); }
    return s;
}

var TEXTS = {
    en: {
        hint: "Move the slider to see ways to divide the shape into rectangles.",
        way: "Way {k} of {n}",
        single: "The shape is one rectangle",
        vertical: "vertical cuts",
        horizontal: "horizontal cuts",
        mixed: "vertical and horizontal cuts",
        subtract: "big rectangle minus the missing parts",
        rects: "{n} rectangles",
        bigRect: "Big rectangle",
        missing: "missing",
        errTitle: "The shape cannot be drawn"
    },
    he: {
        hint: "הזיזו את המחוון כדי לראות דרכים לחלק את הצורה למלבנים.",
        way: "דרך {k} מתוך {n}",
        single: "הצורה היא מלבן אחד",
        vertical: "חלוקה בקווים אנכיים",
        horizontal: "חלוקה בקווים אופקיים",
        mixed: "חלוקה בקווים אנכיים ואופקיים",
        subtract: "מלבן גדול פחות החלקים החסרים",
        rects: "{n} מלבנים",
        bigRect: "המלבן הגדול",
        missing: "חסר",
        errTitle: "לא ניתן לצייר את הצורה"
    },
    ar: {
        hint: "حرّكوا المنزلق لرؤية طرق تقسيم الشكل إلى مستطيلات.",
        way: "الطريقة {k} من {n}",
        single: "الشكل مستطيل واحد",
        vertical: "تقسيم بخطوط عمودية",
        horizontal: "تقسيم بخطوط أفقية",
        mixed: "تقسيم بخطوط عمودية وأفقية",
        subtract: "المستطيل الكبير ناقص الأجزاء الناقصة",
        rects: "{n} مستطيلات",
        rects2: "مستطيلان",             // Arabic dual
        rectsMany: "{n} مستطيلًا",       // 11 and more
        bigRect: "المستطيل الكبير",
        missing: "ناقص",
        errTitle: "لا يمكن رسم الشكل"
    }
};
var RTL = { he: true, ar: true };

/* ============================================================
   Numbers
   ============================================================ */
function fmt(v) {
    var r = Math.round(v * 1e6) / 1e6;
    if (r === 0) r = 0;              // no "-0"
    return String(r);
}
function rnd(v) { return Math.round(v * 1e9) / 1e9; }
function sgn(v) { return v > EPS ? 1 : (v < -EPS ? -1 : 0); }
function idxOf(arr, v) {
    for (var k = 0; k < arr.length; k++) if (Math.abs(arr[k] - v) < EPS) return k;
    return -1;
}
function uniqSorted(vals) {
    var s = vals.slice().sort(function (a, b) { return a - b; }), out = [];
    s.forEach(function (v) { if (!out.length || Math.abs(out[out.length - 1] - v) > EPS) out.push(v); });
    return out;
}
function matrix(a, b, val) {
    var m = [];
    for (var i = 0; i < a; i++) { m[i] = []; for (var j = 0; j < b; j++) m[i][j] = val; }
    return m;
}

/* ============================================================
   Reading the steps
   ============================================================ */
function parseSteps(src) {
    var steps = [], i;
    if (typeof src === "string") {
        var s = src.trim();
        if (/^[RLUD]/i.test(s)) {
            var re = /([RLUD])\s*([+-]?\d*\.?\d+(?:e[+-]?\d+)?)/gi, m;
            if (s.replace(re, "").replace(/[\s,;]+/g, "") !== "")
                throw new Error("Cannot read path \"" + src + "\". Use R, L, U, D followed by a length, e.g. \"R5 D5 L2\".");
            while ((m = re.exec(s))) {
                var d = Number(m[2]), c = m[1].toUpperCase();
                steps.push(c === "R" ? [d, 0] : c === "L" ? [-d, 0] : c === "U" ? [0, d] : [0, -d]);
            }
        } else {
            var nums = s.split(/[\s,;\[\]()]+/).filter(function (t) { return t !== ""; }).map(Number);
            if (nums.length % 2) throw new Error("The steps must be pairs dx,dy - found an odd count of numbers.");
            for (i = 0; i < nums.length; i += 2) steps.push([nums[i], nums[i + 1]]);
        }
    } else if (Array.isArray(src)) {
        src.forEach(function (it) {
            if (Array.isArray(it)) steps.push([Number(it[0]), Number(it[1])]);
            else if (it && typeof it === "object") steps.push([Number(it.dx || 0), Number(it.dy || 0)]);
            else throw new Error("Each step must be [dx, dy].");
        });
    } else {
        throw new Error("No steps given. Use steps: [[dx, dy], ...] starting from (0,0).");
    }
    return steps;
}

// { edgeNumber: label } - label "" = draw the edge without any text
function parseHide(hide, n) {
    var out = {}, list;
    if (hide == null || hide === "") return out;
    if (typeof hide === "number") list = [hide];
    else if (typeof hide === "string") list = hide.split(/[\s,;]+/).filter(Boolean).map(Number);
    else if (Array.isArray(hide)) list = hide.map(Number);
    if (list) {
        list.forEach(function (k) { out[k] = ""; });
    } else if (typeof hide === "object") {
        Object.keys(hide).forEach(function (k) { out[Number(k)] = String(hide[k]); });
    }
    Object.keys(out).forEach(function (k) {
        var num = Number(k);
        if (!(num === Math.floor(num) && num >= 1 && num <= n))
            throw new Error("hide: there is no edge " + k + " (edges are numbered 1 to " + n + ").");
    });
    return out;
}

/* ============================================================
   The shape
   ============================================================ */
function analyse(config) {
    config = config || {};
    var model = { ok: false, errors: [], warnings: [], config: config, version: VERSION };
    var steps, i, j;
    try { steps = parseSteps(config.steps != null ? config.steps : config.path); }
    catch (err) { model.errors.push(err.message); return model; }

    var pts = [[0, 0]], x = 0, y = 0;
    for (i = 0; i < steps.length; i++) {
        var dx = steps[i][0], dy = steps[i][1];
        if (!isFinite(dx) || !isFinite(dy)) { model.errors.push("Step " + (i + 1) + " is not a pair of numbers."); return model; }
        if (sgn(dx) && sgn(dy)) { model.errors.push("Step " + (i + 1) + " [" + fmt(dx) + ", " + fmt(dy) + "] is not parallel to an axis - one of dx, dy must be 0."); return model; }
        if (!sgn(dx) && !sgn(dy)) { model.errors.push("Step " + (i + 1) + " has length 0 - check the random values."); return model; }
        x = rnd(x + dx); y = rnd(y + dy);
        pts.push([x, y]);
    }
    model.autoClosed = false;
    if (sgn(x) || sgn(y)) {
        if (sgn(x) && sgn(y)) {
            model.errors.push("The path ends at (" + fmt(x) + ", " + fmt(y) + "). It must end on the same horizontal or vertical line as (0,0), so the closing edge is parallel to an axis.");
            return model;
        }
        model.autoClosed = true;
    } else {
        pts.pop();
    }
    var n = pts.length;
    if (n < 4) { model.errors.push("A shape needs at least 4 edges."); return model; }

    var edges = [];
    for (i = 0; i < n; i++) {
        var p = pts[i], q = pts[(i + 1) % n];
        var ex = rnd(q[0] - p[0]), ey = rnd(q[1] - p[1]);
        edges.push({ num: i + 1, x0: p[0], y0: p[1], x1: q[0], y1: q[1], dx: ex, dy: ey,
                     axis: sgn(ex) ? "h" : "v", len: Math.abs(ex) + Math.abs(ey) });
    }
    for (i = 0; i < n; i++) {
        var nx = (i + 1) % n;
        if (edges[i].axis === edges[nx].axis)
            model.errors.push("Edges " + edges[i].num + " and " + edges[nx].num + " lie on one line. Join them into one step (or check that no random value makes a length 0).");
    }
    for (i = 0; i < n; i++) {
        for (j = i + 2; j < n; j++) {
            if (i === 0 && j === n - 1) continue;
            var a = edges[i], b = edges[j];
            if (Math.max(Math.min(a.x0, a.x1), Math.min(b.x0, b.x1)) <= Math.min(Math.max(a.x0, a.x1), Math.max(b.x0, b.x1)) + EPS &&
                Math.max(Math.min(a.y0, a.y1), Math.min(b.y0, b.y1)) <= Math.min(Math.max(a.y0, a.y1), Math.max(b.y0, b.y1)) + EPS)
                model.errors.push("Edges " + a.num + " and " + b.num + " cross or touch - the shape must not cross itself.");
        }
    }
    if (model.errors.length) return model;

    var s2 = 0;
    for (i = 0; i < n; i++) { var u = pts[i], v = pts[(i + 1) % n]; s2 += u[0] * v[1] - v[0] * u[1]; }
    model.points = pts;
    model.edges = edges;
    model.orient = s2 > 0 ? 1 : -1;                 // 1 = counter-clockwise
    model.area = rnd(Math.abs(s2) / 2);              // only for checking the divisions
    model.minX = Math.min.apply(null, pts.map(function (pp) { return pp[0]; }));
    model.maxX = Math.max.apply(null, pts.map(function (pp) { return pp[0]; }));
    model.minY = Math.min.apply(null, pts.map(function (pp) { return pp[1]; }));
    model.maxY = Math.max.apply(null, pts.map(function (pp) { return pp[1]; }));
    model.width = rnd(model.maxX - model.minX);
    model.height = rnd(model.maxY - model.minY);

    var range = config.sizeRange === undefined ? [8, 12] : config.sizeRange;
    if (range) {
        if (model.width < range[0] - EPS || model.width > range[1] + EPS)
            model.warnings.push("The width " + fmt(model.width) + " is outside " + range[0] + "-" + range[1] + ".");
        if (model.height < range[0] - EPS || model.height > range[1] + EPS)
            model.warnings.push("The height " + fmt(model.height) + " is outside " + range[0] + "-" + range[1] + ".");
    }

    try { model.hidden = parseHide(config.hide, n); }
    catch (err2) { model.errors.push(err2.message); return model; }
    var hiddenAxis = {};
    Object.keys(model.hidden).forEach(function (k) {
        var e = edges[k - 1];
        if (hiddenAxis[e.axis]) model.errors.push("Edges " + hiddenAxis[e.axis] + " and " + k + " are both " +
            (e.axis === "h" ? "horizontal" : "vertical") + " and hidden - the student cannot find both. Hide at most one horizontal and one vertical edge.");
        hiddenAxis[e.axis] = k;
    });
    if (model.errors.length) return model;

    model.grid = buildGrid(model);
    model.ways = findWays(model, config.maxWays || 8);
    model.subtract = findSubtract(model);
    model.ok = true;
    return model;
}

/* ============================================================
   Division into rectangles
   The plane is cut into cells by the x and y values of all corners.
   A division is a set of cuts between inside cells; every group of
   cells joined without a cut must be a rectangle.
   ============================================================ */
function pointInPoly(px, py, pts) {
    var c = false;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        var xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
        if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
}

function buildGrid(model) {
    var xs = uniqSorted(model.points.map(function (p) { return p[0]; }));
    var ys = uniqSorted(model.points.map(function (p) { return p[1]; }));
    var nx = xs.length - 1, ny = ys.length - 1, inside = matrix(nx, ny, false);
    for (var i = 0; i < nx; i++)
        for (var j = 0; j < ny; j++)
            inside[i][j] = pointInPoly((xs[i] + xs[i + 1]) / 2, (ys[j] + ys[j + 1]) / 2, model.points);
    return {
        xs: xs, ys: ys, nx: nx, ny: ny, inside: inside,
        isIn: function (i, j) { return i >= 0 && j >= 0 && i < nx && j < ny && inside[i][j]; }
    };
}

function cellRect(g, i0, i1, j0, j1) {
    var r = { i0: i0, i1: i1, j0: j0, j1: j1, x0: g.xs[i0], x1: g.xs[i1], y0: g.ys[j0], y1: g.ys[j1] };
    r.w = rnd(r.x1 - r.x0); r.h = rnd(r.y1 - r.y0); r.area = rnd(r.w * r.h);
    return r;
}

// Strips of cells: vertical = column by column, joining neighbour columns with the same runs.
function slabs(g, test, vertical) {
    var A = vertical ? g.nx : g.ny, B = vertical ? g.ny : g.nx, open = {}, done = [];
    function get(a, b) { return vertical ? test(a, b) : test(b, a); }
    function close(o, aEnd) { done.push(vertical ? cellRect(g, o.a0, aEnd, o.b0, o.b1) : cellRect(g, o.b0, o.b1, o.a0, aEnd)); }
    for (var a = 0; a < A; a++) {
        var next = {}, b = 0;
        while (b < B) {
            if (!get(a, b)) { b++; continue; }
            var b0 = b;
            while (b < B && get(a, b)) b++;
            var key = b0 + "-" + b;
            next[key] = open[key] || { a0: a, b0: b0, b1: b };
        }
        Object.keys(open).forEach(function (k) { if (!next[k]) close(open[k], a); });
        open = next;
    }
    Object.keys(open).forEach(function (k) { close(open[k], A); });
    return done;
}

function reflexCorners(model, g) {
    var out = [], n = model.edges.length;
    for (var k = 0; k < n; k++) {
        var ein = model.edges[(k - 1 + n) % n], eout = model.edges[k];
        var cross = ein.dx * eout.dy - ein.dy * eout.dx;
        if (cross * model.orient < 0) {
            out.push({
                gi: idxOf(g.xs, eout.x0), gj: idxOf(g.ys, eout.y0),
                d1: [sgn(ein.dx), sgn(ein.dy)],          // continue the incoming edge
                d2: [-sgn(eout.dx), -sgn(eout.dy)]       // continue the outgoing edge backwards
            });
        }
    }
    return out;
}

// Every reflex corner gets one cut, along one of its two edges, until it meets the boundary or an earlier cut.
function chordDivision(g, reflex, mask) {
    var nx = g.nx, ny = g.ny;
    var vcut = matrix(nx + 1, ny, false), hcut = matrix(nx, ny + 1, false);
    function cutAt(pi, pj, from) {
        if (from !== "L" && pi > 0 && hcut[pi - 1][pj]) return true;
        if (from !== "R" && pi < nx && hcut[pi][pj]) return true;
        if (from !== "D" && pj > 0 && vcut[pi][pj - 1]) return true;
        if (from !== "U" && pj < ny && vcut[pi][pj]) return true;
        return false;
    }
    reflex.forEach(function (r, k) {
        var d = (mask >> k) & 1 ? r.d2 : r.d1, ux = d[0], uy = d[1], pi = r.gi, pj = r.gj;
        for (var guard = 0; guard < 1000; guard++) {
            var ni = pi + ux, nj = pj + uy;
            if (uy === 0) {
                var c = Math.min(pi, ni);
                if (c < 0 || c >= nx || pj <= 0 || pj >= ny || !g.inside[c][pj - 1] || !g.inside[c][pj] || hcut[c][pj]) break;
                hcut[c][pj] = true;
            } else {
                var rr = Math.min(pj, nj);
                if (rr < 0 || rr >= ny || pi <= 0 || pi >= nx || !g.inside[pi - 1][rr] || !g.inside[pi][rr] || vcut[pi][rr]) break;
                vcut[pi][rr] = true;
            }
            pi = ni; pj = nj;
            if (cutAt(pi, pj, ux === 1 ? "L" : ux === -1 ? "R" : uy === 1 ? "D" : "U")) break;
        }
    });
    var comp = matrix(nx, ny, -1), rects = [], id = 0;
    for (var i = 0; i < nx; i++) {
        for (var j = 0; j < ny; j++) {
            if (!g.inside[i][j] || comp[i][j] >= 0) continue;
            var stack = [[i, j]], mini = i, maxi = i, minj = j, maxj = j, count = 0;
            comp[i][j] = id;
            while (stack.length) {
                var cell = stack.pop(), a = cell[0], b = cell[1];
                count++;
                mini = Math.min(mini, a); maxi = Math.max(maxi, a); minj = Math.min(minj, b); maxj = Math.max(maxj, b);
                var nb = [];
                if (a + 1 < nx && !vcut[a + 1][b]) nb.push([a + 1, b]);
                if (a > 0 && !vcut[a][b]) nb.push([a - 1, b]);
                if (b + 1 < ny && !hcut[a][b + 1]) nb.push([a, b + 1]);
                if (b > 0 && !hcut[a][b]) nb.push([a, b - 1]);
                nb.forEach(function (c2) {
                    if (g.inside[c2[0]][c2[1]] && comp[c2[0]][c2[1]] < 0) { comp[c2[0]][c2[1]] = id; stack.push(c2); }
                });
            }
            if (count !== (maxi - mini + 1) * (maxj - minj + 1)) return null;
            rects.push(cellRect(g, mini, maxi + 1, minj, maxj + 1));
            id++;
        }
    }
    return rects;
}

function kindOf(g, rects) {
    if (rects.length === 1) return "single";
    var hasV = false, hasH = false;
    rects.forEach(function (r) {
        var k;
        for (k = r.j0; k < r.j1; k++) if (g.isIn(r.i0 - 1, k) || g.isIn(r.i1, k)) hasV = true;
        for (k = r.i0; k < r.i1; k++) if (g.isIn(k, r.j0 - 1) || g.isIn(k, r.j1)) hasH = true;
    });
    return hasV && hasH ? "mixed" : (hasV ? "vertical" : "horizontal");
}

// Reading order: top to bottom, then left to right (letters A, B, C ...).
function sortRects(rects) {
    return rects.sort(function (a, b) { return (b.y1 - a.y1) || (a.x0 - b.x0); });
}

function findWays(model, maxWays) {
    var g = model.grid, seen = {}, ways = [];
    function add(rects) {
        if (!rects) return;
        sortRects(rects);
        var key = rects.map(function (r) { return [r.i0, r.i1, r.j0, r.j1].join(","); }).sort().join("|");
        if (seen[key]) return;
        seen[key] = true;
        ways.push({ kind: kindOf(g, rects), rects: rects });
    }
    var inside = function (i, j) { return g.inside[i][j]; };
    add(slabs(g, inside, true));
    add(slabs(g, inside, false));
    var reflex = reflexCorners(model, g).slice(0, 10);
    for (var mask = 0; mask < (1 << reflex.length); mask++) add(chordDivision(g, reflex, mask));
    var order = { single: 0, vertical: 1, horizontal: 2, mixed: 3 };
    ways.sort(function (a, b) { return (a.rects.length - b.rects.length) || (order[a.kind] - order[b.kind]); });
    return ways.slice(0, maxWays);
}

function findSubtract(model) {
    var g = model.grid;
    var outside = function (i, j) { return !g.inside[i][j]; };
    var v = slabs(g, outside, true), h = slabs(g, outside, false);
    var holes = v.length <= h.length ? v : h;
    if (!holes.length) return null;
    return { kind: "subtract", outer: cellRect(g, 0, g.nx, 0, g.ny), holes: sortRects(holes) };
}

/* ============================================================
   Drawing
   ============================================================ */
var SVGNS = "http://www.w3.org/2000/svg";
var styleDone = false, instanceCount = 0;

function addStyle() {
    if (styleDone || typeof document === "undefined") return;
    styleDone = true;
    var css =
        ".ra-box{display:inline-block;max-width:100%;box-sizing:border-box;border:1px solid #444;background:#fff;color:#222;" +
        "padding:6px 10px 10px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.45;vertical-align:top}" +
        ".ra-box svg{display:block;width:100%;height:auto}" +
        ".ra-ctrl{display:flex;align-items:center;gap:10px;margin-top:2px}" +
        ".ra-ctrl input{flex:1;min-width:100px;accent-color:#444;margin:0}" +
        ".ra-n{min-width:3.6em;font-weight:bold;direction:ltr;unicode-bidi:isolate}" +
        ".ra-cap{margin-top:4px;font-weight:bold}" +
        ".ra-line{margin-top:1px}" +
        ".ra-math{direction:ltr;unicode-bidi:isolate}" +
        ".ra-err{display:inline-block;border:1px solid #c0392b;background:#fdecea;color:#7b1d14;padding:8px 12px;" +
        "font-family:Arial,Helvetica,sans-serif;font-size:14px}" +
        ".ra-err ul{margin:4px 0 0;padding-inline-start:20px}";
    var st = document.createElement("style");
    st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
}

function svg(name, attrs, parent) {
    var el = document.createElementNS(SVGNS, name);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
}
function html(name, cls, parent, text) {
    var el = document.createElement(name);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    if (parent) parent.appendChild(el);
    return el;
}
function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }

function resolveTarget(target) {
    var el = target;
    if (typeof target === "string") el = document.getElementById(target) || document.querySelector(target);
    if (!el) throw new Error("RectArea: target not found");
    if (el.tagName && el.tagName.toLowerCase() === "script") {
        var div = document.createElement("div");
        el.parentNode.insertBefore(div, el);
        el = div;
    }
    return el;
}

function render(target, config) {
    config = config || {};
    addStyle();
    var host = resolveTarget(target);
    var model = analyse(config);
    var lang = TEXTS[config.lang] ? config.lang : "en";
    var T = {};
    Object.keys(TEXTS.en).forEach(function (k) { T[k] = TEXTS.en[k]; });
    Object.keys(TEXTS[lang]).forEach(function (k) { T[k] = TEXTS[lang][k]; });   // also language-only keys (rects2)
    if (config.texts) Object.keys(config.texts).forEach(function (k) { T[k] = config.texts[k]; });
    function tx(key, vars) {
        return String(T[key]).replace(/\{(\w+)\}/g, function (m0, name) { return vars && vars[name] != null ? vars[name] : m0; });
    }
    // "{n} rectangles", with the optional forms rects2 (dual) and rectsMany (11+)
    function rectsText(n) {
        if (n === 2 && T.rects2) return tx("rects2", { n: n });
        if (n >= 11 && T.rectsMany) return tx("rectsMany", { n: n });
        return tx("rects", { n: n });
    }

    clear(host);
    if (!model.ok) {
        var eb = html("div", "ra-err", host);
        eb.dir = RTL[lang] ? "rtl" : "ltr";
        html("b", null, eb, T.errTitle);
        var ul = html("ul", null, eb);
        model.errors.forEach(function (m) { html("li", null, ul, m); });
        return { model: model, element: eb, show: function () {} };
    }
    if (model.warnings.length && typeof console !== "undefined") console.warn("RectArea: " + model.warnings.join(" "));

    var mode = config.helper || "none";
    var showDims = mode === "dims";
    var reveal = !!config.revealHidden;
    var uid = "ra" + (++instanceCount);

    var maxPx = config.width || 420, pad = 40;
    var scale = Math.min((maxPx - 2 * pad) / model.width, (maxPx * 1.1 - 2 * pad) / model.height);
    var sw = model.width * scale + 2 * pad, sh = model.height * scale + 2 * pad;
    function X(v) { return pad + (v - model.minX) * scale; }
    function Y(v) { return pad + (model.maxY - v) * scale; }

    var box = html("div", "ra-box", host);
    box.dir = RTL[lang] ? "rtl" : "ltr";
    box.style.width = Math.round(sw + 22) + "px";
    var root = svg("svg", { viewBox: "0 0 " + fmt(sw) + " " + fmt(sh), direction: "ltr",
                            "font-family": "Arial, Helvetica, sans-serif", role: "img" }, box);
    root.style.maxWidth = Math.round(sw) + "px";
    var defs = svg("defs", {}, root);
    var pat = svg("pattern", { id: uid + "h", width: 8, height: 8, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, defs);
    svg("rect", { width: 8, height: 8, fill: "#fbe3e0" }, pat);
    svg("line", { x1: 0, y1: 0, x2: 0, y2: 8, stroke: "#e07a6f", "stroke-width": 2 }, pat);

    var gGrid = svg("g", {}, root), gBack = svg("g", {}, root), gPoly = svg("g", {}, root),
        gOver = svg("g", {}, root), gLine = svg("g", {}, root), gLab = svg("g", {}, root), gOverLab = svg("g", {}, root);

    if (config.grid) {
        var gx, gy;
        for (gx = Math.ceil(model.minX - EPS); gx <= model.maxX + EPS; gx++)
            svg("line", { x1: X(gx), y1: Y(model.minY), x2: X(gx), y2: Y(model.maxY), stroke: "#e3e3e3", "stroke-width": 1 }, gGrid);
        for (gy = Math.ceil(model.minY - EPS); gy <= model.maxY + EPS; gy++)
            svg("line", { x1: X(model.minX), y1: Y(gy), x2: X(model.maxX), y2: Y(gy), stroke: "#e3e3e3", "stroke-width": 1 }, gGrid);
    }

    var ptsAttr = model.points.map(function (p) { return fmt(X(p[0])) + "," + fmt(Y(p[1])); }).join(" ");
    svg("polygon", { points: ptsAttr, fill: "#f6ebe6", stroke: "none" }, gPoly);
    svg("polygon", { points: ptsAttr, fill: "none", stroke: "#b5643c", "stroke-width": 2.5, "stroke-linejoin": "miter" }, gLine);
    if (reveal) Object.keys(model.hidden).forEach(function (k) {
        var e = model.edges[k - 1];
        svg("line", { x1: X(e.x0), y1: Y(e.y0), x2: X(e.x1), y2: Y(e.y1), stroke: HIDDEN_COLOR, "stroke-width": 3 }, gLine);
    });

    function label(parent, x, y, text, attrs) {
        var a = { x: fmt(x), y: fmt(y), "font-size": 15, fill: "#8a3a12", "text-anchor": "middle", "dominant-baseline": "central",
                  stroke: "#fff", "stroke-width": 4, "paint-order": "stroke", "stroke-linejoin": "round" };
        if (attrs) for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) a[k] = attrs[k];
        var t = svg("text", a, parent);
        t.textContent = text;
        return t;
    }

    // Edge lengths, outside the shape
    model.edges.forEach(function (e) {
        var mx = (X(e.x0) + X(e.x1)) / 2, my = (Y(e.y0) + Y(e.y1)) / 2;
        var nxs = model.orient * e.dy / e.len, nys = model.orient * e.dx / e.len;   // outward normal, screen coordinates
        var hid = model.hidden[e.num], text = fmt(e.len), extra = {};
        if (hid != null) {
            text = reveal ? (hid ? hid + " = " + fmt(e.len) : fmt(e.len)) : hid;
            extra = { fill: HIDDEN_COLOR };
        }
        if (text) {
            if (e.axis === "h") label(gLab, mx, my + nys * 13, text, extra);
            else {
                extra["text-anchor"] = nxs > 0 ? "start" : "end";
                label(gLab, mx + nxs * 7, my, text, extra);
            }
        }
        if (config.edgeNumbers)
            label(gLab, mx - (e.axis === "v" ? nxs * 14 : 0), my - (e.axis === "h" ? nys * 13 : 0), "#" + e.num,
                  { "font-size": 11, fill: "#888", stroke: "none" });
    });

    var views = model.ways.slice();
    if (model.subtract) views.push(model.subtract);
    // Every way gets its own letters: A, B | C, D | E ...
    var first = [], used = 0;
    views.forEach(function (v) { first.push(used); used += (v.rects || v.holes).length; });

    function rectLabel(r, letter, color) {
        var x0 = X(r.x0), x1 = X(r.x1), y0 = Y(r.y1), y1 = Y(r.y0);
        var w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
        var dims = fmt(r.w) + " " + TIMES + " " + fmt(r.h);
        var dimsFit = showDims && w > dims.length * 7 + 8 && h > 38;
        if (h < 18 || w < 14) return;
        label(gOverLab, cx, dimsFit ? cy - 9 : cy, letter, { fill: color, "font-weight": "bold", "font-size": 15 });
        if (dimsFit) label(gOverLab, cx, cy + 10, dims, { fill: "#333", "font-size": 13 });
    }

    // Controls and texts
    var ctrl, slider, nLab, cap, panel;
    if (mode !== "none") {
        ctrl = html("div", "ra-ctrl", box);
        nLab = html("span", "ra-n", ctrl);
        slider = html("input", null, ctrl);
        slider.type = "range"; slider.min = 0; slider.max = views.length; slider.step = 1;
        slider.setAttribute("aria-label", T.hint);
        cap = html("div", "ra-cap", box);
        panel = html("div", "ra-panel", box);
        slider.addEventListener("input", function () { show(Number(slider.value)); });
    }

    function line(parent, lead, math, cls) {
        var d = html("div", "ra-line" + (cls ? " " + cls : ""), parent);
        if (lead) d.appendChild(document.createTextNode(lead + ": "));
        html("span", "ra-math", d, math);
        return d;
    }

    function show(k) {
        k = Math.max(0, Math.min(views.length, Math.round(k || 0)));
        clear(gBack); clear(gOver); clear(gOverLab);
        var view = k ? views[k - 1] : null;
        var L = function (i) { return letter(first[k - 1] + i); };
        if (view && view.kind === "subtract") {
            var o = view.outer;
            svg("rect", { x: X(o.x0), y: Y(o.y1), width: o.w * scale, height: o.h * scale, fill: "#fff",
                          stroke: "#555", "stroke-width": 1.5, "stroke-dasharray": "6 4" }, gBack);
            view.holes.forEach(function (r, i) {
                svg("rect", { x: X(r.x0), y: Y(r.y1), width: r.w * scale, height: r.h * scale, fill: "url(#" + uid + "h)",
                              stroke: "#c0392b", "stroke-width": 1.5, "stroke-dasharray": "6 4" }, gOver);
                // letter in the outer corner: the shape's edge lengths stand near the inner sides
                var left = Math.abs(r.x0 - o.x0) < EPS, top = Math.abs(r.y1 - o.y1) < EPS;
                if (r.w * scale >= 18 && r.h * scale >= 18)
                    label(gOverLab, left ? X(r.x0) + 11 : X(r.x1) - 11, top ? Y(r.y1) + 12 : Y(r.y0) - 12, L(i),
                          { fill: "#c0392b", "font-weight": "bold" });
            });
        } else if (view) {
            view.rects.forEach(function (r, i) {
                var col = PALETTE[i % PALETTE.length];
                svg("rect", { x: X(r.x0), y: Y(r.y1), width: r.w * scale, height: r.h * scale, fill: col, "fill-opacity": 0.22,
                              stroke: col, "stroke-width": 2, "stroke-dasharray": "7 4" }, gOver);
                rectLabel(r, L(i), col);
            });
        }
        if (!slider) return;
        slider.value = k;
        nLab.textContent = "n = " + k;
        clear(panel);
        if (!view) { cap.textContent = T.hint; return; }
        var head = tx("way", { k: k, n: views.length }) + ": ";
        if (view.kind === "subtract") {
            cap.textContent = head + T.subtract;
            var o2 = view.outer;
            if (showDims) {
                line(panel, T.bigRect, fmt(o2.w) + " " + TIMES + " " + fmt(o2.h));
                view.holes.forEach(function (r, i) {
                    line(panel, L(i) + " (" + T.missing + ")", fmt(r.w) + " " + TIMES + " " + fmt(r.h));
                });
            }
        } else {
            cap.textContent = head + (view.kind === "single" ? T.single : T[view.kind] + " - " + rectsText(view.rects.length));
            if (showDims) view.rects.forEach(function (r, i) {
                line(panel, L(i), fmt(r.w) + " " + TIMES + " " + fmt(r.h));
            });
        }
    }

    show(config.startView || 0);
    return { model: model, element: box, show: show, views: views };
}

function safeRender(item) {
    try { return render(item[0], item[1]); }
    catch (err) { if (typeof console !== "undefined") console.error(err); }
}

var api = {
    version: VERSION,
    analyse: analyse,
    render: render,
    texts: TEXTS,
    format: fmt
};

root.RectArea = api;
// Snippets that ran before this file loaded wait in window.__rectAreaQ; later ones render at once.
var queued = root.__rectAreaQ;
root.__rectAreaQ = { push: function (item) { safeRender(item); } };
if (queued && queued.length) for (var qi = 0; qi < queued.length; qi++) safeRender(queued[qi]);

if (typeof module !== "undefined" && module.exports) module.exports = api;

})(typeof window !== "undefined" ? window : globalThis);
