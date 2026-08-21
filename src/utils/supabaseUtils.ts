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

    const stopsString =
      tripData.stops.length > 0
        ? tripData.stops
            .map(s => `${s.coordinates[1]} ${s.coordinates[0]}`)
            .join(',')
        : null

    const { data, error } = await supabase
      .from('trips')
      .insert([{
        line_name: tripData.direction,
        destination: tripData.end.name,
        start_point_name: tripData.start.name,
        end_point_name: tripData.end.name,

        route: `LINESTRING(${routeString})`,

        stops: stopsString
          ? `MULTIPOINT(${stopsString})`
          : null,

        total_distance: tripData.distance * 1000,
        duration: tripData.duration,
        average_speed: tripData.averageSpeed,
        max_speed: tripData.maxSpeed,
        price: tripData.fare,
        price_per_km:
          tripData.distance > 0
            ? tripData.fare / tripData.distance
            : 0,

        quality: tripData.quality,

        // Données JSON
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

      return {
        success: false,
        error,
      }
    }

    console.log('✅ Trajet envoyé à Supabase !')

    return {
      success: true,
      data,
    }

  } catch (error) {
    console.error('❌ Erreur:', error)

    return {
      success: false,
      error,
    }
  }
}

// ======================================================
// RÉCUPÉRER LES ARRÊTS ENREGISTRÉS DANS stops_json
// ======================================================

export const fetchHistoricalStops = async (): Promise<StopPoint[]> => {
  try {
    const { data, error } = await supabase
      .from('trips')
      .select('stops_json')
      .not('stops_json', 'is', null)
      .order('date', { ascending: false })
      .limit(100)

    // ✅ VÉRIFICATION DE L'ERREUR ICI
    if (error) {
      console.error('❌ ERREUR SUPABASE STOPS:', error)
      throw new Error(
        `Impossible de récupérer les arrêts : ${
          error.message || 'Erreur Supabase'
        }`
      )
    }

    if (!data || data.length === 0) {
      console.log('ℹ️ Aucun trajet trouvé')
      return []
    }

    const historicalStops: StopPoint[] = []

    for (const trip of data) {
      let stops: any = trip.stops_json

      // Si stops_json est enregistré comme texte JSON
      if (typeof stops === 'string') {
        try {
          stops = JSON.parse(stops)
        } catch (e) {
          console.error(
            '❌ Impossible de lire stops_json:',
            stops
          )
          continue
        }
      }

      // On attend un tableau
      if (!Array.isArray(stops)) {
        console.warn(
          '⚠️ stops_json n’est pas un tableau:',
          stops
        )
        continue
      }

      for (let i = 0; i < stops.length; i++) {
        const stop = stops[i]

        if (!stop) continue

        // Récupération des coordonnées
        let coordinates = stop.coordinates

        // Vérifier que coordinates existe
        if (!Array.isArray(coordinates)) {
          console.warn(
            '⚠️ Arrêt sans coordinates:',
            stop
          )
          continue
        }

        if (coordinates.length < 2) {
          console.warn(
            '⚠️ Coordonnées incomplètes:',
            coordinates
          )
          continue
        }

        const latitude = Number(coordinates[0])
        const longitude = Number(coordinates[1])

        // Vérifier les coordonnées
        if (
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude)
        ) {
          console.warn(
            '⚠️ Coordonnées invalides:',
            coordinates
          )
          continue
        }

        // Créer un arrêt propre
        const historicalStop: StopPoint = {
          id:
            typeof stop.id === 'string'
              ? stop.id
              : `historical-stop-${Date.now()}-${i}`,

          name:
            typeof stop.name === 'string'
              ? stop.name
              : 'Arrêt enregistré',

          coordinates: [
            latitude,
            longitude,
          ],

          timestamp:
            typeof stop.timestamp === 'number'
              ? stop.timestamp
              : Date.now(),

          duration:
            typeof stop.duration === 'number'
              ? stop.duration
              : 0,

          isStart:
            typeof stop.isStart === 'boolean'
              ? stop.isStart
              : false,

          isEnd:
            typeof stop.isEnd === 'boolean'
              ? stop.isEnd
              : false,

          isManual:
            typeof stop.isManual === 'boolean'
              ? stop.isManual
              : false,

          isConfirmed:
            typeof stop.isConfirmed === 'boolean'
              ? stop.isConfirmed
              : false,
        }

        historicalStops.push(historicalStop)
      }
    }

    // Supprimer les doublons
    const uniqueStops = historicalStops.filter(
      (stop, index, array) => {
        return (
          index ===
          array.findIndex(
            other =>
              other.coordinates[0] ===
                stop.coordinates[0] &&
              other.coordinates[1] ===
                stop.coordinates[1]
          )
        )
      }
    )

    console.log(
      `🚏 ${uniqueStops.length} arrêts récupérés depuis Supabase`
    )

    return uniqueStops

  } catch (error) {
    console.error(
      '❌ fetchHistoricalStops:',
      error
    )

    throw error // ✅ On relance l'erreur pour que page.tsx la capte
  }
      }
