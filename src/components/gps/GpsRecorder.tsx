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
    <div className="space-y-3">
      {/* Statut GPS */}
      <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
        <span className="text-sm font-medium text-gray-600">Statut GPS</span>
        <div className="flex items-center gap-2">
          <span className={`inline-block h-2 w-2 rounded-full ${isRecording ? 'bg-green-500' : 'bg-orange-400'}`} />
          <span className={`text-sm font-medium ${isRecording ? 'text-green-700' : 'text-orange-700'}`}>
            {gpsStatus}
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700 border border-red-200">
          ⚠️ {error}
        </div>
      )}

      {/* Bouton principal */}
      {!isRecording ? (
        <button
          onClick={startRecording}
          className="w-full rounded-xl bg-blue-600 py-3 text-white font-semibold shadow-md hover:bg-blue-700 transition"
        >
          📍 Démarrer le trajet
        </button>
      ) : (
        <button
          onClick={stopRecording}
          className="w-full rounded-xl bg-red-600 py-3 text-white font-semibold shadow-md hover:bg-red-700 transition"
        >
          ⏹ Terminer le trajet
        </button>
      )}

      {/* Infos */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-gray-50 p-3 text-center">
          <p className="text-xs text-gray-500">Points</p>
          <p className="text-xl font-bold text-gray-800">{points.length}</p>
        </div>
        <div className="rounded-xl bg-gray-50 p-3 text-center">
          <p className="text-xs text-gray-500">Précision</p>
          <p className="text-xl font-bold text-gray-800">
            {latestPoint ? `${Math.round(latestPoint.accuracy)} m` : '--'}
          </p>
        </div>
      </div>

      {/* Détails (si point) */}
      {latestPoint && (
        <div className="rounded-xl bg-gray-50 p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Adresse</span>
            <span className="text-gray-800 font-medium truncate max-w-[180px]">
              {latestPoint.address?.road || latestPoint.address?.suburb || 'Inconnue'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Vitesse</span>
            <span className="text-gray-800 font-medium">
              {latestPoint.speed !== null ? `${(latestPoint.speed * 3.6).toFixed(1)} km/h` : '⏸️'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Dernière mise à jour</span>
            <span className="text-gray-800 font-medium">
              {new Date(latestPoint.timestamp).toLocaleTimeString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
                  }
