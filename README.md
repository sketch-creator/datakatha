# Data Katha

*Katha* (കഥ) means story in Malayalam.

Live: https://datakatha.vercel.app

Drop a spreadsheet, get fact-checked stories. The app finds the stories in a CSV
(including ones people usually miss), writes them as articles and social carousels
in English and Malayalam, and checks every number against the data before you export.

Numbers are worked out by code. Words are written by the AI (Google Gemini).

## Try it

Open the app and click **Try the CO₂ sample**. It runs end to end with no setup,
using answers prepared earlier from the same file (shown as "Sample run").

To run it on your own file with live AI, open **Settings** and either paste your own
free Gemini key (it stays in your browser) or enter the demo passcode if you have one.

## Files to try

Download one, then drop it on the app's first screen. The same list is under
**Download files to try** in the app.

| File | What it is |
| --- | --- |
| [co2_by_country_1990_2024.csv](public/sample/co2_by_country_1990_2024.csv) | CO₂ emissions of 218 countries, 1990–2024. Source: Global Carbon Budget (2025) via Our World in Data. |
| [codebook.csv](public/sample/codebook.csv) | What each column of the CO₂ file means and its unit. Add it under "Optional details". |
| [district_cases_practice.csv](public/sample/district_cases_practice.csv) | Practice file with made-up numbers and six planted mistakes. See which ones the app catches. |

## Run it yourself

```bash
npm install
npm run dev
```

For live AI on your machine, create `.env.local` with `GEMINI_API_KEY=...` and,
optionally, `DEMO_PASSCODE=...`. Never commit that file.

## Deploy

Import this repository into Vercel (framework: Vite). Add `GEMINI_API_KEY` and
`DEMO_PASSCODE` as environment variables if visitors should use the owner's key with
the passcode. Without them the sample still works and visitors can use their own key.

## Data licence

The CO₂ data is from the Global Carbon Budget (2025), published by Our World in Data
under CC BY 4.0.
