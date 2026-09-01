'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { geoDistance, geoGraticule10, geoInterpolate, geoOrthographic, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import land110 from 'world-atlas/land-110m.json';
import demoFlightData from './data/demo-flight-data.json';
import type { Airport, Flight, FlightDataset } from './lib/flight-data';

const demoDataset = demoFlightData as FlightDataset;

const airlineNames: Record<string, string> = {
  '3U': 'Sichuan Airlines', '9C': 'Spring Airlines', AA: 'American Airlines',
  AS: 'Alaska Airlines', BA: 'British Airways', BC: 'Skymark Airlines',
  CA: 'Air China', CI: 'China Airlines', CX: 'Cathay Pacific',
  CZ: 'China Southern', DL: 'Delta Air Lines', F9: 'Frontier Airlines',
  FM: 'Shanghai Airlines', HO: 'Juneyao Air', JL: 'Japan Airlines',
  JT: 'Lion Air', JX: 'Starlux Airlines', KN: 'China United Airlines',
  MH: 'Malaysia Airlines', MM: 'Peach Aviation', MU: 'China Eastern',
  NH: 'All Nippon Airways', OS: 'Austrian Airlines', SC: 'Shandong Airlines',
  SQ: 'Singapore Airlines', U2: 'easyJet', VA: 'Virgin Australia',
};

const aircraftNames: Record<string, string> = {
  A20N: 'Airbus A320neo', A21N: 'Airbus A321neo', A319: 'Airbus A319',
  A320: 'Airbus A320', A321: 'Airbus A321', A32N: 'Airbus A320neo',
  A332: 'Airbus A330-200', A333: 'Airbus A330-300', A339: 'Airbus A330-900neo',
  A359: 'Airbus A350-900', A35K: 'Airbus A350-1000', A388: 'Airbus A380-800',
  B717: 'Boeing 717', B737: 'Boeing 737', B738: 'Boeing 737-800',
  B739: 'Boeing 737-900', B744: 'Boeing 747-400', B763: 'Boeing 767-300',
  B772: 'Boeing 777-200', B773: 'Boeing 777-300', B77W: 'Boeing 777-300ER',
  B788: 'Boeing 787-8', B789: 'Boeing 787-9', B78X: 'Boeing 787-10',
  B7M8: 'Boeing 737 MAX 8', C919: 'COMAC C919',
};

const land = feature(
  land110 as never,
  (land110 as unknown as { objects: { land: never } }).objects.land,
);

type Coordinate = [number, number];
type RouteGeometry = { type: 'LineString'; coordinates: Coordinate[] };

function makeRouteGeometry(flight: Flight, airports: Record<string, Airport>): RouteGeometry {
  const origin = airports[flight.origin];
  const destination = airports[flight.destination];
  const interpolate = geoInterpolate(
    [origin.longitude, origin.latitude],
    [destination.longitude, destination.latitude],
  );
  const coordinates = Array.from(
    { length: 49 },
    (_, index) => interpolate(index / 48) as Coordinate,
  );
  return { type: 'LineString', coordinates };
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-GB').format(value);
}

function countBy<T>(items: T[], key: (item: T) => string) {
  const counts = new Map<string, number>();
  items.forEach((item) => counts.set(key(item), (counts.get(key(item)) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function aircraftMaker(code: string) {
  if (code.startsWith('A')) return 'Airbus';
  if (code.startsWith('B')) return 'Boeing';
  return 'Other';
}

function FlightAtlasExperience() {
  const [dataset, setDataset] = useState<FlightDataset>(demoDataset);
  const [dataSource, setDataSource] = useState('Demo logbook');
  const [localDataset, setLocalDataset] = useState<FlightDataset | null>(null);
  const [importMessage, setImportMessage] = useState('Your file stays in this browser. Nothing is uploaded.');
  const [isImporting, setIsImporting] = useState(false);
  const [yearFilter, setYearFilter] = useState('all');
  const [airlineFilter, setAirlineFilter] = useState('all');
  const [aircraftFilter, setAircraftFilter] = useState('all');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showAllFlights, setShowAllFlights] = useState(false);
  const [flightProgress, setFlightProgress] = useState(0);
  const [animationNonce, setAnimationNonce] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showRouteHistory, setShowRouteHistory] = useState(true);
  const [logbookQuery, setLogbookQuery] = useState('');
  const [globeRotation, setGlobeRotation] = useState<[number, number, number]>([-112, -22, 0]);
  const [followFlight, setFollowFlight] = useState(true);
  const playbackRef = useRef(true);
  const followFlightRef = useRef(true);
  const dragRef = useRef<{
    x: number;
    y: number;
    rotation: [number, number, number];
  } | null>(null);

  const airports = dataset.airports;
  const flights = dataset.flights;

  useEffect(() => {
    const localUrl = new URL('data/local-flight-data.json', document.baseURI);
    fetch(localUrl)
      .then((response) => {
        if (!response.ok) throw new Error('No local archive');
        return response.json() as Promise<FlightDataset>;
      })
      .then((loadedDataset) => {
        if (!loadedDataset.flights?.length || !loadedDataset.airports) return;
        setLocalDataset(loadedDataset);
        setDataset(loadedDataset);
        setDataSource('Local archive');
        setImportMessage(`${loadedDataset.flights.length} local flights loaded. This file is excluded from Git.`);
      })
      .catch(() => undefined);
  }, []);

  const years = useMemo(() => [...new Set(flights.map((flight) => flight.year))], [flights]);
  const airlines = useMemo(() => [...new Set(flights.map((flight) => flight.airline))].sort(), [flights]);
  const aircraftTypes = useMemo(() => [...new Set(flights.map((flight) => flight.aircraft))].sort(), [flights]);

  const routeGeometries = useMemo(() => new Map(
    flights.map((flight) => [flight.id, makeRouteGeometry(flight, airports)]),
  ), [airports, flights]);

  const filteredFlights = useMemo(() => flights.filter((flight) => (
    (yearFilter === 'all' || flight.year === Number(yearFilter))
    && (airlineFilter === 'all' || flight.airline === airlineFilter)
    && (aircraftFilter === 'all' || flight.aircraft === aircraftFilter)
  )), [flights, yearFilter, airlineFilter, aircraftFilter]);

  const activeFlight = filteredFlights[currentIndex];
  const activeInterpolator = useMemo(() => {
    if (!activeFlight) return null;
    const origin = airports[activeFlight.origin];
    const destination = airports[activeFlight.destination];
    if (!origin || !destination) return null;
    return geoInterpolate(
      [origin.longitude, origin.latitude],
      [destination.longitude, destination.latitude],
    );
  }, [activeFlight, airports]);

  useEffect(() => {
    if (!activeFlight || !activeInterpolator) return;
    let frame = 0;
    let arrivalTimer = 0;
    let hasFocusedGlobe = false;
    const startedAt = performance.now();
    const duration = 3200 / playbackSpeed;

    const animate = (now: number) => {
      const rawProgress = Math.min(1, (now - startedAt) / duration);
      const easedProgress = rawProgress < 0.5
        ? 4 * rawProgress ** 3
        : 1 - ((-2 * rawProgress + 2) ** 3) / 2;
      setFlightProgress(easedProgress);
      if (followFlightRef.current && !dragRef.current && !hasFocusedGlobe) {
        const routeMidpoint = activeInterpolator(0.5) as Coordinate;
        setGlobeRotation([-routeMidpoint[0], -routeMidpoint[1], 0]);
        hasFocusedGlobe = true;
      }

      if (rawProgress < 1) {
        frame = window.requestAnimationFrame(animate);
      } else if (playbackRef.current) {
        arrivalTimer = window.setTimeout(() => {
          setFlightProgress(0);
          setCurrentIndex((index) => (
            index >= filteredFlights.length - 1 ? 0 : index + 1
          ));
        }, 450);
      }
    };

    frame = window.requestAnimationFrame(animate);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(arrivalTimer);
    };
  }, [activeFlight, activeInterpolator, animationNonce, filteredFlights.length, playbackSpeed]);

  const projection = useMemo(() => geoOrthographic()
    .translate([690, 300])
    .scale(266)
    .clipAngle(90)
    .precision(0.35)
    .rotate(globeRotation), [globeRotation]);
  const mapPath = useMemo(() => geoPath(projection), [projection]);
  const spherePath = useMemo(() => mapPath({ type: 'Sphere' }) ?? '', [mapPath]);
  const graticulePath = useMemo(() => mapPath(geoGraticule10()) ?? '', [mapPath]);
  const landPath = useMemo(() => mapPath(land as never) ?? '', [mapPath]);
  const routePaths = useMemo(
    () => filteredFlights.map((flight) => mapPath(routeGeometries.get(flight.id)!) ?? ''),
    [filteredFlights, mapPath, routeGeometries],
  );
  const visited = filteredFlights.slice(0, currentIndex);
  const filteredDistance = filteredFlights.reduce((sum, flight) => sum + flight.distanceKm, 0);
  const distanceSoFar = visited.reduce((sum, flight) => sum + flight.distanceKm, 0)
    + (activeFlight?.distanceKm ?? 0) * flightProgress;
  const totalDistance = flights.reduce((sum, flight) => sum + flight.distanceKm, 0);

  const activeOrigin = activeFlight ? airports[activeFlight.origin] : null;
  const activeDestination = activeFlight ? airports[activeFlight.destination] : null;
  const movingCoordinate = activeInterpolator
    ? activeInterpolator(flightProgress) as Coordinate
    : null;
  const originPoint = activeOrigin
    ? projection([activeOrigin.longitude, activeOrigin.latitude])
    : null;
  const destinationPoint = activeDestination
    ? projection([activeDestination.longitude, activeDestination.latitude])
    : null;
  const movingPoint = movingCoordinate ? projection(movingCoordinate) : null;
  const globeCentre: Coordinate = [-globeRotation[0], -globeRotation[1]];
  const originVisible = activeOrigin
    ? geoDistance(globeCentre, [activeOrigin.longitude, activeOrigin.latitude]) <= Math.PI / 2
    : false;
  const destinationVisible = activeDestination
    ? geoDistance(globeCentre, [activeDestination.longitude, activeDestination.latitude]) <= Math.PI / 2
    : false;
  const movingPointVisible = movingCoordinate
    ? geoDistance(globeCentre, movingCoordinate) <= Math.PI / 2
    : false;

  const filteredAirportCodes = new Set(filteredFlights.flatMap((flight) => [flight.origin, flight.destination]));
  const filteredCountries = new Set([...filteredAirportCodes].map((code) => airports[code]?.country ?? 'Unknown'));
  const airportCounts = countBy(
    filteredFlights.flatMap((flight) => [flight.origin, flight.destination]),
    (code) => code,
  );
  const topAirport = airportCounts[0];
  const longestFlight = [...filteredFlights].sort((a, b) => b.distanceKm - a.distanceKm)[0];

  const annualData = years.map((year) => {
    const yearFlights = filteredFlights.filter((flight) => flight.year === year);
    return {
      year,
      count: yearFlights.length,
      distance: yearFlights.reduce((sum, flight) => sum + flight.distanceKm, 0),
    };
  });
  const maxAnnualCount = Math.max(1, ...annualData.map((item) => item.count));
  const busiestYear = [...annualData].sort((a, b) => b.count - a.count)[0];
  const aircraftCounts = countBy(filteredFlights, (flight) => flight.aircraft).slice(0, 8);
  const airlineCounts = countBy(filteredFlights, (flight) => flight.airline).slice(0, 7);
  const maxAircraftCount = Math.max(1, ...(aircraftCounts.map(([, count]) => count)));
  const maxAirlineCount = Math.max(1, ...(airlineCounts.map(([, count]) => count)));
  const routeCounts = countBy(
    filteredFlights,
    (flight) => [flight.origin, flight.destination].sort().join('–'),
  ).slice(0, 6);
  const makerCounts = Object.fromEntries(countBy(filteredFlights, (flight) => aircraftMaker(flight.aircraft)));
  const makerTotal = Math.max(1, filteredFlights.length);
  const airbusPercent = ((makerCounts.Airbus ?? 0) / makerTotal) * 100;
  const boeingPercent = ((makerCounts.Boeing ?? 0) / makerTotal) * 100;
  const makerGradient = `conic-gradient(var(--cyan) 0 ${airbusPercent}%, var(--amber) ${airbusPercent}% ${airbusPercent + boeingPercent}%, #768796 ${airbusPercent + boeingPercent}% 100%)`;
  const internationalFlights = filteredFlights.filter((flight) => (
    airports[flight.origin]?.country !== airports[flight.destination]?.country
  ));
  const domesticFlights = filteredFlights.length - internationalFlights.length;
  const distanceBands = [
    { label: 'Short haul', range: '< 1,500 km', count: filteredFlights.filter((flight) => flight.distanceKm < 1500).length, className: 'band-short' },
    { label: 'Medium haul', range: '1,500–4,000 km', count: filteredFlights.filter((flight) => flight.distanceKm >= 1500 && flight.distanceKm < 4000).length, className: 'band-medium' },
    { label: 'Long haul', range: '≥ 4,000 km', count: filteredFlights.filter((flight) => flight.distanceKm >= 4000).length, className: 'band-long' },
  ];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthCounts = countBy(filteredFlights, (flight) => flight.date.slice(5, 7));
  const topMonth = monthCounts[0];
  const aircraftAges = filteredFlights.flatMap((flight) => {
    if (!flight.aircraftFirstFlight) return [];
    const ageYears = (
      new Date(`${flight.date}T00:00:00Z`).getTime()
      - new Date(`${flight.aircraftFirstFlight}T00:00:00Z`).getTime()
    ) / (365.2425 * 24 * 60 * 60 * 1000);
    return ageYears >= 0 ? [{ flight, ageYears }] : [];
  });
  const averageAircraftAge = aircraftAges.length
    ? aircraftAges.reduce((sum, item) => sum + item.ageYears, 0) / aircraftAges.length
    : 0;
  const youngestAircraft = [...aircraftAges].sort((a, b) => a.ageYears - b.ageYears)[0];
  const oldestAircraft = [...aircraftAges].sort((a, b) => b.ageYears - a.ageYears)[0];
  const cumulativeDistance = filteredFlights.reduce<Array<{ flight: Flight; total: number }>>((items, flight) => {
    const previous = items.at(-1)?.total ?? 0;
    items.push({ flight, total: previous + flight.distanceKm });
    return items;
  }, []);
  const cumulativeMaximum = cumulativeDistance.at(-1)?.total ?? 1;
  const cumulativePoints = cumulativeDistance.map((item, index) => ({
    x: cumulativeDistance.length <= 1 ? 500 : 38 + (index / (cumulativeDistance.length - 1)) * 924,
    y: 188 - (item.total / cumulativeMaximum) * 154,
  }));
  const cumulativeLine = cumulativePoints.length
    ? `M ${cumulativePoints.map((point) => `${point.x} ${point.y}`).join(' L ')}`
    : '';
  const cumulativeArea = cumulativePoints.length
    ? `${cumulativeLine} L ${cumulativePoints.at(-1)!.x} 188 L ${cumulativePoints[0].x} 188 Z`
    : '';
  const normalisedQuery = logbookQuery.trim().toLowerCase();
  const logbookFlights = filteredFlights.filter((flight) => !normalisedQuery || [
    flight.date,
    flight.flightNumber,
    flight.origin,
    flight.destination,
    flight.aircraft,
    aircraftNames[flight.aircraft],
    flight.registration,
    airlineNames[flight.airline],
  ].some((value) => value?.toLowerCase().includes(normalisedQuery)));
  const earthLaps = filteredDistance / 40075;
  const firstYear = flights[0]?.year;
  const lastYear = flights.at(-1)?.year;
  const archiveRange = firstYear
    ? `${firstYear}${lastYear && lastYear !== firstYear ? `—${lastYear}` : ''}`
    : 'Awaiting import';

  const applyDataset = (nextDataset: FlightDataset, source: string, message: string) => {
    setDataset(nextDataset);
    setDataSource(source);
    setImportMessage(message);
    setYearFilter('all');
    setAirlineFilter('all');
    setAircraftFilter('all');
    setCurrentIndex(0);
    setFlightProgress(0);
    setAnimationNonce((nonce) => nonce + 1);
    setShowAllFlights(false);
    setLogbookQuery('');
    playbackRef.current = true;
    setIsPlaying(true);
  };

  const handleFlightImport = async (file: File | undefined) => {
    if (!file) return;
    setIsImporting(true);
    setImportMessage(`Reading ${file.name} locally…`);
    try {
      const { importFlightFile } = await import('./lib/import-flights');
      const result = await importFlightFile(file);
      const warningSummary = result.rejected
        ? ` ${result.rejected} row${result.rejected === 1 ? '' : 's'} skipped.`
        : '';
      applyDataset(
        result.dataset,
        file.name,
        `${result.accepted} flights imported from ${file.name}.${warningSummary}`,
      );
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : 'The file could not be imported.');
    } finally {
      setIsImporting(false);
    }
  };

  const clearFilters = () => {
    setYearFilter('all');
    setAirlineFilter('all');
    setAircraftFilter('all');
    setCurrentIndex(flights.length - 1);
    setFlightProgress(0);
    setAnimationNonce((nonce) => nonce + 1);
    playbackRef.current = false;
    setIsPlaying(false);
    setShowAllFlights(false);
  };

  const applyYearFilter = (value: string) => {
    setYearFilter(value);
    setCurrentIndex(0);
    setFlightProgress(0);
    setAnimationNonce((nonce) => nonce + 1);
    playbackRef.current = false;
    setIsPlaying(false);
    setShowAllFlights(false);
  };

  const applyAirlineFilter = (value: string) => {
    setAirlineFilter(value);
    setCurrentIndex(0);
    setFlightProgress(0);
    setAnimationNonce((nonce) => nonce + 1);
    playbackRef.current = false;
    setIsPlaying(false);
    setShowAllFlights(false);
  };

  const applyAircraftFilter = (value: string) => {
    setAircraftFilter(value);
    setCurrentIndex(0);
    setFlightProgress(0);
    setAnimationNonce((nonce) => nonce + 1);
    playbackRef.current = false;
    setIsPlaying(false);
    setShowAllFlights(false);
  };

  const togglePlayback = () => {
    if (isPlaying) {
      playbackRef.current = false;
      setIsPlaying(false);
      return;
    }
    playbackRef.current = true;
    setFlightProgress(0);
    setAnimationNonce((nonce) => nonce + 1);
    if (currentIndex >= filteredFlights.length - 1) setCurrentIndex(0);
    setIsPlaying(true);
  };

  const toggleFollowFlight = () => {
    const nextValue = !followFlight;
    followFlightRef.current = nextValue;
    setFollowFlight(nextValue);
    if (nextValue && activeInterpolator) {
      const routeMidpoint = activeInterpolator(0.5) as Coordinate;
      setGlobeRotation([-routeMidpoint[0], -routeMidpoint[1], 0]);
    }
  };

  const handleGlobePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      rotation: globeRotation,
    };
    followFlightRef.current = false;
    setFollowFlight(false);
  };

  const handleGlobePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!dragRef.current) return;
    const dx = event.clientX - dragRef.current.x;
    const dy = event.clientY - dragRef.current.y;
    setGlobeRotation([
      dragRef.current.rotation[0] + dx * 0.28,
      Math.max(-85, Math.min(85, dragRef.current.rotation[1] - dy * 0.28)),
      0,
    ]);
  };

  const handleGlobePointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  };

  const resetGlobe = () => {
    followFlightRef.current = false;
    setFollowFlight(false);
    setGlobeRotation([-112, -22, 0]);
  };

  const selectFlightIndex = (index: number) => {
    if (!filteredFlights.length) return;
    const wrappedIndex = (index + filteredFlights.length) % filteredFlights.length;
    playbackRef.current = false;
    setIsPlaying(false);
    setCurrentIndex(wrappedIndex);
    setFlightProgress(0);
    setAnimationNonce((nonce) => nonce + 1);
  };

  const changePlaybackSpeed = (speed: number) => {
    setPlaybackSpeed(speed);
    setFlightProgress(0);
    setAnimationNonce((nonce) => nonce + 1);
  };

  const downloadDataset = () => {
    const url = URL.createObjectURL(new Blob(
      [`${JSON.stringify(dataset, null, 2)}\n`],
      { type: 'application/json;charset=utf-8' },
    ));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'flight-atlas-data.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadLogbook = () => {
    const escapeCsv = (value: string | number | null) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const rows = [
      ['Date', 'Flight', 'Origin', 'Destination', 'Departure', 'Arrival', 'Aircraft', 'Registration', 'Distance (km)'],
      ...[...logbookFlights].reverse().map((flight) => [
        flight.date,
        flight.flightNumber,
        flight.origin,
        flight.destination,
        flight.departureTime,
        flight.arrivalTime,
        flight.aircraft,
        flight.registration,
        flight.distanceKm,
      ]),
    ];
    const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'flight-atlas-logbook.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Flight Atlas home">
          <span className="brand-mark">FA</span>
          <span>Flight Atlas</span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#import">Import</a>
          <a href="#map">Map</a>
          <a href="#patterns">Patterns</a>
          <a href="#logbook">Logbook</a>
        </nav>
        <p className="topbar-meta">Private by design · {dataSource}</p>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">An aviation archive · {archiveRange}</p>
          <h1>Every flight.<br />One evolving map.</h1>
          <p className="hero-deck">
            A chronological atlas of routes, aircraft and the distance between departures.
          </p>
        </div>
        <div className="hero-kpis" aria-label="Flight summary">
          <div><span>Total distance</span><strong>{formatNumber(totalDistance)} km</strong></div>
          <div><span>Flights logged</span><strong>{flights.length}</strong></div>
          <div><span>Airports reached</span><strong>{Object.keys(airports).length}</strong></div>
          <div><span>Aircraft types</span><strong>{new Set(flights.map((flight) => flight.aircraft)).size}</strong></div>
        </div>
      </section>

      <section className="import-section" id="import" aria-labelledby="import-title">
        <div className="import-copy">
          <p className="eyebrow">Bring your own logbook</p>
          <h2 id="import-title">Turn a spreadsheet into your flight atlas.</h2>
          <p>
            Import Excel, CSV or JSON. Dates, routes, local times, aircraft and registrations
            are recognised from English or Chinese column names.
          </p>
          <div className="import-links">
            <a href="templates/flight-atlas-template.csv" download>Download CSV template</a>
            <a href="api/flight-atlas.schema.json" target="_blank" rel="noreferrer">JSON schema</a>
            <a href="api/v1/import" target="_blank" rel="noreferrer">API reference</a>
          </div>
        </div>
        <div className="import-card">
          <div className="source-badge"><span>Current source</span><strong>{dataSource}</strong></div>
          <label className="file-picker">
            <input
              type="file"
              accept=".xlsx,.xls,.csv,.json"
              disabled={isImporting}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                void handleFlightImport(file);
                event.currentTarget.value = '';
              }}
            />
            <span>{isImporting ? 'Reading file…' : 'Choose a flight log'}</span>
            <small>.xlsx · .xls · .csv · .json</small>
          </label>
          <p className="privacy-note" role="status">{importMessage}</p>
          <div className="dataset-actions">
            <button
              type="button"
              onClick={() => applyDataset(demoDataset, 'Demo logbook', 'Anonymous demo flights restored.')}
              disabled={dataSource === 'Demo logbook'}
            >
              Restore demo
            </button>
            {localDataset && (
              <button
                type="button"
                onClick={() => applyDataset(localDataset, 'Local archive', `${localDataset.flights.length} local flights restored.`)}
                disabled={dataSource === 'Local archive'}
              >
                Restore local archive
              </button>
            )}
            <button type="button" onClick={downloadDataset}>Download normalized JSON</button>
          </div>
          <p className="local-processing"><i /> Processed entirely in your browser. No account, upload or tracking.</p>
        </div>
      </section>

      <section className="filter-bar" aria-label="Flight filters">
        <label>
          <span>Year</span>
          <select value={yearFilter} onChange={(event) => applyYearFilter(event.target.value)}>
            <option value="all">All years</option>
            {years.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        </label>
        <label>
          <span>Airline</span>
          <select value={airlineFilter} onChange={(event) => applyAirlineFilter(event.target.value)}>
            <option value="all">All airlines</option>
            {airlines.map((code) => <option key={code} value={code}>{code} · {airlineNames[code] ?? code}</option>)}
          </select>
        </label>
        <label>
          <span>Aircraft</span>
          <select value={aircraftFilter} onChange={(event) => applyAircraftFilter(event.target.value)}>
            <option value="all">All aircraft</option>
            {aircraftTypes.map((code) => <option key={code} value={code}>{code} · {aircraftNames[code] ?? code}</option>)}
          </select>
        </label>
        <div className="filter-result">
          <span>{filteredFlights.length} matching flights</span>
          <button type="button" onClick={clearFilters}>Reset filters</button>
        </div>
      </section>

      <section className="map-section" id="map" aria-labelledby="map-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Dynamic visualisation</p>
            <h2 id="map-title">The route globe</h2>
          </div>
          <p>{formatNumber(activeFlight ? distanceSoFar : 0)} km in this playback</p>
        </div>

        <div className="map-card">
          <svg
            className="world-map"
            viewBox="0 0 1200 600"
            role="img"
            aria-label="Rotatable globe showing animated flight routes"
            onPointerDown={handleGlobePointerDown}
            onPointerMove={handleGlobePointerMove}
            onPointerUp={handleGlobePointerUp}
            onPointerCancel={handleGlobePointerUp}
          >
            <defs>
              <filter id="route-glow" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <linearGradient id="map-fade" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#101f2c" />
                <stop offset="100%" stopColor="#08131d" />
              </linearGradient>
            </defs>
            <path d={spherePath} fill="url(#map-fade)" className="globe-sphere" />
            <path d={graticulePath} className="graticule" />
            <path d={landPath} className="land" />
            {routePaths.map((route, index) => showRouteHistory && index < currentIndex ? (
              <path
                key={filteredFlights[index].id}
                d={route}
                className="route route-visited"
              />
            ) : null)}
            {activeFlight && (
              <path
                key={`route-${activeFlight.id}`}
                d={routePaths[currentIndex]}
                className="route route-active"
                pathLength="1"
                strokeDasharray="1"
                strokeDashoffset={1 - flightProgress}
              />
            )}
            {originPoint && originVisible && (
              <g transform={`translate(${originPoint[0].toFixed(3)} ${originPoint[1].toFixed(3)})`}>
                <circle r="3.2" className="airport-node" />
              </g>
            )}
            {destinationPoint && destinationVisible && (
              <g transform={`translate(${destinationPoint[0].toFixed(3)} ${destinationPoint[1].toFixed(3)})`}>
                <circle r="3.2" className="airport-node airport-node-destination" />
                <circle
                  r={8 + Math.max(0, flightProgress - 0.86) * 42}
                  className="arrival-ring"
                  opacity={flightProgress > 0.86 ? 1 - (flightProgress - 0.86) / 0.14 : 0}
                />
              </g>
            )}
            {movingPoint && movingPointVisible && (
              <g transform={`translate(${movingPoint[0].toFixed(3)} ${movingPoint[1].toFixed(3)})`} filter="url(#route-glow)">
                <circle r="11" className="moving-halo" />
                <circle r="4.6" className="moving-flight" />
              </g>
            )}
          </svg>

          <div className="globe-actions" aria-label="Globe controls">
            <span>Drag to rotate</span>
            <button type="button" className={followFlight ? 'is-active' : ''} onClick={toggleFollowFlight}>
              {followFlight ? 'Following flight' : 'Follow flight'}
            </button>
            <button type="button" className={showRouteHistory ? 'is-active' : ''} onClick={() => setShowRouteHistory((show) => !show)}>
              {showRouteHistory ? 'History on' : 'History off'}
            </button>
            <button type="button" onClick={resetGlobe}>Reset view</button>
          </div>

          {activeFlight ? (
            <div className="map-overlay">
              <p className="overlay-label">Now viewing</p>
              <div className="route-code">
                <strong>{activeFlight.origin}</strong>
                <span aria-hidden="true">→</span>
                <strong>{activeFlight.destination}</strong>
              </div>
              <p>{airports[activeFlight.origin].city} to {airports[activeFlight.destination].city}</p>
              <div className="overlay-rule" />
              <p>{activeFlight.date} · {activeFlight.flightNumber}</p>
              <p>{aircraftNames[activeFlight.aircraft] ?? activeFlight.aircraft}</p>
              <p className="overlay-distance">{formatNumber(activeFlight.distanceKm)} km</p>
              <div className="flight-stage">
                <i><b style={{ width: `${flightProgress * 100}%` }} /></i>
                <span>{flightProgress >= 0.995 ? 'Arrived' : 'En route'} · {Math.round(flightProgress * 100)}%</span>
              </div>
            </div>
          ) : (
            <div className="map-overlay empty-overlay">
              <p className="overlay-label">No matching routes</p>
              <strong>Adjust or reset the filters to continue.</strong>
            </div>
          )}

          <div className="timeline-controls">
            <button
              type="button"
              className="step-button"
              disabled={!activeFlight}
              onClick={() => selectFlightIndex(currentIndex - 1)}
              aria-label="Previous flight"
            >
              ←
            </button>
            <button
              type="button"
              className="play-button"
              disabled={!activeFlight}
              onClick={togglePlayback}
              aria-label={isPlaying ? 'Pause route playback' : 'Play route playback'}
            >
              {isPlaying ? 'Ⅱ' : '▶'}
            </button>
            <button
              type="button"
              className="step-button"
              disabled={!activeFlight}
              onClick={() => selectFlightIndex(currentIndex + 1)}
              aria-label="Next flight"
            >
              →
            </button>
            <input
              aria-label="Flight timeline"
              type="range"
              min="0"
              max={Math.max(0, filteredFlights.length - 1)}
              value={activeFlight ? currentIndex : 0}
              disabled={!activeFlight}
              onChange={(event) => {
                setCurrentIndex(Number(event.target.value));
                setFlightProgress(0);
                setAnimationNonce((nonce) => nonce + 1);
                playbackRef.current = false;
                setIsPlaying(false);
              }}
            />
            <div className="speed-control" aria-label="Playback speed">
              {[0.5, 1, 2].map((speed) => (
                <button
                  key={speed}
                  type="button"
                  className={playbackSpeed === speed ? 'is-active' : ''}
                  onClick={() => changePlaybackSpeed(speed)}
                >
                  {speed}×
                </button>
              ))}
            </div>
            <div className="timeline-date">
              <span>{activeFlight ? `${String(currentIndex + 1).padStart(2, '0')} / ${filteredFlights.length}` : '00 / 00'}</span>
              <strong>{activeFlight?.date ?? 'No flight selected'}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="analytics-section" id="patterns" aria-labelledby="patterns-title">
        <div className="section-heading analytics-heading">
          <div>
            <p className="eyebrow">Static visualisations</p>
            <h2 id="patterns-title">Patterns in the log</h2>
          </div>
          <p>Statistics reflect the active filters</p>
        </div>

        <div className="insight-strip">
          <article>
            <span>Distance selected</span>
            <strong>{formatNumber(filteredDistance)} km</strong>
          </article>
          <article>
            <span>Longest sector</span>
            <strong>{longestFlight ? `${longestFlight.origin}—${longestFlight.destination}` : '—'}</strong>
            <small>{longestFlight ? `${formatNumber(longestFlight.distanceKm)} km` : 'No data'}</small>
          </article>
          <article>
            <span>Most-used airport</span>
            <strong>{topAirport?.[0] ?? '—'}</strong>
            <small>{topAirport ? `${topAirport[1]} movements` : 'No data'}</small>
          </article>
          <article>
            <span>Countries reached</span>
            <strong>{filteredCountries.size}</strong>
            <small>Across {filteredAirportCodes.size} airports</small>
          </article>
        </div>

        <div className="analytics-grid">
          <article className="chart-panel annual-panel">
            <div className="panel-title">
              <div><span>01</span><h3>Flights by year</h3></div>
              <p>{busiestYear?.count ? `Peak: ${busiestYear.year} · ${busiestYear.count} flights` : 'No matching data'}</p>
            </div>
            <div className="year-chart" aria-label="Bar chart showing flight count by year">
              {annualData.map((item) => (
                <button
                  type="button"
                  key={item.year}
                  className={item.count ? 'year-column' : 'year-column year-column-empty'}
                  onClick={() => item.count && applyYearFilter(String(item.year))}
                  aria-label={`${item.year}: ${item.count} flights, ${formatNumber(item.distance)} kilometres`}
                  title={`${item.year}: ${item.count} flights · ${formatNumber(item.distance)} km`}
                >
                  <span className="year-value">{item.count || ''}</span>
                  <span className="year-bar" style={{ height: `${Math.max(3, (item.count / maxAnnualCount) * 100)}%` }} />
                  <span className="year-label">{String(item.year).slice(2)}</span>
                </button>
              ))}
            </div>
          </article>

          <article className="chart-panel maker-panel">
            <div className="panel-title">
              <div><span>02</span><h3>Maker split</h3></div>
            </div>
            <div className="maker-chart" style={{ background: makerGradient }}>
              <div><strong>{filteredFlights.length}</strong><span>flights</span></div>
            </div>
            <ul className="legend-list">
              <li><i className="dot dot-airbus" /><span>Airbus</span><strong>{makerCounts.Airbus ?? 0}</strong></li>
              <li><i className="dot dot-boeing" /><span>Boeing</span><strong>{makerCounts.Boeing ?? 0}</strong></li>
              <li><i className="dot dot-other" /><span>Other</span><strong>{makerCounts.Other ?? 0}</strong></li>
            </ul>
          </article>

          <article className="chart-panel rank-panel">
            <div className="panel-title">
              <div><span>03</span><h3>Top aircraft</h3></div>
            </div>
            <div className="rank-list">
              {aircraftCounts.map(([code, count]) => (
                <button type="button" key={code} onClick={() => applyAircraftFilter(code)}>
                  <span className="rank-name"><strong>{code}</strong><small>{aircraftNames[code] ?? code}</small></span>
                  <span className="rank-track"><i style={{ width: `${(count / maxAircraftCount) * 100}%` }} /></span>
                  <strong className="rank-value">{count}</strong>
                </button>
              ))}
            </div>
          </article>

          <article className="chart-panel rank-panel">
            <div className="panel-title">
              <div><span>04</span><h3>Airlines flown</h3></div>
            </div>
            <div className="rank-list airline-ranks">
              {airlineCounts.map(([code, count]) => (
                <button type="button" key={code} onClick={() => applyAirlineFilter(code)}>
                  <span className="rank-name"><strong>{code}</strong><small>{airlineNames[code] ?? code}</small></span>
                  <span className="rank-track"><i style={{ width: `${(count / maxAirlineCount) * 100}%` }} /></span>
                  <strong className="rank-value">{count}</strong>
                </button>
              ))}
            </div>
          </article>

          <article className="chart-panel routes-panel">
            <div className="panel-title">
              <div><span>05</span><h3>Routes revisited</h3></div>
              <p>Both directions combined</p>
            </div>
            <div className="route-ranking">
              {routeCounts.map(([route, count], index) => (
                <div key={route}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>{route}</strong>
                  <i />
                  <small>{count} {count === 1 ? 'flight' : 'flights'}</small>
                </div>
              ))}
            </div>
          </article>

          <article className="chart-panel cumulative-panel">
            <div className="panel-title">
              <div><span>06</span><h3>Cumulative distance</h3></div>
              <p>{earthLaps.toFixed(1)} laps around the Equator</p>
            </div>
            <div className="cumulative-chart">
              <svg viewBox="0 0 1000 220" role="img" aria-label="Cumulative flight distance over time">
                <defs>
                  <linearGradient id="distance-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#69e0df" stopOpacity="0.34" />
                    <stop offset="100%" stopColor="#69e0df" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[34, 85, 136, 188].map((y) => <line key={y} x1="38" x2="962" y1={y} y2={y} className="chart-gridline" />)}
                {cumulativeArea && <path d={cumulativeArea} fill="url(#distance-area)" />}
                {cumulativeLine && <path d={cumulativeLine} className="cumulative-line" />}
                {cumulativePoints.length > 0 && (
                  <>
                    <circle cx={cumulativePoints[0].x} cy={cumulativePoints[0].y} r="4" className="chart-point" />
                    <circle cx={cumulativePoints.at(-1)!.x} cy={cumulativePoints.at(-1)!.y} r="5" className="chart-point chart-point-last" />
                  </>
                )}
              </svg>
              <div className="cumulative-axis">
                <span>{filteredFlights[0]?.date ?? '—'}</span>
                <strong>{formatNumber(filteredDistance)} km</strong>
                <span>{filteredFlights.at(-1)?.date ?? '—'}</span>
              </div>
            </div>
          </article>

          <article className="chart-panel profile-panel">
            <div className="panel-title">
              <div><span>07</span><h3>Journey profile</h3></div>
              <p>{topMonth ? `${monthNames[Number(topMonth[0]) - 1]} is the busiest month` : 'No matching data'}</p>
            </div>
            <div className="distance-stack" aria-label="Flights by distance band">
              {distanceBands.map((band) => (
                <i
                  key={band.label}
                  className={band.className}
                  style={{ width: `${(band.count / Math.max(1, filteredFlights.length)) * 100}%` }}
                />
              ))}
            </div>
            <ul className="profile-list">
              {distanceBands.map((band) => (
                <li key={band.label}>
                  <span><i className={band.className} />{band.label}<small>{band.range}</small></span>
                  <strong>{band.count}</strong>
                </li>
              ))}
            </ul>
            <div className="border-split">
              <div><span>International</span><strong>{internationalFlights.length}</strong></div>
              <i><b style={{ width: `${(internationalFlights.length / Math.max(1, filteredFlights.length)) * 100}%` }} /></i>
              <div><span>Domestic</span><strong>{domesticFlights}</strong></div>
            </div>
          </article>

          <article className="chart-panel fleet-age-panel">
            <div className="panel-title">
              <div><span>08</span><h3>Aircraft age</h3></div>
              <p>{aircraftAges.length} records with first-flight data</p>
            </div>
            <div className="age-hero">
              <strong>{aircraftAges.length ? averageAircraftAge.toFixed(1) : '—'}</strong>
              <span>average years old<br />at time of flight</span>
            </div>
            <div className="age-extremes">
              <div>
                <span>Youngest flown</span>
                <strong>{youngestAircraft?.flight.registration ?? '—'}</strong>
                <small>{youngestAircraft ? `${youngestAircraft.ageYears.toFixed(1)} years · ${youngestAircraft.flight.aircraft}` : 'No data'}</small>
              </div>
              <div>
                <span>Oldest flown</span>
                <strong>{oldestAircraft?.flight.registration ?? '—'}</strong>
                <small>{oldestAircraft ? `${oldestAircraft.ageYears.toFixed(1)} years · ${oldestAircraft.flight.aircraft}` : 'No data'}</small>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="logbook-section" id="logbook" aria-labelledby="logbook-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Flight records</p>
            <h2 id="logbook-title">The logbook</h2>
          </div>
          <p>{logbookFlights.length} entries · newest first</p>
        </div>

        <div className="logbook-tools">
          <label>
            <span>Search records</span>
            <input
              type="search"
              value={logbookQuery}
              onChange={(event) => {
                setLogbookQuery(event.target.value);
                setShowAllFlights(false);
              }}
              placeholder="Airport, flight, aircraft or registration"
              aria-label="Search flight records"
            />
          </label>
          <button type="button" onClick={downloadLogbook} disabled={!logbookFlights.length}>
            Export {logbookFlights.length} rows as CSV
          </button>
        </div>

        <div className="logbook-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th><th>Route</th><th>Flight</th><th>Local time</th>
                <th>Aircraft</th><th>Registration</th><th>Distance</th>
              </tr>
            </thead>
            <tbody>
              {[...logbookFlights].reverse().slice(0, showAllFlights ? undefined : 12).map((flight) => (
                <tr key={flight.id}>
                  <td>{flight.date}</td>
                  <td><strong>{flight.origin}</strong><span>→</span><strong>{flight.destination}</strong></td>
                  <td>{flight.flightNumber}</td>
                  <td>{flight.departureTime ?? '—'} <span>→</span> {flight.arrivalTime ?? '—'}</td>
                  <td><strong>{flight.aircraft}</strong><small>{aircraftNames[flight.aircraft] ?? flight.aircraft}</small></td>
                  <td>{flight.registration ?? '—'}</td>
                  <td>{formatNumber(flight.distanceKm)} km</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!logbookFlights.length && <p className="empty-table">No flights match the current filters and search.</p>}
        </div>
        {logbookFlights.length > 12 && (
          <button className="show-more" type="button" onClick={() => setShowAllFlights((show) => !show)}>
            {showAllFlights ? 'Show recent flights' : `Show all ${logbookFlights.length} flights`}
          </button>
        )}
      </section>

      <footer>
        <p><strong>Flight Atlas</strong> · Open source, local-first and private by design.</p>
        <p>Distances use great-circle calculations in kilometres. Airport coordinates from <a href="https://ourairports.com/data/" target="_blank" rel="noreferrer">OurAirports</a>.</p>
      </footer>
    </main>
  );
}

export default function Home() {
  return <FlightAtlasExperience key="flight-atlas-features-v3" />;
}
