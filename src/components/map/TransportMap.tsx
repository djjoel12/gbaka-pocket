"use client";

import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Circle,
  useMap,
  useMapEvents,
  Popup,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";
import L from "leaflet";

import { useEffect, useRef, useState } from "react";
import { StopPoint, GPSPoint } from "@/types/trip";

type TransportMapProps = {
  points: GPSPoint[];
  livePosition?: GPSPoint | null;
  isRecording?: boolean;
  onMapReady?: (map: any) => void;
  stops?: StopPoint[];
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
const liveIcon = createIcon("#2563EB", "", true);
const stopIcon = createIcon("#F59E0B", "📍", false);
const manualStopIcon = createIcon("#8B5CF6", "📍", false);

// ============================================
// CALCUL DU CAP (BEARING)
// ============================================
function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number | null {
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  
  const x = Math.sin(dLon) * Math.cos(lat2Rad);
  const y = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  
  const bearing = (Math.atan2(x, y) * 180 / Math.PI + 360) % 360;
  return bearing;
}

// ============================================
// COMPOSANT DE SUIVI FLUIDE
// ============================================

function MapFollower({ 
  position, 
  isFollowing, 
  onDragStart
}: { 
  position: [number, number];
  isFollowing: boolean;
  onDragStart?: () => void;
}) {
  const map = useMap();
  const [lastPosition, setLastPosition] = useState<[number, number] | null>(null);
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const animationRef = useRef<any>(null);

  // ============================================
  // DÉTECTION DES INTERACTIONS UTILISATEUR (SOURIS)
  // ============================================
  useMapEvents({
    dragstart() {
      setIsUserInteracting(true);
      if (onDragStart) onDragStart();
    },
    dragend() {
      setIsUserInteracting(false);
    },
    mousedown() {
      setIsUserInteracting(true);
      if (onDragStart) onDragStart();
    },
    mouseup() {
      setIsUserInteracting(false);
    },
  });

  // ============================================
  // DÉTECTION DES INTERACTIONS UTILISATEUR (TACTILE)
  // ============================================
  useEffect(() => {
    const mapInstance = map;
    if (!mapInstance) return;

    const container = mapInstance.getContainer();

    const handleTouchStart = () => {
      setIsUserInteracting(true);
      if (onDragStart) onDragStart();
    };

    const handleTouchEnd = () => {
      setIsUserInteracting(false);
    };

    container.addEventListener('touchstart', handleTouchStart);
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [map, onDragStart]);

  // ============================================
  // SUIVI FLUIDE
  // ============================================
  useEffect(() => {
    if (!isFollowing || isUserInteracting) return;

    if (lastPosition && position) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }

      map.flyTo(position, 17, {
        animate: true,
        duration: 1.2,
      });
    } else if (position && !lastPosition) {
      map.flyTo(position, 17, {
        animate: true,
        duration: 1.5,
      });
    }

    setLastPosition(position);
  }, [position, map, isFollowing, isUserInteracting]);

  return null;
}

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

export default function TransportMap({
  points,
  livePosition,
  isRecording = false,
  onMapReady,
  stops = [],
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
  const [isFollowing, setIsFollowing] = useState(false);
  const [isUserInteracting, setIsUserInteracting] = useState(false);

  // ============================================
  // EXPOSER LES FONCTIONS AU PARENT
  // ============================================
  useEffect(() => {
    if (mapRef.current && onMapReady) {
      onMapReady({
        ...mapRef.current,
        recenter: handleRecenter,
        toggleFollow: () => setIsFollowing(prev => !prev),
        isFollowing: () => isFollowing,
      });
    }
  }, [onMapReady, isFollowing]);

  // ============================================
  // GESTION DU SUIVI
  // ============================================
  const handleUserInteraction = () => {
    setIsUserInteracting(true);
    setIsFollowing(false);
  };

  const handleRecenter = () => {
    if (livePosition) {
      setIsFollowing(true);
      setIsUserInteracting(false);
      
      const map = mapRef.current;
      if (map) {
        map.flyTo(
          [livePosition.latitude, livePosition.longitude],
          17,
          { animate: true, duration: 1.5 }
        );
      }
    }
  };

  // ============================================
  // RENDU
  // ============================================
  return (
    <div className="relative isolate h-full w-full overflow-hidden">
      <MapContainer
        center={displayPosition}
        zoom={15}
        scrollWheelZoom={true}
        className="relative z-0 h-full w-full"
        style={{ background: "#e8ecf1" }}
        ref={mapRef}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png?label_color=ffffff"
        />

        {/* ===== SUIVI FLUIDE ===== */}
        {livePosition && isRecording && (
          <MapFollower
            position={[livePosition.latitude, livePosition.longitude]}
            isFollowing={isFollowing && !isUserInteracting}
            onDragStart={handleUserInteraction}
          />
        )}

        {/* ===== TRACÉ GPS ===== */}
        {routePositions.length > 1 && (
          <>
            <Polyline positions={routePositions} color="#2563EB" weight={20} opacity={0.12} lineJoin="round" lineCap="round" />
            <Polyline positions={routePositions} color="#2563EB" weight={10} opacity={0.2} lineJoin="round" lineCap="round" />
            <Polyline positions={routePositions} color="#2563EB" weight={5} opacity={0.85} lineJoin="round" lineCap="round" />
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

        {/* ===== ARRÊTS SUR LA CARTE ===== */}
        {stops.map((stop, index) => {
          if (stop.isStart || stop.isEnd) return null;
          const isManual = stop.isManual || false;
          return (
            <Marker
              key={stop.id || index}
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

        {/* ===== POSITION GPS EN DIRECT ===== */}
        {livePosition && (
          <>
            <Marker position={[livePosition.latitude, livePosition.longitude]} icon={liveIcon} />
            <Circle
              center={[livePosition.latitude, livePosition.longitude]}
              radius={livePosition.accuracy}
              pathOptions={{
                color: "#2563EB",
                fillColor: "#2563EB",
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
