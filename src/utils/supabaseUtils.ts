import { supabase } from '@/lib/supabase'
import { TripData } from '@/types/trip'

export const saveTripToSupabase = async (tripData: TripData) => {
  console.log('📤 Envoi vers Supabase...')
  
  try {
    if (!tripData.points || tripData.points.length === 0) {
      console.warn('⚠️ Pas de points GPS à envoyer')
      return { success: false, error: 'Pas de points' }
    }

    const routeString = tripData.points
      .map(p => `${p.longitude} ${p.latitude}`)
      .join(',')

    const { data, error } = await supabase
      .from('trips')
      .insert([{
        line_name: tripData.line?.name || null,
        destination: tripData.destination,
        start_point_name: tripData.startPointName,
        end_point_name: tripData.endPointName,
        route: `LINESTRING(${routeString})`,
        total_distance: tripData.totalDistance,
        duration: tripData.duration,
        average_speed: tripData.averageSpeed,
        max_speed: tripData.maxSpeed,
        price: tripData.price,
        price_per_km: tripData.pricePerKm,
        quality: tripData.quality,
        points_json: tripData.points,
        stops_json: tripData.stops,
        date: tripData.date,
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
