"use client";

import { useEffect, useRef, useState, Dispatch, SetStateAction } from "react";

type GPSPoint = {
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number | null;
  timestamp: number;
  address?: {
    road?: string;
    suburb?: string;
    city?: string;
    country?: string;
    display_name?: string;
  };
};

type GpsRecorderProps = {
  status?: "idle" | "recording" | "paused";
  setStatus?: Dispatch<SetStateAction<"idle" | "recording" | "paused">>;
  onPointsChange?: (points: GPSPoint[]) => void;
};

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function fetchAddress(lat: number, lon: number) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=16&addressdetails=1`
    );
    const data = await res.json();
    if (data && data.address) {
      const { road, suburb, city, country } = data.address;
      const display_name = data.display_name || "";
      return { road, suburb, city, country, display_name };
    }
    return null;
  } catch (error) {
    console.error("Erreur lors de la récupération de l'adresse :", error);
    return null;
  }
}

export default function GpsRecorder({
  status = "idle",
  setStatus,
  onPointsChange,
}: GpsRecorderProps) {
  const isRecording = status === "recording";

  const [gpsStatus, setGpsStatus] = useState("En attente");
  const [points, setPoints] = useState<GPSPoint[]>([]);
  const [error, setError] = useState("");
  const latestPoint = points[points.length - 1];

  const watchIdRef = useRef<number | null>(null);

  const startRecording = () => {
    setError("");

    if (!navigator.geolocation) {
      setError(
        "La géolocalisation n'est pas disponible sur cet appareil."
      );
      return;
    }

    setPoints([]);
    onPointsChange?.([]);

    setGpsStatus("Recherche de votre position...");

    navigator.geolocation.getCurrentPosition(
      () => {
        setStatus?.("recording");
        setGpsStatus("Enregistrement en cours");

        const watchId = navigator.geolocation.watchPosition(
          (position) => {
            if (position.coords.accuracy > 50) {
              console.log(`Point ignoré - précision: ${position.coords.accuracy}m`);
              return;
            }

            const newPoint: GPSPoint = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              speed: position.coords.speed,
              timestamp: position.timestamp,
            };

            if (newPoint.speed !== null && newPoint.speed > 40) {
              console.log(`Point ignoré - vitesse excessive: ${newPoint.speed} m/s`);
              return;
            }

            setPoints((previousPoints) => {
              const lastPoint = previousPoints[previousPoints.length - 1];

              if (lastPoint) {
                const distance = calculateDistance(
                  lastPoint.latitude,
                  lastPoint.longitude,
                  newPoint.latitude,
                  newPoint.longitude
                );
                if (distance < 10) {
                  console.log(`Point ignoré : déplacement ${distance.toFixed(1)}m`);
                  return previousPoints;
                }
              }

              let updatedPoints = [...previousPoints, newPoint];

              if (updatedPoints.length >= 3) {
                const last3 = updatedPoints.slice(-3);
                const avgLat = last3.reduce((s, p) => s + p.latitude, 0) / 3;
                const avgLng = last3.reduce((s, p) => s + p.longitude, 0) / 3;
                const smoothed = {
                  ...newPoint,
                  latitude: avgLat,
                  longitude: avgLng,
                };
                updatedPoints[updatedPoints.length - 1] = smoothed;
              }

              const lastAdded = updatedPoints[updatedPoints.length - 1];
              if (lastAdded) {
                fetchAddress(lastAdded.latitude, lastAdded.longitude)
                  .then((address) => {
                    if (address) {
                      setPoints((currentPoints) => {
                        const newList = [...currentPoints];
                        const index = newList.length - 1;
                        if (index >= 0 && newList[index] === lastAdded) {
                          newList[index] = { ...lastAdded, address };
                          onPointsChange?.(newList);
                        }
                        return newList;
                      });
                    }
                  })
                  .catch((err) =>
                    console.error("Erreur fetchAddress:", err)
                  );
              }

              onPointsChange?.(updatedPoints);
              return updatedPoints;
            });
          },
          (error) => {
            console.error("Erreur GPS :", error);
            setGpsStatus("Erreur GPS");
            setError("Impossible de récupérer votre position GPS.");
          },
          {
            enableHighAccuracy: true,
            maximumAge: 5000,
            timeout: 10000,
          }
        );

        watchIdRef.current = watchId;
      },
      (error) => {
        console.error("Permission GPS refusée :", error);
        setGpsStatus("GPS indisponible");
        if (error.code === 1) {
          setError("Vous devez autoriser la localisation pour enregistrer un trajet.");
        } else if (error.code === 2) {
          setError("Votre position GPS est actuellement indisponible.");
        } else {
          setError("La récupération de votre position a pris trop de temps.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const stopRecording = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setStatus?.("idle");
    setGpsStatus("Trajet terminé");
  };

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return (
    <div className="max-w-md mx-auto space-y-4 p-4">
      <div className="rounded-2xl bg-gradient-to-br from-white to-gray-50/50 p-5 shadow-lg border border-gray-100/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`h-3 w-3 rounded-full animate-pulse ${
              isRecording ? "bg-green-500" : "bg-orange-500"
            }`} />
            <span className="font-semibold text-gray-700">Statut GPS</span>
          </div>
          <span className={`text-sm font-medium ${
            isRecording ? "text-green-600" : "text-orange-600"
          }`}>
            {gpsStatus}
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl bg-red-50/80 backdrop-blur-sm p-4 text-sm text-red-700 border border-red-200/50 shadow-sm animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {!isRecording ? (
        <button
          onClick={startRecording}
          className="group w-full rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-4 font-bold text-white shadow-lg shadow-blue-600/30 transition-all duration-300 hover:scale-[1.02]"
        >
          <span className="flex items-center justify-center gap-2">
            <span className="text-xl">📍</span>
            Démarrer le trajet
          </span>
        </button>
      ) : (
        <button
          onClick={stopRecording}
          className="group w-full rounded-2xl bg-gradient-to-r from-red-600 to-red-700 px-5 py-4 font-bold text-white shadow-lg shadow-red-600/30 transition-all duration-300 hover:scale-[1.02]"
        >
          <span className="flex items-center justify-center gap-2">
            <span className="text-xl">⏹</span>
            Terminer le trajet
          </span>
        </button>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-gradient-to-br from-white to-gray-50/50 p-4 shadow-lg border border-gray-100/50 transition-all duration-300 hover:shadow-xl">
          <div className="flex items-center gap-2">
            <span className="text-lg">📊</span>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Points GPS</p>
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">{points.length}</p>
          <p className="mt-1 text-xs text-gray-400">{isRecording ? "En cours..." : "Total enregistrés"}</p>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-white to-gray-50/50 p-4 shadow-lg border border-gray-100/50 transition-all duration-300 hover:shadow-xl">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎯</span>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Précision</p>
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {latestPoint ? `${Math.round(latestPoint.accuracy)} m` : "--"}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {latestPoint && latestPoint.accuracy < 50
              ? "✅ Très bonne"
              : latestPoint && latestPoint.accuracy < 100
              ? "👍 Bonne"
              : "📡 En attente"}
          </p>
        </div>
      </div>

      {latestPoint && (
        <div className="rounded-2xl bg-gradient-to-br from-white to-gray-50/50 p-5 shadow-lg border border-gray-100/50 animate-in slide-in-from-bottom-4">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">🛰️</span>
            <h2 className="font-bold text-gray-900">Dernière position GPS</h2>
            {isRecording && (
              <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-green-600">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-ping" />
                En direct
              </span>
            )}
          </div>

          {latestPoint.address && (
            <div className="mb-3 p-3 bg-blue-50 rounded-xl text-sm">
              <p className="font-semibold text-blue-800">
                {latestPoint.address.display_name ||
                  `${latestPoint.address.road || ""}, ${latestPoint.address.suburb || ""}, ${latestPoint.address.city || ""}`}
              </p>
              <p className="text-xs text-gray-500">
                {latestPoint.address.country || ""}
              </p>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between p-2 rounded-xl bg-gray-50/50">
              <span className="text-sm text-gray-500 flex items-center gap-1">
                <span>🌐</span> Latitude
              </span>
              <span className="font-mono text-sm font-semibold text-gray-900">
                {latestPoint.latitude.toFixed(6)}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-gray-50/50">
              <span className="text-sm text-gray-500 flex items-center gap-1">
                <span>🌐</span> Longitude
              </span>
              <span className="font-mono text-sm font-semibold text-gray-900">
                {latestPoint.longitude.toFixed(6)}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-gray-50/50">
              <span className="text-sm text-gray-500 flex items-center gap-1">
                <span>🎯</span> Précision
              </span>
              <span className={`font-semibold text-sm ${
                latestPoint.accuracy < 50
                  ? "text-green-600"
                  : latestPoint.accuracy < 100
                  ? "text-yellow-600"
                  : "text-red-600"
              }`}>
                {Math.round(latestPoint.accuracy)} mètres
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-gray-50/50">
              <span className="text-sm text-gray-500 flex items-center gap-1">
                <span>⚡</span> Vitesse
              </span>
              <span className="font-semibold text-sm text-gray-900">
                {latestPoint.speed !== null
                  ? `${(latestPoint.speed * 3.6).toFixed(1)} km/h`
                  : "⏸️ À l'arrêt"}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-gray-50/50">
              <span className="text-sm text-gray-500 flex items-center gap-1">
                <span>🕐</span> Dernière mise à jour
              </span>
              <span className="font-mono text-sm font-semibold text-gray-900">
                {new Date(latestPoint.timestamp).toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
              }
