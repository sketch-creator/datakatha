---
name: data-intake
description: Profiles a new dataset (CSV, spreadsheet, a table pulled from a PDF, or a table copied from a web page) and writes a data card covering rows, columns, units, time range, coverage gaps, duplicates, suspicious values and provenance. Use first whenever a reporter shares a data file, asks what is in a dataset, asks whether data is clean or usable, or before finding story angles.
---

# Data intake

## Goal
Produce a data card the reporter can trust before anyone looks for stories. The data card is the first handoff in the data desk workflow.

## Steps
1. Identify the input.
   - CSV, TSV or spreadsheet: load it.
   - PDF: extract the tables (for example with pdfplumber or camelot), save each as CSV, and note the page number each came from. Say which pages had no extractable table.
   - Web page: copy the table into a CSV and record the URL and the date and time retrieved.
   - A codebook or data dictionary, if supplied, is used for units and definitions.
2. Profile it with code.
   - If you can run scripts, run `scripts/profile.py <file> --codebook <codebook> --source "<publisher, dataset>"`. Run it with `--help` first if unsure.
   - If you cannot run the script, do the same checks with your own code: row and column counts, type of each column, percent filled, distinct values, min and max, likely unit of analysis, likely time column, whether there is exactly one row per unit per period, gaps in coverage, exact duplicates, values that look like totals or groups, numbers stored as text, negative values, single-period spikes, and per-person extremes driven by small populations.
   - For spikes, do this exactly: for the main measure and each per-person column, divide every value by that entity's median over all periods. Count only isolated spikes: skip a value if the period just before or just after is also more than 3 times that entity's median, because that is growth or a level shift, not a spike. List the three largest remaining ratios above 3, one line per entity and column, as `entity, period, column, value, N times its usual level`, skipping entities whose usual level is near zero. Under each, say it is a question for the reporter (real event or error?), never a cause.
   - For small populations, name the entity with the highest per-person value, its population, and the population floor you suggest before ranking.
3. Fill in the data card using `resources/data-card-template.md`. Keep the automatic numbers exactly as computed.
4. Add judgment the automatic numbers can't give: what each flag means for reporting, and which columns are safe to use.
5. End with the questions the reporter should answer before analysis, and offer to run story-finder next.

## Rules
- Do not interpret or look for stories yet. This step is about what the data is.
- Never fill a missing value or drop rows silently. If you exclude anything (aggregates, totals, duplicates), list exactly what and why.
- Units come from the codebook or the source. If neither says, write "unit unknown" and ask.
- Record provenance every time: publisher, dataset name, release or version, URL, date retrieved, and any changes made to the file.
- Follow house-style for numbers.

## Output
A data card in the format of `resources/data-card-template.md`.
