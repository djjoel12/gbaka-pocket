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
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const formatSpeed = (speed: number | null) => {
    if (speed === null || speed < 0) return "--";
    const kmh = speed * 3.6;
    return `${kmh.toFixed(0)} km/h`;
  };

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
    setGpsStatus("Recherche...");
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

  const saveTripWithPrice = async (tripPrice: number) => {
    if (points.length === 0) {
      console.log("⚠️ Aucun point enregistré");
      return;
    }

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

    console.log("✅ Trajet enregistré :", tripData);

    setStatus("paused");
    setGpsStatus("Terminé");
    setCurrentSpeed(null);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const stopRecording = async () => {
    stopGPS();

    if (price && parseInt(price) > 0) {
      await saveTripWithPrice(parseInt(price));
    } else {
      setShowPriceInput(true);
    }
  };

  const handlePriceSubmit = () => {
    const priceValue = parseInt(finalPrice);
    if (priceValue > 0) {
      saveTripWithPrice(priceValue);
    } else {
      setError("Prix valide");
    }
  };

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
    <div className="space-y-1.5 text-xs">
      {/* STATUT GPS */}
      <div className="rounded-lg bg-white/10 backdrop-blur-sm border border-white/15 p-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div
              className={`h-1.5 w-1.5 rounded-full ${
                isRecording ? "animate-pulse bg-emerald-300" : "bg-white/30"
              }`}
            />
            <span className="text-[10px] font-medium text-white/80">GPS</span>
          </div>
          <span className="text-[8px] text-white/60">{gpsStatus}</span>
        </div>

        {isRecording && (
          <div className="mt-0.5 flex justify-between text-[8px] text-white/50">
            <span>{points.length} pts</span>
            {elapsedTime > 0 && <span>⏱ {formatTime(elapsedTime)}</span>}
            {stops.length > 0 && <span>🛑 {stops.length}</span>}
          </div>
        )}

        {tripSaved && (
          <div className="mt-1 rounded bg-emerald-500/20 px-1 py-0.5 text-center text-[8px] text-emerald-200">
            ✅ Sauvegardé
          </div>
        )}
      </div>

      {/* DEMANDE DE PRIX */}
      {showPriceInput && (
        <div className="rounded-lg bg-yellow-500/20 border border-yellow-500/30 p-2 text-center">
          <p className="text-[10px] font-bold text-white">💰 Prix ?</p>
          <div className="mt-1 flex gap-1">
            <input
              type="number"
              value={finalPrice}
              onChange={(e) => setFinalPrice(e.target.value)}
              placeholder="250"
              className="flex-1 rounded bg-white/10 border border-white/20 px-1.5 py-1 text-xs text-white text-center outline-none"
              autoFocus
            />
            <button
              onClick={handlePriceSubmit}
              disabled={!finalPrice || parseInt(finalPrice) <= 0}
              className="rounded bg-gradient-to-r from-yellow-400 to-orange-400 px-2 py-1 text-[10px] font-bold text-white disabled:opacity-40"
            >
              ✅
            </button>
          </div>
        </div>
      )}

      {/* INFOS */}
      {destination && (
        <div className="rounded-lg bg-white/5 border border-white/10 p-1.5 text-center">
          <p className="text-[10px] text-white font-medium truncate">🎯 {destination}</p>
          {lineInfo && (
            <p className="text-[8px] text-sky-200 truncate">🚌 {lineInfo.name}</p>
          )}
          {price && parseInt(price) > 0 && (
            <p className="text-[8px] text-yellow-200">💰 {price} FCFA</p>
          )}
        </div>
      )}

      {/* ERREUR */}
      {error && !showPriceInput && (
        <div className="rounded-lg bg-rose-500/20 border border-rose-500/30 p-1.5 text-[8px] text-rose-200">
          ⚠️ {error}
        </div>
      )}

      {/* BOUTON TERMINER */}
      {isRecording && !showPriceInput && (
        <button
          onClick={stopRecording}
          className="w-full rounded-lg bg-rose-500 px-2 py-1.5 text-[10px] font-bold text-white shadow-lg shadow-rose-500/30 hover:bg-rose-600"
        >
          ⏹ Terminer
        </button>
      )}

      {/* STATS */}
      {isRecording && !showPriceInput && (
        <div className="grid grid-cols-3 gap-1">
          <div className="rounded-lg bg-white/5 border border-white/10 p-1 text-center">
            <p className="text-[7px] text-white/40">PTS</p>
            <p className="text-[10px] font-bold text-white">{points.length}</p>
          </div>
          <div className="rounded-lg bg-white/5 border border-white/10 p-1 text-center">
            <p className="text-[7px] text-white/40">DIST</p>
            <p className="text-[10px] font-bold text-white">
              {totalDistance > 0 ? `${(totalDistance / 1000).toFixed(1)}` : "--"}
            </p>
          </div>
          <div className="rounded-lg bg-white/5 border border-white/10 p-1 text-center">
            <p className="text-[7px] text-white/40">VIT</p>
            <p className="text-[10px] font-bold text-sky-200">{formatSpeed(currentSpeed)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
