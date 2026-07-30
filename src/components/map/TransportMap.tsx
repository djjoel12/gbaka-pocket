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
  status: "idle" | "recording" | "paused";
};

const defaultPosition: [number, number] = [5.3364, -4.0267];

// ---- Marqueur de position actuelle (BLEU animé) ----
const currentIcon = L.divIcon({
  className: "custom-marker current",
  html: `<div style="background-color:#2563eb; width:18px; height:18px; border-radius:50%; border:3px solid white; box-shadow:0 0 0 6px rgba(37,99,235,0.3); animation: pulse 1.5s infinite;"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

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

export default function TransportMap({ points, status }: TransportMapProps) {
  // ---- POSITION EN DIRECT DU GPS (même sans enregistrement) ----
  const [livePosition, setLivePosition] = useState<[number, number] | null>(null);
  const [watchId, setWatchId] = useState<number | null>(null);

  // ---- SUIVI GPS EN CONTINU (dès l'ouverture de l'app) ----
  useEffect(() => {
    if (!navigator.geolocation) return;

    const id = navigator.geolocation.watchPosition(
      (position) => {
        setLivePosition([position.coords.latitude, position.coords.longitude]);
      },
      (error) => {
        console.error("Erreur GPS en direct :", error);
        setLivePosition(null);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      }
    );

    setWatchId(id);

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);

  const lastPoint = points.length > 0 ? points[points.length - 1] : null;
  const firstPoint = points.length > 0 ? points[0] : null;

  // ---- Position affichée : live GPS si disponible, sinon dernier point enregistré, sinon position par défaut ----
  const currentPosition: [number, number] = livePosition || (lastPoint ? [lastPoint.latitude, lastPoint.longitude] : defaultPosition);

  const routePositions: [number, number][] = points.map((p) => [
    p.latitude,
    p.longitude,
  ]);

  const middlePoints = points.slice(1, -1);

  const showStart = status === "recording" || status === "paused";
  const showEnd = status === "idle" && points.length > 0;

  return (
    <div className="overflow-hidden rounded-2xl shadow-lg border border-gray-200">
      <style>{pulseStyle}</style>

      <MapContainer
        center={currentPosition}
        zoom={14}
        scrollWheelZoom={true}
        className="h-[500px] w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapFollower position={currentPosition} />

        {/* POLYLINE */}
        {routePositions.length > 1 && (
          <>
            <Polyline
              positions={routePositions}
              pathOptions={{
                color: "white",
                weight: 12,
                opacity: 0.6,
                lineJoin: "round",
              }}
            />
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

        {/* ---- MARQUEUR VERT (départ) - visible pendant l'enregistrement ---- */}
        {showStart && firstPoint && (
          <Marker
            position={[firstPoint.latitude, firstPoint.longitude]}
            icon={startIcon}
          />
        )}

        {/* ---- MARQUEUR ROUGE (arrivée) - visible après "Terminer" ---- */}
        {showEnd && lastPoint && (
          <Marker
            position={[lastPoint.latitude, lastPoint.longitude]}
            icon={endIcon}
          />
        )}

        {/* ---- MARQUEUR BLEU (position actuelle) - TOUJOURS VISIBLE si GPS allumé ---- */}
        {livePosition && (
          <Marker position={currentPosition} icon={currentIcon} />
        )}

        {/* ---- POINTS INTERMÉDIAIRES ---- */}
        {middlePoints.map((point, index) => (
          <Marker
            key={`point-${index}`}
            position={[point.latitude, point.longitude]}
            icon={pointIcon}
          />
        ))}
      </MapContainer>
    </div>
  );
        }
