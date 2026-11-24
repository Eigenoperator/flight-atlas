'use client';

import { useMemo, useState } from 'react';
import fleetCatalogJson from '../data/airline-fleet-catalog.json';
import { airlineLogoUrl } from '../lib/airline-logos';
import {
  airlineTypeCatalog,
  passportAircraftType,
  specialLiveryCatalog,
} from '../lib/airline-passport-catalog';
import type { Flight } from '../lib/flight-data';

type AirlinePassportProps = {
  flights: Flight[];
  airlineNames: Record<string, string>;
  aircraftNames: Record<string, string>;
  onSelectFlight: (flightId: number) => void;
};

type PassportTab = 'types' | 'airframes' | 'liveries';

type FleetCatalog = {
  generatedAt: string;
  observedFrom: string;
  observedTo: string;
  source: { name: string; url: string; license: string; method: string };
  airlines: Record<string, {
    callsignPrefix: string;
    types: Record<string, string[]>;
  }>;
  verifiedAirlines?: Record<string, {
    verifiedAt: string;
    types: Record<string, number>;
    countSource: { name: string; url: string };
    rosterSource: { name: string; url: string };
  }>;
};

type AirframeRow = {
  registration: string;
  type: string;
  flights: Flight[];
  serial: string | null;
  collected: boolean;
};

const fleetCatalog = fleetCatalogJson as FleetCatalog;

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-GB').format(value);
}

function percentage(part: number, total: number) {
  return total ? Math.round((part / total) * 100) : 0;
}

function ordinal(value: number) {
  const remainder100 = value % 100;
  if (remainder100 >= 11 && remainder100 <= 13) return `${value}th`;
  return `${value}${value % 10 === 1 ? 'st' : value % 10 === 2 ? 'nd' : value % 10 === 3 ? 'rd' : 'th'}`;
}

function formatReferenceDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

export function AirlinePassport({
  flights,
  airlineNames,
  aircraftNames,
  onSelectFlight,
}: AirlinePassportProps) {
  const [selectedAirline, setSelectedAirline] = useState('');
  const [activeTab, setActiveTab] = useState<PassportTab>('types');
  const [showAllAirlines, setShowAllAirlines] = useState(false);
  const [airframeType, setAirframeType] = useState('');
  const [selectedRegistration, setSelectedRegistration] = useState<string | null>(null);

  const airlineCollections = useMemo(() => {
    const grouped = new Map<string, Flight[]>();
    flights.forEach((flight) => grouped.set(flight.airline, [...(grouped.get(flight.airline) ?? []), flight]));
    return [...grouped.entries()]
      .map(([code, airlineFlights]) => ({
        code,
        flights: airlineFlights.sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id),
        types: new Set(airlineFlights.map((flight) => passportAircraftType(flight.aircraft))),
        registrations: new Set(airlineFlights.flatMap((flight) => flight.registration ? [flight.registration] : [])),
      }))
      .sort((a, b) => b.flights.length - a.flights.length || a.code.localeCompare(b.code));
  }, [flights]);

  const selectedCode = airlineCollections.some((entry) => entry.code === selectedAirline)
    ? selectedAirline
    : airlineCollections[0]?.code ?? '';
  const selectedCollection = useMemo(
    () => airlineCollections.find((entry) => entry.code === selectedCode) ?? airlineCollections[0],
    [airlineCollections, selectedCode],
  );
  const selectedFlights = useMemo(() => selectedCollection?.flights ?? [], [selectedCollection]);
  const referenceTypes = useMemo(() => airlineTypeCatalog[selectedCode] ?? [], [selectedCode]);
  const observedTypes = useMemo(
    () => fleetCatalog.airlines[selectedCode]?.types ?? {},
    [selectedCode],
  );
  const loggedTypes = selectedCollection?.types ?? new Set<string>();
  const collectedReferenceTypes = referenceTypes.filter((code) => loggedTypes.has(code));
  const registrationCoverage = selectedFlights.filter((flight) => flight.registration).length;
  const distance = selectedFlights.reduce((sum, flight) => sum + flight.distanceKm, 0);
  const routes = new Set(selectedFlights.map((flight) => [flight.origin, flight.destination].sort().join('–')));

  const airframesByType = useMemo(() => {
    const flightsByTypeAndRegistration = new Map<string, Map<string, Flight[]>>();
    selectedFlights.forEach((flight) => {
      if (!flight.registration) return;
      const type = passportAircraftType(flight.aircraft);
      const typeFlights = flightsByTypeAndRegistration.get(type) ?? new Map<string, Flight[]>();
      typeFlights.set(flight.registration, [...(typeFlights.get(flight.registration) ?? []), flight]);
      flightsByTypeAndRegistration.set(type, typeFlights);
    });

    const typeCodes = [...new Set([...referenceTypes, ...flightsByTypeAndRegistration.keys()])];
    const roster = new Map<string, AirframeRow[]>();
    typeCodes.forEach((type) => {
      const logged = flightsByTypeAndRegistration.get(type) ?? new Map<string, Flight[]>();
      const registrations = [...new Set([...(observedTypes[type] ?? []), ...logged.keys()])];
      roster.set(type, registrations
        .map((registration) => {
          const registrationFlights = logged.get(registration) ?? [];
          return {
            registration,
            type,
            flights: registrationFlights,
            serial: registrationFlights.find((flight) => flight.aircraftSerialNumber)?.aircraftSerialNumber ?? null,
            collected: registrationFlights.length > 0,
          };
        })
        .sort((a, b) => Number(b.collected) - Number(a.collected) || a.registration.localeCompare(b.registration)));
    });
    return roster;
  }, [observedTypes, referenceTypes, selectedFlights]);

  const typeRows = useMemo(() => {
    const byType = new Map<string, Flight[]>();
    selectedFlights.forEach((flight) => {
      const type = passportAircraftType(flight.aircraft);
      byType.set(type, [...(byType.get(type) ?? []), flight]);
    });
    const codes = [...new Set([...referenceTypes, ...byType.keys()])];
    return codes
      .map((code) => {
        const typeFlights = byType.get(code) ?? [];
        const roster = airframesByType.get(code) ?? [];
        return {
          code,
          flights: typeFlights,
          roster,
          collected: roster.filter((airframe) => airframe.collected).length,
          inReference: referenceTypes.includes(code),
        };
      })
      .sort((a, b) => Number(Boolean(b.flights.length)) - Number(Boolean(a.flights.length))
        || b.flights.length - a.flights.length
        || a.code.localeCompare(b.code));
  }, [airframesByType, referenceTypes, selectedFlights]);

  const effectiveAirframeType = typeRows.some((row) => row.code === airframeType)
    ? airframeType
    : typeRows[0]?.code ?? '';
  const visibleAirframes = airframesByType.get(effectiveAirframeType) ?? [];
  const selectedAirframe = selectedRegistration
    ? visibleAirframes.find((airframe) => airframe.registration === selectedRegistration && airframe.collected) ?? null
    : null;
  const totalRoster = [...airframesByType.values()].reduce((sum, roster) => sum + roster.length, 0);
  const collectedAirframes = [...airframesByType.values()].reduce(
    (sum, roster) => sum + roster.filter((airframe) => airframe.collected).length,
    0,
  );

  const liveryReferences = specialLiveryCatalog[selectedCode] ?? [];
  const verifiedFleet = fleetCatalog.verifiedAirlines?.[selectedCode];
  const registrationSet = selectedCollection?.registrations ?? new Set<string>();
  const collectedLiveries = liveryReferences.filter((livery) => registrationSet.has(livery.registration));
  const firstFlight = selectedFlights[0];
  const latestFlight = selectedFlights.at(-1);
  const airlineButtons = showAllAirlines ? airlineCollections : airlineCollections.slice(0, 12);

  if (!selectedCollection) return null;

  const openTypeRoster = (type: string) => {
    setAirframeType(type);
    setSelectedRegistration(null);
    setActiveTab('airframes');
  };

  return (
    <article className="chart-panel airline-passport-panel" id="passport">
      <div className="panel-title airline-passport-title">
        <div><span>18</span><h3>Airline passport</h3></div>
        <p>Aircraft types, observed fleets and special liveries</p>
      </div>

      <div className={`airline-passport-picker${showAllAirlines ? ' is-expanded' : ''}`} aria-label="Choose an airline collection">
        {airlineButtons.map((entry) => {
          const targets = airlineTypeCatalog[entry.code] ?? [];
          const matched = targets.filter((type) => entry.types.has(type)).length;
          const progress = targets.length ? percentage(matched, targets.length) : 0;
          return (
            <button
              type="button"
              key={entry.code}
              className={selectedCode === entry.code ? 'is-active' : ''}
              aria-pressed={selectedCode === entry.code}
              onClick={() => {
                setSelectedAirline(entry.code);
                setActiveTab('types');
                setAirframeType('');
                setSelectedRegistration(null);
              }}
            >
              <span className="airline-passport-picker-logo">
                <img
                  src={airlineLogoUrl(entry.code)}
                  alt=""
                  width="96"
                  height="96"
                  onError={(event) => event.currentTarget.parentElement?.classList.add('logo-missing')}
                />
                <strong>{entry.code}</strong>
              </span>
              <span className="airline-passport-picker-copy">
                <strong>{entry.code}</strong>
                <small>{entry.flights.length} flights · {entry.types.size} types</small>
                <i><b style={{ width: targets.length ? `${progress}%` : '0%' }} /></i>
              </span>
            </button>
          );
        })}
      </div>
      {airlineCollections.length > 12 && (
        <button
          type="button"
          className="ranking-toggle ranking-toggle-compact airline-passport-expand"
          aria-expanded={showAllAirlines}
          onClick={() => setShowAllAirlines((value) => !value)}
        >
          <span>{showAllAirlines ? 'Show top 12' : `Show all ${airlineCollections.length} airlines`}</span>
          <strong aria-hidden="true">{showAllAirlines ? '−' : '+'}</strong>
        </button>
      )}

      <section className="airline-passport-overview" aria-live="polite">
        <header>
          <span className="airline-passport-hero-logo">
            <img
              src={airlineLogoUrl(selectedCode)}
              alt={`${airlineNames[selectedCode] ?? selectedCode} logo`}
              width="160"
              height="160"
              onError={(event) => event.currentTarget.parentElement?.classList.add('logo-missing')}
            />
            <strong>{selectedCode}</strong>
          </span>
          <div>
            <span>Collection for {selectedCode}</span>
            <h4>{airlineNames[selectedCode] ?? selectedCode}</h4>
            <p>{firstFlight?.date ?? '—'} — {latestFlight?.date ?? '—'} · complete logbook</p>
          </div>
        </header>
        <div className="airline-passport-kpis">
          <div><span>Flights</span><strong>{selectedFlights.length}</strong><small>{formatNumber(distance)} km</small></div>
          <div><span>Aircraft types</span><strong>{loggedTypes.size}</strong><small>{referenceTypes.length ? `${collectedReferenceTypes.length} of ${referenceTypes.length} in type catalogue` : 'No type reference'}</small></div>
          <div><span>Individual aircraft</span><strong>{collectedAirframes}</strong><small>{totalRoster ? `${collectedAirframes} of ${totalRoster} observed or logged` : `${registrationCoverage} identified flights`}</small></div>
          <div><span>Special liveries</span><strong>{collectedLiveries.length}</strong><small>{liveryReferences.length ? `${collectedLiveries.length} of ${liveryReferences.length} known liveries` : 'No livery reference yet'}</small></div>
          <div><span>Routes</span><strong>{routes.size}</strong><small>{firstFlight ? `${firstFlight.origin}—${firstFlight.destination} first` : '—'}</small></div>
        </div>
      </section>

      <div className="airline-passport-tabs" role="tablist" aria-label="Airline passport detail">
        <button type="button" role="tab" aria-selected={activeTab === 'types'} className={activeTab === 'types' ? 'is-active' : ''} onClick={() => setActiveTab('types')}>Aircraft types <span>{loggedTypes.size}/{typeRows.length}</span></button>
        <button type="button" role="tab" aria-selected={activeTab === 'airframes'} className={activeTab === 'airframes' ? 'is-active' : ''} onClick={() => setActiveTab('airframes')}>Individual aircraft <span>{collectedAirframes}/{totalRoster || '—'}</span></button>
        <button type="button" role="tab" aria-selected={activeTab === 'liveries'} className={activeTab === 'liveries' ? 'is-active' : ''} onClick={() => setActiveTab('liveries')}>Special liveries <span>{collectedLiveries.length}/{liveryReferences.length || '—'}</span></button>
      </div>

      {activeTab === 'types' && (
        <div className="passport-type-grid" role="tabpanel">
          {typeRows.map((row) => (
            <button
              type="button"
              key={row.code}
              className={row.flights.length ? 'is-collected' : 'is-missing'}
              onClick={() => openTypeRoster(row.code)}
            >
              <div><strong>{row.code}</strong><span>{row.flights.length ? 'Collected' : 'Not yet'}</span></div>
              <h5>{aircraftNames[row.code] ?? row.code}</h5>
              <p>{row.flights.length} {row.flights.length === 1 ? 'flight' : 'flights'} · {row.collected}/{row.roster.length || '—'} aircraft flown</p>
              <i><b style={{ width: `${percentage(row.collected, row.roster.length)}%` }} /></i>
              {!row.inReference && row.flights.length > 0 && <small>Historic logbook type</small>}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'airframes' && (
        <div className="passport-airframes" role="tabpanel">
          <div className="passport-coverage">
            <span>Observed fleet collected</span>
            <i><b style={{ width: `${percentage(collectedAirframes, totalRoster)}%` }} /></i>
            <strong>{collectedAirframes}/{totalRoster || '—'}</strong>
          </div>

          <div className="passport-type-picker" aria-label="Choose aircraft type">
            {typeRows.map((row) => (
              <button
                type="button"
                key={row.code}
                className={effectiveAirframeType === row.code ? 'is-active' : ''}
                onClick={() => {
                  setAirframeType(row.code);
                  setSelectedRegistration(null);
                }}
              >
                <strong>{row.code}</strong>
                <span>{row.collected}/{row.roster.length || '—'}</span>
              </button>
            ))}
          </div>

          <div className="passport-roster-heading">
            <div>
              <strong>{effectiveAirframeType}</strong>
              <span>{aircraftNames[effectiveAirframeType] ?? effectiveAirframeType}</span>
            </div>
            <p>{visibleAirframes.filter((airframe) => airframe.collected).length} of {visibleAirframes.length} aircraft flown</p>
          </div>

          {selectedAirframe && (
            <section className="airframe-trip-history" aria-live="polite">
              <div className="airframe-trip-history-title">
                <div>
                  <span>Collected aircraft</span>
                  <strong>{selectedAirframe.registration}</strong>
                  <small>{aircraftNames[selectedAirframe.type] ?? selectedAirframe.type}{selectedAirframe.serial ? ` · MSN ${selectedAirframe.serial}` : ''}</small>
                </div>
                <p>All journeys on this aircraft · {selectedAirframe.flights.length} {selectedAirframe.flights.length === 1 ? 'flight' : 'flights'}</p>
                <button type="button" aria-label="Close aircraft history" onClick={() => setSelectedRegistration(null)}>Close <span aria-hidden="true">×</span></button>
              </div>
              <div className="milestone-flight-grid airframe-journey-grid">
                {selectedAirframe.flights.map((flight, index) => (
                  <button type="button" className="milestone-flight-card airframe-journey-card" key={flight.id} onClick={() => onSelectFlight(flight.id)}>
                    <span className="milestone-flight-index"><strong>{ordinal(index + 1)}</strong><small>journey</small></span>
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
                      <span>{aircraftNames[flight.aircraft] ?? flight.aircraft} · {selectedAirframe.registration}{flight.aircraftSerialNumber ? ` · MSN ${flight.aircraftSerialNumber}` : ''}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <div className="passport-registration-grid">
            {visibleAirframes.map((airframe) => (
              <button
                type="button"
                key={airframe.registration}
                className={airframe.collected ? 'is-collected' : 'is-missing'}
                disabled={!airframe.collected}
                aria-pressed={selectedAirframe?.registration === airframe.registration}
                onClick={() => setSelectedRegistration(airframe.registration)}
              >
                <span aria-hidden="true">{airframe.collected ? '✓' : '○'}</span>
                <strong>{airframe.registration}</strong>
                {airframe.collected
                  ? <small>{airframe.flights.length} {airframe.flights.length === 1 ? 'flight' : 'flights'}{airframe.serial ? ` · MSN ${airframe.serial}` : ''}</small>
                  : <small>Not flown</small>}
              </button>
            ))}
          </div>
          {!visibleAirframes.length && <p className="passport-empty">No observed registrations are available for this aircraft type.</p>}
        </div>
      )}

      {activeTab === 'liveries' && (
        <div className="passport-livery-grid" role="tabpanel">
          {liveryReferences.map((livery) => {
            const matchingFlights = selectedFlights.filter((flight) => flight.registration === livery.registration);
            const collected = matchingFlights.length > 0;
            return (
              <button
                type="button"
                key={livery.registration}
                className={collected ? 'is-collected' : 'is-missing'}
                disabled={!collected}
                onClick={() => collected && onSelectFlight(matchingFlights.at(-1)!.id)}
              >
                <span className="livery-status" aria-hidden="true">{collected ? '✓' : '○'}</span>
                <span><small>{livery.type} · {livery.registration}</small><strong>{livery.name}</strong><em>{livery.note}</em></span>
              </button>
            );
          })}
          {!liveryReferences.length && (
            <div className="passport-empty passport-empty-livery">
              <strong>No special-livery reference has been added for {selectedCode} yet.</strong>
              <span>Aircraft registrations from your logbook are still collected under “Individual aircraft”.</span>
            </div>
          )}
        </div>
      )}

      <p className="airline-passport-note">
        {verifiedFleet ? <>
          Verified fleet types ({Object.keys(verifiedFleet.types).join(', ')}):{' '}
          <a href={verifiedFleet.countSource.url} target="_blank" rel="noreferrer">official airline count</a> +{' '}
          <a href={verifiedFleet.rosterSource.url} target="_blank" rel="noreferrer">registration roster</a>, checked {formatReferenceDate(verifiedFleet.verifiedAt)}.{' '}
        </> : null}
        Other types use an observed-fleet fallback from {formatReferenceDate(fleetCatalog.observedFrom)} — {formatReferenceDate(fleetCatalog.observedTo)} via{' '}
        <a href={fleetCatalog.source.url} target="_blank" rel="noreferrer">{fleetCatalog.source.name}</a> ({fleetCatalog.source.license}). Logged historic aircraft are always added; unverified types are not presented as an official complete fleet.
      </p>
    </article>
  );
}
