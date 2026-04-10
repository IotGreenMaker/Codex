// src/lib/buildGrowContext.ts
// Assemble structured plant + environment context for AI

import type { PlantProfile } from '@/lib/types'

export function buildGrowContext(
  plant: PlantProfile,
  plants: PlantProfile[] = [],
  notificationsEnabled: boolean = false
): string {
  // Calculate stage durations
  const startDate = new Date(plant.startedAt)
  const now = new Date()
  const daysSinceStart = Math.floor(
    (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  )

  let seedlingDays = 0;
  let vegDays = 0;
  let bloomDays = 0;

  // Seedling: from startedAt to vegStartedAt (or now)
  if (plant.vegStartedAt) {
    seedlingDays = Math.floor((new Date(plant.vegStartedAt).getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  } else {
    seedlingDays = daysSinceStart;
  }

  // Veg: from vegStartedAt to bloomStartedAt (or now)
  if (plant.vegStartedAt) {
    const vegStart = new Date(plant.vegStartedAt);
    if (plant.bloomStartedAt) {
      vegDays = Math.floor((new Date(plant.bloomStartedAt).getTime() - vegStart.getTime()) / (1000 * 60 * 60 * 24));
    } else {
      vegDays = Math.floor((now.getTime() - vegStart.getTime()) / (1000 * 60 * 60 * 24));
    }
  }

  // Bloom: from bloomStartedAt to now
  if (plant.bloomStartedAt) {
    bloomDays = Math.floor((now.getTime() - new Date(plant.bloomStartedAt).getTime()) / (1000 * 60 * 60 * 24));
  }

  const daysInCurrentStage = plant.stage === 'Seedling' ? seedlingDays : plant.stage === 'Veg' ? vegDays : bloomDays;

  const latestClimate = plant.climateData?.[plant.climateData.length - 1]
  const latestWatering = plant.wateringData?.[plant.wateringData.length - 1]

  // Calculate days since last watering
  let daysSinceLast = 0
  if (latestWatering?.timestamp) {
    const waterDate = new Date(latestWatering.timestamp)
    daysSinceLast = Math.floor(
      (now.getTime() - waterDate.getTime()) / (1000 * 60 * 60 * 24)
    )
  }

  // Simple VPD calculation: VPD = (SVP_sat - SVP_actual)
  // Where SVP (saturation vapor pressure) ≈ 0.6108 * e^(17.27*T/(T+237.7))
  const tempC = latestClimate?.tempC || plant.growTempC || 24
  const humidity = latestClimate?.humidity || plant.growHumidity || 60
  const svpSat = 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.7))
  const svpActual = (humidity / 100) * svpSat
  const vpd = Math.max(0, svpSat - svpActual).toFixed(2)

  const vpdStatus =
    Number(vpd) < 0.4
      ? 'too low (risk of mould)'
      : Number(vpd) < 0.8
        ? 'low (good for seedling/clone)'
        : Number(vpd) <= 1.2
          ? 'optimal'
          : Number(vpd) <= 1.6
            ? 'high (push for late bloom)'
            : 'dangerously high'

  // Get other available plants for reference
  const otherPlants = plants
    .filter((p) => p.id !== plant.id)
    .map((p) => `- ${p.strainName} (${p.stage} stage, ID: ${p.id})`)
    .join('\n')

  const waterLine = latestWatering
    ? `Last watered ${daysSinceLast}d ago — ${latestWatering.amountMl}ml` +
      (latestWatering.ph ? `, pH in ${latestWatering.ph}` : '') +
      (latestWatering.ec ? `, EC in ${latestWatering.ec}` : '') +
      (latestWatering.runoffPh
        ? `, pH runoff ${latestWatering.runoffPh}`
        : '') +
      (latestWatering.runoffEc
        ? `, EC runoff ${latestWatering.runoffEc}`
        : '')
    : 'No watering recorded yet.'

  return `
## ACTIVE PLANT — ${plant.strainName}
- Stage: ${plant.stage} | Total days: ${daysSinceStart} | Days in stage: ${daysInCurrentStage}
- Days by Stage: Seedling: ${seedlingDays}d, Veg: ${vegDays}d, Bloom: ${bloomDays}d
- Container: ${plant.containerVolumeL}L (${plant.mediaType})
- Light: ${plant.lightLampName} (${plant.lightLampWatts}W) at ${plant.lightDimmerPercent}%
- Schedule: ${plant.lightSchedule} (${plant.lightsOn}-${plant.lightsOff})

## CURRENT ENVIRONMENT
- Temp: ${tempC}°C | RH: ${humidity}%
- VPD: ${vpd} kPa — ${vpdStatus}

## LAST WATERING
${waterLine}

## WATERING CONFIG
- Interval: every ${plant.wateringIntervalDays} days
- Target pH: ${plant.waterPh}
- Target EC: ${plant.waterEc}

## RECENT NOTES
${(plant.notes || [])
  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  .slice(0, 3)
  .map((n) => `- [${new Date(n.timestamp).toLocaleDateString()}] ${n.text}`)
  .join('\n') || 'No manual notes recorded.'}

## OTHER PLANTS IN ROOM
 ${otherPlants || 'No other plants tagged.'}

## NOTIFICATIONS
 - Watering notifications: ${notificationsEnabled ? 'ENABLED' : 'DISABLED'}

 Be concise (1-2 sentences) and focus on actionable advice based on the grow data above.
`.trim()
}
