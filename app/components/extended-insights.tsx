'use client';

import { useState } from 'react';
import { airlineLogoUrl } from '../lib/airline-logos';
import { displayAirportCity, type Airport, type Flight } from '../lib/flight-data';
import { countAirportVisits, groupFlightsIntoTrips } from '../lib/flight-stats';

type ExtendedInsightsProps = {
  airports: Record<string, Airport>;
  aircraftNames: Record<string, string>;
  allFlights: Flight[];
  filteredFlights: Flight[];
  comparisonFlights: Flight[];
  selectedAirportCode: string | null;
  onSelectAirport: (code: string) => void;
  onSelectFlight: (flightId: number) => void;
};

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
const longMonthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-GB').format(value);
}

function countBy(items: Flight[], key: (flight: Flight) => string) {
  const counts = new Map<string, number>();
  items.forEach((flight) => counts.set(key(flight), (counts.get(key(flight)) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function dateRange(start: string, end: string) {
  return start === end ? start : `${start} — ${end}`;
}

function yearSummary(flights: Flight[], year: number, airports: Record<string, Airport>) {
  const selected = flights.filter((flight) => flight.year === year);
  const airportCodes = new Set(selected.flatMap((flight) => [flight.origin, flight.destination]));
  return {
    flights: selected.length,
    distance: selected.reduce((sum, flight) => sum + flight.distanceKm, 0),
    airports: airportCodes.size,
    countries: new Set([...airportCodes].map((code) => airports[code]?.country ?? 'Unknown')).size,
    airlines: new Set(selected.map((flight) => flight.airline)).size,
    flightDays: new Set(selected.map((flight) => flight.date)).size,
  };
}

function formatDifference(value: number, suffix = '') {
  if (value === 0) return '—';
  return `${value > 0 ? '+' : '−'}${formatNumber(Math.abs(value))}${suffix}`;
}

function ordinal(value: number) {
  const remainder100 = value % 100;
  if (remainder100 >= 11 && remainder100 <= 13) return `${value}th`;
  if (value % 10 === 1) return `${value}st`;
  if (value % 10 === 2) return `${value}nd`;
  if (value % 10 === 3) return `${value}rd`;
  return `${value}th`;
}

export function ExtendedInsights({
  airports,
  aircraftNames,
  allFlights,
  filteredFlights,
  comparisonFlights,
  selectedAirportCode,
  onSelectAirport,
  onSelectFlight,
}: ExtendedInsightsProps) {
  const [comparisonYearA, setComparisonYearA] = useState('');
  const [comparisonYearB, setComparisonYearB] = useState('');
  const [selectedHistoricDate, setSelectedHistoricDate] = useState<string | null>(null);
  const [hoveredHistoricDate, setHoveredHistoricDate] = useState<{ monthDay: string; x: number; y: number } | null>(null);
  const [showAllAirportsRanking, setShowAllAirportsRanking] = useState(false);
  const [showAllConnectionRanking, setShowAllConnectionRanking] = useState(false);
  const [milestoneEnding, setMilestoneEnding] = useState(0);

  const trips = groupFlightsIntoTrips(filteredFlights);
  const recentTrips = [...trips].reverse().slice(0, 8);
  const connectionCount = Math.max(0, filteredFlights.length - trips.length);
  const longestTrip = [...trips].sort((a, b) => b.distanceKm - a.distanceKm)[0];

  const airportVisits = countAirportVisits(filteredFlights);
  const airportVisitMap = new Map(airportVisits);
  const detailCode = selectedAirportCode && airportVisitMap.has(selectedAirportCode)
    ? selectedAirportCode
    : airportVisits[0]?.[0] ?? null;
  const detailAirport = detailCode ? airports[detailCode] : null;
  const detailFlights = detailCode
    ? filteredFlights.filter((flight) => flight.origin === detailCode || flight.destination === detailCode)
    : [];
  const detailConnections = detailCode
    ? countBy(detailFlights, (flight) => (flight.origin === detailCode ? flight.destination : flight.origin))
    : [];
  const detailAirlines = countBy(detailFlights, (flight) => flight.airline);

  const availableYears = [...new Set(comparisonFlights.map((flight) => flight.year))].sort((a, b) => a - b);
  const fallbackYearB = availableYears.at(-1) ?? new Date().getUTCFullYear();
  const fallbackYearA = availableYears.at(-2) ?? fallbackYearB;
  const yearA = availableYears.includes(Number(comparisonYearA)) ? Number(comparisonYearA) : fallbackYearA;
  const yearB = availableYears.includes(Number(comparisonYearB)) ? Number(comparisonYearB) : fallbackYearB;
  const summaryA = yearSummary(comparisonFlights, yearA, airports);
  const summaryB = yearSummary(comparisonFlights, yearB, airports);
  const comparisonRows = [
    { label: 'Flights', a: summaryA.flights, b: summaryB.flights, difference: formatDifference(summaryB.flights - summaryA.flights) },
    { label: 'Distance', a: `${formatNumber(summaryA.distance)} km`, b: `${formatNumber(summaryB.distance)} km`, difference: formatDifference(summaryB.distance - summaryA.distance, ' km') },
    { label: 'Airports', a: summaryA.airports, b: summaryB.airports, difference: formatDifference(summaryB.airports - summaryA.airports) },
    { label: 'Countries', a: summaryA.countries, b: summaryB.countries, difference: formatDifference(summaryB.countries - summaryA.countries) },
    { label: 'Airlines', a: summaryA.airlines, b: summaryB.airlines, difference: formatDifference(summaryB.airlines - summaryA.airlines) },
    { label: 'Flight days', a: summaryA.flightDays, b: summaryB.flightDays, difference: formatDifference(summaryB.flightDays - summaryA.flightDays) },
  ];

  const firstFlight = filteredFlights[0];
  const fiftiethFlight = filteredFlights[49];
  const hundredthFlight = filteredFlights[99];
  const longestFlight = [...filteredFlights].sort((a, b) => b.distanceKm - a.distanceKm)[0];
  const firstInternational = filteredFlights.find((flight) => (
    airports[flight.origin]?.country !== airports[flight.destination]?.country
  ));
  const seenAirports = new Set<string>();
  let latestNewAirport: { code: string; flight: Flight } | null = null;
  for (const flight of filteredFlights) {
    for (const code of [flight.origin, flight.destination]) {
      if (!seenAirports.has(code)) latestNewAirport = { code, flight };
      seenAirports.add(code);
    }
  }
  const passportRoutes = new Set(filteredFlights.map((flight) => [flight.origin, flight.destination].sort().join('–')));
  const passportCities = new Set([...seenAirports].map((code) => displayAirportCity(airports[code])));
  const passportCountries = new Set([...seenAirports].map((code) => airports[code]?.country ?? 'Unknown'));
  const milestones = [
    { label: 'First logged flight', value: firstFlight ? `${firstFlight.origin}—${firstFlight.destination}` : '—', detail: firstFlight?.date ?? 'No flight selected' },
    { label: '50th flight', value: fiftiethFlight ? `${fiftiethFlight.origin}—${fiftiethFlight.destination}` : 'Locked', detail: fiftiethFlight?.date ?? `${Math.max(0, 50 - filteredFlights.length)} flights to go` },
    { label: '100th flight', value: hundredthFlight ? `${hundredthFlight.origin}—${hundredthFlight.destination}` : 'Locked', detail: hundredthFlight?.date ?? `${Math.max(0, 100 - filteredFlights.length)} flights to go` },
    { label: 'Longest sector', value: longestFlight ? `${longestFlight.origin}—${longestFlight.destination}` : '—', detail: longestFlight ? `${formatNumber(longestFlight.distanceKm)} km · ${longestFlight.date}` : 'No data' },
    { label: 'First international', value: firstInternational ? `${firstInternational.origin}—${firstInternational.destination}` : '—', detail: firstInternational?.date ?? 'No international flight' },
    { label: 'Latest new airport', value: latestNewAirport ? latestNewAirport.code : '—', detail: latestNewAirport ? `${displayAirportCity(airports[latestNewAirport.code])} · ${latestNewAirport.flight.date}` : 'No data' },
  ];

  const allFlightDateCounts = new Map<string, number>();
  comparisonFlights.forEach((flight) => {
    allFlightDateCounts.set(flight.date, (allFlightDateCounts.get(flight.date) ?? 0) + 1);
  });
  const calendarHeatmapMaximum = Math.max(1, ...allFlightDateCounts.values());
  const calendarYears = availableYears.map((year) => {
    const firstDate = new Date(Date.UTC(year, 0, 1));
    const daysInYear = Math.round((Date.UTC(year + 1, 0, 1) - firstDate.getTime()) / 86_400_000);
    const mondayOffset = (firstDate.getUTCDay() + 6) % 7;
    const cells: Array<{ date: string; count: number; level: number } | null> = [
      ...Array<null>(mondayOffset).fill(null),
      ...Array.from({ length: daysInYear }, (_, dayIndex) => {
        const date = new Date(Date.UTC(year, 0, dayIndex + 1)).toISOString().slice(0, 10);
        const count = allFlightDateCounts.get(date) ?? 0;
        return {
          date,
          count,
          level: count ? Math.max(1, Math.ceil((count / calendarHeatmapMaximum) * 4)) : 0,
        };
      }),
    ];
    const weekCount = Math.ceil(cells.length / 7);
    const monthMarkers = monthNames.map((label, monthIndex) => {
      const dayOfYear = Math.round((Date.UTC(year, monthIndex, 1) - firstDate.getTime()) / 86_400_000);
      return { label, week: Math.floor((mondayOffset + dayOfYear) / 7) + 1 };
    });
    const flights = comparisonFlights.filter((flight) => flight.year === year);
    return {
      year,
      cells,
      weekCount,
      monthMarkers,
      flightCount: flights.length,
      flightDays: new Set(flights.map((flight) => flight.date)).size,
    };
  });
  const busiestDate = [...allFlightDateCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];

  const historicDateMap = new Map<string, { flights: number; years: Set<number> }>();
  comparisonFlights.forEach((flight) => {
    const monthDay = flight.date.slice(5);
    const entry = historicDateMap.get(monthDay) ?? { flights: 0, years: new Set<number>() };
    entry.flights += 1;
    entry.years.add(flight.year);
    historicDateMap.set(monthDay, entry);
  });
  const historicMaximumFlights = Math.max(1, ...[...historicDateMap.values()].map((entry) => entry.flights));
  const recurringHistoricDates = [...historicDateMap.values()].filter((entry) => entry.years.size > 1).length;
  const daysPerMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const historicMonthRows = monthNames.map((label, monthIndex) => ({
    label,
    days: Array.from({ length: 31 }, (_, dayIndex) => {
      const day = dayIndex + 1;
      if (day > daysPerMonth[monthIndex]) return null;
      const monthDay = `${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const entry = historicDateMap.get(monthDay);
      const years = entry ? [...entry.years].sort((a, b) => a - b) : [];
      return {
        day,
        monthDay,
        flightCount: entry?.flights ?? 0,
        years,
        level: entry?.flights ? Math.max(1, Math.ceil((entry.flights / historicMaximumFlights) * 4)) : 0,
      };
    }),
  }));
  const selectedHistoricFlights = selectedHistoricDate
    ? comparisonFlights
      .filter((flight) => flight.date.slice(5) === selectedHistoricDate)
      .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
    : [];
  const selectedHistoricLabel = selectedHistoricDate
    ? `${longMonthNames[Number(selectedHistoricDate.slice(0, 2)) - 1]} ${Number(selectedHistoricDate.slice(3))}`
    : '';
  const hoveredHistoricFlights = hoveredHistoricDate
    ? comparisonFlights
      .filter((flight) => flight.date.slice(5) === hoveredHistoricDate.monthDay)
      .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
    : [];
  const hoveredHistoricLabel = hoveredHistoricDate
    ? `${longMonthNames[Number(hoveredHistoricDate.monthDay.slice(0, 2)) - 1]} ${Number(hoveredHistoricDate.monthDay.slice(3))}`
    : '';

  function updateHistoricHover(monthDay: string, clientX: number, clientY: number) {
    const flightCount = historicDateMap.get(monthDay)?.flights ?? 1;
    const tooltipWidth = 370;
    const tooltipHeight = 68 + Math.min(flightCount, 4) * 76;
    setHoveredHistoricDate({
      monthDay,
      x: Math.max(12, Math.min(clientX + 18, window.innerWidth - tooltipWidth - 12)),
      y: Math.max(12, Math.min(clientY - 22, window.innerHeight - tooltipHeight - 12)),
    });
  }

  const milestoneSequences = milestoneEnding === 0
    ? [1, ...Array.from({ length: Math.floor(allFlights.length / 10) }, (_, index) => (index + 1) * 10)]
    : Array.from({ length: allFlights.length }, (_, index) => index + 1)
      .filter((sequence) => sequence % 10 === milestoneEnding);
  const milestoneFlights = milestoneSequences
    .map((sequence) => ({ sequence, flight: allFlights[sequence - 1] }))
    .filter((item): item is { sequence: number; flight: Flight } => Boolean(item.flight));

  const firstEncounterYear = new Map<string, number>();
  comparisonFlights.forEach((flight) => {
    [flight.origin, flight.destination].forEach((code) => {
      if (!firstEncounterYear.has(code)) firstEncounterYear.set(code, flight.year);
    });
  });
  const yearbookRows = availableYears.map((year) => {
    const yearFlights = comparisonFlights.filter((flight) => flight.year === year);
    const first = yearFlights[0];
    const last = yearFlights.at(-1)!;
    return {
      year,
      first,
      last,
      days: new Set(yearFlights.map((flight) => flight.date)).size,
      newAirports: [...firstEncounterYear.values()].filter((firstYear) => firstYear === year).length,
      distance: yearFlights.reduce((sum, flight) => sum + flight.distanceKm, 0),
    };
  });

  return (
    <>
      <article className="chart-panel trips-panel">
        <div className="panel-title">
          <div><span>10</span><h3>Trips & journeys</h3></div>
          <p>{trips.length} trips · {connectionCount} connections merged</p>
        </div>
        <div className="trip-summary">
          <div><span>Longest journey</span><strong>{longestTrip ? `${formatNumber(longestTrip.distanceKm)} km` : '—'}</strong></div>
          <div><span>Most recent</span><strong>{recentTrips[0]?.startDate ?? '—'}</strong></div>
        </div>
        <div className="trip-list">
          {recentTrips.map((trip) => (
            <button type="button" key={trip.id} onClick={() => onSelectFlight(trip.flights[0].id)}>
              <span className="trip-date">{dateRange(trip.startDate, trip.endDate)}</span>
              <span className="trip-route">{trip.airportCodes.join(' → ')}</span>
              <span className="trip-meta">{trip.flights.length} {trip.flights.length === 1 ? 'leg' : 'legs'} · {formatNumber(trip.distanceKm)} km</span>
            </button>
          ))}
          {!recentTrips.length && <p className="panel-empty">No trips match the current filters.</p>}
        </div>
      </article>

      <article className="chart-panel airport-detail-panel" id="airport-detail">
        <div className="panel-title">
          <div><span>11</span><h3>Airport profile</h3></div>
          <p>Choose a dot on the globe</p>
        </div>
        <div className={`airport-picker${showAllAirportsRanking ? ' is-expanded' : ''}`} aria-label="Most visited airports">
          {(showAllAirportsRanking ? airportVisits : airportVisits.slice(0, 10)).map(([code, visits]) => (
            <button type="button" key={code} className={code === detailCode ? 'is-active' : ''} onClick={() => onSelectAirport(code)}>
              <strong>{code}</strong><span>{visits}</span>
            </button>
          ))}
        </div>
        {airportVisits.length > 10 && (
          <button
            type="button"
            className="ranking-toggle ranking-toggle-compact"
            aria-expanded={showAllAirportsRanking}
            onClick={() => setShowAllAirportsRanking((value) => !value)}
          >
            <span>{showAllAirportsRanking ? 'Show top 10' : `Show all ${airportVisits.length} airports`}</span>
            <strong aria-hidden="true">{showAllAirportsRanking ? '−' : '+'}</strong>
          </button>
        )}
        {detailAirport && detailCode ? (
          <div className="airport-profile-grid">
            <div className="airport-identity">
              <span>{detailAirport.country}</span>
              <strong>{detailCode}</strong>
              <h4>{displayAirportCity(detailAirport)}</h4>
              <p>{detailAirport.name}</p>
            </div>
            <div className="airport-profile-stats">
              <div><span>Visits</span><strong>{airportVisitMap.get(detailCode) ?? 0}</strong></div>
              <div><span>First seen</span><strong>{detailFlights[0]?.date ?? '—'}</strong></div>
              <div><span>Last seen</span><strong>{detailFlights.at(-1)?.date ?? '—'}</strong></div>
              <div><span>Airlines</span><strong>{detailAirlines.length}</strong></div>
            </div>
            <div className="airport-profile-links">
              <span>Top connections</span>
              {(showAllConnectionRanking ? detailConnections : detailConnections.slice(0, 5)).map(([code, count]) => <p key={code}><strong>{code}</strong><i /><small>{count} flights</small></p>)}
              {detailConnections.length > 5 && (
                <button
                  type="button"
                  className="ranking-toggle ranking-toggle-compact"
                  aria-expanded={showAllConnectionRanking}
                  onClick={() => setShowAllConnectionRanking((value) => !value)}
                >
                  <span>{showAllConnectionRanking ? 'Show top 5' : `Show all ${detailConnections.length} connections`}</span>
                  <strong aria-hidden="true">{showAllConnectionRanking ? '−' : '+'}</strong>
                </button>
              )}
            </div>
          </div>
        ) : <p className="panel-empty">No airport data matches the current filters.</p>}
      </article>

      <article className="chart-panel comparison-panel">
        <div className="panel-title comparison-title">
          <div><span>12</span><h3>Year comparison</h3></div>
          <div className="comparison-selectors">
            <select aria-label="First comparison year" value={yearA} onChange={(event) => setComparisonYearA(event.target.value)}>
              {availableYears.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
            <span>vs</span>
            <select aria-label="Second comparison year" value={yearB} onChange={(event) => setComparisonYearB(event.target.value)}>
              {availableYears.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </div>
        </div>
        <div className="comparison-grid">
          <div className="comparison-head"><span>Metric</span><strong>{yearA}</strong><strong>{yearB}</strong><span>Change</span></div>
          {comparisonRows.map((row) => (
            <div key={row.label}><span>{row.label}</span><strong>{row.a}</strong><strong>{row.b}</strong><small>{row.difference}</small></div>
          ))}
        </div>
      </article>

      <article className="chart-panel passport-panel">
        <div className="panel-title">
          <div><span>13</span><h3>Passport & milestones</h3></div>
          <p>Based on the current selection</p>
        </div>
        <div className="passport-strip">
          <div><strong>{passportCountries.size}</strong><span>Countries</span></div>
          <div><strong>{passportCities.size}</strong><span>Cities</span></div>
          <div><strong>{seenAirports.size}</strong><span>Airports</span></div>
          <div><strong>{passportRoutes.size}</strong><span>Routes</span></div>
        </div>
        <div className="milestone-grid">
          {milestones.map((milestone) => (
            <div key={milestone.label} className={milestone.value === 'Locked' ? 'is-locked' : ''}>
              <span>{milestone.label}</span><strong>{milestone.value}</strong><small>{milestone.detail}</small>
            </div>
          ))}
        </div>
      </article>

      <article className="chart-panel calendar-panel">
        <div className="panel-title calendar-title">
          <div><span>14</span><h3>Flight calendar</h3></div>
          <div className="calendar-controls">
            <p>{availableYears.length} years · {allFlightDateCounts.size} flight days{busiestDate ? ` · Peak ${busiestDate[0]} (${busiestDate[1]})` : ''}</p>
          </div>
        </div>
        <div className="calendar-scroll">
          <div className="calendar-multi-layout">
            <div className="calendar-weekdays"><span>Mon</span><span>Wed</span><span>Fri</span><span>Sun</span></div>
            <div className="calendar-years-track">
              {calendarYears.map((calendarYear) => (
                <section className="calendar-year-block" key={calendarYear.year} aria-label={`${calendarYear.year} flight calendar`}>
                  <div className="calendar-year-heading">
                    <strong>{calendarYear.year}</strong>
                    <span>{calendarYear.flightDays} days · {calendarYear.flightCount} flights</span>
                  </div>
                  <div
                    className="calendar-months"
                    style={{ gridTemplateColumns: `repeat(${calendarYear.weekCount}, 10px)` }}
                  >
                    {calendarYear.monthMarkers.map((month) => (
                      <span key={month.label} style={{ gridColumnStart: month.week }}>{month.label}</span>
                    ))}
                  </div>
                  <div className="calendar-grid">
                    {calendarYear.cells.map((cell, index) => cell ? (
                      <i
                        key={cell.date}
                        className={`calendar-level-${cell.level}`}
                        title={`${cell.date}: ${cell.count} ${cell.count === 1 ? 'flight' : 'flights'}`}
                        role={cell.count ? 'img' : undefined}
                        aria-label={cell.count ? `${cell.date}: ${cell.count} ${cell.count === 1 ? 'flight' : 'flights'}` : undefined}
                        aria-hidden={cell.count ? undefined : true}
                      />
                    ) : <i key={`empty-${calendarYear.year}-${index}`} className="calendar-empty" aria-hidden="true" />)}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
        <div className="calendar-legend"><span>Less</span>{[0, 1, 2, 3, 4].map((level) => <i key={level} className={`calendar-level-${level}`} />)}<span>More</span></div>
      </article>

      <article className="chart-panel historic-calendar-panel">
        <div className="panel-title">
          <div><span>15</span><h3>Historic flight days</h3></div>
          <p>{comparisonFlights.length} flights on {historicDateMap.size} dates · {recurringHistoricDates} repeated across years</p>
        </div>
        <div className="historic-calendar-scroll">
          <div className="historic-calendar" aria-label="All flight years overlaid by month and day">
            <div className="historic-calendar-header" aria-hidden="true">
              <span />
              <div>{Array.from({ length: 31 }, (_, index) => <small key={index + 1}>{index === 0 || (index + 1) % 5 === 0 ? index + 1 : ''}</small>)}</div>
            </div>
            {historicMonthRows.map((month) => (
              <div className="historic-month-row" key={month.label}>
                <strong>{month.label}</strong>
                <div>
                  {month.days.map((cell, index) => cell?.years.length ? (
                    <button
                      type="button"
                      key={cell.monthDay}
                      className={`historic-day calendar-level-${cell.level}${selectedHistoricDate === cell.monthDay && selectedHistoricFlights.length ? ' is-selected' : ''}`}
                      aria-label={cell.years.length
                        ? `${month.label} ${cell.day}: flown in ${cell.years.join(', ')}. Show flight details.`
                        : undefined}
                      aria-pressed={selectedHistoricDate === cell.monthDay && selectedHistoricFlights.length > 0}
                      onMouseEnter={(event) => updateHistoricHover(cell.monthDay, event.clientX, event.clientY)}
                      onMouseMove={(event) => updateHistoricHover(cell.monthDay, event.clientX, event.clientY)}
                      onMouseLeave={() => setHoveredHistoricDate(null)}
                      onFocus={() => setSelectedHistoricDate(cell.monthDay)}
                      onClick={() => setSelectedHistoricDate(cell.monthDay)}
                    />
                  ) : cell ? (
                    <i key={cell.monthDay} className="historic-day calendar-level-0" aria-hidden="true" />
                  ) : <i key={`empty-${month.label}-${index}`} className="historic-day historic-day-empty" aria-hidden="true" />)}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="calendar-legend historic-legend"><span>Fewer flights</span>{[0, 1, 2, 3, 4].map((level) => <i key={level} className={`calendar-level-${level}`} />)}<span>More flights</span></div>
        {hoveredHistoricDate && hoveredHistoricFlights.length > 0 && (
          <aside
            className="historic-hover-tooltip"
            role="tooltip"
            style={{ left: hoveredHistoricDate.x, top: hoveredHistoricDate.y }}
          >
            <header>
              <span>Flights on</span>
              <strong>{hoveredHistoricLabel}</strong>
              <small>{hoveredHistoricFlights.length} {hoveredHistoricFlights.length === 1 ? 'flight' : 'flights'}</small>
            </header>
            <div>
              {hoveredHistoricFlights.map((flight) => (
                <article key={flight.id}>
                  <span className="historic-hover-logo">
                    <img src={airlineLogoUrl(flight.airline)} alt="" width="64" height="64" />
                  </span>
                  <div>
                    <p><strong>{flight.flightNumber}</strong><time>{flight.date}</time></p>
                    <b>{flight.origin} <em>{displayAirportCity(airports[flight.origin])}</em><i aria-hidden="true">→</i>{flight.destination} <em>{displayAirportCity(airports[flight.destination])}</em></b>
                    <small>{aircraftNames[flight.aircraft] ?? flight.aircraft}{flight.registration ? ` · ${flight.registration}` : ''}{flight.aircraftSerialNumber ? ` · MSN ${flight.aircraftSerialNumber}` : ''}</small>
                  </div>
                </article>
              ))}
            </div>
          </aside>
        )}
        {selectedHistoricDate && selectedHistoricFlights.length > 0 && (
          <section className="historic-flight-details" aria-live="polite" aria-label={`Flights on ${selectedHistoricLabel}`}>
            <div className="historic-flight-details-title">
              <div>
                <span>Flights on</span>
                <h4>{selectedHistoricLabel}</h4>
                <p>{selectedHistoricFlights.length} {selectedHistoricFlights.length === 1 ? 'flight' : 'flights'} across {new Set(selectedHistoricFlights.map((flight) => flight.year)).size} {new Set(selectedHistoricFlights.map((flight) => flight.year)).size === 1 ? 'year' : 'years'}</p>
              </div>
              <button type="button" onClick={() => setSelectedHistoricDate(null)} aria-label="Close historic flight details">Close</button>
            </div>
            <div className="historic-flight-list">
              {selectedHistoricFlights.map((flight) => (
                <article className="historic-flight-card" key={flight.id}>
                  <div className="historic-flight-logo" title={flight.airline}>
                    <img
                      src={airlineLogoUrl(flight.airline)}
                      alt={`${flight.airline} logo`}
                      width="128"
                      height="128"
                      onError={(event) => event.currentTarget.parentElement?.classList.add('logo-missing')}
                    />
                    <strong>{flight.airline}</strong>
                  </div>
                  <div className="historic-flight-main">
                    <div className="historic-flight-number">
                      <strong>{flight.flightNumber}</strong>
                      <span>{flight.date}</span>
                    </div>
                    <div className="historic-flight-route">
                      <span><strong>{flight.origin}</strong><small>{displayAirportCity(airports[flight.origin])}</small></span>
                      <i aria-hidden="true">→</i>
                      <span><strong>{flight.destination}</strong><small>{displayAirportCity(airports[flight.destination])}</small></span>
                    </div>
                    <div className="historic-flight-meta">
                      <span>{aircraftNames[flight.aircraft] ?? flight.aircraft}<small>{flight.aircraft} · Registration {flight.registration ?? 'not recorded'}</small></span>
                      {flight.aircraftSerialNumber && <strong>MSN {flight.aircraftSerialNumber}</strong>}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </article>

      <article className="chart-panel milestone-flights-panel">
        <div className="panel-title milestone-flights-title">
          <div><span>16</span><h3>Milestone flights</h3></div>
          <p>{milestoneEnding === 0
            ? 'First flight, then every tenth flight in the complete logbook'
            : `Every flight number ending in ${milestoneEnding}`}</p>
        </div>
        <div className="milestone-ending-controls">
          <span>Flight number ending in</span>
          <div role="group" aria-label="Choose the final digit of milestone flight numbers">
            {Array.from({ length: 10 }, (_, digit) => (
              <button
                type="button"
                key={digit}
                className={milestoneEnding === digit ? 'is-active' : ''}
                aria-pressed={milestoneEnding === digit}
                onClick={() => setMilestoneEnding(digit)}
              >
                {digit}
              </button>
            ))}
          </div>
          <small>{milestoneFlights.length} {milestoneFlights.length === 1 ? 'flight' : 'flights'} in this sequence</small>
        </div>
        <div className="milestone-flight-grid">
          {milestoneFlights.map(({ sequence, flight }) => (
            <article className="milestone-flight-card" key={sequence}>
              <span className="milestone-flight-index"><strong>{ordinal(sequence)}</strong><small>flight</small></span>
              <span className="milestone-flight-logo" title={flight.airline}>
                <img
                  src={airlineLogoUrl(flight.airline)}
                  alt={`${flight.airline} logo`}
                  width="128"
                  height="128"
                  onError={(event) => event.currentTarget.parentElement?.classList.add('logo-missing')}
                />
                <strong>{flight.airline}</strong>
              </span>
              <span className="milestone-flight-copy">
                <small>{flight.date} · {flight.flightNumber}</small>
                <strong>{flight.origin} → {flight.destination}</strong>
                <span>{aircraftNames[flight.aircraft] ?? flight.aircraft}{flight.registration ? ` · ${flight.registration}` : ''}</span>
              </span>
            </article>
          ))}
        </div>
      </article>

      <article className="chart-panel yearbook-panel">
        <div className="panel-title">
          <div><span>17</span><h3>First & last flight by year</h3></div>
          <p>Annual opening and closing sectors</p>
        </div>
        <div className="yearbook-wrap">
          <table className="yearbook-table">
            <thead><tr><th>Year</th><th>First flight</th><th>Last flight</th><th>Flight days</th><th>New airports</th><th>Distance</th></tr></thead>
            <tbody>
              {yearbookRows.map((row) => (
                <tr key={row.year}>
                  <td><strong>{row.year}</strong></td>
                  <td><strong>{row.first.origin}—{row.first.destination}</strong><small>{row.first.date} · {row.first.flightNumber}</small></td>
                  <td><strong>{row.last.origin}—{row.last.destination}</strong><small>{row.last.date} · {row.last.flightNumber}</small></td>
                  <td>{row.days}</td><td>{row.newAirports}</td><td>{formatNumber(row.distance)} km</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </>
  );
}
