---
name: fact-check-gate
description: Checks a finished chart or infographic before publication by recomputing every number, and every comparison or ranking, in its title, dek, labels, annotations and alt text from the source data, auditing the plotted values, and checking the source line, credits and alt text. Returns PASS or a numbered fix list. Use before anything is published or shared, or when a reporter asks to verify, fact-check, double-check or proof a graphic or its numbers.
---

# Fact-check gate

## Goal
Nothing leaves the desk with a number that doesn't match the source file. Return a clear verdict: PASS, or FAIL with a numbered list of exactly what to fix.

## Steps
1. Gather the chart spec, the source data file, and (if it exists) the renderer's `<slug>_plotted_data.csv`. If there is no spec, reconstruct one from the graphic: list every number shown and what it claims to be.
2. Run the checks.
   - If you can run scripts: `python scripts/recheck.py spec.yaml --plotted exports/<slug>_plotted_data.csv --out report.md`.
   - If not, do the same yourself, independently of whoever made the chart:
     a. Recompute every claim (value, change, percent change, ratio, rank, share) from the source file. A stated number passes if it equals the computed value rounded to the precision it is written at.
     b. Every number in the title, dek and annotations must match a claim. Numbers in the alt text should match the data.
     c. Recompute the plotted values from the source using the spec's filters and compare them with what was drawn.
     d. Highlighted entities must appear in the chart.
     d2. Every comparison, crossover, direction or ranking the words state (more than, less than, passed, rose, highest) must match an assertion that says the same thing, with the same entities in the same direction, and each assertion must hold when you recompute it. A headline can be wrong with every number right: "more than the United States" fails if China is at 8.7 and the United States at 14.2.
     e. Source line starts with "Source:", alt text is present and states the pattern, the value label names the unit, and any AI illustration is disclosed.
     f. Wording: no "caused" unless the source shows cause; no "record" unless the full series was checked; title within 60 characters.
3. Write the report in the format of `resources/check-report.md`: verdict first, then the fix list, then what to check by hand, then what passed.
4. On FAIL, propose the exact corrected wording or number for each item. On PASS, remind the user that an editor still signs off.

## Rules
- Do your own calculation. Never reuse the chart maker's numbers as the check.
- Do not soften a FAIL. One wrong number is a FAIL.
- A PASS confirms the numbers match the file, not that the file is right. Say so.
- Do not change the spec or the graphic yourself unless asked; list the fixes.

## Output
A check report following `resources/check-report.md`.
