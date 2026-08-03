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

const defaultPosition: [
  number,
  number
] = [
  5.3364,
  -4.0267,
];

// ============================================
// ICÔNE DE DÉPART
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

// ============================================
// ICÔNE D'ARRIVÉE
// ============================================

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

// ============================================
// ICÔNE POSITION EN DIRECT
// ============================================

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

function MapFollower({
  position,
}: {
  position: [
    number,
    number
  ];
}) {
  const map = useMap();

  const firstRender =
    useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      map.setView(
        position,
        16
      );

      firstRender.current =
        false;

      return;
    }

    map.panTo(
      position,
      {
        animate: true,

        duration: 0.5,
      }
    );
  }, [
    position,
    map,
  ]);

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
      ? points[
          points.length - 1
        ]
      : null;

  const firstPoint =
    points.length > 0
      ? points[0]
      : null;

  // ==========================================
  // POSITION À AFFICHER
  // ==========================================

  const displayPosition: [
    number,
    number
  ] = livePosition
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
  // CONVERSION DES POINTS
  // ==========================================

  const routePositions: [
    number,
    number
  ][] = points.map(
    (point) => [
      point.latitude,
      point.longitude,
    ]
  );

  const hasLivePosition =
    !!livePosition;

  return (
    <div className="h-full w-full overflow-hidden rounded-2xl shadow-sm">

      <MapContainer
        center={
          displayPosition
        }
        zoom={13}
        scrollWheelZoom={true}
        className="h-full w-full"
        style={{ background: "#0a0e17" }}
      >

        {/* ==========================================
            FOND DE CARTE - STYLE SOMBRE AVEC ROUTES VISIBLES
            Utilisation de la tuile "voyager" qui a des routes claires
        ========================================== */}

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png"
        />

        {/* Couche supplémentaire pour les routes en plus clair */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png"
          opacity={0.6}
        />

        {/* ==================================
            SUIVI DE LA POSITION
        ================================== */}

        {hasLivePosition && (
          <MapFollower
            position={
              displayPosition
            }
          />
        )}

        {/* ==================================
            TRACÉ DU TRAJET
        ================================== */}

        {routePositions.length >
          1 && (

          <Polyline
            positions={
              routePositions
            }

            color="#2563eb"

            weight={5}

            opacity={0.9}

            lineJoin="round"

            lineCap="round"
          />

        )}

        {/* ==================================
            POINT DE DÉPART
        ================================== */}

        {firstPoint && (
          <Marker
            position={[
              firstPoint.latitude,
              firstPoint.longitude,
            ]}
            icon={
              startIcon
            }
          />
        )}

        {/* ==================================
            POINT D'ARRIVÉE
        ================================== */}

        {lastPoint &&
          points.length > 1 && (

          <Marker
            position={[
              lastPoint.latitude,
              lastPoint.longitude,
            ]}
            icon={
              endIcon
            }
          />

        )}

        {/* ==================================
            POSITION EN DIRECT
        ================================== */}

        {livePosition && (

          <>
            <Marker
              position={[
                livePosition.latitude,
                livePosition.longitude,
              ]}
              icon={
                liveIcon
              }
            />

            {/* CERCLE DE PRÉCISION */}

            <Circle
              center={[
                livePosition.latitude,
                livePosition.longitude,
              ]}
              radius={
                livePosition.accuracy
              }

              pathOptions={{
                color:
                  "#3b82f6",

                fillColor:
                  "#3b82f6",

                fillOpacity:
                  0.1,

                weight: 1,
              }}
            />

          </>

        )}

      </MapContainer>

      {/* LÉGENDE */}

      <div className="flex items-center gap-4 bg-white px-4 py-3 text-xs">

        <div className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-full bg-blue-500" />
          Position GPS
        </div>

        <div className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-full bg-green-500" />
          Départ
        </div>

        <div className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-full bg-red-500" />
          Arrivée
        </div>

        {isRecording && (
          <span className="ml-auto font-semibold text-green-600">
            ● REC
          </span>
        )}

      </div>

    </div>
  );
    }
