"use client";

import {
  Dispatch,
  SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";

import type { GPSPoint } from "@/app/page";

type GpsRecorderProps = {
  status: "idle" | "recording" | "paused";
  setStatus: Dispatch<SetStateAction<"idle" | "recording" | "paused">>;
  onPointsChange: (points: GPSPoint[]) => void;
  onLivePositionChange: (point: GPSPoint | null) => void;
  destination?: string;
  minDistance?: number;
  maxAccuracy?: number;
};

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function detectSpike(
  previousPoint: GPSPoint | null,
  newPoint: GPSPoint,
  maxJump = 100
): boolean {
  if (!previousPoint) {
    return false;
  }

  const distance = calculateDistance(
    previousPoint.latitude,
    previousPoint.longitude,
    newPoint.latitude,
    newPoint.longitude
  );

  if (distance > maxJump) {
    console.log(`GPS ignoré : saut de ${distance.toFixed(1)} mètres`);
    return true;
  }

  return false;
}

export default function GpsRecorder({
  status,
  setStatus,
  onPointsChange,
  onLivePositionChange,
  destination,
  minDistance = 5,
  maxAccuracy = 50,
}: GpsRecorderProps) {
  const [points, setPoints] = useState<GPSPoint[]>([]);
  const [gpsStatus, setGpsStatus] = useState("En attente");
  const [error, setError] = useState("");
  const [totalDistance, setTotalDistance] = useState(0);
  const [tripStartTime, setTripStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState<number | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const lastPointRef = useRef<GPSPoint | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (status === "recording") {
      setTripStartTime(Date.now());
      timerRef.current = setInterval(() => {
        if (tripStartTime) {
          setElapsedTime(Math.floor((Date.now() - tripStartTime) / 1000));
        }
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [status, tripStartTime]);

  const stopGPS = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      console.log("GPS arrêté correctement");
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h}h ${m}m ${s}s`;
    }
    if (m > 0) {
      return `${m}m ${s}s`;
    }
    return `${s}s`;
  };

  const formatSpeed = (speed: number | null) => {
    if (speed === null || speed < 0) return "--";
    const kmh = speed * 3.6;
    return `${kmh.toFixed(1)} km/h`;
  };

  useEffect(() => {
    if (status === "recording" && destination) {
      startRecording();
    }
  }, [status, destination]);

  const startRecording = () => {
    if (!navigator.geolocation) {
      setError("La géolocalisation n'est pas disponible sur cet appareil.");
      return;
    }

    stopGPS();
    setError("");
    setPoints([]);
    onPointsChange([]);
    setTotalDistance(0);
    setCurrentSpeed(null);
    lastPointRef.current = null;
    onLivePositionChange(null);
    setGpsStatus("Recherche de votre position...");
    setTripStartTime(Date.now());

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const newPoint: GPSPoint = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed,
          timestamp: position.timestamp,
        };

        console.log("Position GPS reçue :", newPoint);

        setCurrentSpeed(position.coords.speed);
        onLivePositionChange(newPoint);

        if (newPoint.accuracy > maxAccuracy) {
          console.log(`Position ignorée : précision ${newPoint.accuracy.toFixed(1)}m`);
          setGpsStatus(`GPS imprécis (${Math.round(newPoint.accuracy)}m)`);
          return;
        }

        if (lastPointRef.current === null) {
          setPoints([newPoint]);
          onPointsChange([newPoint]);
          lastPointRef.current = newPoint;
          setGpsStatus("Enregistrement en cours");
          console.log("Premier point enregistré");
          return;
        }

        if (detectSpike(lastPointRef.current, newPoint)) {
          return;
        }

        const distance = calculateDistance(
          lastPointRef.current.latitude,
          lastPointRef.current.longitude,
          newPoint.latitude,
          newPoint.longitude
        );

        if (distance < minDistance) {
          console.log(`Déplacement trop faible : ${distance.toFixed(1)}m`);
          return;
        }

        setPoints((previousPoints) => {
          const updatedPoints = [...previousPoints, newPoint];
          onPointsChange(updatedPoints);
          return updatedPoints;
        });

        setTotalDistance((previousDistance) => previousDistance + distance);
        lastPointRef.current = newPoint;
        setGpsStatus("Enregistrement en cours");

        console.log(`Point enregistré : ${distance.toFixed(1)}m`);
      },

      (gpsError) => {
        console.error("Erreur GPS :", gpsError);
        if (gpsError.code === 1) {
          setError("Autorisez la localisation dans votre navigateur.");
        } else if (gpsError.code === 2) {
          setError("Impossible de déterminer votre position.");
        } else if (gpsError.code === 3) {
          setError("Le GPS met trop de temps à répondre.");
        } else {
          setError("Une erreur GPS est survenue.");
        }
        setGpsStatus("Erreur GPS");
      },

      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      }
    );

    watchIdRef.current = watchId;
  };

  const stopRecording = () => {
    stopGPS();
    setStatus("paused");
    setGpsStatus("Trajet terminé");
    setCurrentSpeed(null);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    console.log("Trajet terminé.");
    console.log("Destination :", destination);
    console.log("Nombre de points :", points.length);
    console.log("Distance totale :", totalDistance);
    console.log("Durée :", formatTime(elapsedTime));
  };

  useEffect(() => {
    if (status === "idle") {
      stopGPS();
      setPoints([]);
      setTotalDistance(0);
      setError("");
      setGpsStatus("En attente");
      setCurrentSpeed(null);
      lastPointRef.current = null;
      onPointsChange([]);
      onLivePositionChange(null);
      setTripStartTime(null);
      setElapsedTime(0);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [status]);

  useEffect(() => {
    return () => {
      stopGPS();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const latestPoint = points.length > 0 ? points[points.length - 1] : null;
  const isRecording = status === "recording";

  return (
    <div className="space-y-3">

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={`h-2.5 w-2.5 rounded-full ${
                isRecording ? "animate-pulse bg-green-500" : "bg-gray-500"
              }`}
            />
            <span className="font-medium text-white/80">GPS</span>
          </div>
          <span className="text-sm font-medium text-white/60">
            {gpsStatus}
          </span>
        </div>

        {isRecording && (
          <div className="mt-2 flex justify-between text-xs text-white/40">
            <span>{points.length} points</span>
            {elapsedTime > 0 && <span>⏱ {formatTime(elapsedTime)}</span>}
          </div>
        )}
      </div>

      {destination && (
        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-3 backdrop-blur-sm">
          <p className="text-center text-sm text-blue-400">
            🎯 Destination : <span className="font-bold text-white">{destination}</span>
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-2xl bg-red-500/20 p-3 text-sm text-red-400">
          ⚠️ {error}
        </div>
      )}

      {isRecording && (
        <button
          onClick={stopRecording}
          className="w-full rounded-2xl bg-red-600 px-5 py-4 font-bold text-white shadow-lg shadow-red-600/30 transition hover:bg-red-700"
        >
          ⏹ Terminer le trajet
        </button>
      )}

      {isRecording && (
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
            <p className="text-xs text-white/40">POINTS</p>
            <p className="mt-1 text-lg font-bold text-white">{points.length}</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
            <p className="text-xs text-white/40">DISTANCE</p>
            <p className="mt-1 text-lg font-bold text-white">
              {totalDistance > 0
                ? `${(totalDistance / 1000).toFixed(2)} km`
                : "--"}
            </p>
          </div>

          <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-3 backdrop-blur-sm">
            <p className="text-xs text-yellow-400/60">VITESSE</p>
            <p className="mt-1 text-lg font-bold text-yellow-400">
              {formatSpeed(currentSpeed)}
            </p>
          </div>
        </div>
      )}

      {latestPoint && isRecording && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
          <h2 className="mb-2 text-sm font-medium text-white/60">
            🛰️ Dernier point
          </h2>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-white/40">Lat</span>
              <span className="ml-2 font-mono text-white/80">
                {latestPoint.latitude.toFixed(6)}
              </span>
            </div>
            <div>
              <span className="text-white/40">Lng</span>
              <span className="ml-2 font-mono text-white/80">
                {latestPoint.longitude.toFixed(6)}
              </span>
            </div>
            {currentSpeed !== null && (
              <div className="col-span-2 mt-1 pt-1 border-t border-white/5">
                <span className="text-white/40">Vitesse</span>
                <span className="ml-2 font-mono text-yellow-400">
                  {formatSpeed(currentSpeed)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}