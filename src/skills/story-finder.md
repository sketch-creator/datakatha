---
name: story-finder
description: Finds newsworthy story angles in a dataset and ranks them, each backed by numbers computed from the file. Use after data-intake has produced a data card, or when a reporter asks what the story is, what is surprising, what stands out, or wants angles, outliers, trends, biggest changes, rankings or comparisons.
---

# Story finder

## Goal
Return 3 to 5 ranked story angles. Each one has a finding with its number, the evidence, why readers should care, what the reporter must check, and the chart to hand to chart-advisor.

## Steps
1. Read the data card. If there isn't one, run data-intake first and say so in one line.
2. Decide the columns: the entity (place, company, school), the time column, the main measure, a per-person or per-unit measure if one exists, and a size column (population) for a floor. Exclude totals and groups the data card flagged.
3. Run the standard checks with code, not by eye.
   - If you can run scripts, run `scripts/find_angles.py` (use `--help` for the arguments). Example: `python scripts/find_angles.py data.csv --entity country --time year --value co2 --rate co2_per_capita --size population --min-size 1000000 --min-value 100 --base 1990 --unit "million tonnes" --rate-unit "tonnes per person"`.
   - If you cannot run the script, compute the same seven checks yourself: leaders and concentration in the latest period (the five largest and their share of the total, naming the denominator); biggest rises and falls since a base period (percent, multiple and absolute); per-person highs and lows above a population floor; entities well below their own peak; latest-period turns against the recent trend; outliers more than 2 standard deviations from the group; per-person crossovers among the ten largest emitters (pairs whose order swapped between the base period and the latest).
4. Before the memo, list the checks you ran with a one-line result each ("Checks run"), so nothing is skipped silently. Then pick the 3 to 5 strongest. A crossover among big emitters or a concentration finding can matter more to readers than one country's extreme. Rank by: impact on readers, surprise, local relevance, and how solid the evidence is. Prefer angles that survive a different base year or a different floor.
5. Pressure-test each angle before writing it up: try another base year, check whether a small base inflates the percent, check whether the latest period is provisional. Drop or caveat angles that wobble.
6. Write the memo in the format of `resources/angle-memo.md`.
7. Offer two next steps: data-explorer for follow-up questions, or chart-advisor on the angle the reporter picks.

## Rules
- Never state a number you did not compute from the file. If you can't compute something, say so.
- Show percent and absolute change together when they tell different stories, and say which one the headline uses.
- Normalize before comparing places of different size, and say which normalization you used.
- Say "linked to", not "caused". Offer likely explanations only as questions for reporting, never as findings.
- Flag small groups, small bases, missing years and definition changes.
- Follow house-style for numbers, dates and headline wording.

## Output
An angle memo following `resources/angle-memo.md`.
