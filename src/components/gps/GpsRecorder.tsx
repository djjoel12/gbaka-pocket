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

  setStatus: Dispatch<
    SetStateAction<"idle" | "recording" | "paused">
  >;

  onPointsChange: (points: GPSPoint[]) => void;

  onLivePositionChange: (
    point: GPSPoint | null
  ) => void;

  route?: string;

  minDistance?: number;

  maxAccuracy?: number;
};

// ============================================
// CALCUL DE DISTANCE GPS
// ============================================

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;

  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;

  const deltaPhi =
    ((lat2 - lat1) * Math.PI) / 180;

  const deltaLambda =
    ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) ** 2;

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return R * c;
}

// ============================================
// DÉTECTION DES GROS SAUTS GPS
// ============================================

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
    console.log(
      `GPS ignoré : saut de ${distance.toFixed(1)} mètres`
    );

    return true;
  }

  return false;
}

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

export default function GpsRecorder({
  status,
  setStatus,
  onPointsChange,
  onLivePositionChange,
  route,
  minDistance = 5,
  maxAccuracy = 50,
}: GpsRecorderProps) {
  const [points, setPoints] =
    useState<GPSPoint[]>([]);

  const [gpsStatus, setGpsStatus] =
    useState("En attente");

  const [error, setError] =
    useState("");

  const [totalDistance, setTotalDistance] =
    useState(0);

  // ID du suivi GPS
  const watchIdRef =
    useRef<number | null>(null);

  // Dernier point réellement enregistré
  const lastPointRef =
    useRef<GPSPoint | null>(null);

  // ============================================
  // NETTOYAGE DU GPS
  // ============================================

  const stopGPS = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(
        watchIdRef.current
      );

      watchIdRef.current = null;

      console.log(
        "GPS arrêté correctement"
      );
    }
  };

  // ============================================
  // DÉMARRER L'ENREGISTREMENT
  // ============================================

  const startRecording = () => {
    if (!navigator.geolocation) {
      setError(
        "La géolocalisation n'est pas disponible sur cet appareil."
      );

      return;
    }

    // Si un GPS était déjà actif,
    // on le ferme avant d'en démarrer un nouveau.
    stopGPS();

    setError("");

    setPoints([]);

    onPointsChange([]);

    setTotalDistance(0);

    lastPointRef.current = null;

    onLivePositionChange(null);

    setGpsStatus(
      "Recherche de votre position..."
    );

    setStatus("recording");

    // ============================================
    // UN SEUL SUIVI GPS
    // ============================================

    const watchId =
      navigator.geolocation.watchPosition(
        (position) => {
          const newPoint: GPSPoint = {
            latitude:
              position.coords.latitude,

            longitude:
              position.coords.longitude,

            accuracy:
              position.coords.accuracy,

            speed:
              position.coords.speed,

            timestamp:
              position.timestamp,
          };

          console.log(
            "Position GPS reçue :",
            newPoint
          );

          // ========================================
          // POSITION EN DIRECT
          // ========================================

          // On envoie toujours la position actuelle
          // pour que la carte puisse nous suivre.
          onLivePositionChange(
            newPoint
          );

          // ========================================
          // FILTRE DE PRÉCISION
          // ========================================

          if (
            newPoint.accuracy >
            maxAccuracy
          ) {
            console.log(
              `Position ignorée : précision ${newPoint.accuracy.toFixed(
                1
              )}m`
            );

            setGpsStatus(
              `GPS imprécis (${Math.round(
                newPoint.accuracy
              )}m)`
            );

            return;
          }

          // ========================================
          // PREMIER POINT
          // ========================================

          if (
            lastPointRef.current === null
          ) {
            setPoints([newPoint]);

            onPointsChange([newPoint]);

            lastPointRef.current =
              newPoint;

            setGpsStatus(
              "Enregistrement en cours"
            );

            console.log(
              "Premier point enregistré"
            );

            return;
          }

          // ========================================
          // DÉTECTION DES SAUTS
          // ========================================

          if (
            detectSpike(
              lastPointRef.current,
              newPoint
            )
          ) {
            return;
          }

          // ========================================
          // CALCUL DE DISTANCE
          // ========================================

          const distance =
            calculateDistance(
              lastPointRef.current.latitude,
              lastPointRef.current.longitude,
              newPoint.latitude,
              newPoint.longitude
            );

          // ========================================
          // IGNORER LES PETITS DÉPLACEMENTS
          // ========================================

          if (
            distance < minDistance
          ) {
            console.log(
              `Déplacement trop faible : ${distance.toFixed(
                1
              )}m`
            );

            return;
          }

          // ========================================
          // AJOUT DU POINT
          // ========================================

          setPoints((previousPoints) => {
            const updatedPoints = [
              ...previousPoints,
              newPoint,
            ];

            onPointsChange(
              updatedPoints
            );

            return updatedPoints;
          });

          // Mise à jour de la distance
          setTotalDistance(
            (previousDistance) =>
              previousDistance +
              distance
          );

          // Le nouveau point devient
          // le dernier point enregistré
          lastPointRef.current =
            newPoint;

          setGpsStatus(
            "Enregistrement en cours"
          );

          console.log(
            `Point enregistré : ${distance.toFixed(
              1
            )}m`
          );
        },

        // ========================================
        // ERREUR GPS
        // ========================================

        (gpsError) => {
          console.error(
            "Erreur GPS :",
            gpsError
          );

          if (gpsError.code === 1) {
            setError(
              "Autorisez la localisation dans votre navigateur."
            );
          } else if (
            gpsError.code === 2
          ) {
            setError(
              "Impossible de déterminer votre position."
            );
          } else if (
            gpsError.code === 3
          ) {
            setError(
              "Le GPS met trop de temps à répondre."
            );
          } else {
            setError(
              "Une erreur GPS est survenue."
            );
          }

          setGpsStatus(
            "Erreur GPS"
          );
        },

        // ========================================
        // OPTIONS GPS
        // ========================================

        {
          enableHighAccuracy: true,

          maximumAge: 0,

          timeout: 15000,
        }
      );

    watchIdRef.current =
      watchId;
  };

  // ============================================
  // TERMINER LE TRAJET
  // ============================================

  const stopRecording = () => {
    stopGPS();

    setStatus("paused");

    setGpsStatus(
      "Trajet terminé"
    );

    console.log(
      "Trajet terminé."
    );

    console.log(
      "Nombre de points :",
      points.length
    );

    console.log(
      "Distance totale :",
      totalDistance
    );
  };

  // ============================================
  // RESET QUAND LA LIGNE CHANGE
  // ============================================

  useEffect(() => {
    stopGPS();

    setPoints([]);

    setTotalDistance(0);

    setError("");

    setGpsStatus(
      "En attente"
    );

    lastPointRef.current = null;

    onPointsChange([]);

    onLivePositionChange(null);

    setStatus("idle");

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  // ============================================
  // NETTOYAGE SI LE COMPOSANT DISPARAÎT
  // ============================================

  useEffect(() => {
    return () => {
      stopGPS();
    };
  }, []);

  const latestPoint =
    points.length > 0
      ? points[points.length - 1]
      : null;

  const isRecording =
    status === "recording";

  return (
    <div className="space-y-4">

      {/* STATUT GPS */}

      <div className="rounded-2xl bg-white p-5 shadow-sm">

        <div className="flex items-center justify-between">

          <div className="flex items-center gap-2">

            <div
              className={`h-3 w-3 rounded-full ${
                isRecording
                  ? "animate-pulse bg-green-500"
                  : "bg-gray-400"
              }`}
            />

            <span className="font-semibold text-gray-700">
              GPS
            </span>

          </div>

          <span className="text-sm font-medium text-gray-600">
            {gpsStatus}
          </span>

        </div>

        {isRecording && (
          <p className="mt-3 text-xs text-gray-500">
            {points.length} points enregistrés
          </p>
        )}

      </div>

      {/* ERREUR */}

      {error && (
        <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}

      {/* BOUTON */}

      {!isRecording ? (

        <button
          onClick={startRecording}
          disabled={!route}
          className="w-full rounded-2xl bg-blue-600 px-5 py-4 font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:bg-gray-400"
        >
          📍 Démarrer le trajet
        </button>

      ) : (

        <button
          onClick={stopRecording}
          className="w-full rounded-2xl bg-red-600 px-5 py-4 font-bold text-white shadow-sm transition hover:bg-red-700"
        >
          ⏹ Terminer le trajet
        </button>

      )}

      {/* INFORMATIONS */}

      <div className="grid grid-cols-2 gap-3">

        <div className="rounded-2xl bg-white p-4 shadow-sm">

          <p className="text-xs text-gray-500">
            POINTS
          </p>

          <p className="mt-1 text-xl font-bold">
            {points.length}
          </p>

        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm">

          <p className="text-xs text-gray-500">
            DISTANCE
          </p>

          <p className="mt-1 text-xl font-bold">
            {totalDistance > 0
              ? `${(
                  totalDistance / 1000
                ).toFixed(2)} km`
              : "--"}
          </p>

        </div>

      </div>

      {/* DERNIÈRE POSITION */}

      {latestPoint && (

        <div className="rounded-2xl bg-white p-5 shadow-sm">

          <h2 className="mb-3 font-bold">
            🛰️ Dernier point enregistré
          </h2>

          <div className="space-y-2 text-sm">

            <div className="flex justify-between">
              <span className="text-gray-500">
                Latitude
              </span>

              <span className="font-mono">
                {latestPoint.latitude.toFixed(
                  6
                )}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-500">
                Longitude
              </span>

              <span className="font-mono">
                {latestPoint.longitude.toFixed(
                  6
                )}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-500">
                Précision
              </span>

              <span>
                {Math.round(
                  latestPoint.accuracy
                )}m
              </span>
            </div>

          </div>

        </div>

      )}

    </div>
  );
        }
