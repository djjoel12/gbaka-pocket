"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Icônes créées côté client
const getIcons = () => {
  return {
    startIcon: L.divIcon({
      html: `<div style="background:#22C55E;border-radius:50%;width:16px;height:16px;border:3px solid white;box-shadow:0 0 20px rgba(34,197,94,0.6);"></div>`,
      className: "",
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    }),
    endIcon: L.divIcon({
      html: `<div style="background:#EF4444;border-radius:50%;width:16px;height:16px;border:3px solid white;box-shadow:0 0 20px rgba(239,68,68,0.6);"></div>`,
      className: "",
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    }),
    transferIcon: L.divIcon({
      html: `<div style="background:#F59E0B;border-radius:50%;width:14px;height:14px;border:2px solid white;box-shadow:0 0 15px rgba(245,158,11,0.5);"></div>`,
      className: "",
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    }),
  };
};

type SearchMapProps = {
  startCoords: { lat: number; lng: number; name: string } | null;
  endCoords: { lat: number; lng: number; name: string } | null;
  lineGeometry: any;
  transferPoints: any[];
  mapCenter: [number, number];
};

export default function SearchMap({
  startCoords,
  endCoords,
  lineGeometry,
  transferPoints,
  mapCenter,
}: SearchMapProps) {
  const [isMounted, setIsMounted] = useState(false);
  const icons = getIcons();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return <div className="h-full w-full bg-[#0a0e17] flex items-center justify-center text-white/40">Chargement de la carte...</div>;
  }

  return (
    <MapContainer
      center={mapCenter}
      zoom={14}
      className="h-full w-full"
      style={{ background: "#0a0e17" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {startCoords && (
        <Marker position={[startCoords.lat, startCoords.lng]} icon={icons.startIcon}>
          <Popup>
            <div className="text-sm font-bold text-green-600">🚀 Départ</div>
            <div className="text-xs text-gray-500">{startCoords.name}</div>
          </Popup>
        </Marker>
      )}

      {endCoords && (
        <Marker position={[endCoords.lat, endCoords.lng]} icon={icons.endIcon}>
          <Popup>
            <div className="text-sm font-bold text-red-600">🏁 Arrivée</div>
            <div className="text-xs text-gray-500">{endCoords.name}</div>
          </Popup>
        </Marker>
      )}

      {lineGeometry && (
        <Polyline
          positions={lineGeometry.coordinates.map((c: any) => [c[1], c[0]])}
          color="#3B82F6"
          weight={4}
          opacity={0.9}
        />
      )}

      {transferPoints.map((p, i) => (
        <Marker key={i} position={[p.lat, p.lng]} icon={icons.transferIcon}>
          <Popup>
            <div className="text-sm font-bold text-orange-500">🔄 Correspondance</div>
            <div className="text-xs text-gray-500">{p.name}</div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
              }
