import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const endpoint = 'https://www.planequery.com/api/query';
const observedFrom = '2026-10-14 00:00:00';
const observedTo = '2026-10-28 00:00:00';
const outputPath = path.join(process.cwd(), 'app', 'data', 'airline-fleet-catalog.json');

const airlineCallsignPrefixes = {
  '3U': 'CSC',
  '9C': 'CQH',
  AA: 'AAL',
  AS: 'ASA',
  BA: 'BAW',
  BC: 'SKY',
  CA: 'CCA',
  CI: 'CAL',
  CX: 'CPA',
  CZ: 'CSN',
  DL: 'DAL',
  F9: 'FFT',
  FM: 'CSH',
  HO: 'DKH',
  JL: 'JAL',
  JT: 'LNI',
  JX: 'SJX',
  KN: 'CUA',
  MH: 'MAS',
  MM: 'APJ',
  MU: 'CES',
  NH: 'ANA',
  OS: 'AUA',
  SC: 'CDG',
  SQ: 'SIA',
  U2: 'EZY',
  UA: 'UAL',
  VA: 'VOZ',
  WN: 'SWA',
  XE: 'JSX',
};

const registrationPatterns = {
  '3U': /^B-/, '9C': /^B-/, AA: /^N/, AS: /^N/, BA: /^G-/, BC: /^JA/,
  CA: /^B-/, CI: /^B-/, CX: /^B-/, CZ: /^B-/, DL: /^N/, F9: /^N/,
  FM: /^B-/, HO: /^B-/, JL: /^JA/, JT: /^PK-/, JX: /^B-/, KN: /^B-/,
  MH: /^9M-/, MM: /^JA/, MU: /^B-/, NH: /^JA/, OS: /^OE-/, SC: /^B-/,
  SQ: /^9V-/, U2: /^(G-|OE-|HB-|D-|F-|I-)/, UA: /^N/, VA: /^VH-/,
  WN: /^N/, XE: /^N/,
};

const typeAliases = {
  A32N: 'A20N',
  AJ27: 'C909',
  B712: 'B717',
  B7M8: 'B38M',
};

// Verified rosters take precedence over the short ADS-B observation window.
// Counts are checked against the airline disclosure; registrations are checked
// against the linked fleet directory on the verification date.
const verifiedFleetOverrides = {
  FM: {
    verifiedAt: '2026-11-24',
    countSource: {
      name: 'PlaneFinder · Shanghai Airlines current fleet',
      url: 'https://planefinder.net/data/airline/CSH/fleet',
    },
    rosterSource: {
      name: 'PlaneFinder · Shanghai Airlines current fleet',
      url: 'https://planefinder.net/data/airline/CSH/fleet',
    },
    allowedTypes: ['B737', 'B738', 'B38M', 'B789'],
    expectedCounts: { B737: 5, B738: 59, B38M: 17, B789: 10 },
    additions: { B737: ['B-2913'] },
  },
  MU: {
    verifiedAt: '2026-11-24',
    countSource: {
      name: 'China Eastern Airlines · July 2026 operating data',
      url: 'https://global.ceair.com/global/static/AboutChinaEasternAirlines/intoEasternAirlines/InvestorRelations/announcement/ShanghaiExchangeReleased/shExcReleased2026/202608/P020260817318595260134.pdf',
    },
    rosterSource: {
      name: 'PlaneFinder · China Eastern fleet',
      url: 'https://planefinder.net/data/airline/CES/fleet',
    },
    types: {
      A359: [
        'B-304D', 'B-304N', 'B-305X', 'B-306Y', 'B-307Y', 'B-308E', 'B-30CW', 'B-30FM',
        'B-321J', 'B-323H', 'B-324W', 'B-324X', 'B-329E', 'B-32A8', 'B-32CZ', 'B-32D0',
        'B-32DJ', 'B-32DW', 'B-32FP', 'B-32FQ',
      ],
      B77W: [
        'B-2001', 'B-2002', 'B-2003', 'B-2005', 'B-2020', 'B-2021', 'B-2022', 'B-2023',
        'B-2025', 'B-7343', 'B-7347', 'B-7349', 'B-7365', 'B-7367', 'B-7368', 'B-7369',
        'B-7868', 'B-7881', 'B-7882', 'B-7883',
      ],
    },
  },
};

function applyVerifiedOverrides(payload) {
  payload.verifiedAirlines = {};
  for (const [airline, verification] of Object.entries(verifiedFleetOverrides)) {
    if (!payload.airlines[airline]) continue;
    if (verification.allowedTypes) {
      payload.airlines[airline].types = Object.fromEntries(
        Object.entries(payload.airlines[airline].types)
          .filter(([type]) => verification.allowedTypes.includes(type)),
      );
    }
    for (const [type, registrations] of Object.entries(verification.additions ?? {})) {
      payload.airlines[airline].types[type] = [
        ...new Set([...(payload.airlines[airline].types[type] ?? []), ...registrations]),
      ].sort();
    }
    for (const [type, registrations] of Object.entries(verification.types ?? {})) {
      payload.airlines[airline].types[type] = [...registrations].sort();
    }
    payload.verifiedAirlines[airline] = {
      verifiedAt: verification.verifiedAt,
      types: verification.expectedCounts ?? Object.fromEntries(
        Object.entries(verification.types ?? {}).map(([type, registrations]) => [type, registrations.length]),
      ),
      countSource: verification.countSource,
      rosterSource: verification.rosterSource,
    };
  }
  return payload;
}

function sqlForPrefix(prefix) {
  return `SELECT aircraft_type,
       array_sort(array_distinct(array_agg(registration))) AS registrations
FROM flights
WHERE takeoff_time >= TIMESTAMP '${observedFrom}'
  AND takeoff_time < TIMESTAMP '${observedTo}'
  AND callsign LIKE '${prefix}%'
  AND registration IS NOT NULL
  AND trim(registration) <> ''
  AND aircraft_type IS NOT NULL
  AND trim(aircraft_type) <> ''
GROUP BY aircraft_type
ORDER BY aircraft_type
LIMIT 1000`;
}

async function queryAirline([airline, prefix]) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sqlForPrefix(prefix) }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`${airline}: ${result.error ?? response.statusText}`);

  const byType = new Map();
  for (const row of result.rows) {
    const rawType = String(row.aircraft_type ?? '').trim().toUpperCase();
    const type = typeAliases[rawType] ?? rawType;
    const registrations = String(row.registrations ?? '')
      .replace(/^\[|\]$/g, '')
      .split(',')
      .map((value) => value.trim().toUpperCase())
      .filter((registration) => registrationPatterns[airline]?.test(registration));
    if (!type || !registrations.length) continue;
    byType.set(type, [...(byType.get(type) ?? []), ...registrations]);
  }

  const types = Object.fromEntries(
    [...byType.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([type, registrations]) => [type, [...new Set(registrations)].sort()]),
  );
  process.stdout.write(`${airline}: ${Object.values(types).flat().length} aircraft\n`);
  return [airline, { callsignPrefix: prefix, types }];
}

async function main() {
  const entries = Object.entries(airlineCallsignPrefixes);
  const results = [];
  const concurrency = 4;
  for (let index = 0; index < entries.length; index += concurrency) {
    results.push(...await Promise.all(entries.slice(index, index + concurrency).map(queryAirline)));
  }

  const payload = {
    generatedAt: '2026-11-24',
    observedFrom: observedFrom.slice(0, 10),
    observedTo: '2026-10-27',
    source: {
      name: 'PlaneQuery / ADSB.lol',
      url: 'https://www.planequery.com/',
      license: 'Open Database License 1.0',
      method: 'Distinct registrations observed under each airline ICAO callsign prefix during the reference window.',
    },
    airlines: Object.fromEntries(results.sort(([a], [b]) => a.localeCompare(b))),
  };

  applyVerifiedOverrides(payload);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  process.stdout.write(`Wrote ${outputPath}\n`);
}

async function filterExistingCatalog() {
  const payload = JSON.parse(await readFile(outputPath, 'utf8'));
  for (const [airline, entry] of Object.entries(payload.airlines)) {
    const cleaned = new Map();
    for (const [rawType, registrations] of Object.entries(entry.types)) {
      const type = typeAliases[rawType] ?? rawType;
      const accepted = registrations.filter((registration) => registrationPatterns[airline]?.test(registration));
      cleaned.set(type, [...(cleaned.get(type) ?? []), ...accepted]);
    }
    entry.types = Object.fromEntries(
      [...cleaned.entries()]
        .filter(([, registrations]) => registrations.length)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([type, registrations]) => [type, [...new Set(registrations)].sort()]),
    );
  }
  applyVerifiedOverrides(payload);
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  process.stdout.write(`Filtered ${outputPath}\n`);
}

if (process.argv.includes('--filter-existing')) await filterExistingCatalog();
else await main();
