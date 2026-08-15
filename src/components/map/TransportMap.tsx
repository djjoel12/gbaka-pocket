"use client";

import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Circle,
  Popup,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";
import L from "leaflet";

import { useEffect, useRef } from "react";
import { StopPoint, GPSPoint } from "@/types/trip";
import { POI } from "@/utils/poiUtils";

type TransportMapProps = {
  points: GPSPoint[];
  livePosition?: GPSPoint | null;
  isRecording?: boolean;
  onMapReady?: (map: any) => void;
  stops?: StopPoint[];
  pois?: POI[];
};

const defaultPosition: [number, number] = [5.3364, -4.0267];

// ============================================
// CRÉATION D'ICÔNES
// ============================================

function createIcon(color: string, label: string = "", isPulsing: boolean = false) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
      ${isPulsing ? `
        <circle cx="20" cy="20" r="16" fill="none" stroke="${color}" stroke-width="2" opacity="0.4">
          <animate attributeName="r" from="12" to="20" dur="1.5s" repeatCount="indefinite"/>
          <animate attributeName="opacity" from="0.6" to="0" dur="1.5s" repeatCount="indefinite"/>
        </circle>
        <circle cx="20" cy="20" r="14" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.3">
          <animate attributeName="r" from="10" to="18" dur="1.5s" begin="0.5s" repeatCount="indefinite"/>
          <animate attributeName="opacity" from="0.5" to="0" dur="1.5s" begin="0.5s" repeatCount="indefinite"/>
        </circle>
      ` : ""}
      <circle cx="20" cy="20" r="${isPulsing ? "10" : "14"}" fill="${color}" stroke="white" stroke-width="2.5"/>
      ${label ? `<text x="20" y="${isPulsing ? "25" : "24"}" text-anchor="middle" fill="white" font-size="16" font-weight="bold" font-family="Arial">${label}</text>` : ""}
      ${isPulsing ? `
        <circle cx="20" cy="20" r="4" fill="white"/>
        <circle cx="20" cy="20" r="2.5" fill="${color}"/>
      ` : ""}
    </svg>
  `;
  return L.divIcon({ html: svg, className: isPulsing ? "pulsing-marker" : "custom-marker", iconSize: [40, 40], iconAnchor: [20, 20] });
}

const startIcon = createIcon("#22C55E", "🏁");
const endIcon = createIcon("#EF4444", "🏁");
const liveIcon = createIcon("#3B82F6", "", true);
const stopIcon = createIcon("#F59E0B", "📍", false);
const manualStopIcon = createIcon("#8B5CF6", "📍", false);
const poiIcon = createIcon("#F59E0B", "📍", false);

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

export default function TransportMap({
  points,
  livePosition,
  isRecording = false,
  onMapReady,
  stops = [],
  pois = [],
}: TransportMapProps) {

  const lastPoint = points.length > 0 ? points[points.length - 1] : null;
  const firstPoint = points.length > 0 ? points[0] : null;

  const displayPosition: [number, number] =
    livePosition
      ? [livePosition.latitude, livePosition.longitude]
      : lastPoint
      ? [lastPoint.latitude, lastPoint.longitude]
      : defaultPosition;

  const routePositions: [number, number][] = points.map((point) => [point.latitude, point.longitude]);

  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (mapRef.current && onMapReady) {
      onMapReady(mapRef.current);
    }
  }, [onMapReady]);

  return (
    <div className="relative isolate h-full w-full overflow-hidden">
      <MapContainer
        center={displayPosition}
        zoom={13}
        scrollWheelZoom={true}
        className="relative z-0 h-full w-full"
        style={{ background: "#0a0e17" }}
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png"
        />

        {/* ===== TRACÉ ===== */}
        {routePositions.length > 1 && (
          <>
            <Polyline positions={routePositions} color="#3B82F6" weight={20} opacity={0.12} lineJoin="round" lineCap="round" />
            <Polyline positions={routePositions} color="#3B82F6" weight={10} opacity={0.2} lineJoin="round" lineCap="round" />
            <Polyline positions={routePositions} color="#3B82F6" weight={5} opacity={0.85} lineJoin="round" lineCap="round" />
            <Polyline positions={routePositions} color="#60A5FA" weight={2} opacity={0.6} lineJoin="round" lineCap="round" dashArray="10 14" />
          </>
        )}

        {/* ===== POINT DE DÉPART ===== */}
        {firstPoint && (
          <Marker position={[firstPoint.latitude, firstPoint.longitude]} icon={startIcon}>
            <Popup>
              <div className="text-sm font-bold text-green-600">🏁 Départ</div>
            </Popup>
          </Marker>
        )}

        {/* ===== POINT D'ARRIVÉE ===== */}
        {lastPoint && points.length > 1 && (
          <Marker position={[lastPoint.latitude, lastPoint.longitude]} icon={endIcon}>
            <Popup>
              <div className="text-sm font-bold text-red-600">🏁 Arrivée</div>
            </Popup>
          </Marker>
        )}

        {/* ===== ARRÊTS DU TRAJET EN COURS ===== */}
        {stops.map((stop, index) => {
          if (stop.isStart || stop.isEnd) return null;
          const isManual = stop.isManual || false;
          return (
            <Marker
              key={stop.id || `stop-${index}`}
              position={[stop.coordinates[0], stop.coordinates[1]]}
              icon={isManual ? manualStopIcon : stopIcon}
            >
              <Popup>
                <div className="text-sm">
                  <p className="font-bold">{stop.name || `Arrêt ${index + 1}`}</p>
                  <p className="text-xs text-gray-500">
                    {isManual ? "📌 Ajouté manuellement" : "🛑 Détecté automatiquement"}
                  </p>
                  {stop.duration > 0 && (
                    <p className="text-xs text-gray-500">⏱️ {Math.round(stop.duration)}s</p>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* ===== POI PERMANENTS ===== */}
        {pois.map((poi) => (
          <Marker
            key={poi.id}
            position={[poi.latitude, poi.longitude]}
            icon={poiIcon}
          >
            <Popup>
              <div className="text-sm">
                <p className="font-bold text-orange-600">📍 {poi.name}</p>
                <p className="text-xs text-gray-500">🛑 Arrêt permanent</p>
                {poi.line_ids && poi.line_ids.length > 0 && (
                  <p className="text-xs text-gray-500">🚌 Lignes: {poi.line_ids.join(', ')}</p>
                )}
                {poi.is_verified && (
                  <p className="text-xs text-green-500">✅ Vérifié</p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* ===== POSITION GPS EN DIRECT ===== */}
        {livePosition && (
          <>
            <Marker position={[livePosition.latitude, livePosition.longitude]} icon={liveIcon} />
            <Circle
              center={[livePosition.latitude, livePosition.longitude]}
              radius={livePosition.accuracy}
              pathOptions={{
                color: "#3B82F6",
                fillColor: "#3B82F6",
                fillOpacity: 0.08,
                weight: 1.5,
              }}
            />
          </>
        )}
      </MapContainer>
    </div>
  );
}
