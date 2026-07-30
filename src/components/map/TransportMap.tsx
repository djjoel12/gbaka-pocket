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

const currentIcon = L.divIcon({
  className: "custom-marker current",
  html: `<div style="background-color:#3b82f6; width:18px; height:18px; border-radius:50%; border:3px solid white; box-shadow:0 0 0 6px rgba(59,130,246,0.4); animation: pulse 1.5s infinite;"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const startIcon = L.divIcon({
  className: "custom-marker",
  html: `<div style="background-color:#22c55e; width:22px; height:22px; border-radius:50%; border:3px solid white; box-shadow:0 0 0 6px rgba(34,197,94,0.3);"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const endIcon = L.divIcon({
  className: "custom-marker",
  html: `<div style="background-color:#ef4444; width:22px; height:22px; border-radius:50%; border:3px solid white; box-shadow:0 0 0 6px rgba(239,68,68,0.3);"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const pointIcon = L.divIcon({
  className: "custom-marker",
  html: `<div style="background-color:#60a5fa; width:8px; height:8px; border-radius:50%; border:2px solid rgba(255,255,255,0.8); box-shadow:0 0 0 4px rgba(96,165,250,0.2);"></div>`,
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
    50% { transform: scale(1.6); opacity: 0.6; }
    100% { transform: scale(1); opacity: 1; }
  }
  .current div {
    animation: pulse 1.5s infinite;
  }
`;

export default function TransportMap({ points, status }: TransportMapProps) {
  const [livePosition, setLivePosition] = useState<[number, number] | null>(null);
  const [watchId, setWatchId] = useState<number | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;

    const id = navigator.geolocation.watchPosition(
      (position) => {
        setLivePosition([position.coords.latitude, position.coords.longitude]);
      },
      () => setLivePosition(null),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    setWatchId(id);
    return () => { if (watchId !== null) navigator.geolocation.clearWatch(watchId); };
  }, []);

  const lastPoint = points.length > 0 ? points[points.length - 1] : null;
  const firstPoint = points.length > 0 ? points[0] : null;

  const currentPosition: [number, number] = livePosition || (lastPoint ? [lastPoint.latitude, lastPoint.longitude] : defaultPosition);

  const routePositions: [number, number][] = points.map((p) => [p.latitude, p.longitude]);
  const middlePoints = points.slice(1, -1);

  const showStart = status === "recording" || status === "paused";
  const showEnd = status === "idle" && points.length > 0;

  return (
    <div className="relative w-full h-[60vh]">
      <style>{pulseStyle}</style>

      <MapContainer
        center={currentPosition}
        zoom={14}
        scrollWheelZoom={true}
        className="h-full w-full"
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" class="text-white/50">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapFollower position={currentPosition} />

        {routePositions.length > 1 && (
          <>
            <Polyline
              positions={routePositions}
              pathOptions={{
                color: "rgba(255,255,255,0.3)",
                weight: 16,
                opacity: 0.4,
                lineJoin: "round",
                lineCap: "round",
              }}
            />
            <Polyline
              positions={routePositions}
              pathOptions={{
                color: "#3b82f6",
                weight: 5,
                opacity: 0.9,
                lineJoin: "round",
                lineCap: "round",
              }}
            />
            <Polyline
              positions={routePositions}
              pathOptions={{
                color: "#60a5fa",
                weight: 2,
                opacity: 0.3,
                lineJoin: "round",
                lineCap: "round",
              }}
            />
          </>
        )}

        {showStart && firstPoint && (
          <Marker position={[firstPoint.latitude, firstPoint.longitude]} icon={startIcon} />
        )}

        {showEnd && lastPoint && (
          <Marker position={[lastPoint.latitude, lastPoint.longitude]} icon={endIcon} />
        )}

        {livePosition && (
          <Marker position={currentPosition} icon={currentIcon} />
        )}

        {middlePoints.map((point, index) => (
          <Marker key={`point-${index}`} position={[point.latitude, point.longitude]} icon={pointIcon} />
        ))}
      </MapContainer>

      <div className="absolute bottom-3 right-3 pointer-events-none">
        <div className="bg-black/50 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10">
          <span className="text-[10px] font-mono text-white/60">{points.length} pts</span>
        </div>
      </div>
    </div>
  );
               }
