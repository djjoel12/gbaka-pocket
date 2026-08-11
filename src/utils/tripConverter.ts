// src/utils/tripConverter.ts
import { TripData, GPSPoint, StopPoint } from "@/types/trip";

/**
 * Convertit les données brutes au format JSON cible
 */
export const convertToGbakaFormat = (
  points: GPSPoint[],
  stops: StopPoint[],
  destination: string,
  startPointName: string,
  endPointName: string,
  price: number,
  totalDistance: number,  // en mètres
  duration: number,       // en secondes
  averageSpeed: number,   // en km/h
  maxSpeed: number,       // en km/h
  quality: number,
  lineName: string,
  type: string
): TripData => {
  
  // Générer un lineId unique
  const lineId = generateLineId(startPointName, endPointName);
  
  // Extraire les coordonnées de départ et d'arrivée
  const startCoords = getStartCoords(points);
  const endCoords = getEndCoords(points);
  
  return {
    id: Date.now().toString(),
    lineId: lineId,
    type: type as "gbaka" | "woro-woro" | "bus" | "taxi",
    direction: `${startPointName} → ${destination}`,
    
    start: {
      name: startPointName,
      latitude: startCoords.latitude,
      longitude: startCoords.longitude,
    },
    
    end: {
      name: destination,
      latitude: endCoords.latitude,
      longitude: endCoords.longitude,
    },
    
    fare: price,
    
    distance: totalDistance / 1000,  // convert m → km
    duration: duration,              // déjà en secondes
    averageSpeed: averageSpeed,      // déjà en km/h
    maxSpeed: maxSpeed,              // déjà en km/h
    
    points: points,
    stops: stops,
    
    startedAt: new Date(points[0]?.timestamp || Date.now()).toISOString(),
    endedAt: new Date(points[points.length - 1]?.timestamp || Date.now()).toISOString(),
    
    quality: quality,
    isComplete: true,
  };
};

/**
 * Génère un lineId type "GES-ADJ-01"
 */
const generateLineId = (start: string, end: string): string => {
  const startCode = start.substring(0, 3).toUpperCase();
  const endCode = end.substring(0, 3).toUpperCase();
  const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
  return `${startCode}-${endCode}-${random}`;
};

/**
 * Récupère les coordonnées du premier point GPS
 */
const getStartCoords = (points: GPSPoint[]) => {
  if (points.length === 0) {
    return { latitude: 0, longitude: 0 };
  }
  return {
    latitude: points[0].latitude,
    longitude: points[0].longitude,
  };
};

/**
 * Récupère les coordonnées du dernier point GPS
 */
const getEndCoords = (points: GPSPoint[]) => {
  if (points.length === 0) {
    return { latitude: 0, longitude: 0 };
  }
  return {
    latitude: points[points.length - 1].latitude,
    longitude: points[points.length - 1].longitude,
  };
};
