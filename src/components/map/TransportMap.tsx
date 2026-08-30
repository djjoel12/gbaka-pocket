"use client";

import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Circle,
  Popup,
  GeoJSON,
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
  historicalStops?: StopPoint[];
  transportLines?: any[];
  osmStops?: any[];
  searchedLine?: any;
  showResult?: boolean;
};

const defaultPosition: [number, number] = [5.3364, -4.0267];

// ============================================
// PALETTE DE COULEURS POUR LES LIGNES
// ============================================
const LINE_COLORS = [
  "#3B82F6", // Bleu
  "#EF4444", // Rouge
  "#22C55E", // Vert
  "#F59E0B", // Orange
  "#8B5CF6", // Violet
  "#EC4899", // Rose
  "#06B6D4", // Cyan
  "#F97316", // Orange foncé
  "#14B8A6", // Turquoise
  "#6366F1", // Indigo
  "#84CC16", // Vert lime
  "#D946EF", // Magenta
  "#0EA5E9", // Bleu ciel
  "#E11D48", // Rouge foncé
  "#65A30D", // Vert olive
  "#9333EA", // Violet foncé
  "#0891B2", // Cyan foncé
  "#EA580C", // Orange brûlé
  "#4F46E5", // Bleu indigo
  "#DB2777", // Rose foncé
];

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

const historicalStopIcon = L.divIcon({
  html: `
    <div style="
      background: white; 
      border-radius: 50%; 
      width: 44px; 
      height: 44px; 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      box-shadow: 0 0 20px rgba(59,130,246,0.9), 0 0 60px rgba(59,130,246,0.4);
      border: 4px solid #3B82F6; 
      font-size: 24px;
    ">
      🚏
    </div>
  `,
  className: "",
  iconSize: [44, 44],
  iconAnchor: [22, 22],
});

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
  historicalStops = [],
  transportLines = [],
  osmStops = [],
  searchedLine = null,
  showResult = false,
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

  // ============================================
  // AFFICHAGE DE TOUTES LES LIGNES AVEC COULEURS
  // ============================================
  const displayLines = showResult && searchedLine ? [searchedLine] : transportLines;

  return (
    <div className="relative isolate h-full w-full overflow-hidden">
      <MapContainer
        center={displayPosition}
        zoom={15}
        scrollWheelZoom={true}
        className="relative z-0 h-full w-full"
        style={{ background: "#0a0e17" }}
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* ========================================================= */}
        {/* ===== TOUTES LES LIGNES AVEC COULEURS DIFFÉRENTES ===== */}
        {/* ========================================================= */}
        {displayLines.map((line, index) => {
          const color = LINE_COLORS[index % LINE_COLORS.length];
          return (
            <GeoJSON
              key={line.id}
              data={line.geometry}
              style={() => ({
                color: color,
                weight: 4,
                opacity: 0.85,
              })}
            />
          );
        })}

        {/* ========================================================= */}
        {/* ===== ARRÊTS OSM - SUPPRIMÉS ===== */}
        {/* ========================================================= */}

        {firstPoint && (
          <Marker position={[firstPoint.latitude, firstPoint.longitude]} icon={startIcon}>
            <Popup>
              <div className="text-sm font-bold text-green-600">🏁 Départ</div>
            </Popup>
          </Marker>
        )}

        {lastPoint && points.length > 1 && (
          <Marker position={[lastPoint.latitude, lastPoint.longitude]} icon={endIcon}>
            <Popup>
              <div className="text-sm font-bold text-red-600">🏁 Arrivée</div>
            </Popup>
          </Marker>
        )}

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

        {historicalStops.map((stop, index) => (
          <Marker
            key={`hist-${index}`}
            position={[stop.coordinates[0], stop.coordinates[1]]}
            icon={historicalStopIcon}
          >
            <Popup>
              <div className="text-sm text-gray-800">
                <p className="font-bold">{stop.name || "Arrêt Gbaka"}</p>
                <p className="text-xs text-gray-500">📍 Arrêt enregistré</p>
              </div>
            </Popup>
          </Marker>
        ))}

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
