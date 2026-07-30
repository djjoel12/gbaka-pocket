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

type GPSPoint = {
  latitude: number;
  longitude: number;
};

type TransportMapProps = {
  points: GPSPoint[];
};

const defaultPosition: [number, number] = [
  5.3364,
  -4.0267,
];

const defaultIcon = L.icon({
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",

  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",

  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",

  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function MapFollower({
  position,
}: {
  position: [number, number];
}) {
  const map = useMap();

  map.setView(position, map.getZoom(), {
    animate: true,
  });

  return null;
}

export default function TransportMap({
  points,
}: TransportMapProps) {
  const lastPoint =
    points.length > 0
      ? points[points.length - 1]
      : null;

  const currentPosition: [number, number] =
    lastPoint
      ? [
          lastPoint.latitude,
          lastPoint.longitude,
        ]
      : defaultPosition;

  const routePositions: [number, number][] =
    points.map((point) => [
      point.latitude,
      point.longitude,
    ]);

  return (
    <div className="overflow-hidden rounded-2xl shadow-sm">
      <MapContainer
        center={currentPosition}
        zoom={13}
        scrollWheelZoom={true}
        className="h-[400px] w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapFollower position={currentPosition} />

        {lastPoint && (
          <Marker
            position={currentPosition}
            icon={defaultIcon}
          />
        )}

        {/* ---------- POLYLINE AMÉLIORÉE ---------- */}
        {routePositions.length > 1 && (
          <>
            {/* Ombre blanche pour contraste */}
            <Polyline
              positions={routePositions}
              pathOptions={{
                color: "white",
                weight: 10,
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
      </MapContainer>
    </div>
  );
}
