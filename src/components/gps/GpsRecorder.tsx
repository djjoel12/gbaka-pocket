"use client";

import { useEffect, useRef, useState, Dispatch, SetStateAction } from "react";
import type { GPSPoint } from "@/app/page";

type GpsRecorderProps = {
  status?: "idle" | "recording" | "paused";
  setStatus?: Dispatch<SetStateAction<"idle" | "recording" | "paused">>;
  onPointsChange?: (points: GPSPoint[]) => void;
  route?: string;
  minDistance?: number;
  maxSpeed?: number;
  maxAccuracy?: number;
};

// ============================================
// 1. CALCUL DE DISTANCE (Haversine)
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

// ============================================
// 2. FILTRE DE KALMAN
// ============================================
class KalmanFilter {
  private Q: number;
  private R: number;
  private P: number;
  private K: number;
  private x: number;

  constructor(initialValue: number, Q: number = 0.01, R: number = 5) {
    this.Q = Q;
    this.R = R;
    this.P = 1;
    this.K = 0;
    this.x = initialValue;
  }

  update(measurement: number): number {
    this.P = this.P + this.Q;
    this.K = this.P / (this.P + this.R);
    this.x = this.x + this.K * (measurement - this.x);
    this.P = (1 - this.K) * this.P;
    return this.x;
  }
}

// ============================================
// 3. LISSAGE BIDIRECTIONNEL (moyenne mobile sur 7 points)
// ============================================
function smoothPoints(points: GPSPoint[], windowSize: number = 7): GPSPoint[] {
  if (points.length < windowSize) return points;

  const smoothDirectional = (pts: GPSPoint[], size: number): GPSPoint[] => {
    const half = Math.floor(size / 2);
    const smoothed: GPSPoint[] = [];

    for (let i = 0; i < pts.length; i++) {
      const start = Math.max(0, i - half);
      const end = Math.min(pts.length, i + half + 1);
      const window = pts.slice(start, end);

      const avgLat = window.reduce((sum, p) => sum + p.latitude, 0) / window.length;
      const avgLon = window.reduce((sum, p) => sum + p.longitude, 0) / window.length;
      const avgAccuracy = window.reduce((sum, p) => sum + p.accuracy, 0) / window.length;

      smoothed.push({
        latitude: avgLat,
        longitude: avgLon,
        accuracy: avgAccuracy,
        speed: pts[i].speed,
        timestamp: pts[i].timestamp,
      });
    }
    return smoothed;
  };

  const smoothed = smoothDirectional(points, windowSize);
  const reversed = smoothDirectional([...smoothed].reverse(), windowSize);
  return reversed.reverse();
}

// ============================================
// 4. MAP MATCHING (OSRM)
// ============================================
async function mapMatchPoints(points: GPSPoint[]): Promise<GPSPoint[]> {
  if (points.length < 3) return points;

  try {
    const coordinates = points
      .map((p) => `${p.longitude},${p.latitude}`)
      .join(';');

    const response = await fetch(
      `https://router.project-osrm.org/match/v1/car/${coordinates}?geometries=geojson&overview=full`
    );

    if (!response.ok) return points;

    const data = await response.json();

    if (data && data.matchings && data.matchings.length > 0) {
      const matched = data.matchings[0];
      const matchedPoints: GPSPoint[] = matched.geometry.coordinates.map(
        (coord: [number, number], index: number) => ({
          latitude: coord[1],
          longitude: coord[0],
          accuracy: points[index]?.accuracy || 30,
          speed: points[index]?.speed || 0,
          timestamp: points[index]?.timestamp || Date.now(),
        })
      );
      console.log(`✅ Map Matching: ${points.length} → ${matchedPoints.length} points`);
      return matchedPoints;
    }
    return points;
  } catch (error) {
    console.error('Map Matching error:', error);
    return points;
  }
}

// ============================================
// 5. DOUGLAS-PEUCKER (Simplification)
// ============================================
function douglasPeucker(points: GPSPoint[], epsilon: number = 5): GPSPoint[] {
  if (points.length < 3) return points;

  let dmax = 0;
  let index = 0;
  const end = points.length - 1;

  for (let i = 1; i < end; i++) {
    const d = perpendicularDistance(points[i], points[0], points[end]);
    if (d > dmax) {
      index = i;
      dmax = d;
    }
  }

  if (dmax > epsilon) {
    const recResults1 = douglasPeucker(points.slice(0, index + 1), epsilon);
    const recResults2 = douglasPeucker(points.slice(index), epsilon);
    return [...recResults1.slice(0, -1), ...recResults2];
  } else {
    return [points[0], points[end]];
  }
}

function perpendicularDistance(point: GPSPoint, start: GPSPoint, end: GPSPoint): number {
  const d13 = calculateDistance(point.latitude, point.longitude, end.latitude, end.longitude);
  const d23 = calculateDistance(start.latitude, start.longitude, end.latitude, end.longitude);
  const d12 = calculateDistance(point.latitude, point.longitude, start.latitude, start.longitude);
  
  if (d13 === 0) return d23;
  if (d23 === 0) return d13;
  
  const cosθ = (d13 * d13 + d23 * d23 - d12 * d12) / (2 * d13 * d23);
  const sinθ = Math.sqrt(1 - Math.min(cosθ * cosθ, 1));
  return d13 * sinθ;
}

// ============================================
// 6. REVERSE GEOCODING (Nominatim)
// ============================================
async function getAddress(lat: number, lon: number): Promise<string> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`
    );
    const data = await response.json();
    if (data && data.display_name) {
      const parts = data.display_name.split(',');
      return parts.slice(0, 3).join(',').trim();
    }
    return "Adresse inconnue";
  } catch (error) {
    console.error("Reverse geocoding error:", error);
    return "Adresse inconnue";
  }
}

// ============================================
// 7. COMPOSANT PRINCIPAL
// ============================================
export default function GpsRecorder({
  status = "idle",
  setStatus,
  onPointsChange,
  route,
  minDistance = 15,
  maxSpeed = 40,
  maxAccuracy = 30,
}: GpsRecorderProps) {
  const isRecording = status === "recording";

  // États
  const [gpsStatus, setGpsStatus] = useState<string>("En attente");
  const [points, setPoints] = useState<GPSPoint[]>([]);
  const [rawPoints, setRawPoints] = useState<GPSPoint[]>([]);
  const [error, setError] = useState<string>("");
  const [totalDistance, setTotalDistance] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [address, setAddress] = useState<string>("");
  const [startTime, setStartTime] = useState<number | null>(null);
  const [isStopped, setIsStopped] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [hasMoved, setHasMoved] = useState<boolean>(false);
  const [stopCount, setStopCount] = useState<number>(0);

  // Refs
  const watchIdRef = useRef<number | null>(null);
  const latFilterRef = useRef<KalmanFilter | null>(null);
  const lonFilterRef = useRef<KalmanFilter | null>(null);
  const stopStartTimeRef = useRef<number | null>(null);

  const latestPoint = points[points.length - 1];
  const lastRawPoint = rawPoints[rawPoints.length - 1];

  // Nettoyage au changement de route
  useEffect(() => {
    setPoints([]);
    setRawPoints([]);
    setTotalDistance(0);
    setDuration(0);
    setAddress("");
    setStartTime(null);
    setIsStopped(false);
    setError("");
    setGpsStatus("En attente");
    setHasMoved(false);
    setStopCount(0);
    stopStartTimeRef.current = null;
  }, [route]);

  // Timer pour la durée
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

  // ============================================
  // TRAITEMENT DES POINTS (COMPLET)
  // ============================================
  const processPoints = async (newPoints: GPSPoint[]) => {
    // VÉRIFICATION STRICTE : Est-ce qu'on a vraiment bougé ?
    if (rawPoints.length >= 2) {
      const last = rawPoints[rawPoints.length - 1];
      const beforeLast = rawPoints[rawPoints.length - 2];
      
      if (last && beforeLast) {
        const realDistance = calculateDistance(
          beforeLast.latitude,
          beforeLast.longitude,
          last.latitude,
          last.longitude
        );

        // ❌ Si on a pas bougé de minDistance, on ignore
        if (realDistance < minDistance) {
          console.log(`❌ Immobile: ${realDistance.toFixed(1)}m < ${minDistance}m`);
          return;
        }

        // Calcul de la vitesse réelle
        const timeDiff = (last.timestamp - beforeLast.timestamp) / 1000;
        if (timeDiff > 0) {
          const speed = realDistance / timeDiff;
          if (speed < 0.5) {
            console.log(`❌ Trop lent: ${speed.toFixed(2)} m/s`);
            return;
          }
        }

        setHasMoved(true);
      }
    }

    setIsProcessing(true);

    try {
      let processed = [...newPoints];

      // 1. FILTRE DE KALMAN
      if (latFilterRef.current && lonFilterRef.current) {
        processed = processed.map((point) => ({
          ...point,
          latitude: latFilterRef.current!.update(point.latitude),
          longitude: lonFilterRef.current!.update(point.longitude),
        }));
      }

      // 2. LISSAGE BIDIRECTIONNEL (7 points)
      if (processed.length >= 7 && hasMoved) {
        processed = smoothPoints(processed, 7);
      }

      // 3. MAP MATCHING (alignement sur les routes)
      if (processed.length >= 3 && route && hasMoved) {
        try {
          const matched = await mapMatchPoints(processed);
          if (matched.length > 0) {
            processed = matched;
          }
        } catch (e) {
          console.log('Map Matching non disponible');
        }
      }

      // 4. DOUGLAS-PEUCKER (simplification)
      if (processed.length >= 10 && hasMoved) {
        processed = douglasPeucker(processed, 5);
      }

      // Mise à jour des points affichés
      setPoints(processed);
      onPointsChange?.(processed);

      // Calcul de la distance totale
      if (processed.length >= 2 && hasMoved) {
        const last = processed[processed.length - 2];
        const current = processed[processed.length - 1];
        if (last && current) {
          const dist = calculateDistance(
            last.latitude,
            last.longitude,
            current.latitude,
            current.longitude
          );
          setTotalDistance((prev) => prev + dist);
        }
      }

      // Détection des arrêts
      if (hasMoved && rawPoints.length >= 2) {
        const last = rawPoints[rawPoints.length - 1];
        const beforeLast = rawPoints[rawPoints.length - 2];
        const timeDiff = (last.timestamp - beforeLast.timestamp) / 1000;
        const dist = calculateDistance(
          beforeLast.latitude,
          beforeLast.longitude,
          last.latitude,
          last.longitude
        );
        const speed = dist / timeDiff;

        if (speed < 0.5) {
          if (!stopStartTimeRef.current) {
            stopStartTimeRef.current = Date.now();
          } else {
            const stopDuration = (Date.now() - stopStartTimeRef.current) / 1000;
            if (stopDuration > 30) {
              setStopCount((prev) => prev + 1);
              stopStartTimeRef.current = null;
            }
          }
        } else {
          stopStartTimeRef.current = null;
        }
      }
    } catch (error) {
      console.error('Erreur traitement:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // ============================================
  // DÉMARRER L'ENREGISTREMENT
  // ============================================
  const startRecording = () => {
    setError("");
    setGpsStatus("Recherche de votre position…");
    setIsStopped(false);
    setHasMoved(false);
    setStopCount(0);
    stopStartTimeRef.current = null;

    if (!navigator.geolocation) {
      setError("La géolocalisation n'est pas disponible sur cet appareil.");
      setGpsStatus("Indisponible");
      return;
    }

    // Réinitialisation
    setPoints([]);
    setRawPoints([]);
    setTotalDistance(0);
    setDuration(0);
    setAddress("");

    latFilterRef.current = null;
    lonFilterRef.current = null;

    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        // FILTRE DE PRÉCISION
        if (position.coords.accuracy > maxAccuracy) {
          console.log(`❌ Précision: ${position.coords.accuracy}m > ${maxAccuracy}m`);
          return;
        }

        // FILTRE DE VITESSE
        if (position.coords.speed !== null && position.coords.speed > maxSpeed) {
          console.log(`❌ Vitesse: ${position.coords.speed}m/s > ${maxSpeed}m/s`);
          return;
        }

        const newPoint: GPSPoint = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed,
          timestamp: position.timestamp,
        };

        // Initialiser les filtres Kalman
        if (!latFilterRef.current) {
          latFilterRef.current = new KalmanFilter(newPoint.latitude, 0.01, 5);
          lonFilterRef.current = new KalmanFilter(newPoint.longitude, 0.01, 5);
        }

        // Ajouter le point
        setRawPoints((prev) => {
          const updated = [...prev, newPoint];
          
          // Vérification stricte AVANT de traiter
          if (updated.length >= 3) {
            const lastTwo = updated.slice(-2);
            if (lastTwo.length === 2) {
              const dist = calculateDistance(
                lastTwo[0].latitude,
                lastTwo[0].longitude,
                lastTwo[1].latitude,
                lastTwo[1].longitude
              );
              
              if (dist < minDistance) {
                console.log(`❌ Ignoré (trop proche): ${dist.toFixed(1)}m`);
                return prev;
              }
            }
            
            processPoints(updated);
          } else {
            setPoints(updated);
            onPointsChange?.(updated);
          }

          return updated;
        });

        // Mise à jour de l'adresse
        if (rawPoints.length === 0) {
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

  // ============================================
  // ARRÊTER L'ENREGISTREMENT
  // ============================================
  const stopRecording = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setStatus?.("paused");
    setGpsStatus("Trajet terminé");
    setIsStopped(true);
  };

  // Suivi GPS en direct (même sans enregistrement)
  useEffect(() => {
    if (!isRecording && !isStopped) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          if (rawPoints.length === 0) {
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
  }, [isRecording, isStopped, rawPoints.length]);

  // Nettoyage
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Formater la durée
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
            {isProcessing ? "🔄 Traitement..." : gpsStatus}
          </span>
        </div>
        {isRecording && (
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className={hasMoved ? "text-green-600" : "text-gray-400"}>
              {hasMoved ? "🚶 En mouvement" : "⏸️ Immobile"}
            </span>
            {stopCount > 0 && (
              <span className="text-blue-600">🛑 {stopCount} arrêts</span>
            )}
          </div>
        )}
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
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-gradient-to-br from-white to-gray-50/50 p-3 shadow-lg border border-gray-100/50">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Points</p>
          <p className="text-xl font-bold text-gray-900">{points.length}</p>
          <p className="text-[10px] text-gray-400">Bruts: {rawPoints.length}</p>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-white to-gray-50/50 p-3 shadow-lg border border-gray-100/50">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Distance</p>
          <p className="text-xl font-bold text-gray-900">
            {totalDistance > 0 ? `${(totalDistance / 1000).toFixed(2)} km` : "--"}
          </p>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-white to-gray-50/50 p-3 shadow-lg border border-gray-100/50">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Durée</p>
          <p className="text-xl font-bold text-gray-900">
            {startTime ? formatDuration(duration) : "--:--"}
          </p>
        </div>
      </div>

      {/* Adresse */}
      {address && (
        <div className="rounded-2xl bg-gradient-to-br from-white to-gray-50/50 p-4 shadow-lg border border-gray-100/50">
          <div className="flex items-center gap-2">
            <span className="text-lg">🏠</span>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Adresse</p>
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
                  latestPoint.accuracy < 20
                    ? "text-green-600"
                    : latestPoint.accuracy < 30
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
