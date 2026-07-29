"use client";

import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  useMap,
  ZoomControl,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useState } from "react";

type GPSPoint = {
  latitude: number;
  longitude: number;
  speed?: number | null;
};

type TransportMapProps = {
  points: GPSPoint[];
};

const defaultPosition: [number, number] = [5.3364, -4.0267];

// Icônes
const defaultIcon = L.icon({
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const startIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const endIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// Icône animée pour la position actuelle
const currentIcon = L.divIcon({
  className: "current-marker",
  html: `<div style="
    width: 20px;
    height: 20px;
    background: #2563EB;
    border: 3px solid white;
    border-radius: 50%;
    box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.4);
    animation: pulse 1.5s ease-in-out infinite;
  "></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

// Style d'animation
const pulseStyle = `
@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.4); }
  70% { box-shadow: 0 0 0 15px rgba(37, 99, 235, 0); }
  100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); }
}
`;

function MapFollower({ position }: { position: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(position, map.getZoom(), { animate: true, duration: 0.5 });
  }, [position, map]);
  return null;
}

// ✅ CORRIGÉ : Composant RecenterButton à l'intérieur du MapContainer
function RecenterButton({ position }: { position: [number, number] }) {
  const map = useMap();
  return (
    <button
      onClick={() => map.setView(position, 15, { animate: true })}
      className="absolute bottom-24 right-4 z-[1000] rounded-lg bg-white p-3 shadow-lg hover:bg-gray-50 transition border border-gray-200"
      title="Recentrer sur ma position"
    >
      <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2z" />
      </svg>
    </button>
  );
}

export default function TransportMap({ points }: TransportMapProps) {
  const lastPoint = points.length > 0 ? points[points.length - 1] : null;
  const currentPosition: [number, number] = lastPoint
    ? [lastPoint.latitude, lastPoint.longitude]
    : defaultPosition;

  const routePositions: [number, number][] = points.map((p) => [p.latitude, p.longitude]);
  const [totalDistance, setTotalDistance] = useState(0);

  // Calcul de la distance totale
  useEffect(() => {
    if (points.length < 2) {
      setTotalDistance(0);
      return;
    }
    let dist = 0;
    for (let i = 1; i < points.length; i++) {
      const R = 6371e3;
      const φ1 = (points[i - 1].latitude * Math.PI) / 180;
      const φ2 = (points[i].latitude * Math.PI) / 180;
      const Δφ = ((points[i].latitude - points[i - 1].latitude) * Math.PI) / 180;
      const Δλ = ((points[i].longitude - points[i - 1].longitude) * Math.PI) / 180;
      const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
      dist += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
    setTotalDistance(dist);
  }, [points]);

  // Dégradé de couleurs
  const getGradientColor = (index: number, total: number) => {
    const hue = 220 - (index / total) * 200; // Bleu → Rouge
    return `hsl(${hue}, 80%, 50%)`;
  };

  return (
    <div className="relative overflow-hidden rounded-2xl shadow-lg">
      <style>{pulseStyle}</style>

      <MapContainer
        center={currentPosition}
        zoom={13}
        zoomControl={false}
        className="h-[450px] w-full"
      >
        {/* Carte stylisée */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; CartoDB'
        />

        <ZoomControl position="topright" />
        <MapFollower position={currentPosition} />

        {/* Tracé avec dégradé */}
        {routePositions.length > 1 &&
          routePositions.map((pos, i) => {
            if (i === 0) return null;
            return (
              <Polyline
                key={i}
                positions={[routePositions[i - 1], pos]}
                pathOptions={{
                  color: getGradientColor(i, routePositions.length),
                  weight: 6,
                  opacity: 0.9,
                  lineJoin: "round",
                  lineCap: "round",
                }}
              />
            );
          })}

        {/* Marqueur départ (vert) */}
        {points.length > 0 && (
          <Marker
            position={[points[0].latitude, points[0].longitude]}
            icon={startIcon}
          />
        )}

        {/* Marqueur arrivée (rouge) */}
        {points.length > 1 && lastPoint && (
          <Marker position={currentPosition} icon={endIcon} />
        )}

        {/* Marqueur position actuelle (bleu animé) */}
        {lastPoint && <Marker position={currentPosition} icon={currentIcon} />}

        {/* ✅ Bouton Recentrer placé à l'intérieur du MapContainer */}
        <RecenterButton position={currentPosition} />
      </MapContainer>

      {/* Overlay info - en dehors du MapContainer */}
      <div className="absolute top-4 left-4 rounded-xl bg-white/95 px-4 py-3 text-sm shadow-lg backdrop-blur-sm border border-gray-200 z-[1000]">
        {lastPoint ? (
          <>
            <div className="font-semibold text-gray-700">
              📍 {lastPoint.latitude.toFixed(5)}, {lastPoint.longitude.toFixed(5)}
            </div>
            {lastPoint.speed && (
              <div className="text-blue-600">
                ⚡ {(lastPoint.speed * 3.6).toFixed(1)} km/h
              </div>
            )}
            <div className="text-green-600 font-bold">
              📏 {(totalDistance / 1000).toFixed(2)} km
            </div>
          </>
        ) : (
          <div className="text-gray-400">En attente de position...</div>
        )}
        <div className="text-xs text-gray-400 mt-1">{points.length} points GPS</div>
      </div>

      {/* Légende - en dehors du MapContainer */}
      <div className="absolute bottom-4 right-4 rounded-xl bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur-sm border border-gray-200 z-[1000]">
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full bg-green-500"></span>
          <span>Départ</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full bg-red-500"></span>
          <span>Arrivée</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-1 w-6"
            style={{ background: "linear-gradient(to right, #2563EB, #EF4444)" }}
          ></span>
          <span>Trajet</span>
        </div>
      </div>
    </div>
  );
}