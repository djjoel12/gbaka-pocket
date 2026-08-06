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

  const isRecording = status === "recording";

  return (
    <>
      {/* ÉTAT ENREGISTREMENT */}
      {isRecording && !showPriceInput && (
        <div className="flex items-center gap-4 flex-wrap">
          {/* Points */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-white/30">📊</span>
            <span className="text-sm font-bold text-white">{points.length}</span>
          </div>

          {/* Distance */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-white/30">📏</span>
            <span className="text-sm text-white">
              {totalDistance > 0 ? `${(totalDistance / 1000).toFixed(1)} km` : "--"}
            </span>
          </div>

          {/* Vitesse */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-white/30">🏎️</span>
            <span className="text-sm font-medium text-white/70">{formatSpeed(currentSpeed)}</span>
          </div>

          {/* Arrêts */}
          {stops.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-white/30">🛑</span>
              <span className="text-sm text-white">{stops.length}</span>
            </div>
          )}

          {/* Temps */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-white/30">⏱️</span>
            <span className="text-sm text-white">{formatTime(elapsedTime)}</span>
          </div>

          {/* Qualité */}
          {points.length > 10 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-white/30">📈</span>
              <span className="text-sm text-green-500">{calculateQuality(points)}%</span>
            </div>
          )}

          {/* Bouton Terminer */}
          <button
            onClick={stopRecording}
            className="ml-2 rounded-lg border border-white/20 px-4 py-2 text-sm font-bold text-white hover:bg-white/10 transition"
          >
            ⏹ Terminer
          </button>

          {/* Sauvegardé */}
          {tripSaved && (
            <span className="text-xs text-green-500">✅ Sauvegardé</span>
          )}
        </div>
      )}

      {/* DEMANDE DE PRIX */}
      {showPriceInput && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-white font-medium">💰 Prix ?</span>
          <input
            type="number"
            value={finalPrice}
            onChange={(e) => setFinalPrice(e.target.value)}
            placeholder="250"
            className="w-24 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white text-center outline-none focus:border-white/30"
            autoFocus
          />
          <button
            onClick={handlePriceSubmit}
            disabled={!finalPrice || parseInt(finalPrice) <= 0}
            className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-black disabled:opacity-40 hover:scale-[1.02] transition"
          >
            ✅ Sauvegarder
          </button>
          <button
            onClick={() => {
              setShowPriceInput(false);
              setStatus("paused");
              setGpsStatus("Terminé");
            }}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/40 hover:bg-white/5 transition"
          >
            Passer
          </button>
          {error && (
            <span className="text-xs text-red-400">{error}</span>
          )}
        </div>
      )}
    </>
  );
  }
