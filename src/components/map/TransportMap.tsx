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

  // ==========================================
  // DERNIER POINT
  // ==========================================

  const lastPoint =
    points.length > 0
      ? points[points.length - 1]
      : null;

  // ==========================================
  // PREMIER POINT
  // ==========================================

  const firstPoint =
    points.length > 0
      ? points[0]
      : null;

  // ==========================================
  // POSITION À AFFICHER
  // ==========================================

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

  // ==========================================
  // CONVERSION DES POINTS GPS
  // ==========================================

  const routePositions: [number, number][] =
    points.map((point) => [
      point.latitude,
      point.longitude,
    ]);

  // ==========================================
  // POSITION GPS DISPONIBLE
  // ==========================================

  const hasLivePosition =
    !!livePosition;

  // ==========================================
  // AFFICHAGE
  // ==========================================

  return (
    <div
      className="
        relative
        isolate
        h-full
        w-full
        overflow-hidden
        rounded-2xl
        shadow-sm
      "
    >

      {/* ======================================
          CARTE
      ====================================== */}

      <MapContainer
        center={displayPosition}
        zoom={13}
        scrollWheelZoom={true}
        className="
          relative
          z-0
          h-full
          w-full
        "
        style={{
          background: "#0a0e17",
        }}
      >

        {/* ====================================
            FOND DE CARTE
        ==================================== */}

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png"
        />

        {/* ====================================
            SUIVI AUTOMATIQUE GPS
        ==================================== */}

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
            {/* Halo de lumière bleu */}
            <Polyline
              positions={routePositions}
              color="#1d4ed8"
              weight={16}
              opacity={0.15}
              lineJoin="round"
              lineCap="round"
            />

            {/* Halo extérieur */}
            <Polyline
              positions={routePositions}
              color="#3b82f6"
              weight={10}
              opacity={0.25}
              lineJoin="round"
              lineCap="round"
            />

            {/* Ligne principale - Bleu électrique */}
            <Polyline
              positions={routePositions}
              color="#60a5fa"
              weight={5}
              opacity={0.95}
              lineJoin="round"
              lineCap="round"
            />

            {/* Ligne intérieure - Bleu clair brillant */}
            <Polyline
              positions={routePositions}
              color="#93c5fd"
              weight={2}
              opacity={0.7}
              lineJoin="round"
              lineCap="round"
            />

            {/* Pointillés lumineux */}
            <Polyline
              positions={routePositions}
              color="#bfdbfe"
              weight={1}
              opacity={0.5}
              lineJoin="round"
              lineCap="round"
              dashArray="12 16"
            />
          </>
        )}

        {/* ====================================
            POINT DE DÉPART
        ==================================== */}

        {firstPoint && (
          <Marker
            position={[
              firstPoint.latitude,
              firstPoint.longitude,
            ]}
            icon={startIcon}
          />
        )}

        {/* ====================================
            POINT D'ARRIVÉE
        ==================================== */}

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

        {/* ====================================
            POSITION GPS EN DIRECT
        ==================================== */}

        {livePosition && (
          <>
            {/* Position actuelle */}

            <Marker
              position={[
                livePosition.latitude,
                livePosition.longitude,
              ]}
              icon={liveIcon}
            />

            {/* Cercle de précision GPS */}

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
          LÉGENDE PRINCIPALE
      ====================================== */}

      <div
        className="
          pointer-events-none
          absolute
          bottom-3
          left-1/2
          z-[1000]
          -translate-x-1/2
          rounded-2xl
          border
          border-white/10
          bg-black/80
          px-4
          py-2.5
          shadow-xl
          backdrop-blur-md
        "
      >

        <div
          className="
            flex
            flex-wrap
            items-center
            justify-center
            gap-3
            whitespace-nowrap
            text-xs
          "
        >

          {/* GPS */}

          <div className="flex items-center gap-1.5">

            <span
              className="
                h-2.5
                w-2.5
                rounded-full
                bg-blue-500
                shadow-lg
                shadow-blue-500/50
              "
            />

            <span className="text-white/80">
              GPS
            </span>

          </div>

          {/* DÉPART */}

          <div className="flex items-center gap-1.5">

            <span
              className="
                h-2.5
                w-2.5
                rounded-full
                bg-green-500
                shadow-lg
                shadow-green-500/50
              "
            />

            <span className="text-white/80">
              Départ
            </span>

          </div>

          {/* ARRIVÉE */}

          <div className="flex items-center gap-1.5">

            <span
              className="
                h-2.5
                w-2.5
                rounded-full
                bg-red-500
                shadow-lg
                shadow-red-500/50
              "
            />

            <span className="text-white/80">
              Arrivée
            </span>

          </div>

          {/* ENREGISTREMENT */}

          {isRecording && (
            <span
              className="
                ml-2
                flex
                items-center
                gap-1.5
                font-semibold
                text-emerald-400
              "
            >

              <span
                className="
                  h-2
                  w-2
                  animate-pulse
                  rounded-full
                  bg-emerald-400
                "
              />

              REC

            </span>
          )}

        </div>

      </div>

    </div>
  );
        }
