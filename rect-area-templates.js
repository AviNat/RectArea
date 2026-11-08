/*
 * Copyright (c) 2026 Avi Nathan. All rights reserved.
 * No part of this file may be copied, modified or distributed without the written permission of the copyright holder.
 */
/*
 * Shape templates for RectArea - used by the demo page and the tests (not needed in Moodle).
 * Every template is written the way a Formulas question uses it:
 *   vars:   random variables, each an independent range [low, high] (Formulas: {low:high+1})
 *           chosen so that every combination gives a valid shape with sides 8-12.
 *   steps:  the snippet text, with {name} placeholders that Formulas fills in.
 *   area:   used only by the tests, to check the divisions (the question calculates its own answers).
 *   hide:   suggested edges to hide (one horizontal, one vertical).
 */
(function (root) {
"use strict";

var LIST = [
    {
        id: "L", name: "L shape (corner cut off)",
        vars: { W: [8, 12], H: [8, 12], cw: [2, 5], ch: [2, 5] },
        steps: "[[{W},0],[0,{ch}-{H}],[-{cw},0],[0,-{ch}],[{cw}-{W},0]]",
        area: "W*H - cw*ch",
        hide: [3, 4]
    },
    {
        id: "U", name: "U shape (notch from the top)",
        vars: { W: [9, 12], H: [8, 12], a: [2, 3], nw: [2, 3], nd: [2, 5] },
        steps: "[[{a},0],[0,-{nd}],[{nw},0],[0,{nd}],[{W}-{a}-{nw},0],[0,-{H}],[-{W},0]]",
        area: "W*H - nw*nd",
        hide: [3, 6]
    },
    {
        id: "T", name: "T shape",
        vars: { W: [8, 12], H: [8, 12], t: [2, 4], a: [2, 3], s: [2, 3] },
        steps: "[[{W},0],[0,-{t}],[{a}+{s}-{W},0],[0,{t}-{H}],[-{s},0],[0,{H}-{t}],[-{a},0]]",
        area: "W*t + s*(H-t)",
        hide: [5, 6]
    },
    {
        id: "S", name: "Stairs (two steps)",
        vars: { W: [8, 12], H: [8, 12], a: [2, 3], c: [2, 3], b: [2, 3], d: [2, 3] },
        steps: "[[{a},0],[0,-{b}],[{c},0],[0,-{d}],[{W}-{a}-{c},0],[0,{b}+{d}-{H}],[-{W},0]]",
        area: "W*H - (W-a)*b - (W-a-c)*d",
        hide: [3, 4]
    },
    {
        id: "C", name: "Two corners cut off",
        vars: { W: [8, 12], H: [8, 12], p: [2, 3], q: [2, 3], r: [2, 3], u: [2, 3] },
        steps: "[[{W}-{p},0],[0,-{q}],[{p},0],[0,{q}-{H}],[{r}-{W},0],[0,{u}],[-{r},0]]",
        area: "W*H - p*q - r*u",
        hide: [1, 4]
    }
];

function randomValues(t) {
    var vals = {};
    Object.keys(t.vars).forEach(function (k) {
        var r = t.vars[k];
        vals[k] = r[0] + Math.floor(Math.random() * (r[1] - r[0] + 1));
    });
    return vals;
}

// Replace {name} by its value - what Formulas does to the question text.
function fill(text, vals) {
    return text.replace(/\{(\w+)\}/g, function (m0, k) { return vals[k] != null ? String(vals[k]) : m0; });
}

// Evaluate a Formulas-style expression (only + - * / and parentheses are used here).
function evalExpr(expr, vals) {
    var names = Object.keys(vals);
    /* eslint-disable no-new-func */
    return Function.apply(null, names.concat("return (" + expr + ");")).apply(null, names.map(function (k) { return vals[k]; }));
}

function steps(t, vals) {
    return Function("return " + fill(t.steps, vals) + ";")();
}

// Text for the Formulas "Random variables" box.
function formulasText(t) {
    return Object.keys(t.vars).map(function (k) { return k + " = {" + t.vars[k][0] + ":" + (t.vars[k][1] + 1) + "};"; }).join("\n");
}

var api = { list: LIST, randomValues: randomValues, fill: fill, evalExpr: evalExpr, steps: steps, formulasText: formulasText };
root.RectAreaTemplates = api;
if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
