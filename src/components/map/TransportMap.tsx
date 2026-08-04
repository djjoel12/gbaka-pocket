"use client";

import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Circle,
  useMap,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";

import L from "leaflet";

import {
  useEffect,
  useRef,
  useState,
} from "react";

type GPSPoint = {
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number | null;
  timestamp: number;
};

type TransportMapProps = {
  points: GPSPoint[];
  livePosition?: GPSPoint | null;
  isRecording?: boolean;
};

type POI = {
  id: string;
  lat: number;
  lon: number;
  name: string;
  type: string;
  icon: string;
  color: string;
};

const defaultPosition: [number, number] = [5.3364, -4.0267];

// ============================================
// CRÉATION D'ICÔNES PERSONNALISÉES
// ============================================

function createIcon(
  color: string,
  label: string = "",
  isPulsing: boolean = false
) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
      ${isPulsing ? `
        <circle cx="20" cy="20" r="16" fill="none" stroke="${color}" stroke-width="2" opacity="0.4">
          <animate attributeName="r" from="12" to="20" dur="1.5s" repeatCount="indefinite"/>
          <animate attributeName="opacity" from="0.6" to="0" dur="1.5s" repeatCount="indefinite"/>
        </circle>
        <circle cx="20" cy="20" r="14" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.3">
          <animate attributeName="r" from="10" to="18" dur="1.5s" begin="0.5s" repeatCount="indefinite"/>
          <animate attributeName="opacity" from="0.5" to="0" dur="1.5s" begin="0.5s" repeatCount="indefinite"/>
        </circle>
      ` : ''}
      <circle cx="20" cy="20" r="${isPulsing ? '10' : '14'}" fill="${color}" stroke="white" stroke-width="2.5"/>
      ${label ? `
        <text x="20" y="${isPulsing ? '25' : '24'}" text-anchor="middle" fill="white" font-size="16" font-weight="bold" font-family="Arial">${label}</text>
      ` : ''}
      ${isPulsing ? `
        <circle cx="20" cy="20" r="4" fill="white"/>
        <circle cx="20" cy="20" r="2.5" fill="${color}"/>
      ` : ''}
    </svg>
  `;

  return L.divIcon({
    html: svg,
    className: isPulsing ? 'pulsing-marker' : 'custom-marker',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

// ============================================
// CRÉATION D'ICÔNE POI
// ============================================

function createPOIIcon(emoji: string, color: string) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="14" fill="${color}" stroke="white" stroke-width="2.5" opacity="0.95"/>
      <text x="16" y="21" text-anchor="middle" fill="white" font-size="14" font-weight="bold" font-family="Arial">${emoji}</text>
    </svg>
  `;

  return L.divIcon({
    html: svg,
    className: 'poi-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}

// ============================================
// CATÉGORIES POI AVEC LEURS COULEURS
// ============================================

const POI_CATEGORIES = {
  'restaurant': { icon: '🍽️', color: '#f59e0b' },
  'maquis': { icon: '🥘', color: '#f97316' },
  'bar': { icon: '🍺', color: '#ef4444' },
  'cafe': { icon: '☕', color: '#8b5cf6' },
  'school': { icon: '🏫', color: '#3b82f6' },
  'university': { icon: '🎓', color: '#6366f1' },
  'hospital': { icon: '🏥', color: '#ef4444' },
  'clinic': { icon: '🩺', color: '#ec4899' },
  'pharmacy': { icon: '💊', color: '#14b8a6' },
  'church': { icon: '⛪', color: '#8b5cf6' },
  'mosque': { icon: '🕌', color: '#22c55e' },
  'market': { icon: '🛒', color: '#f59e0b' },
  'supermarket': { icon: '🏪', color: '#3b82f6' },
  'bank': { icon: '🏦', color: '#22c55e' },
  'bus_stop': { icon: '🚌', color: '#8b5cf6' },
  'taxi': { icon: '🚕', color: '#f97316' },
  'gas_station': { icon: '⛽', color: '#ef4444' },
  'stadium': { icon: '🏟️', color: '#8b5cf6' },
  'police': { icon: '👮', color: '#3b82f6' },
  'post_office': { icon: '📮', color: '#f59e0b' },
  'townhall': { icon: '🏛️', color: '#6366f1' },
  'fast_food': { icon: '🍔', color: '#f97316' },
  'hotel': { icon: '🏨', color: '#3b82f6' },
  'mall': { icon: '🛍️', color: '#ec4899' },
};

// ============================================
// ICÔNES PRINCIPALES
// ============================================

const startIcon = createIcon('#22c55e', '🏁');
const endIcon = createIcon('#ef4444', '🏁');
const liveIcon = createIcon('#3b82f6', '', true);

// ============================================
// SUIVI AUTOMATIQUE DE LA CARTE
// ============================================

function MapFollower({ position }: { position: [number, number] }) {
  const map = useMap();
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      map.setView(position, 16);
      firstRender.current = false;
      return;
    }

    map.panTo(position, {
      animate: true,
      duration: 0.5,
    });
  }, [position, map]);

  return null;
}

// ============================================
// COMPOSANT DE CHARGEMENT DES POI
// ============================================

function POILoader({ 
  bounds, 
  onPOILoaded 
}: { 
  bounds: any, 
  onPOILoaded: (pois: POI[]) => void 
}) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!bounds || loaded) return;

    const fetchPOIs = async () => {
      try {
        const southWest = bounds.getSouthWest();
        const northEast = bounds.getNorthEast();

        // Requête Overpass API pour récupérer les POIs
        const query = `
          [out:json];
          (
            // Restaurants & maquis
            node["amenity"~"restaurant|fast_food|cafe|bar"]({{bbox}});
            node["shop"~"restaurant|fast_food"]({{bbox}});
            
            // Écoles
            node["amenity"~"school|university|college|kindergarten"]({{bbox}});
            
            // Santé
            node["amenity"~"hospital|clinic|pharmacy|doctors"]({{bbox}});
            
            // Lieux de culte
            node["amenity"~"place_of_worship|church|mosque|temple"]({{bbox}});
            
            // Commerces
            node["shop"~"supermarket|convenience|marketplace|mall"]({{bbox}});
            
            // Transport
            node["amenity"~"bus_station|taxi"]({{bbox}});
            node["highway"~"bus_stop"]({{bbox}});
            
            // Stations-service
            node["amenity"~"fuel"]({{bbox}});
            
            // Banques
            node["amenity"~"bank"]({{bbox}});
            
            // Services publics
            node["amenity"~"police|post_office|townhall"]({{bbox}});
            
            // Stades
            node["leisure"~"stadium|sports_centre"]({{bbox}});
            
            // Hôtels
            node["tourism"~"hotel|guest_house"]({{bbox}});
          );
          out body;
        `;

        // Remplacer {{bbox}} par les coordonnées réelles
        const bbox = `${southWest.lat},${southWest.lng},${northEast.lat},${northEast.lng}`;
        const finalQuery = query.replace(/{{bbox}}/g, bbox);
        
        const response = await fetch(
          `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(finalQuery)}`
        );

        if (!response.ok) {
          throw new Error('Erreur lors de la récupération des POIs');
        }

        const data = await response.json();

        const pois: POI[] = data.elements
          .filter((el: any) => el.tags && el.tags.name)
          .map((el: any) => {
            // Déterminer le type de POI
            let type = 'restaurant';
            const tags = el.tags;
            
            if (tags.amenity === 'restaurant' || tags.amenity === 'fast_food' || tags.shop === 'restaurant') type = 'restaurant';
            else if (tags.amenity === 'bar') type = 'bar';
            else if (tags.amenity === 'cafe') type = 'cafe';
            else if (tags.amenity === 'school') type = 'school';
            else if (tags.amenity === 'university') type = 'university';
            else if (tags.amenity === 'hospital') type = 'hospital';
            else if (tags.amenity === 'clinic') type = 'clinic';
            else if (tags.amenity === 'pharmacy') type = 'pharmacy';
            else if (tags.amenity === 'place_of_worship') {
              if (tags.religion === 'christian') type = 'church';
              else if (tags.religion === 'muslim') type = 'mosque';
              else type = 'church';
            }
            else if (tags.amenity === 'church') type = 'church';
            else if (tags.amenity === 'mosque') type = 'mosque';
            else if (tags.shop === 'supermarket') type = 'supermarket';
            else if (tags.shop === 'mall') type = 'mall';
            else if (tags.amenity === 'marketplace') type = 'market';
            else if (tags.amenity === 'bus_station') type = 'bus_stop';
            else if (tags.highway === 'bus_stop') type = 'bus_stop';
            else if (tags.amenity === 'taxi') type = 'taxi';
            else if (tags.amenity === 'fuel') type = 'gas_station';
            else if (tags.amenity === 'bank') type = 'bank';
            else if (tags.amenity === 'police') type = 'police';
            else if (tags.amenity === 'post_office') type = 'post_office';
            else if (tags.amenity === 'townhall') type = 'townhall';
            else if (tags.leisure === 'stadium') type = 'stadium';
            else if (tags.tourism === 'hotel' || tags.tourism === 'guest_house') type = 'hotel';
            else if (tags.amenity === 'fast_food') type = 'fast_food';
            else if (tags.shop === 'convenience') type = 'market';

            // Si le type n'existe pas dans POI_CATEGORIES, utiliser restaurant par défaut
            if (!POI_CATEGORIES[type as keyof typeof POI_CATEGORIES]) {
              type = 'restaurant';
            }

            const category = POI_CATEGORIES[type as keyof typeof POI_CATEGORIES] || POI_CATEGORIES['restaurant'];

            return {
              id: `${el.id}`,
              lat: el.lat,
              lon: el.lon,
              name: tags.name || 'Lieu',
              type: type,
              icon: category.icon,
              color: category.color,
            };
          });

        onPOILoaded(pois);
        setLoaded(true);
      } catch (error) {
        console.error('Erreur lors du chargement des POIs:', error);
        // En cas d'erreur, charger des POIs de démonstration
        loadDemoPOIs(onPOILoaded);
        setLoaded(true);
      }
    };

    // POIs de démonstration si l'API ne répond pas
    const loadDemoPOIs = (callback: (pois: POI[]) => void) => {
      const demoPOIs: POI[] = [
        { id: 'demo1', lat: 5.3364, lon: -4.0267, name: 'Maquis Chez Arthur', type: 'restaurant', icon: '🍽️', color: '#f59e0b' },
        { id: 'demo2', lat: 5.3400, lon: -4.0300, name: 'École Primaire d\'Adjamé', type: 'school', icon: '🏫', color: '#3b82f6' },
        { id: 'demo3', lat: 5.3300, lon: -4.0220, name: 'CHU de Cocody', type: 'hospital', icon: '🏥', color: '#ef4444' },
        { id: 'demo4', lat: 5.3450, lon: -4.0350, name: 'Stade Félix Houphouët-Boigny', type: 'stadium', icon: '🏟️', color: '#8b5cf6' },
        { id: 'demo5', lat: 5.3380, lon: -4.0200, name: 'Marché de Cocody', type: 'market', icon: '🛒', color: '#f59e0b' },
        { id: 'demo6', lat: 5.3320, lon: -4.0400, name: 'Église Saint-Pierre', type: 'church', icon: '⛪', color: '#8b5cf6' },
        { id: 'demo7', lat: 5.3500, lon: -4.0250, name: 'Mosquée d\'Adjamé', type: 'mosque', icon: '🕌', color: '#22c55e' },
        { id: 'demo8', lat: 5.3420, lon: -4.0280, name: 'Station Total Yopougon', type: 'gas_station', icon: '⛽', color: '#ef4444' },
      ];
      callback(demoPOIs);
    };

    const timer = setTimeout(() => {
      fetchPOIs();
    }, 500);

    return () => clearTimeout(timer);
  }, [bounds, loaded, onPOILoaded]);

  return null;
}

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

export default function TransportMap({
  points,
  livePosition,
  isRecording = false,
}: TransportMapProps) {
  const lastPoint = points.length > 0 ? points[points.length - 1] : null;
  const firstPoint = points.length > 0 ? points[0] : null;
  const [pois, setPois] = useState<POI[]>([]);
  const [mapBounds, setMapBounds] = useState<any>(null);
  const mapRef = useRef<any>(null);

  // ==========================================
  // POSITION À AFFICHER
  // ==========================================

  const displayPosition: [number, number] = livePosition
    ? [livePosition.latitude, livePosition.longitude]
    : lastPoint
    ? [lastPoint.latitude, lastPoint.longitude]
    : defaultPosition;

  // ==========================================
  // CONVERSION DES POINTS
  // ==========================================

  const routePositions: [number, number][] = points.map((point) => [
    point.latitude,
    point.longitude,
  ]);

  const hasLivePosition = !!livePosition;

  // ==========================================
  // ÉCOUTE DES MOUVEMENTS DE LA CARTE
  // ==========================================

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleMoveEnd = () => {
      const bounds = map.getBounds();
      setMapBounds(bounds);
    };

    map.on('moveend', handleMoveEnd);

    return () => {
      map.off('moveend', handleMoveEnd);
    };
  }, []);

  // ==========================================
  // RÉCUPÉRATION DES POIs QUAND LA CARTE CHANGE
  // ==========================================

  const handleMapReady = () => {
    if (mapRef.current) {
      setMapBounds(mapRef.current.getBounds());
    }
  };

  // ==========================================
  // CRÉATION DES ICÔNES POI
  // ==========================================

  const getPOIIcon = (poi: POI) => {
    const category = POI_CATEGORIES[poi.type as keyof typeof POI_CATEGORIES] || POI_CATEGORIES['restaurant'];
    return createPOIIcon(poi.icon, category.color);
  };

  return (
    <div className="h-full w-full overflow-hidden rounded-2xl shadow-sm">
      <MapContainer
        center={displayPosition}
        zoom={13}
        scrollWheelZoom={true}
        className="h-full w-full"
        style={{ background: "#0a0e17" }}
        ref={mapRef}
        whenReady={handleMapReady}
      >
        {/* ==========================================
            FOND DE CARTE - STYLE SOMBRE
        ========================================== */}

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png"
        />

        {/* ==========================================
            CHARGEMENT DES POIs
        ========================================== */}

        {mapBounds && (
          <POILoader 
            bounds={mapBounds} 
            onPOILoaded={setPois} 
          />
        )}

        {/* ==========================================
            AFFICHAGE DES POIs
        ========================================== */}

        {pois.map((poi) => (
          <Marker
            key={poi.id}
            position={[poi.lat, poi.lon]}
            icon={getPOIIcon(poi)}
          >
            <div className="custom-popup">
              <div className="rounded-lg bg-white p-2 shadow-lg">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{poi.icon}</span>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{poi.name}</p>
                    <p className="text-xs text-gray-500 capitalize">{poi.type}</p>
                  </div>
                </div>
              </div>
            </div>
          </Marker>
        ))}

        {/* ==================================
            SUIVI DE LA POSITION
        ================================== */}

        {hasLivePosition && <MapFollower position={displayPosition} />}

        {/* ==================================
            TRACÉ DU TRAJET
        ================================== */}

        {routePositions.length > 1 && (
          <>
            {/* Ombre du trajet */}
            <Polyline
              positions={routePositions}
              color="#60a5fa"
              weight={12}
              opacity={0.15}
              lineJoin="round"
              lineCap="round"
            />

            {/* Trajet principal */}
            <Polyline
              positions={routePositions}
              color="#2563eb"
              weight={5}
              opacity={0.9}
              lineJoin="round"
              lineCap="round"
            />
          </>
        )}

        {/* ==================================
            POINT DE DÉPART
        ================================== */}

        {firstPoint && (
          <Marker
            position={[firstPoint.latitude, firstPoint.longitude]}
            icon={startIcon}
          />
        )}

        {/* ==================================
            POINT D'ARRIVÉE
        ================================== */}

        {lastPoint && points.length > 1 && (
          <Marker
            position={[lastPoint.latitude, lastPoint.longitude]}
            icon={endIcon}
          />
        )}

        {/* ==================================
            POSITION EN DIRECT
        ================================== */}

        {livePosition && (
          <>
            <Marker
              position={[livePosition.latitude, livePosition.longitude]}
              icon={liveIcon}
            />

            <Circle
              center={[livePosition.latitude, livePosition.longitude]}
              radius={livePosition.accuracy}
              pathOptions={{
                color: "#3b82f6",
                fillColor: "#3b82f6",
                fillOpacity: 0.1,
                weight: 1,
              }}
            />
          </>
        )}
      </MapContainer>

      {/* ==========================================
          LÉGENDE
      ========================================== */}

      <div className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-2xl bg-black/80 px-4 py-2.5 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50" />
            <span className="text-white/80">GPS</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-green-500 shadow-lg shadow-green-500/50" />
            <span className="text-white/80">Départ</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-lg shadow-red-500/50" />
            <span className="text-white/80">Arrivée</span>
          </div>

          <div className="flex items-center gap-1.5 border-l border-white/10 pl-3">
            <span className="text-base">🍽️</span>
            <span className="text-white/60">Lieux</span>
          </div>

          {isRecording && (
            <span className="ml-2 flex items-center gap-1.5 font-semibold text-emerald-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              REC
            </span>
          )}
        </div>
      </div>

      {/* ==========================================
          LÉGENDE POI - EN BAS À GAUCHE
      ========================================== */}

      <div className="absolute bottom-16 left-3 z-10 rounded-xl bg-black/70 p-2 backdrop-blur-sm">
        <div className="grid grid-cols-2 gap-1 text-xs text-white/60">
          <span>🍽️ Resto</span>
          <span>🏫 Écoles</span>
          <span>🏥 Hôpital</span>
          <span>⛪ Église</span>
          <span>🕌 Mosquée</span>
          <span>🛒 Marché</span>
          <span>⛽ Station</span>
          <span>🏟️ Stade</span>
        </div>
      </div>

    </div>
  );
}
