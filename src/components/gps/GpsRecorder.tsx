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
  const [gpsStatus, setGpsStatus] = useState("En attente");
  const watchIdRef = useRef<number | null>(null);

  const startRecording = () => {
    if (!navigator.geolocation) return;
    setStatus("recording");
    setGpsStatus("Enregistrement actif");

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (status !== "recording") return;
        if (position.coords.accuracy > 100) return;

        const newPoint: GPSPoint = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed,
          timestamp: position.timestamp,
        };

        setPoints((prev) => {
          const last = prev[prev.length - 1];
          if (last) {
            const distance = calculateDistance(
              last.latitude,
              last.longitude,
              newPoint.latitude,
              newPoint.longitude
            );
            if (distance < 5) return prev;
          }
          const updated = [...prev, newPoint];
          onPointsChange?.(updated);
          return updated;
        });
      },
      () => setGpsStatus("Erreur GPS"),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    watchIdRef.current = watchId;
  };

  const pauseRecording = () => {
    setStatus("paused");
    setGpsStatus("Pause");
  };

  const resumeRecording = () => {
    setStatus("recording");
    setGpsStatus("Enregistrement actif");
  };

  const stopRecording = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setStatus("idle");
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
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-5 shadow">
        <p>Statut : <strong>{gpsStatus}</strong></p>
        <p>Points GPS : {points.length}</p>
      </div>

      {status === "idle" && (
        <button onClick={startRecording} className="w-full rounded-xl bg-blue-600 p-4 text-white font-bold">
          📍 Démarrer le trajet
        </button>
      )}

      {status === "recording" && (
        <div className="space-y-3">
          <button onClick={pauseRecording} className="w-full rounded-xl bg-yellow-500 p-4 text-white font-bold">
            ⏸ Pause
          </button>
          <button onClick={stopRecording} className="w-full rounded-xl bg-red-600 p-4 text-white font-bold">
            ⏹ Terminer
          </button>
        </div>
      )}

      {status === "paused" && (
        <div className="space-y-3">
          <button onClick={resumeRecording} className="w-full rounded-xl bg-green-600 p-4 text-white font-bold">
            ▶ Reprendre
          </button>
          <button onClick={stopRecording} className="w-full rounded-xl bg-red-600 p-4 text-white font-bold">
            ⏹ Terminer
          </button>
        </div>
      )}
    </div>
  );
}
