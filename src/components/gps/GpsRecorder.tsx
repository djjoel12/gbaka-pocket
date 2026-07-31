"use client";

import { useEffect, useRef, useState, Dispatch, SetStateAction } from "react";
import type { GPSPoint } from "@/app/page";

type GpsRecorderProps = {
  status?: "idle" | "recording" | "paused";
  setStatus?: Dispatch<SetStateAction<"idle" | "recording" | "paused">>;
  onPointsChange?: (points: GPSPoint[]) => void;
};

export default function GpsRecorder({
  status = "idle",
  setStatus,
  onPointsChange,
}: GpsRecorderProps) {
  const isRecording = status === "recording";

  const [gpsStatus, setGpsStatus] = useState("En attente");
  const [points, setPoints] = useState<GPSPoint[]>([]);
  const [error, setError] = useState("");
  const [totalDistance, setTotalDistance] = useState(0);
  const [duration, setDuration] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const latestPoint = points[points.length - 1];

  // Timer durée
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    if (isRecording && startTime) {
      intervalId = setInterval(() => {
        setDuration((Date.now() - startTime) / 1000);
      }, 1000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isRecording, startTime]);

  // Démarrer
  const startRecording = () => {
    setError("");
    setGpsStatus("Recherche de votre position…");

    if (!navigator.geolocation) {
      setError("Géolocalisation non disponible");
      return;
    }

    setPoints([]);
    setTotalDistance(0);
    setDuration(0);

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (position.coords.accuracy > 50) {
          console.log(`Précision: ${position.coords.accuracy}m`);
          return;
        }

        const newPoint: GPSPoint = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed,
          timestamp: position.timestamp,
        };

        setPoints((prev) => {
          const updated = [...prev, newPoint];
          onPointsChange?.(updated);
          return updated;
        });

        if (gpsStatus !== "Enregistrement en cours") {
          setGpsStatus("Enregistrement en cours");
        }
        if (status !== "recording") {
          setStatus?.("recording");
        }
        if (!startTime) {
          setStartTime(Date.now());
        }
      },
      (err) => {
        console.error("Erreur GPS:", err);
        setGpsStatus("Erreur GPS");
        setError("Impossible de récupérer votre position");
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

  // Arrêter
  const stopRecording = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setStatus?.("paused");
    setGpsStatus("Trajet terminé");
  };

  // Nettoyage
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Formatage
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-4">
      {/* STATUT */}
      <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={`h-2.5 w-2.5 rounded-full ${
                isRecording ? "bg-green-500 animate-pulse" : "bg-gray-400"
              }`}
            />
            <span className="text-sm font-medium text-gray-700">GPS</span>
          </div>
          <span className={`text-sm ${isRecording ? "text-green-600" : "text-gray-500"}`}>
            {gpsStatus}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
          <span>{points.length} points collectés</span>
          {latestPoint && (
            <span>📍 {latestPoint.latitude.toFixed(4)}, {latestPoint.longitude.toFixed(4)}</span>
          )}
        </div>
      </div>

      {/* ERREUR */}
      {error && (
        <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700 border border-red-200">
          ⚠️ {error}
        </div>
      )}

      {/* BOUTON */}
      {!isRecording ? (
        <button
          onClick={startRecording}
          className="w-full rounded-2xl bg-blue-600 px-5 py-4 font-semibold text-white shadow-md shadow-blue-600/25 transition hover:bg-blue-700 active:scale-95"
        >
          📍 Démarrer le trajet
        </button>
      ) : (
        <button
          onClick={stopRecording}
          className="w-full rounded-2xl bg-red-600 px-5 py-4 font-semibold text-white shadow-md shadow-red-600/25 transition hover:bg-red-700 active:scale-95"
        >
          ⏹ Terminer le trajet
        </button>
      )}

      {/* INFOS */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-gray-50 p-3 text-center border border-gray-100">
          <p className="text-xs text-gray-500">Points</p>
          <p className="text-lg font-bold text-gray-900">{points.length}</p>
        </div>
        <div className="rounded-2xl bg-gray-50 p-3 text-center border border-gray-100">
          <p className="text-xs text-gray-500">Distance</p>
          <p className="text-lg font-bold text-gray-900">
            {totalDistance > 0 ? `${(totalDistance / 1000).toFixed(1)} km` : "--"}
          </p>
        </div>
        <div className="rounded-2xl bg-gray-50 p-3 text-center border border-gray-100">
          <p className="text-xs text-gray-500">Durée</p>
          <p className="text-lg font-bold text-gray-900">
            {startTime ? formatDuration(duration) : "--:--"}
          </p>
        </div>
      </div>
    </div>
  );
            }
