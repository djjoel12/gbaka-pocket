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

import {
  useEffect,
  useRef,
} from "react";

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

const defaultPosition: [number, number] = [
  5.3364,
  -4.0267,
];

// ============================================
// CRÉATION D'ICÔNES PERSONNALISÉES
// ============================================

function createIcon(
  color: string,
  label: string = "",
  isPulsing: boolean = false
) {
  const svg = `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 40 40"
    >
      ${
        isPulsing
          ? `
        <circle
          cx="20"
          cy="20"
          r="16"
          fill="none"
          stroke="${color}"
          stroke-width="2"
          opacity="0.4"
        >
          <animate
            attributeName="r"
            from="12"
            to="20"
            dur="1.5s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            from="0.6"
            to="0"
            dur="1.5s"
            repeatCount="indefinite"
          />
        </circle>

        <circle
          cx="20"
          cy="20"
          r="14"
          fill="none"
          stroke="${color}"
          stroke-width="1.5"
          opacity="0.3"
        >
          <animate
            attributeName="r"
            from="10"
            to="18"
            dur="1.5s"
            begin="0.5s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            from="0.5"
            to="0"
            dur="1.5s"
            begin="0.5s"
            repeatCount="indefinite"
          />
        </circle>
      `
          : ""
      }

      <circle
        cx="20"
        cy="20"
        r="${isPulsing ? "10" : "14"}"
        fill="${color}"
        stroke="white"
        stroke-width="2.5"
      />

      ${
        label
          ? `
        <text
          x="20"
          y="${isPulsing ? "25" : "24"}"
          text-anchor="middle"
          fill="white"
          font-size="16"
          font-weight="bold"
          font-family="Arial"
        >
          ${label}
        </text>
      `
          : ""
      }

      ${
        isPulsing
          ? `
        <circle
          cx="20"
          cy="20"
          r="4"
          fill="white"
        />

        <circle
          cx="20"
          cy="20"
          r="2.5"
          fill="${color}"
        />
      `
          : ""
      }
    </svg>
  `;

  return L.divIcon({
    html: svg,
    className: isPulsing
      ? "pulsing-marker"
      : "custom-marker",
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

// ============================================
// ICÔNES PRINCIPALES
// ============================================

const startIcon = createIcon(
  "#22c55e",
  "🏁"
);

const endIcon = createIcon(
  "#ef4444",
  "🏁"
);

const liveIcon = createIcon(
  "#3b82f6",
  "",
  true
);

// ============================================
// SUIVI AUTOMATIQUE DE LA CARTE
// ============================================

function MapFollower({
  position,
}: {
  position: [number, number];
}) {
  const map = useMap();

  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      map.setView(position, 16);

      firstRender.current = false;

      return;
    }

    map.panTo(position, {
      animate: true,
      duration: 0.5,
    });
  }, [position, map]);

  return null;
}

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

export default function TransportMap({
  points,
  livePosition,
  isRecording = false,
}: TransportMapProps) {

  const lastPoint =
    points.length > 0
      ? points[points.length - 1]
      : null;

  const firstPoint =
    points.length > 0
      ? points[0]
      : null;

  const displayPosition: [number, number] =
    livePosition
      ? [
          livePosition.latitude,
          livePosition.longitude,
        ]
      : lastPoint
      ? [
          lastPoint.latitude,
          lastPoint.longitude,
        ]
      : defaultPosition;

  const routePositions: [number, number][] =
    points.map((point) => [
      point.latitude,
      point.longitude,
    ]);

  const hasLivePosition =
    !!livePosition;

  return (
    <div className="relative isolate h-full w-full overflow-hidden shadow-sm">

      <MapContainer
        center={displayPosition}
        zoom={13}
        scrollWheelZoom={true}
        className="relative z-0 h-full w-full"
        style={{
          background: "#0a0e17",
        }}
      >

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png"
        />

        {hasLivePosition && (
          <MapFollower
            position={displayPosition}
          />
        )}

        {/* ====================================
            TRACÉ DU TRAJET - STYLE AMÉLIORÉ
        ==================================== */}

        {routePositions.length > 1 && (
          <>
            <Polyline
              positions={routePositions}
              color="#8b5cf6"
              weight={20}
              opacity={0.12}
              lineJoin="round"
              lineCap="round"
            />

            <Polyline
              positions={routePositions}
              color="#6d28d9"
              weight={14}
              opacity={0.2}
              lineJoin="round"
              lineCap="round"
            />

            <Polyline
              positions={routePositions}
              color="#a78bfa"
              weight={6}
              opacity={0.95}
              lineJoin="round"
              lineCap="round"
            />

            <Polyline
              positions={routePositions}
              color="#c4b5fd"
              weight={3}
              opacity={0.8}
              lineJoin="round"
              lineCap="round"
            />

            <Polyline
              positions={routePositions}
              color="#ddd6fe"
              weight={1.5}
              opacity={0.6}
              lineJoin="round"
              lineCap="round"
              dashArray="10 14"
            />
          </>
        )}

        {firstPoint && (
          <Marker
            position={[
              firstPoint.latitude,
              firstPoint.longitude,
            ]}
            icon={startIcon}
          />
        )}

        {lastPoint &&
          points.length > 1 && (
            <Marker
              position={[
                lastPoint.latitude,
                lastPoint.longitude,
              ]}
              icon={endIcon}
            />
          )}

        {livePosition && (
          <>
            <Marker
              position={[
                livePosition.latitude,
                livePosition.longitude,
              ]}
              icon={liveIcon}
            />

            <Circle
              center={[
                livePosition.latitude,
                livePosition.longitude,
              ]}
              radius={
                livePosition.accuracy
              }
              pathOptions={{
                color: "#3b82f6",
                fillColor: "#3b82f6",
                fillOpacity: 0.1,
                weight: 1,
              }}
            />
          </>
        )}

      </MapContainer>

      {/* ======================================
          LÉGENDE - SUPPRIMÉE (maintenant dans la colonne)
      ====================================== */}
      {/* La légende est maintenant dans la colonne à gauche */}

    </div>
  );
  }
