// src/lib/buildGrowContext.ts
// Assemble structured plant + environment context for AI

import type { PlantProfile } from '@/lib/types'

export function buildGrowContext(
  plant: PlantProfile,
  plants: PlantProfile[] = []
): string {
  // Calculate days since start
  const startDate = new Date(plant.startedAt)
  const now = new Date()
  const daysSinceStart = Math.floor(
    (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  )

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
- Stage: ${plant.stage} | Total days: ${daysSinceStart} | Days in stage: ?
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

## OTHER PLANTS IN ROOM
${otherPlants || 'No other plants tagged.'}

Be concise (1-2 sentences) and focus on actionable advice based on the grow data above.
`.trim()
}
