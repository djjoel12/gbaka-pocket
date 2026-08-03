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

const defaultPosition: [number, number] = [5.3364, -4.0267];

// ============================================
// CRÉATION D'ICÔNES PERSONNALISÉES
// ============================================

function createIcon(
  color: string,
  label: string = "",
  isPulsing: boolean = false
) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
      ${isPulsing ? `
        <!-- Anneau de pulsation -->
        <circle cx="20" cy="20" r="16" fill="none" stroke="${color}" stroke-width="2" opacity="0.4">
          <animate attributeName="r" from="12" to="20" dur="1.5s" repeatCount="indefinite"/>
          <animate attributeName="opacity" from="0.6" to="0" dur="1.5s" repeatCount="indefinite"/>
        </circle>
        <!-- Deuxième anneau -->
        <circle cx="20" cy="20" r="14" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.3">
          <animate attributeName="r" from="10" to="18" dur="1.5s" begin="0.5s" repeatCount="indefinite"/>
          <animate attributeName="opacity" from="0.5" to="0" dur="1.5s" begin="0.5s" repeatCount="indefinite"/>
        </circle>
      ` : ''}
      <!-- Cercle principal -->
      <circle cx="20" cy="20" r="${isPulsing ? '10' : '14'}" fill="${color}" stroke="white" stroke-width="2.5"/>
      ${label ? `
        <!-- Texte à l'intérieur -->
        <text x="20" y="${isPulsing ? '25' : '24'}" text-anchor="middle" fill="white" font-size="16" font-weight="bold" font-family="Arial">${label}</text>
      ` : ''}
      ${isPulsing ? `
        <!-- Point central -->
        <circle cx="20" cy="20" r="4" fill="white"/>
        <!-- Petit cercle bleu au centre -->
        <circle cx="20" cy="20" r="2.5" fill="${color}"/>
      ` : ''}
    </svg>
  `;

  return L.divIcon({
    html: svg,
    className: isPulsing ? 'pulsing-marker' : 'custom-marker',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

// ============================================
// ICÔNE DÉPART - VERT AVEC DRAPEAU
// ============================================

const startIcon = createIcon('#22c55e', '🏁');

// ============================================
// ICÔNE ARRIVÉE - ROUGE AVEC DRAPEAU
// ============================================

const endIcon = createIcon('#ef4444', '🏁');

// ============================================
// ICÔNE GPS - BLEU PULSANT
// ============================================

const liveIcon = createIcon('#3b82f6', '', true);

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
  const lastPoint = points.length > 0 ? points[points.length - 1] : null;
  const firstPoint = points.length > 0 ? points[0] : null;

  // ==========================================
  // POSITION À AFFICHER
  // ==========================================

  const displayPosition: [number, number] = livePosition
    ? [livePosition.latitude, livePosition.longitude]
    : lastPoint
    ? [lastPoint.latitude, lastPoint.longitude]
    : defaultPosition;

  // ==========================================
  // CONVERSION DES POINTS
  // ==========================================

  const routePositions: [number, number][] = points.map((point) => [
    point.latitude,
    point.longitude,
  ]);

  const hasLivePosition = !!livePosition;

  return (
    <div className="h-full w-full overflow-hidden rounded-2xl shadow-sm">
      <MapContainer
        center={displayPosition}
        zoom={13}
        scrollWheelZoom={true}
        className="h-full w-full"
        style={{ background: "#0a0e17" }}
      >
        {/* ==========================================
            FOND DE CARTE - STYLE SOMBRE AVEC ROUTES VISIBLES
        ========================================== */}

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png"
        />

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png"
          opacity={0.6}
        />

        {/* ==================================
            SUIVI DE LA POSITION
        ================================== */}

        {hasLivePosition && <MapFollower position={displayPosition} />}

        {/* ==================================
            TRACÉ DU TRAJET
        ================================== */}

        {routePositions.length > 1 && (
          <>
            {/* Ombre du trajet (effet glow) */}
            <Polyline
              positions={routePositions}
              color="#60a5fa"
              weight={12}
              opacity={0.15}
              lineJoin="round"
              lineCap="round"
            />

            {/* Trajet principal */}
            <Polyline
              positions={routePositions}
              color="#2563eb"
              weight={5}
              opacity={0.9}
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

            {/* CERCLE DE PRÉCISION */}
            <Circle
              center={[livePosition.latitude, livePosition.longitude]}
              radius={livePosition.accuracy}
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

      {/* ==========================================
          LÉGENDE
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
    </div>
  );
}
