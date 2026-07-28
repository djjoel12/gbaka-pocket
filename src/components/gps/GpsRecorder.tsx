"use client";

import { useEffect, useRef, useState } from "react";

type GPSPoint = {
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number | null;
  timestamp: number;
};

type GpsRecorderProps = {
  onPointsChange?: (points: GPSPoint[]) => void;
};

export default function GpsRecorder({
  onPointsChange,
}: GpsRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
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

    setGpsStatus("Recherche de votre position...");

    navigator.geolocation.getCurrentPosition(
      () => {
        setIsRecording(true);
        setGpsStatus("Enregistrement en cours");

        const watchId = navigator.geolocation.watchPosition(
          (position) => {
            if (position.coords.accuracy > 100) {
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

            setPoints((previousPoints) => {
              const updatedPoints = [
                ...previousPoints,
                newPoint,
              ];

              onPointsChange?.(updatedPoints);

              return updatedPoints;
            });
          },
          (error) => {
            console.error("Erreur GPS :", error);

            setGpsStatus("Erreur GPS");
            setError(
              "Impossible de récupérer votre position GPS."
            );
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
          setError(
            "Vous devez autoriser la localisation pour enregistrer un trajet."
          );
        } else if (error.code === 2) {
          setError(
            "Votre position GPS est actuellement indisponible."
          );
        } else {
          setError(
            "La récupération de votre position a pris trop de temps."
          );
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
      navigator.geolocation.clearWatch(
        watchIdRef.current
      );

      watchIdRef.current = null;
    }

    setIsRecording(false);
    setGpsStatus("Trajet terminé");
  };

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(
          watchIdRef.current
        );
      }
    };
  }, []);

  return (
    <div className="max-w-md mx-auto space-y-4 p-4">
      {/* Statut GPS */}
      <div className="rounded-2xl bg-gradient-to-br from-white to-gray-50/50 p-5 shadow-lg border border-gray-100/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`h-3 w-3 rounded-full animate-pulse ${
              isRecording ? "bg-green-500" : "bg-orange-500"
            }`} />
            <span className="font-semibold text-gray-700">
              Statut GPS
            </span>
          </div>

          <span className={`text-sm font-medium ${
            isRecording ? "text-green-600" : "text-orange-600"
          }`}>
            {gpsStatus}
          </span>
        </div>
      </div>

      {/* Erreur */}
      {error && (
        <div className="rounded-2xl bg-red-50/80 backdrop-blur-sm p-4 text-sm text-red-700 border border-red-200/50 shadow-sm animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Bouton */}
      {!isRecording ? (
        <button
          onClick={startRecording}
          className="group w-full rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-4 font-bold text-white shadow-lg shadow-blue-600/30 transition-all duration-300 hover:scale-[1.02] hover:shadow-blue-600/40 active:scale-[0.98]"
        >
          <span className="flex items-center justify-center gap-2">
            <span className="text-xl">📍</span>
            Démarrer le trajet
          </span>
        </button>
      ) : (
        <button
          onClick={stopRecording}
          className="group w-full rounded-2xl bg-gradient-to-r from-red-600 to-red-700 px-5 py-4 font-bold text-white shadow-lg shadow-red-600/30 transition-all duration-300 hover:scale-[1.02] hover:shadow-red-600/40 active:scale-[0.98]"
        >
          <span className="flex items-center justify-center gap-2">
            <span className="text-xl">⏹</span>
            Terminer le trajet
          </span>
        </button>
      )}

      {/* Informations GPS */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-gradient-to-br from-white to-gray-50/50 p-4 shadow-lg border border-gray-100/50 transition-all duration-300 hover:shadow-xl">
          <div className="flex items-center gap-2">
            <span className="text-lg">📊</span>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Points GPS
            </p>
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {points.length}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {isRecording ? "En cours..." : "Total enregistrés"}
          </p>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-white to-gray-50/50 p-4 shadow-lg border border-gray-100/50 transition-all duration-300 hover:shadow-xl">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎯</span>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Précision
            </p>
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {latestPoint
              ? `${Math.round(latestPoint.accuracy)} m`
              : "--"}
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

      {/* Dernière position GPS */}
      {latestPoint && (
        <div className="rounded-2xl bg-gradient-to-br from-white to-gray-50/50 p-5 shadow-lg border border-gray-100/50 animate-in slide-in-from-bottom-4">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">🛰️</span>
            <h2 className="font-bold text-gray-900">
              Dernière position GPS
            </h2>
            {isRecording && (
              <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-green-600">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-ping" />
                En direct
              </span>
            )}
          </div>

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
                {new Date(
                  latestPoint.timestamp
                ).toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}