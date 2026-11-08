/*
 * Copyright (c) 2026 Avi Nathan. All rights reserved.
 * No part of this file may be copied, modified or distributed without the written permission of the copyright holder.
 */
/* Run: node rect-area-tests.js */
"use strict";
var RA = require("./rect-area.js");
var TPL = require("./rect-area-templates.js");

var fails = 0, checks = 0;
function ok(cond, msg) { checks++; if (!cond) { fails++; console.log("FAIL: " + msg); } }
function near(a, b) { return Math.abs(a - b) < 1e-6; }

function checkWays(m, label) {
    ok(m.ways.length >= 1, label + ": no way to divide");
    m.ways.forEach(function (w, k) {
        var sum = 0;
        w.rects.forEach(function (r) { sum += r.area; });
        ok(near(sum, m.area), label + ": way " + (k + 1) + " rect areas " + sum + " != " + m.area);
        // rectangles must not overlap
        for (var i = 0; i < w.rects.length; i++)
            for (var j = i + 1; j < w.rects.length; j++) {
                var a = w.rects[i], b = w.rects[j];
                var ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
                ok(!(ox > 1e-9 && oy > 1e-9), label + ": way " + (k + 1) + " rects overlap");
            }
    });
    if (m.subtract) {
        var holes = m.subtract.holes.reduce(function (t, r) { return t + r.area; }, 0);
        ok(near(m.subtract.outer.area - holes, m.area), label + ": subtract gives " + (m.subtract.outer.area - holes));
    }
}

// 1. Templates with random values, compared with the Formulas answer expressions
TPL.list.forEach(function (t) {
    for (var n = 0; n < 400; n++) {
        var vals = TPL.randomValues(t), label = t.id + " " + JSON.stringify(vals);
        var m = RA.analyse({ steps: TPL.steps(t, vals), hide: t.hide });
        ok(m.ok, label + ": " + m.errors.join(" "));
        if (!m.ok) continue;
        ok(m.warnings.length === 0, label + ": " + m.warnings.join(" "));
        ok(near(m.area, TPL.evalExpr(t.area, vals)), label + ": area " + m.area + " != formula " + TPL.evalExpr(t.area, vals));
        checkWays(m, label);
    }
});

// 2. The shape from the picture: 5 x 10 with a 2 x 5 corner missing
var pic = RA.analyse({ steps: [[5, 0], [0, -5], [-2, 0], [0, -5], [-3, 0]], sizeRange: null });
ok(pic.ok && pic.area === 40, "picture shape: area 40");
ok(pic.autoClosed, "picture shape: closing edge added");
ok(pic.ways.length === 2, "picture shape: 2 ways, got " + pic.ways.length);
ok(pic.ways[0].kind === "vertical" && pic.ways[1].kind === "horizontal", "picture shape: vertical then horizontal");
ok(pic.subtract && pic.subtract.holes.length === 1 && pic.subtract.holes[0].area === 10, "picture shape: one hole 2 x 5");
checkWays(pic, "picture");

// 2b. Second picture: notches at top-left and bottom-right, edges 3 and 6 hidden (blue in the picture)
var pic2 = RA.analyse({ path: "R7 D6 L2 D1 L6 U4 R1 U3", hide: [3, 6] });
ok(pic2.ok, "picture 2: " + pic2.errors.join(" "));
ok(pic2.width === 8 && pic2.height === 7 && pic2.area === 51, "picture 2: 8 x 7, area 51");
ok(pic2.hidden[3] === "" && pic2.hidden[6] === "", "picture 2: hidden edges have no label");
ok(pic2.ways.length === 4 && pic2.subtract.holes.length === 2, "picture 2: 4 ways + 2 missing parts");
checkWays(pic2, "picture 2");

// 3. Other forms of the steps
ok(RA.analyse({ path: "R5 D5 L2 D5 L3", sizeRange: null }).area === 40, "R/L/U/D path");
ok(RA.analyse({ steps: "5,0 0,-5 -2,0 0,-5 -3,0", sizeRange: null }).area === 40, "string of pairs");
ok(RA.analyse({ steps: [[5, 0], [0, -5], [-2, 0], [0, -5], [-3, 0], [0, 10]], sizeRange: null }).ok, "closed by the last step");
ok(RA.analyse({ steps: [[2.5, 0], [0, -1.5], [-2.5, 0]], sizeRange: null }).area === 3.75, "decimal values");

// 4. Errors the teacher should see
function err(cfg, part, label) {
    var m = RA.analyse(cfg);
    ok(!m.ok && m.errors.join(" ").indexOf(part) >= 0, label + " -> " + m.errors.join(" "));
}
err({ steps: [[5, 2], [0, -5]] }, "not parallel", "diagonal step");
err({ steps: [[5, 0], [0, 0], [0, -5]] }, "length 0", "zero step");
err({ steps: [[5, 0], [0, -5], [-2, 0]] }, "must end", "cannot close");
err({ steps: [[5, 0], [3, 0], [0, -5], [-8, 0]] }, "one line", "collinear steps");
err({ steps: [[10, 0], [0, -10], [-5, 0], [0, 15], [-5, 0]] }, "cross", "self crossing");
err({ steps: [[5, 0], [0, -5], [-2, 0], [0, -5], [-3, 0]], hide: [1, 3] }, "both horizontal", "two hidden horizontal");
err({ steps: [[5, 0], [0, -5], [-5, 0]], hide: [7] }, "no edge 7", "hide out of range");
ok(RA.analyse({ steps: [[5, 0], [0, -5], [-5, 0]] }).warnings.length === 2, "size warning for 5 x 5");

// 5. A shape with many corners (plus / cross) - every division must still be valid
var plus = RA.analyse({ path: "R3 U3 R3 D3 R3 D3 L3 D3 L3 U3 L3 U3", sizeRange: null });
ok(plus.ok && plus.area === 45, "plus shape area " + plus.area);
checkWays(plus, "plus");

// 6. Rectangle: one way, nothing to subtract
var rect = RA.analyse({ steps: [[10, 0], [0, -8], [-10, 0]] });
ok(rect.ways.length === 1 && rect.ways[0].kind === "single" && !rect.subtract, "plain rectangle");

console.log(fails ? fails + " of " + checks + " checks FAILED" : "all " + checks + " checks passed");
process.exit(fails ? 1 : 0);
