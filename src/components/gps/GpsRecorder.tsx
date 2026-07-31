"use client";

import { useEffect, useRef, useState, Dispatch, SetStateAction } from "react";
import type { GPSPoint } from "@/app/page";

type GpsRecorderProps = {
  status?: "idle" | "recording" | "paused";
  setStatus?: Dispatch<SetStateAction<"idle" | "recording" | "paused">>;
  onPointsChange?: (points: GPSPoint[]) => void;
  route?: string;
};

// ============================================
// 1. FILTRE DE KALMAN (LISSAGE INTELLIGENT)
// ============================================
class KalmanFilter {
  private Q: number; // Bruit du processus
  private R: number; // Bruit de mesure
  private P: number; // Erreur de covariance
  private K: number; // Gain de Kalman
  private x: number; // État estimé

  constructor(initialValue: number, Q: number = 0.01, R: number = 5) {
    this.Q = Q;
    this.R = R;
    this.P = 1;
    this.K = 0;
    this.x = initialValue;
  }

  update(measurement: number): number {
    // 1. Prédiction
    this.P = this.P + this.Q;

    // 2. Mise à jour (correction)
    this.K = this.P / (this.P + this.R);
    this.x = this.x + this.K * (measurement - this.x);
    this.P = (1 - this.K) * this.P;

    return this.x;
  }
}

// ============================================
// 2. MAP MATCHING AVEC OSRM
// ============================================
async function mapMatchPoints(points: GPSPoint[]): Promise<GPSPoint[]> {
  if (points.length < 3) return points;

  try {
    // Préparer les coordonnées pour OSRM
    const coordinates = points
      .map((p) => `${p.longitude},${p.latitude}`)
      .join(';');

    // Appeler l'API OSRM Map Matching
    const response = await fetch(
      `https://router.project-osrm.org/match/v1/car/${coordinates}?geometries=geojson&overview=full`
    );

    if (!response.ok) {
      console.warn('Map Matching échoué, utilisation des points bruts');
      return points;
    }

    const data = await response.json();

    if (data && data.matchings && data.matchings.length > 0) {
      const matched = data.matchings[0];
      
      // Convertir les points alignés
      const matchedPoints: GPSPoint[] = matched.geometry.coordinates.map(
        (coord: [number, number], index: number) => ({
          latitude: coord[1],
          longitude: coord[0],
          accuracy: points[index]?.accuracy || 30,
          speed: points[index]?.speed || 0,
          timestamp: points[index]?.timestamp || Date.now(),
        })
      );

      console.log(`✅ Map Matching réussi : ${points.length} → ${matchedPoints.length} points`);
      return matchedPoints;
    }

    return points;
  } catch (error) {
    console.error('Erreur Map Matching:', error);
    return points;
  }
}

// ============================================
// 3. LISSAGE BIDIRECTIONNEL
// ============================================
function smoothPoints(points: GPSPoint[], windowSize: number = 5): GPSPoint[] {
  if (points.length < windowSize) return points;

  // Lissage dans les deux sens
  const smoothed = smoothDirectional(points, windowSize);
  const reversed = smoothDirectional([...smoothed].reverse(), windowSize);
  
  return reversed.reverse();
}

function smoothDirectional(points: GPSPoint[], windowSize: number): GPSPoint[] {
  const halfWindow = Math.floor(windowSize / 2);
  const smoothed: GPSPoint[] = [];

  for (let i = 0; i < points.length; i++) {
    const start = Math.max(0, i - halfWindow);
    const end = Math.min(points.length, i + halfWindow + 1);
    const window = points.slice(start, end);

    const avgLat = window.reduce((sum, p) => sum + p.latitude, 0) / window.length;
    const avgLon = window.reduce((sum, p) => sum + p.longitude, 0) / window.length;
    const avgAccuracy = window.reduce((sum, p) => sum + p.accuracy, 0) / window.length;

    smoothed.push({
      latitude: avgLat,
      longitude: avgLon,
      accuracy: avgAccuracy,
      speed: points[i].speed,
      timestamp: points[i].timestamp,
    });
  }

  return smoothed;
}

// ============================================
// 4. ALGORITHME DE DOUGLAS-PEUCKER (Simplification)
// ============================================
function douglasPeucker(points: GPSPoint[], epsilon: number = 5): GPSPoint[] {
  if (points.length < 3) return points;

  // Trouver le point le plus éloigné
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

  // Si la distance max est > epsilon, on divise
  if (dmax > epsilon) {
    const recResults1 = douglasPeucker(points.slice(0, index + 1), epsilon);
    const recResults2 = douglasPeucker(points.slice(index), epsilon);
    return [...recResults1.slice(0, -1), ...recResults2];
  } else {
    return [points[0], points[end]];
  }
}

function perpendicularDistance(point: GPSPoint, start: GPSPoint, end: GPSPoint): number {
  const lat1 = point.latitude;
  const lon1 = point.longitude;
  const lat2 = start.latitude;
  const lon2 = start.longitude;
  const lat3 = end.latitude;
  const lon3 = end.longitude;

  // Convertir en radians
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const φ3 = (lat3 * Math.PI) / 180;
  const Δλ2 = ((lon2 - lon1) * Math.PI) / 180;
  const Δλ3 = ((lon3 - lon1) * Math.PI) / 180;

  // Distance entre les points
  const d13 = calculateDistance(lat1, lon1, lat3, lon3);
  const d23 = calculateDistance(lat2, lon2, lat3, lon3);
  
  if (d13 === 0) return d23;
  if (d23 === 0) return d13;

  // Projection
  const cosθ = (d13 * d13 + d23 * d23 - calculateDistance(lat1, lon1, lat2, lon2) ** 2) / (2 * d13 * d23);
  const sinθ = Math.sqrt(1 - cosθ * cosθ);
  
  return d13 * sinθ;
}

// ============================================
// 5. CALCUL DE DISTANCE (Haversine)
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
// 6. REVERSE GEOCODING
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
    console.error("Erreur reverse geocoding:", error);
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
}: GpsRecorderProps) {
  const isRecording = status === "recording";

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

  const watchIdRef = useRef<number | null>(null);
  const latestPoint = points[points.length - 1];
  const lastRawPoint = rawPoints[rawPoints.length - 1];

  // Filtres Kalman (un pour latitude, un pour longitude)
  const latFilterRef = useRef<KalmanFilter | null>(null);
  const lonFilterRef = useRef<KalmanFilter | null>(null);

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
  // FONCTION DE TRAITEMENT DES POINTS
  // ============================================
  const processPoints = async (newPoints: GPSPoint[]) => {
    setIsProcessing(true);

    try {
      let processed = [...newPoints];

      // 1. Filtre de Kalman (si initialisé)
      if (latFilterRef.current && lonFilterRef.current) {
        processed = processed.map((point) => ({
          ...point,
          latitude: latFilterRef.current!.update(point.latitude),
          longitude: lonFilterRef.current!.update(point.longitude),
        }));
      }

      // 2. Lissage bidirectionnel (si assez de points)
      if (processed.length >= 5) {
        processed = smoothPoints(processed, 7);
      }

      // 3. Map Matching (si assez de points et route)
      if (processed.length >= 3 && route) {
        try {
          const matched = await mapMatchPoints(processed);
          if (matched.length > 0) {
            processed = matched;
          }
        } catch (e) {
          console.log('Map Matching non disponible, utilisation des points lissés');
        }
      }

      // 4. Simplification (Douglas-Peucker)
      if (processed.length >= 10) {
        processed = douglasPeucker(processed, 5);
      }

      // Mettre à jour les points affichés
      setPoints(processed);
      onPointsChange?.(processed);

      // Calculer la distance
      if (processed.length >= 2) {
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
    } catch (error) {
      console.error('Erreur lors du traitement des points:', error);
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

    if (!navigator.geolocation) {
      setError("La géolocalisation n'est pas disponible sur cet appareil.");
      setGpsStatus("Indisponible");
      return;
    }

    // Réinitialiser
    setPoints([]);
    setRawPoints([]);
    setTotalDistance(0);
    setDuration(0);
    setAddress("");

    // Réinitialiser les filtres Kalman
    latFilterRef.current = null;
    lonFilterRef.current = null;

    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        // Filtres de qualité
        if (position.coords.accuracy > 30) {
          console.log(`❌ Point ignoré – précision: ${position.coords.accuracy}m`);
          return;
        }

        if (position.coords.speed !== null && position.coords.speed > 40) {
          console.log(`❌ Point ignoré – vitesse: ${position.coords.speed}m/s`);
          return;
        }

        const newPoint: GPSPoint = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed,
          timestamp: position.timestamp,
        };

        // Initialiser les filtres Kalman avec le premier point
        if (!latFilterRef.current) {
          latFilterRef.current = new KalmanFilter(newPoint.latitude, 0.01, 5);
          lonFilterRef.current = new KalmanFilter(newPoint.longitude, 0.01, 5);
        }

        // Ajouter le point brut
        setRawPoints((prev) => {
          const updated = [...prev, newPoint];
          
          // Traiter les points
          if (updated.length >= 3) {
            processPoints(updated);
          } else {
            // Points initiaux (pas de filtrage avancé)
            setPoints(updated);
            onPointsChange?.(updated);
          }

          return updated;
        });

        // Détection des arrêts
        if (lastRawPoint && position.coords.speed !== null && position.coords.speed < 0.5) {
          const timeDiff = (position.timestamp - lastRawPoint.timestamp) / 1000;
          if (timeDiff > 30) {
            console.log(`🛑 Arrêt détecté – durée: ${Math.round(timeDiff)}s`);
          }
        }

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

  // Suivi GPS en direct
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
      {/* Statut GPS avec indicateur de traitement */}
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
          
          {/* Afficher les coordonnées si disponibles */}
          {latestPoint && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-gray-50 p-2">
                  <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Latitude</p>
                  <p className="text-sm font-mono font-bold text-gray-900">
                    {latestPoint.latitude.toFixed(6)}
                  </p>
                </div>
                <div className="rounded-xl bg-gray-50 p-2">
                  <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Longitude</p>
                  <p className="text-sm font-mono font-bold text-gray-900">
                    {latestPoint.longitude.toFixed(6)}
                  </p>
                </div>
              </div>
              {latestPoint.accuracy && (
                <div className="rounded-xl bg-gray-50 p-2">
                  <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Précision</p>
                  <p className="text-sm font-bold text-gray-900">{latestPoint.accuracy} m</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
                  }
