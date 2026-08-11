export type GPSPoint = {
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number | null;
  timestamp: number;
};

export type StopPoint = {
  id: string;
  name: string;                    // Nom saisi par l'utilisateur
  coordinates: [number, number];
  timestamp: number;
  duration: number;
  isStart: boolean;
  isEnd: boolean;
  isManual?: boolean;              // ✅ TRUE si ajouté manuellement
  isConfirmed?: boolean;           // ✅ TRUE si confirmé par l'utilisateur
};

export type LineInfo = {
  id: string;
  name: string;
  number: string;
  type: "gbaka" | "woro-woro" | "bus" | "taxi";
  color: string;
  estimatedPrice: number;
};

export type TripData = {
  id: string;
  lineId: string;
  type: "gbaka" | "woro-woro" | "bus" | "taxi";
  direction: string;
  start: {
    name: string;
    latitude: number;
    longitude: number;
  };
  end: {
    name: string;
    latitude: number;
    longitude: number;
  };
  fare: number;
  distance: number;
  duration: number;
  averageSpeed: number;
  maxSpeed: number;
  points: GPSPoint[];
  stops: StopPoint[];
  startedAt: string;
  endedAt: string;
  quality: number;
  isComplete: boolean;
  notes?: string;
};
