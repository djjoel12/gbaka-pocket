"use client";

import { useEffect, useRef, useState, Dispatch, SetStateAction } from "react";
import type { GPSPoint } from "@/app/page";

type GpsRecorderProps = {
  status?: "idle" | "recording" | "paused";
  setStatus?: Dispatch<SetStateAction<"idle" | "recording" | "paused">>;
  onPointsChange?: (points: GPSPoint[]) => void;
  route?: string;
  minDistance?: number; // seuil en mètres (défaut: 10)
  maxSpeed?: number; // seuil en m/s (défaut: 40)
  maxAccuracy?: number; // seuil en mètres (défaut: 50)
};

// Calcul de la distance entre deux points (formule de Haversine)
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

// Lissage par moyenne mobile (fonctionnalité 2)
function smoothPoints(points: GPSPoint[]): GPSPoint[] {
  if (points.length < 3) return points;

  const smoothed: GPSPoint[] = [];
  
  // Premier point inchangé
  smoothed.push(points[0]);

  // Points intermédiaires lissés
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    const smoothedPoint: GPSPoint = {
      latitude: (prev.latitude + curr.latitude + next.latitude) / 3,
      longitude: (prev.longitude + curr.longitude + next.longitude) / 3,
      accuracy: (prev.accuracy + curr.accuracy + next.accuracy) / 3,
      speed: curr.speed,
      timestamp: curr.timestamp,
    };

    smoothed.push(smoothedPoint);
  }

  // Dernier point inchangé
  smoothed.push(points[points.length - 1]);

  return smoothed;
}

// Reverse geocoding (fonctionnalité 3 et 17)
async function getAddress(lat: number, lon: number): Promise<string> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`
    );
    const data = await response.json();
    
    if (data && data.display_name) {
      // On extrait les parties importantes
      const parts = data.display_name.split(',');
      // On prend les 3 premières parties (ex: rue, quartier, ville)
      return parts.slice(0, 3).join(',').trim();
    }
    return "Adresse inconnue";
  } catch (error) {
    console.error("Erreur reverse geocoding:", error);
    return "Adresse inconnue";
  }
}

export default function GpsRecorder({
  status = "idle",
  setStatus,
  onPointsChange,
  route,
  minDistance = 10,
  maxSpeed = 40,
  maxAccuracy = 50,
}: GpsRecorderProps) {
  const isRecording = status === "recording";

  const [gpsStatus, setGpsStatus] = useState<string>("En attente");
  const [points, setPoints] = useState<GPSPoint[]>([]);
  const [error, setError] = useState<string>("");
  const [totalDistance, setTotalDistance] = useState<number>(0); // fonctionnalité 6
  const [duration, setDuration] = useState<number>(0); // fonctionnalité 7
  const [address, setAddress] = useState<string>(""); // fonctionnalité 17
  const [startTime, setStartTime] = useState<number | null>(null);
  const [isStopped, setIsStopped] = useState<boolean>(false);

  const watchIdRef = useRef<number | null>(null);
  const latestPoint = points[points.length - 1];

  // Nettoyage au changement de route (fonctionnalité 18)
  useEffect(() => {
    setPoints([]);
    setTotalDistance(0);
    setDuration(0);
    setAddress("");
    setStartTime(null);
    setIsStopped(false);
    setError("");
    setGpsStatus("En attente");
  }, [route]);

  // Timer pour la durée (fonctionnalité 7)
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

  // Fonction pour démarrer l'enregistrement
  const startRecording = () => {
    setError("");
    setGpsStatus("Recherche de votre position…");
    setIsStopped(false);

    if (!navigator.geolocation) {
      setError("La géolocalisation n'est pas disponible sur cet appareil.");
      setGpsStatus("Indisponible");
      return;
    }

    // Réinitialiser les données
    setPoints([]);
    setTotalDistance(0);
    setDuration(0);
    setAddress("");

    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        // Filtre de précision (fonctionnalité 2 - ici maxAccuracy = 50m)
        if (position.coords.accuracy > maxAccuracy) {
          console.log(`Point ignoré – précision: ${position.coords.accuracy}m`);
          return;
        }

        // Filtre de vitesse (fonctionnalité 1)
        if (position.coords.speed !== null && position.coords.speed > maxSpeed) {
          console.log(`Point ignoré – vitesse: ${position.coords.speed}m/s`);
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
          const last = prev[prev.length - 1];
          
          // Filtre de distance (fonctionnalité 3)
          if (last) {
            const distance = calculateDistance(
              last.latitude,
              last.longitude,
              newPoint.latitude,
              newPoint.longitude
            );
            if (distance < minDistance) {
              console.log(`Point ignoré – déplacement ${distance.toFixed(1)}m`);
              return prev;
            }
          }

          // Ajout du point
          const updated = [...prev, newPoint];
          
          // Calcul de la distance totale (fonctionnalité 6)
          if (last) {
            const dist = calculateDistance(
              last.latitude,
              last.longitude,
              newPoint.latitude,
              newPoint.longitude
            );
            setTotalDistance((prevDist) => prevDist + dist);
          }

          // Détection des arrêts (fonctionnalité 5)
          if (last && position.coords.speed !== null && position.coords.speed < 0.5) {
            const timeDiff = (position.timestamp - last.timestamp) / 1000;
            if (timeDiff > 30) {
              console.log(`🛑 Arrêt détecté – durée: ${Math.round(timeDiff)}s`);
            }
          }

          // Lissage des points (fonctionnalité 2)
          if (updated.length >= 3) {
            const smoothed = smoothPoints(updated);
            onPointsChange?.(smoothed);
            return smoothed;
          }

          onPointsChange?.(updated);
          return updated;
        });

        // Mise à jour de l'adresse (fonctionnalité 17)
        if (points.length === 0) {
          const addr = await getAddress(position.coords.latitude, position.coords.longitude);
          setAddress(addr);
        }

        // Mise à jour du statut
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
        console.error("Erreur GPS :", err);
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
        maximumAge: 5000,
        timeout: 10000,
      }
    );

    watchIdRef.current = watchId;
  };

  // Fonction pour arrêter l'enregistrement
  const stopRecording = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setStatus?.("paused");
    setGpsStatus("Trajet terminé");
    setIsStopped(true);
  };

  // Suivi GPS en direct (fonctionnalité 4)
  useEffect(() => {
    if (!isRecording && !isStopped) {
      // Suivi passif (même sans enregistrement)
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          // On met juste à jour l'adresse pour l'affichage
          if (points.length === 0) {
            getAddress(position.coords.latitude, position.coords.longitude)
              .then(addr => setAddress(addr));
          }
        },
        (err) => console.log("Suivi passif:", err),
        { enableHighAccuracy: true, maximumAge: 10000 }
      );
      
      return () => {
        if (watchId) navigator.geolocation.clearWatch(watchId);
      };
    }
  }, [isRecording, isStopped, points.length]);

  // Nettoyage
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Formater la durée (fonctionnalité 7)
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-md mx-auto space-y-4 p-4">
      {/* Statut GPS */}
      <div className="rounded-2xl bg-gradient-to-br from-white to-gray-50/50 p-5 shadow-lg border border-gray-100/50">
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

      {/* Bouton principal */}
      {!isRecording ? (
        <button
          onClick={startRecording}
          className="group w-full rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-4 font-bold text-white shadow-lg shadow-blue-600/30 transition-all duration-300 hover:scale-[1.02]"
        >
          <span className="flex items-center justify-center gap-2">
            <span className="text-xl">📍</span> Démarrer le trajet
          </span>
        </button>
      ) : (
        <button
          onClick={stopRecording}
          className="group w-full rounded-2xl bg-gradient-to-r from-red-600 to-red-700 px-5 py-4 font-bold text-white shadow-lg shadow-red-600/30 transition-all duration-300 hover:scale-[1.02]"
        >
          <span className="flex items-center justify-center gap-2">
            <span className="text-xl">⏹</span> Terminer le trajet
          </span>
        </button>
      )}

      {/* Informations GPS */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-gradient-to-br from-white to-gray-50/50 p-4 shadow-lg border border-gray-100/50">
          <div className="flex items-center gap-2">
            <span className="text-lg">📊</span>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Points GPS
            </p>
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">{points.length}</p>
          <p className="mt-1 text-xs text-gray-400">
            {isRecording ? "En cours…" : "Total enregistrés"}
          </p>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-white to-gray-50/50 p-4 shadow-lg border border-gray-100/50">
          <div className="flex items-center gap-2">
            <span className="text-lg">📏</span>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Distance
            </p>
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {totalDistance > 0 ? `${(totalDistance / 1000).toFixed(2)} km` : "--"}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {isRecording ? "En cours…" : "Total parcouru"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-gradient-to-br from-white to-gray-50/50 p-4 shadow-lg border border-gray-100/50">
          <div className="flex items-center gap-2">
            <span className="text-lg">⏱️</span>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Durée
            </p>
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {startTime ? formatDuration(duration) : "--:--"}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {isRecording ? "En cours…" : "Total"}
          </p>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-white to-gray-50/50 p-4 shadow-lg border border-gray-100/50">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎯</span>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Précision
            </p>
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {latestPoint ? `${Math.round(latestPoint.accuracy)} m` : "--"}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {latestPoint
              ? latestPoint.accuracy < 30
                ? "✅ Excellente"
                : latestPoint.accuracy < 50
                ? "👍 Très bonne"
                : "📡 Bonne"
              : "📡 En attente"}
          </p>
        </div>
      </div>

      {/* Adresse (fonctionnalité 17) */}
      {address && (
        <div className="rounded-2xl bg-gradient-to-br from-white to-gray-50/50 p-4 shadow-lg border border-gray-100/50">
          <div className="flex items-center gap-2">
            <span className="text-lg">🏠</span>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Adresse
            </p>
          </div>
          <p className="mt-1 text-sm font-medium text-gray-900">{address}</p>
        </div>
      )}

      {/* Dernière position GPS */}
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
              <span
                className={`font-semibold text-sm ${
                  latestPoint.accuracy < 30
                    ? "text-green-600"
                    : latestPoint.accuracy < 50
                    ? "text-yellow-600"
                    : "text-red-600"
                }`}
              >
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
