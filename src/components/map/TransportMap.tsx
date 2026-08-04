"use client";

import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Circle,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";

type GPSPoint = {
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number | null;
  timestamp: number;
};

type TransportMapProps = {
  points: GPSPoint[];
  livePosition?: GPSPoint | null;
  isRecording?: boolean;
};

const defaultPosition: [number, number] = [5.3364, -4.0267];

// ============================================
// ICÔNES
// ============================================

const startIcon = L.icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  iconRetinaUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const endIcon = L.icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  iconRetinaUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const liveIcon = L.icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  iconRetinaUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [30, 48],
  iconAnchor: [15, 48],
});

// ============================================
// SUIVI AUTOMATIQUE DE LA CARTE
// ============================================

function MapFollower({ position }: { position: [number, number] }) {
  const map = useMap();
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      map.setView(position, 16);
      firstRender.current = false;
      return;
    }
    map.panTo(position, { animate: true, duration: 0.5 });
  }, [position, map]);

  return null;
}

// ============================================
// FORMATAGE DE LA VITESSE
// ============================================

const formatSpeed = (speed: number | null) => {
  if (speed === null || speed < 0) return null;
  const kmh = speed * 3.6;
  return `${kmh.toFixed(1)} km/h`;
};

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

export default function TransportMap({
  points,
  livePosition,
  isRecording = false,
}: TransportMapProps) {
  const lastPoint = points.length > 0 ? points[points.length - 1] : null;
  const firstPoint = points.length > 0 ? points[0] : null;

  const displayPosition: [number, number] = livePosition
    ? [livePosition.latitude, livePosition.longitude]
    : lastPoint
    ? [lastPoint.latitude, lastPoint.longitude]
    : defaultPosition;

  const routePositions: [number, number][] = points.map((point) => [
    point.latitude,
    point.longitude,
  ]);

  const hasLivePosition = !!livePosition;
  const speedDisplay = livePosition?.speed ? formatSpeed(livePosition.speed) : null;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl shadow-sm">
      <MapContainer
        center={displayPosition}
        zoom={13}
        scrollWheelZoom={true}
        className="h-full w-full"
        style={{ background: "#0a0e17" }}
      >
        {/* ==========================================
            FOND DE CARTE - STYLE AMÉLIORÉ
            Plus contrasté pour meilleure visibilité
        ========================================== */}

        {/* Couche principale : fond sombre avec routes visibles */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png"
        />

        {/* Couche supplémentaire : routes plus visibles (overlay) */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
          opacity={0.25}
        />

        {/* ==================================
            SUIVI DE LA POSITION
        ================================== */}

        {hasLivePosition && <MapFollower position={displayPosition} />}

        {/* ==================================
            TRACÉ DU TRAJET - PLUS VISIBLE
        ================================== */}

        {routePositions.length > 1 && (
          <>
            {/* Ombre du trajet (effet glow plus prononcé) */}
            <Polyline
              positions={routePositions}
              color="#60a5fa"
              weight={14}
              opacity={0.2}
              lineJoin="round"
              lineCap="round"
            />

            {/* Trajet principal plus épais */}
            <Polyline
              positions={routePositions}
              color="#3b82f6"
              weight={6}
              opacity={0.95}
              lineJoin="round"
              lineCap="round"
            />

            {/* Trajet avec contour blanc pour meilleur contraste */}
            <Polyline
              positions={routePositions}
              color="rgba(255,255,255,0.15)"
              weight={8}
              opacity={0.3}
              lineJoin="round"
              lineCap="round"
            />
          </>
        )}

        {/* ==================================
            POINT DE DÉPART
        ================================== */}

        {firstPoint && (
          <Marker
            position={[firstPoint.latitude, firstPoint.longitude]}
            icon={startIcon}
          />
        )}

        {/* ==================================
            POINT D'ARRIVÉE
        ================================== */}

        {lastPoint && points.length > 1 && (
          <Marker
            position={[lastPoint.latitude, lastPoint.longitude]}
            icon={endIcon}
          />
        )}

        {/* ==================================
            POSITION EN DIRECT
        ================================== */}

        {livePosition && (
          <>
            <Marker
              position={[livePosition.latitude, livePosition.longitude]}
              icon={liveIcon}
            />

            {/* CERCLE DE PRÉCISION plus visible */}
            <Circle
              center={[livePosition.latitude, livePosition.longitude]}
              radius={livePosition.accuracy}
              pathOptions={{
                color: "#3b82f6",
                fillColor: "#3b82f6",
                fillOpacity: 0.15,
                weight: 2,
              }}
            />
          </>
        )}
      </MapContainer>

      {/* ==========================================
          LÉGENDE FLOTTANTE SUR LA CARTE
      ========================================== */}

      <div className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-2xl bg-black/80 px-4 py-2.5 backdrop-blur-md">
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50" />
            <span className="text-white/80">GPS</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-green-500 shadow-lg shadow-green-500/50" />
            <span className="text-white/80">Départ</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-lg shadow-red-500/50" />
            <span className="text-white/80">Arrivée</span>
          </div>

          {isRecording && (
            <span className="ml-2 flex items-center gap-1.5 font-semibold text-emerald-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              REC
            </span>
          )}
        </div>
      </div>

      {/* ==========================================
          INDICATEUR DE VITESSE SUR LA CARTE
      ========================================== */}

      {speedDisplay && isRecording && (
        <div className="absolute right-3 top-3 z-10 rounded-2xl bg-black/80 px-3 py-2 backdrop-blur-md border border-yellow-500/20">
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/60">🚀</span>
            <span className="text-sm font-bold text-yellow-400">{speedDisplay}</span>
          </div>
        </div>
      )}
    </div>
  );
            }
