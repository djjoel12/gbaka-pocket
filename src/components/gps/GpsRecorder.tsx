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
      {/* Statut GPS - version épurée */}
      <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 border border-white/5">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${
            isRecording ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
          }`} />
          <span className="text-xs font-medium text-white/60 uppercase tracking-wider">
            Statut GPS
          </span>
        </div>
        <span className={`text-xs font-semibold ${
          isRecording ? "text-emerald-400" : "text-white/50"
        }`}>
          {gpsStatus}
        </span>
      </div>

      {/* Erreur */}
      {error && (
        <div className="rounded-xl bg-red-500/10 backdrop-blur-sm p-3 text-xs text-red-300 border border-red-500/20">
          <div className="flex items-start gap-2">
            <span className="text-red-400 text-base leading-none">⚠</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Bouton principal - design moderne */}
      {!isRecording ? (
        <button
          onClick={startRecording}
          className="group w-full rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-3.5 font-semibold text-white shadow-lg shadow-blue-500/30 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] hover:shadow-blue-500/50"
        >
          <span className="flex items-center justify-center gap-2 text-sm">
            <span className="text-lg leading-none">📍</span>
            Démarrer le trajet
          </span>
        </button>
      ) : (
        <button
          onClick={stopRecording}
          className="group w-full rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 px-4 py-3.5 font-semibold text-white shadow-lg shadow-rose-500/30 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] hover:shadow-rose-500/50"
        >
          <span className="flex items-center justify-center gap-2 text-sm">
            <span className="text-lg leading-none">⏹</span>
            Terminer le trajet
          </span>
        </button>
      )}

      {/* Statistiques - design élégant */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-white/5 p-3 border border-white/5">
          <div className="flex items-center gap-1.5">
            <span className="text-base leading-none opacity-50">📊</span>
            <p className="text-[10px] font-medium text-white/40 uppercase tracking-wider">
              Points GPS
            </p>
          </div>
          <p className="mt-1 text-lg font-bold text-white">{points.length}</p>
          <p className="text-[10px] text-white/30">
            {isRecording ? "En cours..." : "Total enregistrés"}
          </p>
        </div>

        <div className="rounded-xl bg-white/5 p-3 border border-white/5">
          <div className="flex items-center gap-1.5">
            <span className="text-base leading-none opacity-50">🎯</span>
            <p className="text-[10px] font-medium text-white/40 uppercase tracking-wider">
              Précision
            </p>
          </div>
          <p className="mt-1 text-lg font-bold text-white">
            {latestPoint ? `${Math.round(latestPoint.accuracy)} m` : "--"}
          </p>
          <p className="text-[10px] text-white/30">
            {latestPoint && latestPoint.accuracy < 50
              ? "✅ Très bonne"
              : latestPoint && latestPoint.accuracy < 100
              ? "👍 Bonne"
              : "📡 En attente"}
          </p>
        </div>
      </div>

      {/* Dernière position - version minimaliste */}
      {latestPoint && (
        <div className="rounded-xl bg-white/5 p-3 border border-white/5 space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base leading-none">🛰️</span>
              <h3 className="text-xs font-semibold text-white/70">Dernière position</h3>
            </div>
            {isRecording && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                En direct
              </span>
            )}
          </div>

          {latestPoint.address && (
            <div className="rounded-lg bg-white/5 p-2 text-xs text-white/60 border border-white/5">
              <p className="font-medium text-white/80">
                {latestPoint.address.display_name ||
                  `${latestPoint.address.road || ""}, ${latestPoint.address.suburb || ""}, ${latestPoint.address.city || ""}`}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-1">
            <div className="flex justify-between items-center px-2 py-1 rounded bg-white/5">
              <span className="text-[10px] text-white/40">Lat</span>
              <span className="font-mono text-[10px] text-white/70">{latestPoint.latitude.toFixed(6)}</span>
            </div>
            <div className="flex justify-between items-center px-2 py-1 rounded bg-white/5">
              <span className="text-[10px] text-white/40">Lng</span>
              <span className="font-mono text-[10px] text-white/70">{latestPoint.longitude.toFixed(6)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1">
            <div className="flex justify-between items-center px-2 py-1 rounded bg-white/5">
              <span className="text-[10px] text-white/40">⚡ Vitesse</span>
              <span className="text-[10px] font-medium text-white/70">
                {latestPoint.speed !== null
                  ? `${(latestPoint.speed * 3.6).toFixed(1)} km/h`
                  : "⏸ À l'arrêt"}
              </span>
            </div>
            <div className="flex justify-between items-center px-2 py-1 rounded bg-white/5">
              <span className="text-[10px] text-white/40">🕐</span>
              <span className="font-mono text-[10px] text-white/70">
                {new Date(latestPoint.timestamp).toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
    }
