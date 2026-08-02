"use client";

import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  CircleMarker,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useState } from "react";

type GPSPoint = {
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number | null;
  timestamp: number;
};

type TransportMapProps = {
  points: GPSPoint[];
};

const defaultPosition: [number, number] = [5.3364, -4.0267];

// Icône personnalisée pour le marqueur de départ (vert)
const startIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  iconRetinaUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// Icône personnalisée pour le marqueur d'arrivée (rouge)
const endIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  iconRetinaUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// Icône personnalisée pour le marqueur de position en direct (bleu animé)
const liveIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  iconRetinaUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// Composant pour suivre la carte
function MapFollower({ position }: { position: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.setView(position, map.getZoom(), { animate: true });
    }
  }, [position, map]);
  return null;
}

// Composant pour les points intermédiaires (fonctionnalité 13)
function IntermediatePoints({ points }: { points: GPSPoint[] }) {
  // On exclut le premier et le dernier point
  const intermediate = points.slice(1, -1);
  return (
    <>
      {intermediate.map((point, index) => (
        <CircleMarker
          key={`intermediate-${index}-${point.timestamp}`}
          center={[point.latitude, point.longitude]}
          radius={4}
          fillColor="#3b82f6"
          color="#2563eb"
          weight={1}
          opacity={0.8}
          fillOpacity={0.8}
        />
      ))}
    </>
  );
}

export default function TransportMap({ points }: TransportMapProps) {
  // ✅ Debug
  console.log('🗺️ TransportMap - Points reçus:', points.length);

  const lastPoint = points.length > 0 ? points[points.length - 1] : null;
  const firstPoint = points.length > 0 ? points[0] : null;

  const currentPosition: [number, number] = lastPoint
    ? [lastPoint.latitude, lastPoint.longitude]
    : defaultPosition;

  const routePositions: [number, number][] = points.map((p) => [
    p.latitude,
    p.longitude,
  ]);

  // ✅ Vérification si la carte doit être affichée
  const hasValidPoints = points.length > 0;

  return (
    <div className="overflow-hidden rounded-2xl shadow-sm">
      <MapContainer
        center={currentPosition}
        zoom={hasValidPoints ? 15 : 13}
        scrollWheelZoom={true}
        className="h-[400px] w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Suivi automatique de la carte (fonctionnalité 19) */}
        {hasValidPoints && <MapFollower position={currentPosition} />}

        {/* Double tracé (fonctionnalité 9) - trait blanc en dessous, bleu au-dessus */}
        {routePositions.length > 1 && (
          <>
            {/* Trait blanc (effet de contour) */}
            <Polyline
              positions={routePositions}
              color="white"
              weight={8}
              opacity={0.7}
              lineJoin="round"
            />
            {/* Trait bleu (principal) */}
            <Polyline
              positions={routePositions}
              color="#3b82f6"
              weight={4}
              opacity={0.9}
              lineJoin="round"
            />
          </>
        )}

        {/* Points intermédiaires (fonctionnalité 13) */}
        {routePositions.length > 2 && <IntermediatePoints points={points} />}

        {/* Marqueur de départ (fonctionnalité 10) */}
        {firstPoint && routePositions.length > 1 && (
          <Marker
            key={`start-${firstPoint.timestamp}`}
            position={[firstPoint.latitude, firstPoint.longitude]}
            icon={startIcon}
          />
        )}

        {/* Marqueur d'arrivée (fonctionnalité 11) */}
        {lastPoint && routePositions.length > 1 && (
          <Marker
            key={`end-${lastPoint.timestamp}`}
            position={[lastPoint.latitude, lastPoint.longitude]}
            icon={endIcon}
          />
        )}

        {/* Marqueur de position en direct (fonctionnalité 12) */}
        {lastPoint && (
          <Marker
            key={`live-${lastPoint.timestamp}`}
            position={currentPosition}
            icon={liveIcon}
          />
        )}
      </MapContainer>
    </div>
  );
}
