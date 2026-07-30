"use client";

import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";

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

// ---- Marqueur de départ (VERT) ----
const startIcon = L.divIcon({
  className: "custom-marker",
  html: `<div style="background-color:#22c55e; width:20px; height:20px; border-radius:50%; border:3px solid white; box-shadow:0 0 0 4px rgba(34,197,94,0.4);"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

// ---- Marqueur d'arrivée (ROUGE) ----
const endIcon = L.divIcon({
  className: "custom-marker",
  html: `<div style="background-color:#ef4444; width:20px; height:20px; border-radius:50%; border:3px solid white; box-shadow:0 0 0 4px rgba(239,68,68,0.4);"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

// ---- Marqueur actuel (avec animation) ----
const currentIcon = L.divIcon({
  className: "custom-marker current",
  html: `<div style="background-color:#2563eb; width:18px; height:18px; border-radius:50%; border:3px solid white; box-shadow:0 0 0 6px rgba(37,99,235,0.3); animation: pulse 1.5s infinite;"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

// ---- Points intermédiaires (petits ronds bleus) ----
const pointIcon = L.divIcon({
  className: "custom-marker",
  html: `<div style="background-color:#3b82f6; width:8px; height:8px; border-radius:50%; border:2px solid white; box-shadow:0 0 0 2px rgba(59,130,246,0.3);"></div>`,
  iconSize: [8, 8],
  iconAnchor: [4, 4],
});

function MapFollower({ position }: { position: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(position, map.getZoom(), { animate: true });
  }, [position, map]);
  return null;
}

// ---- Injecter les animations CSS pour le point actuel ----
const pulseStyle = `
  @keyframes pulse {
    0% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.5); opacity: 0.7; }
    100% { transform: scale(1); opacity: 1; }
  }
  .current div {
    animation: pulse 1.5s infinite;
  }
`;

export default function TransportMap({ points }: TransportMapProps) {
  const lastPoint = points.length > 0 ? points[points.length - 1] : null;
  const firstPoint = points.length > 0 ? points[0] : null;

  const currentPosition: [number, number] = lastPoint
    ? [lastPoint.latitude, lastPoint.longitude]
    : defaultPosition;

  const routePositions: [number, number][] = points.map((p) => [
    p.latitude,
    p.longitude,
  ]);

  // Points intermédiaires (tous sauf le premier et le dernier)
  const middlePoints = points.slice(1, -1);

  return (
    <div className="overflow-hidden rounded-2xl shadow-lg border border-gray-200">
      {/* Injection du style CSS pour l'animation */}
      <style>{pulseStyle}</style>

      <MapContainer
        center={currentPosition}
        zoom={14}
        scrollWheelZoom={true}
        className="h-[500px] w-full"
      >
        {/* Fond de carte OpenStreetMap avec style amélioré */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapFollower position={currentPosition} />

        {/* ---- POLYLINE AVEC DOUBLE CONTOUR ---- */}
        {routePositions.length > 1 && (
          <>
            {/* Ombre blanche */}
            <Polyline
              positions={routePositions}
              pathOptions={{
                color: "white",
                weight: 12,
                opacity: 0.6,
                lineJoin: "round",
              }}
            />
            {/* Ligne principale bleue */}
            <Polyline
              positions={routePositions}
              pathOptions={{
                color: "#2563eb",
                weight: 5,
                opacity: 1,
                lineJoin: "round",
              }}
            />
          </>
        )}

        {/* ---- POINTS INTERMÉDIAIRES (petits ronds) ---- */}
        {middlePoints.map((point, index) => (
          <Marker
            key={`point-${index}`}
            position={[point.latitude, point.longitude]}
            icon={pointIcon}
          />
        ))}

        {/* ---- MARQUEUR DE DÉPART (VERT) ---- */}
        {firstPoint && (
          <Marker
            position={[firstPoint.latitude, firstPoint.longitude]}
            icon={startIcon}
          />
        )}

        {/* ---- MARQUEUR D'ARRIVÉE (ROUGE) ---- */}
        {lastPoint && points.length > 1 && (
          <Marker
            position={[lastPoint.latitude, lastPoint.longitude]}
            icon={endIcon}
          />
        )}

        {/* ---- MARQUEUR ACTUEL (BLEU ANIMÉ) ---- */}
        {lastPoint && points.length === 1 && (
          <Marker position={currentPosition} icon={currentIcon} />
        )}
      </MapContainer>
    </div>
  );
                }
