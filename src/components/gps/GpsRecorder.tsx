"use client";

import {
  Dispatch,
  SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";

import type { GPSPoint, TripData, LineInfo, StopPoint } from "@/types/trip";
import {
  calculateDistance,
  detectStops,
  calculateQuality,
  calculateAverageSpeed,
  calculateMaxSpeed,
  calculateMovingTime,
  saveTrip,
  reverseGeocode,
} from "@/utils/tripUtils";

type GpsRecorderProps = {
  status: "idle" | "recording" | "paused";
  setStatus: Dispatch<SetStateAction<"idle" | "recording" | "paused">>;
  onPointsChange: (points: GPSPoint[]) => void;
  onLivePositionChange: (point: GPSPoint | null) => void;
  destination?: string;
  lineInfo?: LineInfo | null;
  startPointName?: string;
  endPointName?: string;
  minDistance?: number;
  maxAccuracy?: number;
};

function detectSpike(
  previousPoint: GPSPoint | null,
  newPoint: GPSPoint,
  maxJump = 100
): boolean {
  if (!previousPoint) return false;

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
  lineInfo = null,
  startPointName = "",
  endPointName = "",
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
  const [tripSaved, setTripSaved] = useState(false);
  const [stops, setStops] = useState<StopPoint[]>([]);

  const watchIdRef = useRef<number | null>(null);
  const lastPointRef = useRef<GPSPoint | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // ============================================
  // CHRONOMÈTRE
  // ============================================

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

  // ============================================
  // NETTOYAGE GPS
  // ============================================

  const stopGPS = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      console.log("GPS arrêté correctement");
    }
  };

  // ============================================
  // FORMATAGE
  // ============================================

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const formatSpeed = (speed: number | null) => {
    if (speed === null || speed < 0) return "--";
    const kmh = speed * 3.6;
    return `${kmh.toFixed(1)} km/h`;
  };

  // ============================================
  // DÉMARRER ENREGISTREMENT
  // ============================================

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
    setTripSaved(false);
    setStops([]);
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
          console.log(
            `Position ignorée : précision ${newPoint.accuracy.toFixed(1)}m`
          );
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
          
          // Détection des arrêts en temps réel (mise à jour périodique)
          if (updatedPoints.length % 10 === 0) {
            const detectedStops = detectStops(updatedPoints);
            setStops(detectedStops);
          }
          
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

  // ============================================
  // TERMINER LE TRAJET
  // ============================================

  const stopRecording = async () => {
    stopGPS();
    setStatus("paused");
    setGpsStatus("Trajet terminé");
    setCurrentSpeed(null);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // ===== ANALYSE COMPLÈTE DU TRAJET =====
    if (points.length > 0) {
      // 1. Détection des arrêts
      const detectedStops = await detectStops(points);
      
      // 2. Géocodage du point de départ et d'arrivée
      let startName = startPointName;
      let endName = endPointName;
      
      if (detectedStops.length > 0) {
        // Premier point = départ
        if (!startName) {
          startName = await reverseGeocode(
            detectedStops[0].coordinates[0],
            detectedStops[0].coordinates[1]
          );
        }
        
        // Dernier point = arrivée
        if (!endName) {
          const lastStop = detectedStops[detectedStops.length - 1];
          endName = await reverseGeocode(
            lastStop.coordinates[0],
            lastStop.coordinates[1]
          );
        }
      }

      const startPoint = detectedStops.length > 0 ? detectedStops[0] : null;
      const endPoint = detectedStops.length > 1 ? detectedStops[detectedStops.length - 1] : null;
      const averageSpeed = calculateAverageSpeed(points);
      const maxSpeed = calculateMaxSpeed(points);
      const movingTime = calculateMovingTime(points);
      const stoppedTime = elapsedTime - movingTime;
      const quality = calculateQuality(points);

      const tripData: TripData = {
        id: Date.now().toString(),
        line: lineInfo || null,
        destination: destination || "Trajet sans destination",
        startPointName: startName || "Départ inconnu",
        endPointName: endName || "Arrivée inconnue",
        points: points,
        startPoint: startPoint,
        endPoint: endPoint,
        stops: detectedStops,
        totalDistance: totalDistance,
        duration: elapsedTime,
        averageSpeed: averageSpeed,
        maxSpeed: maxSpeed,
        movingTime: movingTime,
        stoppedTime: stoppedTime > 0 ? stoppedTime : 0,
        date: new Date().toISOString(),
        quality: quality,
        isComplete: true,
        notes: "",
      };

      // Sauvegarder le trajet
      saveTrip(tripData);
      setTripSaved(true);

      console.log("✅ Trajet enregistré :", tripData);
      console.log(`📊 ${points.length} points GPS`);
      console.log(`📏 Distance : ${(totalDistance / 1000).toFixed(2)} km`);
      console.log(`⏱️ Durée : ${formatTime(elapsedTime)}`);
      console.log(`🏎️ Vitesse moyenne : ${averageSpeed.toFixed(1)} km/h`);
      console.log(`🛑 Arrêts : ${detectedStops.length}`);
      console.log(`📍 Départ : ${startName}`);
      console.log(`📍 Arrivée : ${endName}`);
      console.log(`📈 Qualité : ${quality}%`);
    } else {
      console.log("⚠️ Aucun point enregistré, trajet ignoré");
    }
  };

  // ============================================
  // RESET
  // ============================================

  useEffect(() => {
    if (status === "idle") {
      stopGPS();
      setPoints([]);
      setTotalDistance(0);
      setError("");
      setGpsStatus("En attente");
      setCurrentSpeed(null);
      setTripSaved(false);
      setStops([]);
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

  // ============================================
  // NETTOYAGE
  // ============================================

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
      {/* STATUT GPS */}
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
            {stops.length > 0 && <span>🛑 {stops.length} arrêts</span>}
          </div>
        )}

        {tripSaved && (
          <div className="mt-2 rounded-lg bg-green-500/20 p-2 text-center text-xs text-green-400">
            ✅ Trajet sauvegardé avec succès !
          </div>
        )}
      </div>

      {/* INFOS TRAJET */}
      {destination && (
        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-3 backdrop-blur-sm">
          <p className="text-center text-sm text-blue-400">
            🎯 Destination :{" "}
            <span className="font-bold text-white">{destination}</span>
          </p>
          {lineInfo && (
            <p className="mt-1 text-center text-xs text-purple-400">
              🚌 Ligne : <span className="font-bold text-white">{lineInfo.name}</span>
            </p>
          )}
        </div>
      )}

      {/* ERREUR */}
      {error && (
        <div className="rounded-2xl bg-red-500/20 p-3 text-sm text-red-400">
          ⚠️ {error}
        </div>
      )}

      {/* BOUTON TERMINER */}
      {isRecording && (
        <button
          onClick={stopRecording}
          className="w-full rounded-2xl bg-red-600 px-5 py-4 font-bold text-white shadow-lg shadow-red-600/30 transition hover:bg-red-700"
        >
          ⏹ Terminer le trajet
        </button>
      )}

      {/* STATS */}
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
          <div className="rounded-2xl border border-purple-500/20 bg-purple-500/10 p-3 backdrop-blur-sm">
            <p className="text-xs text-purple-400/60">ARRÊTS</p>
            <p className="mt-1 text-lg font-bold text-purple-400">
              {stops.length}
            </p>
          </div>
          <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-3 backdrop-blur-sm">
            <p className="text-xs text-green-400/60">QUALITÉ</p>
            <p className="mt-1 text-lg font-bold text-green-400">
              {points.length > 0 ? `${calculateQuality(points)}%` : "--"}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
            <p className="text-xs text-white/40">TEMPS</p>
            <p className="mt-1 text-lg font-bold text-white">
              {formatTime(elapsedTime)}
            </p>
          </div>
        </div>
      )}

      {/* DERNIER POINT */}
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
              <div className="col-span-2 mt-1 border-t border-white/5 pt-1">
                <span className="text-white/40">Vitesse</span>
                <span className="ml-2 font-mono text-yellow-400">
                  {formatSpeed(currentSpeed)}
                </span>
              </div>
            )}
            {stops.length > 0 && (
              <div className="col-span-2 mt-1 border-t border-white/5 pt-1">
                <span className="text-white/40">Arrêts détectés</span>
                <span className="ml-2 font-mono text-purple-400">
                  {stops.length}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}