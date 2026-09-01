import fs from 'node:fs/promises';

const sourcePath = process.argv[2];
const outputPath = process.argv[3] ?? 'app/data/airports-global.json';
if (!sourcePath) throw new Error('Usage: node scripts/build-airports.mjs <airports.csv> [output.json]');

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ',') { row.push(field); field = ''; }
    else if (character === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += character;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const rows = parseCsv(await fs.readFile(sourcePath, 'utf8'));
const headers = Object.fromEntries(rows[0].map((header, index) => [header, index]));
const countries = new Intl.DisplayNames(['en'], { type: 'region' });
const rank = { large_airport: 4, medium_airport: 3, small_airport: 2, seaplane_base: 1, heliport: 0 };
const airports = new Map();

for (const row of rows.slice(1)) {
  const code = (row[headers.iata_code] ?? '').trim().toUpperCase();
  const latitude = Number(row[headers.latitude_deg]);
  const longitude = Number(row[headers.longitude_deg]);
  if (!/^[A-Z]{3}$/.test(code) || !Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
  const type = row[headers.type];
  const existing = airports.get(code);
  if (existing && (rank[existing.type] ?? -1) >= (rank[type] ?? -1)) continue;
  const countryCode = row[headers.iso_country] || 'ZZ';
  airports.set(code, {
    type,
    airport: {
      code,
      name: row[headers.name] || code,
      city: row[headers.municipality] || row[headers.name] || code,
      country: countries.of(countryCode) || countryCode,
      latitude,
      longitude,
    },
  });
}

const output = [...airports.values()]
  .map((entry) => entry.airport)
  .sort((a, b) => a.code.localeCompare(b.code));
await fs.writeFile(outputPath, `${JSON.stringify(output)}\n`, 'utf8');
console.log(`Wrote ${output.length} IATA airports to ${outputPath}`);
