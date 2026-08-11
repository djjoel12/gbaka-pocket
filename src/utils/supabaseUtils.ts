import { supabase } from '@/lib/supabase'
import { TripData } from '@/types/trip'

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

    // Insertion dans la table trips existante
    const { data, error } = await supabase
      .from('trips')
      .insert([{
        // Colonnes existantes
        line_name: tripData.direction,
        destination: tripData.end.name,
        start_point_name: tripData.start.name,
        end_point_name: tripData.end.name,
        route: `LINESTRING(${routeString})`,
        stops: stopsString ? `MULTIPOINT(${stopsString})` : null,
        total_distance: tripData.distance * 1000,  // km → m
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
        
        // Nouvelles colonnes ajoutées
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
