# Flight Atlas

Flight Atlas turns a personal flight log into an animated, rotatable route globe and a set of static travel statistics. It is local-first, uses English labels and metric units, and includes an import API for reusable integrations.

The repository contains only an anonymous, synthetic demo logbook. Its fictional traveller was born in Shanghai in 2004, attended international school in Singapore from 2017 to 2019, returned to Shanghai in 2020, and moved to Los Angeles for university in 2022. The 100-flight history covers parent-accompanied childhood travel, term journeys, annual trips home, internships, academic events and holidays. It does not describe a real person or reuse a private flight log. Imported files are processed in the browser and are never uploaded by the app.

Regenerate the deterministic demo dataset with:

```bash
node scripts/generate-synthetic-demo-data.mjs
```

Refresh the observed fleet snapshot with:

```bash
node scripts/update-airline-fleet-catalog.mjs
```

## Features

- Animated great-circle flights on a draggable globe
- Timeline playback, route history, filters and speed controls
- Statistics for years, distance, airports, countries, airlines and aircraft
- Airline passport collections with observed fleet rosters, collected registrations, per-aircraft journey history and curated special liveries
- Milestone-flight sequences for every final digit from 0 through 9
- Searchable logbook with CSV and normalized JSON export
- Browser import for `.xlsx`, `.xls`, `.csv` and `.json`
- English and Chinese source-column aliases
- Stateless JSON normalization API with CORS support
- More than 9,000 IATA-coded airports from OurAirports

## Run locally

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`, choose a flight log, and the visualizations update immediately.

## Import a flight log

Download [`public/templates/flight-atlas-template.csv`](public/templates/flight-atlas-template.csv) or use an existing workbook. The first worksheet is read. Only these three fields are required:

| Field | Examples | Required |
| --- | --- | --- |
| Date | `2026-01-15`, `20260115` | Yes |
| Origin | `LHR` | Yes |
| Destination | `CDG` | Yes |
| Flight Number | `EX101` | No |
| Airline | `BA` | No |
| Departure Time | `09:10` | No |
| Arrival Time | `11:25` | No |
| Aircraft | `A320` | No |
| Registration | `G-EXAMPLE` | No |
| Aircraft Serial Number | `12345` | No |
| Aircraft First Flight | `2019-03-12` | No |

Common Chinese headings such as `日期`, `航班号`, `起飞地`, `起飞时间`, `降落地`, `降落时间`, `机型`, `注册号`, `飞机序列号` and `首飞时间` are also recognized.

To auto-load a private log on one computer, import it once, choose **Download normalized JSON**, and save the download as `public/data/local-flight-data.json`. That path is ignored by Git.

## JSON API

Run the app and send an array of rows, or an object containing a `flights` array, to `POST /api/v1/import`. The endpoint normalizes dates and times, resolves IATA airports, calculates great-circle distances in kilometres, and returns a ready-to-render dataset. It does not store requests.

```bash
curl -X POST http://localhost:3000/api/v1/import \
  -H "Content-Type: application/json" \
  -d '{"flights":[{"date":"2026-01-15","flightNumber":"EX101","origin":"LHR","destination":"CDG","aircraft":"A320"}]}'
```

- `GET /api/v1/import` returns compact endpoint documentation.
- [`public/api/flight-atlas.schema.json`](public/api/flight-atlas.schema.json) describes the JSON request.
- The request limit is 5 MB and 5,000 flight rows.

## Privacy

- Spreadsheet parsing happens entirely in the browser.
- The API is stateless and writes no flight data.
- `plane.xlsx`, `app/data/flight-data.json` and `public/data/local-flight-data.json` are ignored by Git.
- Before publishing a fork, check `git status` and ensure no private logbook is staged.

## Deploy to Cloudflare Pages

Authenticate Wrangler, create a Pages project, then build and deploy the advanced-mode Worker bundle:

```bash
npx wrangler login
npx wrangler pages project create fushimi-flight-atlas --production-branch main --compatibility-date 2026-05-15 --compatibility-flags nodejs_compat
npm run deploy:pages
```

Change `fushimi-flight-atlas` in `package.json` if your Pages project uses a different name. The deployment build removes `public/data/local-flight-data.json` automatically, even when that private local file exists.

## Quality checks

```bash
npm run lint
npm run typecheck
npm run build
```

## Data and license

Airport coordinates and names come from [OurAirports](https://ourairports.com/data/) and are released into the public domain by that project. Sheet import uses [SheetJS Community Edition](https://docs.sheetjs.com/).

The aircraft-registration reference in `app/data/airline-fleet-catalog.json` is an observed snapshot derived through [PlaneQuery](https://www.planequery.com/) from [ADSB.lol](https://www.adsb.lol/) data under the Open Database License 1.0. It is not an official or complete live airline fleet list. The generated database snapshot remains subject to ODbL 1.0 and is not relicensed under MIT.

Selected fleet types can carry verified overrides in the refresh script. China Eastern A350-900 and Boeing 777-300ER totals are checked against the airline's July 2026 operating disclosure, with individual registrations checked against PlaneFinder. Verified overrides replace the short-window ADS-B roster for those types while preserving historic registrations from an imported logbook.

Flight Atlas source code is available under the [MIT License](LICENSE).
