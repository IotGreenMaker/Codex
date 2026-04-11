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
  let nextWateringEstimate = "N/A";
  
  if (latestWatering?.timestamp) {
    const waterDate = new Date(latestWatering.timestamp)
    const diffMs = now.getTime() - waterDate.getTime();
    daysSinceLast = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    // Calculate expected next watering
    if (plant.wateringIntervalDays > 0) {
      const nextDate = new Date(waterDate.getTime() + plant.wateringIntervalDays * 24 * 60 * 60 * 1000);
      const diffNextMs = nextDate.getTime() - now.getTime();
      const diffNextDays = (diffNextMs / (1000 * 60 * 60 * 24)).toFixed(1);
      
      if (Number(diffNextDays) < 0) {
        nextWateringEstimate = `OVERDUE by ${Math.abs(Number(diffNextDays))} days`;
      } else {
        nextWateringEstimate = `In ${diffNextDays} days (${nextDate.toLocaleDateString()})`;
      }
    }
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

  // Lighting calculations (DLI / PPFD)
  const activeLight = plant.lights?.find(l => l.id === plant.activeLightId) || plant.lights?.[0];
  let lightDesc = "Light info not logged yet.";
  let scheduleDesc = `${plant.lightSchedule || "None"} (${plant.lightsOn || "06:00"}-${plant.lightsOff || "00:00"})`;
  let lightingMetrics = "N/A";
  let lightHealth = "N/A";

  // Parse hours on
  const [onH, onM] = (plant.lightsOn || "06:00").split(':').map(Number);
  const [offH, offM] = (plant.lightsOff || "00:00").split(':').map(Number);
  let hoursOn = (offH + offM/60) - (onH + onM/60);
  if (hoursOn <= 0) hoursOn += 24;

  let currentPpfd = 0;
  if (activeLight) {
    lightDesc = `${activeLight.type} (${activeLight.watts}W)`;
    currentPpfd = activeLight.ppfdEstimated || 0;
    if (activeLight.hasDimmer && activeLight.dimmerPercent !== undefined) {
      lightDesc += ` at ${activeLight.dimmerPercent}%`;
      currentPpfd = (currentPpfd * activeLight.dimmerPercent) / 100;
    }
    scheduleDesc = `${activeLight.lightsOn}-${activeLight.lightsOff}`;
  } else if (plant.lightLampName && plant.lightLampName.trim() !== "" && plant.lightLampName !== "Growth Light") {
    lightDesc = `${plant.lightLampName}`;
    if (plant.lightLampWatts) lightDesc += ` (${plant.lightLampWatts}W)`;
    if (plant.lightDimmerPercent) lightDesc += ` at ${plant.lightDimmerPercent}%`;
    // Fallback PPFD guess if watts known (very rough: 1.5 umol/j)
    currentPpfd = ((plant.lightLampWatts || 100) * 1.5 * (plant.lightDimmerPercent || 100) / 100) / 0.5; // spread over 0.5m2
  }

  const dli = (currentPpfd * hoursOn * 3600) / 1_000_000;
  lightingMetrics = `PPFD: ${currentPpfd.toFixed(0)} μmol/m²/s | DLI: ${dli.toFixed(1)} mol/m²/d (${hoursOn.toFixed(1)}h on)`;
  
  // Basic light health check
  const targets = {
    Seedling: { minDli: 6, maxDli: 12 },
    Veg: { minDli: 15, maxDli: 30 },
    Bloom: { minDli: 30, maxDli: 50 }
  }[plant.stage as 'Seedling' | 'Veg' | 'Bloom'] || { minDli: 10, maxDli: 40 };

  if (dli < targets.minDli) lightHealth = "LOW for this stage (increase intensity or hours)";
  else if (dli > targets.maxDli) lightHealth = "HIGH for this stage (risk of light burn)";
  else lightHealth = "OPTIMAL for this stage";

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
- Light: ${lightDesc}
- Schedule: ${scheduleDesc}
- Light Efficiency: ${lightingMetrics} | Status: ${lightHealth}

## CURRENT ENVIRONMENT
- Temp: ${tempC}°C | RH: ${humidity}%
- VPD: ${vpd} kPa — ${vpdStatus}

## WATERING STATUS
- ${waterLine}
- CONFIG: Every ${plant.wateringIntervalDays} days | Target pH: ${plant.waterPh} | Target EC: ${plant.waterEc}
- NEXT ESTIMATED WATERING: ${nextWateringEstimate}

## RECENT HISTORY & NOTES (Showing last 10)
${(plant.notes || [])
  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  .slice(0, 10)
  .map((n) => `- [${new Date(n.timestamp).toLocaleDateString()}] ${n.text}`)
  .join('\n') || 'No manual notes recorded.'}

## OTHER PLANTS IN ROOM
 ${otherPlants || 'No other plants tagged.'}

## NOTIFICATIONS
 - Watering notifications: ${notificationsEnabled ? 'ENABLED' : 'DISABLED'}

 Be concise (1-2 sentences). Use the DLI/PPFD and historical notes to provide expert advice (e.g., if asked about flushing or light height).
`.trim()
}
