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
  livePosition?: GPSPoint | null; // ✅ Position en direct
};

const defaultPosition: [number, number] = [5.3364, -4.0267];

// Icônes
const startIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  iconRetinaUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const endIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  iconRetinaUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// ✅ Icône spéciale pour la position en direct (plus grosse, avec pulsation)
const liveIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  iconRetinaUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [35, 57], // Plus grand
  iconAnchor: [17, 57],
});

// ✅ Icône pour le point de départ de l'enregistrement (vert)
const recordingStartIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  iconRetinaUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// Suivi automatique de la carte
function MapFollower({ position }: { position: [number, number] }) {
  const map = useMap();
  const isFirstRender = useRef(true);
  
  useEffect(() => {
    if (position) {
      // Animation plus fluide
      map.setView(position, map.getZoom(), { 
        animate: true,
        duration: isFirstRender.current ? 0 : 0.5,
      });
      isFirstRender.current = false;
    }
  }, [position, map]);
  return null;
}

// Points intermédiaires
function IntermediatePoints({ points }: { points: GPSPoint[] }) {
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

export default function TransportMap({ points, livePosition }: TransportMapProps) {
  const lastPoint = points.length > 0 ? points[points.length - 1] : null;
  const firstPoint = points.length > 0 ? points[0] : null;

  // ✅ Position à afficher : soit la position en direct, soit le dernier point enregistré
  const displayPosition: [number, number] = livePosition
    ? [livePosition.latitude, livePosition.longitude]
    : lastPoint
    ? [lastPoint.latitude, lastPoint.longitude]
    : defaultPosition;

  const routePositions: [number, number][] = points.map((p) => [
    p.latitude,
    p.longitude,
  ]);

  const hasValidPoints = points.length > 0;
  const hasLivePosition = livePosition !== null;

  return (
    <div className="overflow-hidden rounded-2xl shadow-sm">
      <MapContainer
        center={displayPosition}
        zoom={hasValidPoints || hasLivePosition ? 16 : 13}
        scrollWheelZoom={true}
        className="h-[400px] w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* ✅ Suivi automatique sur la position en direct ou le dernier point */}
        {(hasLivePosition || hasValidPoints) && (
          <MapFollower position={displayPosition} />
        )}

        {/* Tracé du trajet enregistré */}
        {routePositions.length > 1 && (
          <>
            <Polyline
              positions={routePositions}
              color="white"
              weight={8}
              opacity={0.7}
              lineJoin="round"
            />
            <Polyline
              positions={routePositions}
              color="#3b82f6"
              weight={4}
              opacity={0.9}
              lineJoin="round"
            />
          </>
        )}

        {/* Points intermédiaires */}
        {routePositions.length > 2 && <IntermediatePoints points={points} />}

        {/* Marqueur de départ de l'enregistrement */}
        {firstPoint && routePositions.length > 1 && (
          <Marker
            key={`start-${firstPoint.timestamp}`}
            position={[firstPoint.latitude, firstPoint.longitude]}
            icon={recordingStartIcon}
          />
        )}

        {/* Marqueur d'arrivée de l'enregistrement */}
        {lastPoint && routePositions.length > 1 && (
          <Marker
            key={`end-${lastPoint.timestamp}`}
            position={[lastPoint.latitude, lastPoint.longitude]}
            icon={endIcon}
          />
        )}

        {/* ✅ Position en direct (toujours affichée) */}
        {livePosition && (
          <Marker
            key="live-position"
            position={[livePosition.latitude, livePosition.longitude]}
            icon={liveIcon}
          >
            {/* ✅ Cercle de précision autour de la position */}
            <CircleMarker
              center={[livePosition.latitude, livePosition.longitude]}
              radius={livePosition.accuracy / 10}
              fillColor="#3b82f6"
              color="#60a5fa"
              weight={1}
              opacity={0.3}
              fillOpacity={0.15}
            />
          </Marker>
        )}

        {/* ✅ Si pas de position en direct mais des points enregistrés */}
        {!livePosition && lastPoint && (
          <Marker
            key={`last-${lastPoint.timestamp}`}
            position={[lastPoint.latitude, lastPoint.longitude]}
            icon={liveIcon}
          />
        )}
      </MapContainer>
    </div>
  );
            }
