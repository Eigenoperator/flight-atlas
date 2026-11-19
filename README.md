# Flight Atlas

Flight Atlas turns a personal flight log into an animated, rotatable route globe and a set of static travel statistics. It is local-first, uses English labels and metric units, and includes an import API for reusable integrations.

The repository contains only an anonymous demo logbook. Imported files are processed in the browser and are never uploaded by the app.

## Features

- Animated great-circle flights on a draggable globe
- Timeline playback, route history, filters and speed controls
- Statistics for years, distance, airports, countries, airlines and aircraft
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

## Quality checks

```bash
npm run lint
npm run typecheck
npm run build
```

## Data and license

Airport coordinates and names come from [OurAirports](https://ourairports.com/data/) and are released into the public domain by that project. Sheet import uses [SheetJS Community Edition](https://docs.sheetjs.com/).

Flight Atlas source code is available under the [MIT License](LICENSE).
