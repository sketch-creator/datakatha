---
name: data-explorer
description: Answers a reporter's follow-up questions about a dataset in plain language by filtering, grouping, comparing and recomputing with code, and always shows the method. Use when a reporter asks things like "only for 2024", "per person", "which ones", "how does X compare to Y", "what's the average", "since when", "show me the rows", or wants a filtered table or quick check of a number.
---

# Data explorer

## Goal
Give a direct, correct answer to the reporter's question, with the table that backs it and the method used, so the number can be checked and reused.

## Steps
1. Restate the question as a precise calculation in one line, including the filter, grouping, measure and period. If two readings are plausible, pick the likelier one, say which you picked, and offer the other.
2. Compute with code on the full file. Never estimate from a sample or from memory.
3. Answer in this order:
   - **Answer:** one or two sentences with the number, in house-style.
   - **Table:** the rows behind it, sorted by what matters, at most 15 rows (offer the rest as a CSV).
   - **Method:** the code or formula in a short block, and the exact filters used.
   - **Caveats:** missing values, exclusions, small groups, provisional periods.
4. If the answer changes or weakens an angle from the story-finder memo, say so plainly.
5. Offer the natural next question or chart-advisor when the answer is chart-worthy.

## Common patterns
- Per person or per 100,000: divide by the population column from the same period; state the population floor used for rankings.
- Change: give both endpoints, the absolute change and the percent change. For percentages, give the change in percentage points.
- Rankings: say how many entities were ranked and what was excluded. Ties get the same rank.
- Averages: say whether it is a simple average across places or a weighted average (for example, total emissions divided by total population). They differ, often a lot.
- Shares: say what the denominator is (the file's total or the publisher's official total).
- Comparisons between two places: give both values and the ratio, not just the ratio.

## Rules
- Never invent rows, columns or values. If the data can't answer the question, say what data would.
- Keep full precision until the final answer; round once using house-style.
- Name the units every time.
- If the filtered result has fewer than 30 rows, say so.
