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
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ/2)**2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// ============================================
// 1. FILTRE DE KALMAN
// ============================================
class KalmanFilter {
  private Q: number;
  private R: number;
  private P: number;
  private K: number;
  private x: number;

  constructor(initialValue: number, Q: number = 0.01, R: number = 10) {
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
// 2. DÉTECTION DES SAUTS
// ============================================
function detectSpike(
  previousPoint: GPSPoint | null,
  newPoint: GPSPoint,
  maxJump: number = 50
): boolean {
  if (!previousPoint) return false;
  
  const dist = calculateDistance(
    previousPoint.latitude,
    previousPoint.longitude,
    newPoint.latitude,
    newPoint.longitude
  );
  
  if (dist > maxJump) {
    console.log(`🔄 Saut: ${dist.toFixed(0)}m → IGNORÉ`);
    return true;
  }
  return false;
}

// ============================================
// 3. LISSAGE ADAPTATIF
// ============================================
function adaptiveSmooth(
  points: GPSPoint[], 
  newPoint: GPSPoint
): GPSPoint {
  const accuracy = newPoint.accuracy;
  
  if (accuracy < 15) {
    const lastPoints = points.slice(-2);
    if (lastPoints.length < 2) return newPoint;
    
    const allPoints = [...lastPoints, newPoint];
    const avgLat = allPoints.reduce((sum, p) => sum + p.latitude, 0) / allPoints.length;
    const avgLon = allPoints.reduce((sum, p) => sum + p.longitude, 0) / allPoints.length;
    
    return { ...newPoint, latitude: avgLat, longitude: avgLon };
  }
  
  const lastPoints = points.slice(-4);
  if (lastPoints.length < 4) return newPoint;
  
  const allPoints = [...lastPoints, newPoint];
  const avgLat = allPoints.reduce((sum, p) => sum + p.latitude, 0) / allPoints.length;
  const avgLon = allPoints.reduce((sum, p) => sum + p.longitude, 0) / allPoints.length;
  
  return { ...newPoint, latitude: avgLat, longitude: avgLon };
}

export default function GpsRecorder({
  status = "idle",
  setStatus,
  onPointsChange,
  route,
  minDistance = 10,
  maxAccuracy = 25,
}: GpsRecorderProps) {
  const isRecording = status === "recording";

  const [gpsStatus, setGpsStatus] = useState<string>("En attente");
  const [points, setPoints] = useState<GPSPoint[]>([]);
  const [error, setError] = useState<string>("");
  const [totalDistance, setTotalDistance] = useState<number>(0);
  const [isStopped, setIsStopped] = useState<boolean>(false);
  const [isFirstPoint, setIsFirstPoint] = useState<boolean>(true);

  const watchIdRef = useRef<number | null>(null);
  const lastPositionRef = useRef<GPSPoint | null>(null);
  const latFilterRef = useRef<KalmanFilter | null>(null);
  const lonFilterRef = useRef<KalmanFilter | null>(null);
  const isFirstPointRef = useRef<boolean>(true);

  const latestPoint = points[points.length - 1];

  // Nettoyage au changement de route
  useEffect(() => {
    setPoints([]);
    setTotalDistance(0);
    setError("");
    setGpsStatus("En attente");
    setIsStopped(false);
    setIsFirstPoint(true);
    isFirstPointRef.current = true;
    lastPositionRef.current = null;
    latFilterRef.current = null;
    lonFilterRef.current = null;
    onPointsChange?.([]);
  }, [route, onPointsChange]);

  // ✅ Fonction pour ajouter un point immédiatement
  const addPointImmediate = (point: GPSPoint) => {
    console.log("✅ AJOUT IMMÉDIAT:", point.latitude, point.longitude);
    
    setPoints((prev) => {
      const updated = [...prev, point];
      onPointsChange?.(updated);
      return updated;
    });
    
    lastPositionRef.current = point;
    setIsFirstPoint(false);
    isFirstPointRef.current = false;
  };

  const startRecording = () => {
    setError("");
    setGpsStatus("Recherche de votre position…");
    setIsStopped(false);
    setIsFirstPoint(true);
    isFirstPointRef.current = true;

    if (!navigator.geolocation) {
      setError("La géolocalisation n'est pas disponible.");
      setGpsStatus("Indisponible");
      return;
    }

    setPoints([]);
    setTotalDistance(0);
    lastPositionRef.current = null;
    latFilterRef.current = null;
    lonFilterRef.current = null;
    onPointsChange?.([]);

    // ✅ ÉTAPE 1 : Récupérer la position immédiatement
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log("📍 POSITION INITIALE RÉCUPÉRÉE");
        
        // Créer le point
        let newPoint: GPSPoint = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed,
          timestamp: position.timestamp,
        };

        // Initialiser les filtres Kalman
        if (!latFilterRef.current) {
          latFilterRef.current = new KalmanFilter(newPoint.latitude);
          lonFilterRef.current = new KalmanFilter(newPoint.longitude);
        }

        // Appliquer le filtre Kalman
        if (latFilterRef.current && lonFilterRef.current) {
          newPoint = {
            ...newPoint,
            latitude: latFilterRef.current.update(newPoint.latitude),
            longitude: lonFilterRef.current.update(newPoint.longitude),
          };
        }

        // ✅ AJOUTER LE POINT IMMÉDIATEMENT
        addPointImmediate(newPoint);

        // Mettre à jour le statut
        setGpsStatus("Enregistrement en cours");
        if (status !== "recording") {
          setStatus?.("recording");
        }
      },
      (error) => {
        console.error("❌ Erreur position initiale:", error);
        // Si la position immédiate échoue, on utilise le watch
        setGpsStatus("En attente de position...");
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 2000,
      }
    );

    // ✅ ÉTAPE 2 : Démarrer le suivi continu
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        console.log("📍 POSITION CONTINUE:", position.coords.latitude, position.coords.longitude);
        
        // Filtre de précision
        if (position.coords.accuracy > maxAccuracy) {
          console.log(`❌ Précision: ${position.coords.accuracy}m`);
          return;
        }

        // Créer le point brut
        let newPoint: GPSPoint = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed,
          timestamp: position.timestamp,
        };

        // Détection des sauts
        if (detectSpike(lastPositionRef.current, newPoint, 50)) {
          return;
        }

        // Initialisation des filtres Kalman (si pas déjà fait)
        if (!latFilterRef.current) {
          latFilterRef.current = new KalmanFilter(newPoint.latitude);
          lonFilterRef.current = new KalmanFilter(newPoint.longitude);
        }

        // Application du filtre Kalman
        if (latFilterRef.current && lonFilterRef.current) {
          newPoint = {
            ...newPoint,
            latitude: latFilterRef.current.update(newPoint.latitude),
            longitude: lonFilterRef.current.update(newPoint.longitude),
          };
        }

        // Lissage adaptatif
        newPoint = adaptiveSmooth(points, newPoint);

        // Vérifier la distance
        if (lastPositionRef.current) {
          const dist = calculateDistance(
            lastPositionRef.current.latitude,
            lastPositionRef.current.longitude,
            newPoint.latitude,
            newPoint.longitude
          );

          if (dist < minDistance) {
            console.log(`❌ Trop proche: ${dist.toFixed(1)}m`);
            return;
          }

          setTotalDistance((prev) => prev + dist);
        }

        // ✅ Ajouter le point
        setPoints((prev) => {
          const updated = [...prev, newPoint];
          onPointsChange?.(updated);
          return updated;
        });

        lastPositionRef.current = newPoint;
        setIsFirstPoint(false);
        isFirstPointRef.current = false;

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
          setError("Autorisez la localisation.");
        } else if (err.code === 2) {
          setError("Position GPS indisponible.");
        } else {
          setError("Erreur de géolocalisation.");
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
      {/* Statut GPS */}
      <div className="rounded-2xl bg-white/70 p-5 shadow-lg border border-gray-100/50 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`h-3 w-3 rounded-full animate-pulse ${
              isRecording ? "bg-green-500" : isStopped ? "bg-gray-500" : "bg-orange-500"
            }`} />
            <span className="font-semibold text-gray-700">Statut GPS</span>
          </div>
          <span className={`text-sm font-medium ${
            isRecording ? "text-green-600" : isStopped ? "text-gray-600" : "text-orange-600"
          }`}>
            {gpsStatus}
          </span>
        </div>
        {isRecording && (
          <div className="mt-2 text-xs text-gray-500">
            ✅ Points: {points.length} 
            {latestPoint && ` | 🎯 Précision: ${latestPoint.accuracy.toFixed(0)}m`}
            {isFirstPoint && points.length > 0 && ` | ⚡ Premier point capturé !`}
          </div>
        )}
      </div>

      {/* Erreur */}
      {error && (
        <div className="rounded-2xl bg-red-50/80 p-4 text-sm text-red-700 border border-red-200/50">
          ⚠️ {error}
        </div>
      )}

      {/* Boutons */}
      {!isRecording ? (
        <button
          onClick={startRecording}
          disabled={!route}
          className={`w-full rounded-2xl px-5 py-4 font-bold text-white shadow-lg transition-all duration-300 ${
            route 
              ? "bg-gradient-to-r from-blue-600 to-blue-700 shadow-blue-600/30 hover:scale-[1.02] active:scale-[0.98] cursor-pointer" 
              : "bg-gray-400 shadow-gray-400/30 cursor-not-allowed opacity-50"
          }`}
        >
          <span className="flex items-center justify-center gap-2">
            <span className="text-xl">📍</span> Démarrer le trajet
          </span>
        </button>
      ) : (
        <button
          onClick={stopRecording}
          className="w-full rounded-2xl bg-gradient-to-r from-red-600 to-red-700 px-5 py-4 font-bold text-white shadow-lg shadow-red-600/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <span className="flex items-center justify-center gap-2">
            <span className="text-xl">⏹</span> Terminer le trajet
          </span>
        </button>
      )}

      {/* Infos */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white/70 p-3 shadow-lg border border-gray-100/50">
          <p className="text-xs font-medium text-gray-500 uppercase">Points</p>
          <p className="text-xl font-bold text-gray-900">{points.length}</p>
        </div>
        <div className="rounded-2xl bg-white/70 p-3 shadow-lg border border-gray-100/50">
          <p className="text-xs font-medium text-gray-500 uppercase">Distance</p>
          <p className="text-xl font-bold text-gray-900">
            {totalDistance > 0 ? `${(totalDistance / 1000).toFixed(2)} km` : "--"}
          </p>
        </div>
      </div>

      {/* Dernière position */}
      {latestPoint && (
        <div className="rounded-2xl bg-white/70 p-5 shadow-lg border border-gray-100/50">
          <h2 className="font-bold text-gray-900 mb-3">🛰️ Dernière position</h2>
          <div className="space-y-2">
            <div className="flex justify-between p-2 rounded-xl bg-gray-50/50">
              <span className="text-sm text-gray-500">Latitude</span>
              <span className="font-mono text-sm font-semibold">
                {latestPoint.latitude.toFixed(6)}
              </span>
            </div>
            <div className="flex justify-between p-2 rounded-xl bg-gray-50/50">
              <span className="text-sm text-gray-500">Longitude</span>
              <span className="font-mono text-sm font-semibold">
                {latestPoint.longitude.toFixed(6)}
              </span>
            </div>
            <div className="flex justify-between p-2 rounded-xl bg-gray-50/50">
              <span className="text-sm text-gray-500">Précision</span>
              <span className={`font-semibold text-sm ${
                latestPoint.accuracy < 15 ? "text-green-600" :
                latestPoint.accuracy < 25 ? "text-yellow-600" : "text-red-600"
              }`}>
                {Math.round(latestPoint.accuracy)} m
              </span>
            </div>
            {latestPoint.speed !== null && (
              <div className="flex justify-between p-2 rounded-xl bg-gray-50/50">
                <span className="text-sm text-gray-500">Vitesse</span>
                <span className="font-semibold text-sm text-gray-900">
                  {(latestPoint.speed * 3.6).toFixed(1)} km/h
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
    }
