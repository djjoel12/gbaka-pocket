"use client";

import { useEffect, useRef, useState, Dispatch, SetStateAction } from "react";
import type { GPSPoint } from "@/app/page";

type GpsRecorderProps = {
  status?: "idle" | "recording" | "paused";
  setStatus?: Dispatch<SetStateAction<"idle" | "recording" | "paused">>;
  onPointsChange?: (points: GPSPoint[]) => void;
  route?: string;
  minDistance?: number;
  maxAccuracy?: number;
};

// ============================================
// CALCUL DE DISTANCE (Haversine)
// ============================================
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
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

export default function GpsRecorder({
  status = "idle",
  setStatus,
  onPointsChange,
  route,
  minDistance = 15,
  maxAccuracy = 30,
}: GpsRecorderProps) {
  const isRecording = status === "recording";

  const [gpsStatus, setGpsStatus] = useState<string>("En attente");
  const [points, setPoints] = useState<GPSPoint[]>([]);
  const [error, setError] = useState<string>("");
  const [totalDistance, setTotalDistance] = useState<number>(0);
  const [isStopped, setIsStopped] = useState<boolean>(false);

  const watchIdRef = useRef<number | null>(null);
  const lastPositionRef = useRef<GPSPoint | null>(null);

  const latestPoint = points[points.length - 1];

  useEffect(() => {
    setPoints([]);
    setTotalDistance(0);
    setError("");
    setGpsStatus("En attente");
    setIsStopped(false);
    lastPositionRef.current = null;
    onPointsChange?.([]);
  }, [route, onPointsChange]);

  const startRecording = () => {
    setError("");
    setGpsStatus("Recherche de votre position…");
    setIsStopped(false);

    if (!navigator.geolocation) {
      setError("La géolocalisation n'est pas disponible.");
      setGpsStatus("Indisponible");
      return;
    }

    setPoints([]);
    setTotalDistance(0);
    lastPositionRef.current = null;
    onPointsChange?.([]);

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (position.coords.accuracy > maxAccuracy) {
          console.log(`❌ Précision: ${position.coords.accuracy}m > ${maxAccuracy}m`);
          return;
        }

        const newPoint: GPSPoint = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed,
          timestamp: position.timestamp,
        };

        if (lastPositionRef.current) {
          const dist = calculateDistance(
            lastPositionRef.current.latitude,
            lastPositionRef.current.longitude,
            newPoint.latitude,
            newPoint.longitude
          );

          if (dist < minDistance) {
            console.log(`❌ Trop proche: ${dist.toFixed(1)}m < ${minDistance}m`);
            return;
          }

          setTotalDistance((prev) => prev + dist);
        }

        setPoints((prev) => {
          const updated = [...prev, newPoint];
          onPointsChange?.(updated);
          return updated;
        });

        lastPositionRef.current = newPoint;

        if (gpsStatus !== "Enregistrement en cours") {
          setGpsStatus("Enregistrement en cours");
        }
        if (status !== "recording") {
          setStatus?.("recording");
        }
      },
      (err) => {
        console.error("Erreur GPS:", err);
        setGpsStatus("Erreur GPS");
        if (err.code === 1) {
          setError("Vous devez autoriser la localisation pour enregistrer un trajet.");
        } else if (err.code === 2) {
          setError("Votre position GPS est actuellement indisponible.");
        } else if (err.code === 3) {
          setError("La récupération de votre position a pris trop de temps.");
        } else {
          setError("Erreur inconnue de géolocalisation.");
        }
        stopRecording();
      },
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 10000,
      }
    );

    watchIdRef.current = watchId;
  };

  const stopRecording = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setStatus?.("paused");
    setGpsStatus("Trajet terminé");
    setIsStopped(true);
  };

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white/70 p-5 shadow-lg border border-gray-100/50 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={`h-3 w-3 rounded-full animate-pulse ${
                isRecording ? "bg-green-500" : isStopped ? "bg-gray-500" : "bg-orange-500"
              }`}
            />
            <span className="font-semibold text-gray-700">Statut GPS</span>
          </div>
          <span
            className={`text-sm font-medium ${
              isRecording ? "text-green-600" : isStopped ? "text-gray-600" : "text-orange-600"
            }`}
          >
            {gpsStatus}
          </span>
        </div>
        {isRecording && points.length > 0 && (
          <div className="mt-2 text-xs text-gray-500">
            Dernier point il y a {Math.round((Date.now() - latestPoint.timestamp) / 1000)}s
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-2xl bg-red-50/80 p-4 text-sm text-red-700 border border-red-200/50 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {!isRecording ? (
        <button
          onClick={startRecording}
          className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-4 font-bold text-white shadow-lg shadow-blue-600/30 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
        >
          <span className="flex items-center justify-center gap-2">
            <span className="text-xl">📍</span> Démarrer le trajet
          </span>
        </button>
      ) : (
        <button
          onClick={stopRecording}
          className="w-full rounded-2xl bg-gradient-to-r from-red-600 to-red-700 px-5 py-4 font-bold text-white shadow-lg shadow-red-600/30 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
        >
          <span className="flex items-center justify-center gap-2">
            <span className="text-xl">⏹</span> Terminer le trajet
          </span>
        </button>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white/70 p-3 shadow-lg border border-gray-100/50 backdrop-blur-xl">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Points</p>
          <p className="text-xl font-bold text-gray-900">{points.length}</p>
        </div>

        <div className="rounded-2xl bg-white/70 p-3 shadow-lg border border-gray-100/50 backdrop-blur-xl">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Distance</p>
          <p className="text-xl font-bold text-gray-900">
            {totalDistance > 0 ? `${(totalDistance / 1000).toFixed(2)} km` : "--"}
          </p>
        </div>
      </div>

      {latestPoint && (
        <div className="rounded-2xl bg-white/70 p-5 shadow-lg border border-gray-100/50 backdrop-blur-xl">
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

          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 rounded-xl bg-gray-50/50">
              <span className="text-sm text-gray-500">Latitude</span>
              <span className="font-mono text-sm font-semibold text-gray-900">
                {latestPoint.latitude.toFixed(6)}
              </span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-xl bg-gray-50/50">
              <span className="text-sm text-gray-500">Longitude</span>
              <span className="font-mono text-sm font-semibold text-gray-900">
                {latestPoint.longitude.toFixed(6)}
              </span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-xl bg-gray-50/50">
              <span className="text-sm text-gray-500">Précision</span>
              <span className={`font-semibold text-sm ${
                latestPoint.accuracy < 20 ? "text-green-600" :
                latestPoint.accuracy < 30 ? "text-yellow-600" : "text-red-600"
              }`}>
                {Math.round(latestPoint.accuracy)} mètres
              </span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-xl bg-gray-50/50">
              <span className="text-sm text-gray-500">Vitesse</span>
              <span className="font-semibold text-sm text-gray-900">
                {latestPoint.speed !== null
                  ? `${(latestPoint.speed * 3.6).toFixed(1)} km/h`
                  : "⏸️ À l'arrêt"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
                  }
