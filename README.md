# RectArea

Drawing for area and perimeter questions in Moodle **Formulas**. The shape is a polygon with right angles only, inside a rectangle with sides of 8 to 12 units.

The library only draws. The question calculates and checks the answers and gives the feedback on them. The one exception is helper `"calc"`, which in feedback mode shows the area calculation for the division on the slider.

| File | What it is |
|---|---|
| `rect-area.js` | The library. Moodle loads it from the snippet. |
| `rect-area-demo.html` | Demo page and snippet builder. Open it in a browser. `?tpl=custom&view=2&lang=he` sets the template, the slider position and the language. |
| `rect-area-templates.js` | Ready shapes (L, U, T, stairs, two corners) with their Formulas random variables. Used by the demo and the tests. |
| `rect-area-tests.js` | `node rect-area-tests.js` |

## The shape

- The path starts at (0,0). Every step is `[dx, dy]` from the previous point, and one of dx, dy must be 0.
- If the last step does not return to (0,0), the library adds the closing edge. The closing edge must be parallel to an axis.
- Edges are numbered 1, 2, 3 … in the order of the steps. The closing edge gets the last number. Turn on "edge numbers" in the demo to see them.
- Other ways to write the path: `"5,0 0,-5 -2,0"`, or `path: "R7 D6 L2 D1 L6 U4 R1 U3"`.

The library stops with a clear message when a step is diagonal, a step has length 0, two steps lie on one line, the shape crosses itself, or two hidden edges have the same direction. If the bounding rectangle is outside 8–12, it only writes a warning to the browser console.

## Config

| Option | Default | |
|---|---|---|
| `steps` | – | `[[dx,dy], ...]` |
| `hide` | none | `[3,6]` draws edges 3 and 6 with no length. `{3:"a",6:"b"}` shows a label instead. Hide at most one horizontal and one vertical edge. |
| `revealHidden` | `false` | Draws the hidden edges in blue, with their length. |
| `answer` | none | Ids of the answer fields, e.g. `"part1-{mb},part2-{mb}"`. The id can also be on an element around the field. When every field found is read-only (or disabled), the answer was submitted and the diagram switches to feedback mode. |
| `feedback` | none | The options that change in feedback mode, e.g. `{helper:"calc", revealHidden:true, startView:1}`. `true` means `{helper:"calc", revealHidden:true}`. Without it, nothing changes after submitting. |
| `submitted` | from `answer` | `true` or `false` forces the state, for testing. |
| `helper` | `"none"` | `"divide"`: a slider shows the ways to divide, with no numbers. `"dims"`: also the sides of each rectangle. `"calc"`: also the full calculation, e.g. `A: 2 · 3 = 6`, `B: 5 · 10 = 50`, `6 + 50 = 56` (for the last position: `8 · 7 = 56` … `56 − 2 − 3 = 51`). It gives the answer away, so use it in `feedback`. |
| `times` | `"·"` | The multiplication sign, as taught in 7th grade. `"×"` if you prefer. |
| `lang` | `"en"` | `"he"` for Hebrew, `"ar"` for Arabic (both right to left). `texts: {key: "..."}` replaces single texts. |
| `width` | `420` | Largest size of the drawing, in px. |
| `grid` | `false` | Unit grid behind the shape. |
| `startView` | `0` | Slider position at the start. 0 = the shape only. |
| `maxWays` | `8` | Most ways to divide shown. "Big rectangle minus the missing parts" is always added after them. |
| `allWays` | `false` | `true` also shows ways with a cut that is not needed (two pieces that together make one rectangle). |
| `sizeRange` | `[8,12]` | Range for the console warning. `null` turns it off. |

How the slider's ways are found:
- Vertical strips and horizontal strips.
- Every combination of cuts from the inner (270°) corners. Each cut continues one edge of the corner until it meets the border or an earlier cut.
- Ways with a cut that is not needed are removed: two pieces with a whole side in common would be one rectangle. `allWays:true` keeps them.
- Ways that repeat are removed. The rest are sorted with the fewest rectangles first.
- The last position shows the big rectangle minus the missing parts.

The rectangles get new letters in every way: A, B in the first way, C, D in the next, and so on. The missing parts continue the same letters.

## In Moodle Formulas

1. Put the random variables and the global variables in Formulas. The demo gives both for every template. `A` is the area and `P` the perimeter. Use them as the answers of the parts; their feedback is your own.
2. Paste the snippet into the question text, in the HTML (source) view, as **one line**.
3. Feedback mode is part of the same diagram. Set `answer` to the ids of the answer fields, made unique with the question's random variable `mb` (`part1-{mb}` becomes `part1-123456`). Set `feedback` to the options for after submitting.

Several diagrams on one page work. Each snippet draws where it stands, the library loads once, and the questions' `mb` keeps their answer ids apart. `rect-area-multi-test.html` tests four questions on one page, submitted and not.

What the snippet looks like:

```html
<script>(function(){var c={steps:[[{W},0],[0,{ch}-{H}],[-{cw},0],[0,-{ch}],[{cw}-{W},0]],hide:[3,4],helper:"divide"};var s=document.currentScript;var w=window;if(w.RectArea){w.RectArea.render(s,c);return;}var q=w.__rectAreaQ=w.__rectAreaQ||[];q.push([s,c]);if(!w.__rectAreaLoading){w.__rectAreaLoading=1;var e=document.createElement("script");e.src="https://avinat.github.io/RectArea/rect-area.js";document.head.appendChild(e);}})();</script>
```

- Formulas replaces `{W}` and the other placeholders with the random values. JavaScript then works out expressions such as `{ch}-{H}`.
- The script has no `<`, `>` or `&` characters, because Moodle escapes them, and no line breaks, because Moodle turns them into `<br />`.
- Language from Moodle: the demo's default "Moodle multilang" writes `lang:<span class="multilang" lang="he">"he"</span><span class="multilang" lang="ar">"ar"</span>`. The multilang filter keeps only the student's span, so the script gets `lang:"he"` or `lang:"ar"`. These spans are the only `<` `>` allowed in the snippet, and the filter must be on.
- The library is a plain script with no `define()`, so Moodle's RequireJS does not complain about it.
- The drawing appears right where the script is.

## Why plain SVG and not JSXGraph

The drawing is static: there is nothing to drag. SVG does it with no dependency. JSXGraph would add about 600 KB, and its `define()` meets Moodle's RequireJS the same way GeoGebra's loader did. JSXGraph would be worth it only if the student is to draw the cut lines themselves.

## Not done yet

- The library is not published yet. Put it on GitHub Pages, at the address used in the demo, or change the "Library address" field.
- Not yet tried in a real Moodle Formulas question.
