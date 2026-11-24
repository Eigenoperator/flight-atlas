'use client';

import { useMemo, useState } from 'react';
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

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-GB').format(value);
}

function percentage(part: number, total: number) {
  return total ? Math.round((part / total) * 100) : 0;
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
  const loggedTypes = selectedCollection?.types ?? new Set<string>();
  const collectedReferenceTypes = referenceTypes.filter((code) => loggedTypes.has(code));
  const registrationCoverage = selectedFlights.filter((flight) => flight.registration).length;
  const distance = selectedFlights.reduce((sum, flight) => sum + flight.distanceKm, 0);
  const routes = new Set(selectedFlights.map((flight) => [flight.origin, flight.destination].sort().join('–')));

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
        return {
          code,
          flights: typeFlights,
          registrations: new Set(typeFlights.flatMap((flight) => flight.registration ? [flight.registration] : [])),
          inReference: referenceTypes.includes(code),
        };
      })
      .sort((a, b) => Number(Boolean(b.flights.length)) - Number(Boolean(a.flights.length))
        || b.flights.length - a.flights.length
        || a.code.localeCompare(b.code));
  }, [referenceTypes, selectedFlights]);

  const airframes = useMemo(() => {
    const byRegistration = new Map<string, Flight[]>();
    selectedFlights.forEach((flight) => {
      if (!flight.registration) return;
      byRegistration.set(flight.registration, [...(byRegistration.get(flight.registration) ?? []), flight]);
    });
    return [...byRegistration.entries()]
      .map(([registration, airframeFlights]) => ({
        registration,
        flights: airframeFlights,
        type: passportAircraftType(airframeFlights[0].aircraft),
        serial: airframeFlights.find((flight) => flight.aircraftSerialNumber)?.aircraftSerialNumber ?? null,
        first: airframeFlights[0],
        last: airframeFlights.at(-1)!,
      }))
      .sort((a, b) => a.type.localeCompare(b.type) || a.registration.localeCompare(b.registration));
  }, [selectedFlights]);

  const airframesByType = useMemo(() => {
    const grouped = new Map<string, typeof airframes>();
    airframes.forEach((airframe) => grouped.set(airframe.type, [...(grouped.get(airframe.type) ?? []), airframe]));
    return [...grouped.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  }, [airframes]);

  const liveryReferences = specialLiveryCatalog[selectedCode] ?? [];
  const registrationSet = selectedCollection?.registrations ?? new Set<string>();
  const collectedLiveries = liveryReferences.filter((livery) => registrationSet.has(livery.registration));
  const firstFlight = selectedFlights[0];
  const latestFlight = selectedFlights.at(-1);
  const airlineButtons = showAllAirlines ? airlineCollections : airlineCollections.slice(0, 12);

  if (!selectedCollection) return null;

  return (
    <article className="chart-panel airline-passport-panel" id="passport">
      <div className="panel-title airline-passport-title">
        <div><span>18</span><h3>Airline passport</h3></div>
        <p>Fleet types, individual aircraft and special liveries</p>
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
          <div><span>Aircraft types</span><strong>{loggedTypes.size}</strong><small>{referenceTypes.length ? `${collectedReferenceTypes.length} of ${referenceTypes.length} in starter catalogue` : 'No reference catalogue'}</small></div>
          <div><span>Individual aircraft</span><strong>{airframes.length}</strong><small>{registrationCoverage} of {selectedFlights.length} flights identified</small></div>
          <div><span>Special liveries</span><strong>{collectedLiveries.length}</strong><small>{liveryReferences.length ? `${collectedLiveries.length} of ${liveryReferences.length} known liveries` : 'No livery reference yet'}</small></div>
          <div><span>Routes</span><strong>{routes.size}</strong><small>{firstFlight ? `${firstFlight.origin}—${firstFlight.destination} first` : '—'}</small></div>
        </div>
      </section>

      <div className="airline-passport-tabs" role="tablist" aria-label="Airline passport detail">
        <button type="button" role="tab" aria-selected={activeTab === 'types'} className={activeTab === 'types' ? 'is-active' : ''} onClick={() => setActiveTab('types')}>Aircraft types <span>{loggedTypes.size}</span></button>
        <button type="button" role="tab" aria-selected={activeTab === 'airframes'} className={activeTab === 'airframes' ? 'is-active' : ''} onClick={() => setActiveTab('airframes')}>Individual aircraft <span>{airframes.length}</span></button>
        <button type="button" role="tab" aria-selected={activeTab === 'liveries'} className={activeTab === 'liveries' ? 'is-active' : ''} onClick={() => setActiveTab('liveries')}>Special liveries <span>{collectedLiveries.length}/{liveryReferences.length || '—'}</span></button>
      </div>

      {activeTab === 'types' && (
        <div className="passport-type-grid" role="tabpanel">
          {typeRows.map((row) => (
            <article key={row.code} className={row.flights.length ? 'is-collected' : 'is-missing'}>
              <div><strong>{row.code}</strong><span>{row.flights.length ? 'Collected' : 'Not yet'}</span></div>
              <h5>{aircraftNames[row.code] ?? row.code}</h5>
              <p>{row.flights.length} {row.flights.length === 1 ? 'flight' : 'flights'} · {row.registrations.size} known {row.registrations.size === 1 ? 'aircraft' : 'aircraft'}</p>
              {!row.inReference && row.flights.length > 0 && <small>Logged outside the starter catalogue</small>}
            </article>
          ))}
        </div>
      )}

      {activeTab === 'airframes' && (
        <div className="passport-airframes" role="tabpanel">
          <div className="passport-coverage">
            <span>Registration coverage</span>
            <i><b style={{ width: `${percentage(registrationCoverage, selectedFlights.length)}%` }} /></i>
            <strong>{percentage(registrationCoverage, selectedFlights.length)}%</strong>
          </div>
          {airframesByType.map(([type, typeAirframes], index) => (
            <details key={type} open={index < 2}>
              <summary>
                <span><strong>{type}</strong><small>{aircraftNames[type] ?? type}</small></span>
                <b>{typeAirframes.length} {typeAirframes.length === 1 ? 'aircraft' : 'aircraft'}</b>
              </summary>
              <div>
                {typeAirframes.map((airframe) => (
                  <button type="button" key={airframe.registration} onClick={() => onSelectFlight(airframe.last.id)}>
                    <span><strong>{airframe.registration}</strong><small>{airframe.serial ? `MSN ${airframe.serial}` : 'Serial not recorded'}</small></span>
                    <span><strong>{airframe.flights.length}</strong><small>{airframe.flights.length === 1 ? 'flight' : 'flights'}</small></span>
                    <span><strong>{airframe.first.date === airframe.last.date ? airframe.first.date : `${airframe.first.date} — ${airframe.last.date}`}</strong><small>First to latest check-in</small></span>
                  </button>
                ))}
              </div>
            </details>
          ))}
          {!airframes.length && <p className="passport-empty">No aircraft registrations were recorded for this airline.</p>}
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
        Type and livery percentages use a maintained starter catalogue, not a live fleet database. Logged flights and registrations always come from the current file, including aircraft outside the catalogue.
      </p>
    </article>
  );
}
