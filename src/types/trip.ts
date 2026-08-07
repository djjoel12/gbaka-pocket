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
  id: string;
  name: string;
  number: string;
  type: "gbaka" | "woro-woro" | "bus" | "taxi";
  color: string;
  estimatedPrice: number;
};

export type TripData = {
  id: string;
  line: LineInfo | null;
  destination: string;
  startPointName: string;
  endPointName: string;
  points: GPSPoint[];
  startPoint: StopPoint | null;
  endPoint: StopPoint | null;
  stops: StopPoint[];
  totalDistance: number;
  duration: number;
  averageSpeed: number;
  maxSpeed: number;
  movingTime: number;
  stoppedTime: number;
  date: string;
  quality: number;
  isComplete: boolean;
  price: number;
  pricePerKm: number;
  notes?: string;
};
