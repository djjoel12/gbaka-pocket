"use client";

import { useEffect, useRef, useState } from "react";

type GPSPoint = {
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number | null;
  timestamp: number;
};

type Status = "idle" | "recording" | "paused";

type GpsRecorderProps = {
  status: Status;
  setStatus: React.Dispatch<React.SetStateAction<Status>>;
  onPointsChange?: (points: GPSPoint[]) => void;
};

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export default function GpsRecorder({ status, setStatus, onPointsChange }: GpsRecorderProps) {
  const [points, setPoints] = useState<GPSPoint[]>([]);
  const [totalDistance, setTotalDistance] = useState(0);
  const [gpsStatus, setGpsStatus] = useState("En attente");
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);

  const watchIdRef = useRef<number | null>(null);

  const startRecording = () => {
    if (!navigator.geolocation) {
      alert("❌ GPS non disponible sur cet appareil");
      return;
    }

    setStatus("recording");
    setGpsStatus("Enregistrement actif 📡");
    setPoints([]);
    setTotalDistance(0);
    setGpsAccuracy(null);

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (status !== "recording") {
          return;
        }

        const accuracy = position.coords.accuracy;
        setGpsAccuracy(accuracy);

        if (accuracy > 100) {
          setGpsStatus(`Précision faible (${accuracy.toFixed(0)}m)`);
          return;
        }

        setGpsStatus("Enregistrement actif 📡");

        const newPoint: GPSPoint = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: accuracy,
          speed: position.coords.speed,
          timestamp: position.timestamp,
        };

        setPoints((previous) => {
          const last = previous[previous.length - 1];

          if (last) {
            const distance = calculateDistance(
              last.latitude,
              last.longitude,
              newPoint.latitude,
              newPoint.longitude
            );

            if (distance < 5) {
              return previous;
            }

            setTotalDistance((prev) => prev + distance);
          }

          const updated = [...previous, newPoint];
          onPointsChange?.(updated);
          return updated;
        });
      },
      (error) => {
        console.error("Erreur GPS:", error);
        setGpsStatus(`❌ Erreur: ${error.message}`);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      }
    );

    watchIdRef.current = watchId;
  };

  const pauseRecording = () => {
    setStatus("paused");
    setGpsStatus("Pause ⏸️");
  };

  const resumeRecording = () => {
    setStatus("recording");
    setGpsStatus("Enregistrement actif 📡");
  };

  const stopRecording = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setStatus("idle");
    setGpsStatus(`✅ Trajet terminé - ${(totalDistance / 1000).toFixed(2)} km`);
  };

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Formater la durée
  const formatDuration = (timestamp: number) => {
    if (points.length < 2) return "0s";
    const first = points[0].timestamp;
    const last = points[points.length - 1].timestamp;
    const seconds = Math.floor((last - first) / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  return (
    <div className="space-y-4">
      {/* Panneau d'info */}
      <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-xs text-gray-400">Statut</p>
            <p className="text-sm font-semibold text-blue-600">{gpsStatus}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Points</p>
            <p className="text-sm font-bold">{points.length}</p>
          </div>
          {totalDistance > 0 && (
            <>
              <div>
                <p className="text-xs text-gray-400">Distance</p>
                <p className="text-sm font-bold text-green-600">
                  {(totalDistance / 1000).toFixed(2)} km
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Durée</p>
                <p className="text-sm font-bold">{formatDuration(0)}</p>
              </div>
            </>
          )}
          {gpsAccuracy !== null && (
            <div className="col-span-2">
              <p className="text-xs text-gray-400">Précision</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      gpsAccuracy < 20
                        ? "bg-green-500"
                        : gpsAccuracy < 50
                        ? "bg-yellow-500"
                        : "bg-red-500"
                    }`}
                    style={{ width: `${Math.min(100, 100 - gpsAccuracy)}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500">{gpsAccuracy.toFixed(0)}m</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Boutons */}
      {status === "idle" && (
        <button
          onClick={startRecording}
          className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 p-4 text-white font-bold hover:from-blue-700 hover:to-blue-800 transition shadow-lg shadow-blue-200"
        >
          📍 Démarrer le trajet
        </button>
      )}

      {status === "recording" && (
        <div className="space-y-3">
          <button
            onClick={pauseRecording}
            className="w-full rounded-xl bg-gradient-to-r from-yellow-500 to-yellow-600 p-4 text-white font-bold hover:from-yellow-600 hover:to-yellow-700 transition shadow-lg shadow-yellow-200"
          >
            ⏸ Pause
          </button>
          <button
            onClick={stopRecording}
            className="w-full rounded-xl bg-gradient-to-r from-red-500 to-red-600 p-4 text-white font-bold hover:from-red-600 hover:to-red-700 transition shadow-lg shadow-red-200"
          >
            ⏹ Terminer
          </button>
        </div>
      )}

      {status === "paused" && (
        <div className="space-y-3">
          <button
            onClick={resumeRecording}
            className="w-full rounded-xl bg-gradient-to-r from-green-500 to-green-600 p-4 text-white font-bold hover:from-green-600 hover:to-green-700 transition shadow-lg shadow-green-200"
          >
            ▶ Reprendre
          </button>
          <button
            onClick={stopRecording}
            className="w-full rounded-xl bg-gradient-to-r from-red-500 to-red-600 p-4 text-white font-bold hover:from-red-600 hover:to-red-700 transition shadow-lg shadow-red-200"
          >
            ⏹ Terminer
          </button>
        </div>
      )}
    </div>
  );
}