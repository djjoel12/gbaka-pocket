// src/types/trip.ts

export type GPSPoint = {
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number | null;
  timestamp: number;
};

export type StopPoint = {
  id: string;
  name: string;
  coordinates: [number, number];
  timestamp: number;
  duration: number;
  isStart: boolean;
  isEnd: boolean;
};

export type LineInfo = {
  id: string;           // lineId personnalisé
  name: string;         // direction
  number: string;
  type: "gbaka" | "woro-woro" | "bus" | "taxi";
  color: string;
  estimatedPrice: number;
};

export type TripData = {
  // Identifiants
  id: string;
  lineId: string;               // ✅ nouveau : ex: "GES-ADJ-01"
  
  // Ligne
  type: "gbaka" | "woro-woro" | "bus" | "taxi";
  direction: string;            // ✅ nouveau : ex: "Gesco → Adjamé"
  
  // Départ
  start: {
    name: string;
    latitude: number;           // ✅ nouveau
    longitude: number;          // ✅ nouveau
  };
  
  // Arrivée
  end: {
    name: string;
    latitude: number;           // ✅ nouveau
    longitude: number;          // ✅ nouveau
  };
  
  // Tarif
  fare: number;                 // ✅ nouveau (remplace price)
  
  // Statistiques
  distance: number;             // ✅ en km
  duration: number;             // ✅ en secondes
  averageSpeed: number;         // ✅ en km/h
  maxSpeed: number;             // ✅ en km/h
  
  // Données brutes
  points: GPSPoint[];
  stops: StopPoint[];
  
  // Temps
  startedAt: string;            // ✅ nouveau
  endedAt: string;              // ✅ nouveau
  
  // Qualité
  quality: number;
  
  // Métadonnées
  isComplete: boolean;
  notes?: string;
};
