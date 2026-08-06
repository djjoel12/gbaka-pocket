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
  onMapReady?: (map: any) => void;
};

const defaultPosition: [number, number] = [5.3364, -4.0267];

// ============================================
// ICÔNES
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
const liveIcon = createIcon("#ffffff", "", true);

// ============================================
// SUIVI CARTE AVEC fitBounds
// ============================================

function MapFollower({ 
  position, 
  points, 
  livePosition 
}: { 
  position: [number, number];
  points: GPSPoint[];
  livePosition?: GPSPoint | null;
}) {
  const map = useMap();
  const firstRender = useRef(true);

  useEffect(() => {
    // Récupérer tous les points à inclure dans la vue
    const allPoints: [number, number][] = [];
    
    // Ajouter le point GPS en direct
    if (livePosition) {
      allPoints.push([livePosition.latitude, livePosition.longitude]);
    }
    
    // Ajouter tous les points du tracé
    points.forEach(p => {
      allPoints.push([p.latitude, p.longitude]);
    });
    
    // Si on a des points, ajuster la vue pour tout montrer
    if (allPoints.length > 0) {
      const bounds = L.latLngBounds(allPoints);
      
      // Ajouter un padding pour que les marqueurs ne soient pas coupés
      map.fitBounds(bounds, {
        padding: [60, 60],
        maxZoom: 16,
        duration: 0.5
      });
      
      firstRender.current = false;
    } else {
      // Fallback si pas de points
      if (firstRender.current) {
        map.setView(position, 15);
        firstRender.current = false;
      }
    }
  }, [position, points, livePosition, map]);

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
  const hasLivePosition = !!livePosition;

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

        {hasLivePosition && (
          <MapFollower 
            position={displayPosition} 
            points={points}
            livePosition={livePosition}
          />
        )}

        {/* TRACÉ */}
        {routePositions.length > 1 && (
          <>
            <Polyline positions={routePositions} color="#ffffff" weight={20} opacity={0.08} lineJoin="round" lineCap="round" />
            <Polyline positions={routePositions} color="#ffffff" weight={10} opacity={0.15} lineJoin="round" lineCap="round" />
            <Polyline positions={routePositions} color="#ffffff" weight={5} opacity={0.7} lineJoin="round" lineCap="round" />
            <Polyline positions={routePositions} color="#ffffff" weight={2} opacity={0.4} lineJoin="round" lineCap="round" dashArray="10 14" />
          </>
        )}

        {firstPoint && <Marker position={[firstPoint.latitude, firstPoint.longitude]} icon={startIcon} />}
        {lastPoint && points.length > 1 && <Marker position={[lastPoint.latitude, lastPoint.longitude]} icon={endIcon} />}

        {livePosition && (
          <>
            <Marker position={[livePosition.latitude, livePosition.longitude]} icon={liveIcon} />
            <Circle
              center={[livePosition.latitude, livePosition.longitude]}
              radius={livePosition.accuracy}
              pathOptions={{ color: "#ffffff", fillColor: "#ffffff", fillOpacity: 0.05, weight: 1 }}
            />
          </>
        )}
      </MapContainer>
    </div>
  );
  }
