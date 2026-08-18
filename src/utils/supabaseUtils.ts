import { supabase } from '@/lib/supabase'
import { TripData, StopPoint } from '@/types/trip'

export const saveTripToSupabase = async (tripData: TripData) => {
  console.log('📤 Envoi vers Supabase...')
  
  try {
    if (!tripData.points || tripData.points.length === 0) {
      console.warn('⚠️ Pas de points GPS')
      return { success: false, error: 'Pas de points' }
    }

    const routeString = tripData.points
      .map(p => `${p.longitude} ${p.latitude}`)
      .join(',')

    const stopsString = tripData.stops.length > 0
      ? tripData.stops.map(s => `${s.coordinates[1]} ${s.coordinates[0]}`).join(',')
      : null

    const { data, error } = await supabase
      .from('trips')
      .insert([{
        line_name: tripData.direction,
        destination: tripData.end.name,
        start_point_name: tripData.start.name,
        end_point_name: tripData.end.name,
        route: `LINESTRING(${routeString})`,
        stops: stopsString ? `MULTIPOINT(${stopsString})` : null,
        total_distance: tripData.distance * 1000,
        duration: tripData.duration,
        average_speed: tripData.averageSpeed,
        max_speed: tripData.maxSpeed,
        price: tripData.fare,
        price_per_km: tripData.distance > 0 ? tripData.fare / tripData.distance : 0,
        quality: tripData.quality,
        points_json: tripData.points,
        stops_json: tripData.stops,
        date: tripData.startedAt,
        is_verified: false,
        line_id: tripData.lineId,
        type: tripData.type,
        direction: tripData.direction,
        fare: tripData.fare,
        distance_km: tripData.distance,
        duration_sec: tripData.duration,
        avg_speed_kmh: tripData.averageSpeed,
        max_speed_kmh: tripData.maxSpeed,
        started_at: tripData.startedAt,
        ended_at: tripData.endedAt,
      }])

    if (error) {
      console.error('❌ Erreur Supabase:', error)
      return { success: false, error }
    }

    console.log('✅ Trajet envoyé à Supabase !')
    return { success: true, data }
  } catch (error) {
    console.error('❌ Erreur:', error)
    return { success: false, error }
  }
}

// ============================================
// RÉCUPÉRER LES ARRÊTS HISTORIQUES (GBAKA)
// ============================================
export const fetchHistoricalStops = async (): Promise<StopPoint[]> => {
  try {
    const { data, error } = await supabase
      .from('trips')
      .select('stops_json')
      .order('date', { ascending: false })
      .limit(100);

    if (error || !data) {
      console.error('❌ Erreur récupération arrêts:', error);
      return [];
    }

    const allStops = data.flatMap(trip => trip.stops_json || []);
    
    // Filtre les doublons pour ne pas surcharger la carte
    const uniqueStops = allStops.filter((stop: StopPoint, index: number, self: StopPoint[]) =>
      index === self.findIndex((t) => 
        t.coordinates[0] === stop.coordinates[0] && t.coordinates[1] === stop.coordinates[1]
      )
    );

    return uniqueStops;
  } catch (error) {
    console.error('❌ Erreur:', error);
    return [];
  }
};
