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
  price?: string;
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
  price = "",
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
  const [showPriceInput, setShowPriceInput] = useState(false);
  const [finalPrice, setFinalPrice] = useState(price || "");

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
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const formatSpeed = (speed: number | null) => {
    if (speed === null || speed < 0) return "--";
    const kmh = speed * 3.6;
    return `${kmh.toFixed(0)} km/h`;
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
      setError("La géolocalisation n'est pas disponible.");
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
    setShowPriceInput(false);
    lastPointRef.current = null;
    onLivePositionChange(null);
    setGpsStatus("Recherche GPS...");
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

        setCurrentSpeed(position.coords.speed);
        onLivePositionChange(newPoint);

        if (newPoint.accuracy > maxAccuracy) {
          setGpsStatus(`Précision ${Math.round(newPoint.accuracy)}m`);
          return;
        }

        if (lastPointRef.current === null) {
          setPoints([newPoint]);
          onPointsChange([newPoint]);
          lastPointRef.current = newPoint;
          setGpsStatus("Enregistrement");
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
          return;
        }

        setPoints((previousPoints) => {
          const updatedPoints = [...previousPoints, newPoint];
          onPointsChange(updatedPoints);
          
          if (updatedPoints.length % 10 === 0) {
            const detectedStops = detectStops(updatedPoints);
            setStops(detectedStops);
          }
          
          return updatedPoints;
        });

        setTotalDistance((previousDistance) => previousDistance + distance);
        lastPointRef.current = newPoint;
        setGpsStatus("Enregistrement");
      },

      (gpsError) => {
        console.error("Erreur GPS :", gpsError);
        if (gpsError.code === 1) {
          setError("Autorisez la localisation.");
        } else {
          setError("Erreur GPS.");
        }
        setGpsStatus("Erreur");
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
  // SAUVEGARDE
  // ============================================
  const saveTripWithPrice = async (tripPrice: number) => {
    if (points.length === 0) {
      setError("Aucun point GPS enregistré");
      return;
    }

    try {
      const detectedStops = await detectStops(points);
      
      let endName = endPointName;
      if (!endName && detectedStops.length > 0) {
        const lastStop = detectedStops[detectedStops.length - 1];
        endName = await reverseGeocode(
          lastStop.coordinates[0],
          lastStop.coordinates[1]
        );
      }

      const startPoint = detectedStops.length > 0 ? detectedStops[0] : null;
      const endPoint = detectedStops.length > 1 ? detectedStops[detectedStops.length - 1] : null;
      const averageSpeed = calculateAverageSpeed(points);
      const maxSpeed = calculateMaxSpeed(points);
      const movingTime = calculateMovingTime(points);
      const stoppedTime = elapsedTime - movingTime;
      const quality = calculateQuality(points);
      
      const distanceKm = totalDistance / 1000;
      const pricePerKm = distanceKm > 0 ? tripPrice / distanceKm : 0;

      const tripData: TripData = {
        id: Date.now().toString(),
        line: lineInfo || null,
        destination: destination || "Trajet",
        startPointName: startPointName || "Départ inconnu",
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
        price: tripPrice,
        pricePerKm: pricePerKm,
        notes: "",
      };

      saveTrip(tripData);
      setTripSaved(true);
      setShowPriceInput(false);

      setStatus("paused");
      setGpsStatus("Terminé");
      setCurrentSpeed(null);

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

    } catch (error) {
      console.error("Erreur sauvegarde:", error);
      setError("Erreur lors de la sauvegarde");
    }
  };

  // ============================================
  // TERMINER
  // ============================================
  const stopRecording = () => {
    stopGPS();

    if (points.length === 0) {
      setError("Aucun point GPS enregistré.");
      setStatus("idle");
      return;
    }

    const priceValue = price && parseInt(price) > 0 ? parseInt(price) : 0;

    if (priceValue > 0) {
      saveTripWithPrice(priceValue);
    } else {
      setShowPriceInput(true);
    }
  };

  // ============================================
  // VALIDATION PRIX
  // ============================================
  const handlePriceSubmit = () => {
    const priceValue = parseInt(finalPrice);
    if (priceValue > 0) {
      saveTripWithPrice(priceValue);
    } else {
      setError("Veuillez saisir un prix valide");
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
      setShowPriceInput(false);
      setFinalPrice("");
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

  const isRecording = status === "recording";

  return (
    <>
      {/* ===== STATS PROPREMENT ORGANISÉES ===== */}
      {isRecording && !showPriceInput && (
        <>
          {/* Grille 3x2 */}
          <div className="grid grid-cols-3 gap-3 w-full">
            
            {/* Carte 1 : Points */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
              <p className="text-xs text-white/40 font-medium uppercase tracking-wider">Points</p>
              <p className="text-2xl font-bold text-white mt-1">{points.length}</p>
            </div>

            {/* Carte 2 : Distance */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
              <p className="text-xs text-white/40 font-medium uppercase tracking-wider">Distance</p>
              <p className="text-2xl font-bold text-white mt-1">
                {totalDistance > 0 ? `${(totalDistance / 1000).toFixed(1)} km` : "--"}
              </p>
            </div>

            {/* Carte 3 : Vitesse */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
              <p className="text-xs text-white/40 font-medium uppercase tracking-wider">Vitesse</p>
              <p className="text-2xl font-bold text-white mt-1">{formatSpeed(currentSpeed)}</p>
            </div>

            {/* Carte 4 : Temps */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
              <p className="text-xs text-white/40 font-medium uppercase tracking-wider">Temps</p>
              <p className="text-2xl font-bold text-white mt-1">{formatTime(elapsedTime)}</p>
            </div>

            {/* Carte 5 : Arrêts */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
              <p className="text-xs text-white/40 font-medium uppercase tracking-wider">Arrêts</p>
              <p className="text-2xl font-bold text-white mt-1">{stops.length}</p>
            </div>

            {/* Carte 6 : Qualité */}
            <div className="bg-white/5 border border-green-500/20 rounded-xl p-3 text-center">
              <p className="text-xs text-white/40 font-medium uppercase tracking-wider">Qualité</p>
              <p className="text-2xl font-bold text-green-500 mt-1">
                {points.length > 10 ? `${calculateQuality(points)}%` : "--"}
              </p>
            </div>
          </div>

          {/* GPS Status */}
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/40">🛰️</span>
              <span className="text-xs text-white/50">{gpsStatus}</span>
            </div>

            {/* Bouton Terminer */}
            <button
              onClick={stopRecording}
              className="rounded-lg bg-red-600 border-2 border-red-400 px-6 py-2.5 text-sm font-bold text-white hover:bg-red-700 hover:scale-105 transition shadow-lg shadow-red-500/20"
            >
              ⏹ Terminer le trajet
            </button>

            {tripSaved && (
              <span className="text-sm text-green-500 font-bold">✅ Sauvegardé</span>
            )}
          </div>
        </>
      )}

      {/* ===== DEMANDE DE PRIX ===== */}
      {showPriceInput && (
        <div className="flex flex-wrap items-center gap-4 p-4 bg-white/5 rounded-lg border border-white/10 w-full">
          <div className="flex items-center gap-3">
            <span className="text-lg">💰</span>
            <span className="text-base font-bold text-white">Prix du trajet ?</span>
          </div>
          <input
            type="number"
            value={finalPrice}
            onChange={(e) => setFinalPrice(e.target.value)}
            placeholder="250"
            className="w-28 bg-white/10 border border-white/15 rounded-lg px-4 py-2.5 text-base text-white text-center outline-none focus:border-white/30"
            autoFocus
          />
          <div className="flex gap-3">
            <button
              onClick={handlePriceSubmit}
              disabled={!finalPrice || parseInt(finalPrice) <= 0}
              className="rounded-lg bg-white px-5 py-2.5 text-sm font-bold text-black hover:scale-105 disabled:opacity-40 transition"
            >
              ✅ Sauvegarder
            </button>
            <button
              onClick={() => {
                setShowPriceInput(false);
                setStatus("paused");
                setGpsStatus("Terminé");
              }}
              className="rounded-lg border border-white/10 px-5 py-2.5 text-sm text-white/40 hover:bg-white/5 transition"
            >
              Passer
            </button>
          </div>
          {error && <span className="text-sm text-red-400">{error}</span>}
        </div>
      )}
    </>
  );
}
