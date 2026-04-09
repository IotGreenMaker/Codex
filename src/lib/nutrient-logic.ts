// Nutrient Checker - Pure Logic
// Deterministic analysis of feeding health based on input vs runoff EC/pH

export type NutrientStage = 'Seedling' | 'Vegging' | 'Flowering';

export interface NutrientTargets {
  ecMin: number;
  ecMax: number;
  phMin: number;
  phMax: number;
}

export const NUTRIENT_TARGETS: Record<NutrientStage, NutrientTargets> = {
  Seedling: { ecMin: 0.4, ecMax: 0.8, phMin: 5.8, phMax: 6.2 },
  Vegging:  { ecMin: 0.8, ecMax: 1.8, phMin: 6.0, phMax: 6.5 },
  Flowering: { ecMin: 1.0, ecMax: 2.4, phMin: 6.0, phMax: 6.8 }
};

// Map plant stage to nutrient stage
export function mapToNutrientStage(plantStage: string): NutrientStage {
  if (plantStage === 'Seedling') return 'Seedling';
  if (plantStage === 'Veg') return 'Vegging';
  return 'Flowering'; // Bloom maps to Flowering
}

export interface FeedingAnalysis {
  // Input values
  inputEc: number | null;
  inputPh: number | null;
  runoffEc: number | null;
  runoffPh: number | null;

  // Calculated deltas
  ecDelta: number | null;    // runoffEc - inputEc
  phDelta: number | null;    // runoffPh - inputPh

  // Status indicators
  ecStatus: 'Optimal' | 'Underfeeding' | 'Overfeeding' | 'Salt Buildup' | 'Hungry' | 'Flush Ready' | 'No Data';
  phStatus: 'Optimal' | 'Too Low' | 'Too High' | 'No Data';

  // Recommendation text
  recommendation: string;

  // Target ranges for display
  targets: NutrientTargets;
}

export function analyzeFeeding(
  inputEc: number | null | undefined,
  inputPh: number | null | undefined,
  runoffEc: number | null | undefined,
  runoffPh: number | null | undefined,
  stage: NutrientStage
): FeedingAnalysis {
  const targets = NUTRIENT_TARGETS[stage];

  // Normalize inputs
  const ec = inputEc ?? null;
  const ph = inputPh ?? null;
  const rEc = runoffEc ?? null;
  const rPh = runoffPh ?? null;

  // Calculate deltas
  const ecDelta = (ec !== null && rEc !== null) ? rEc - ec : null;
  const phDelta = (ph !== null && rPh !== null) ? rPh - ph : null;

  // Determine EC status
  let ecStatus: FeedingAnalysis['ecStatus'] = 'No Data';
  if (ec !== null) {
    if (ec < targets.ecMin) {
      ecStatus = 'Underfeeding';
    } else if (ec > targets.ecMax) {
      ecStatus = 'Overfeeding';
    } else {
      ecStatus = 'Optimal';
    }
  }

  // Check for delta-based conditions
  if (ecDelta !== null) {
    if (ecDelta > 1.0) {
      ecStatus = 'Flush Ready';
    } else if (ecDelta > 0.5) {
      ecStatus = 'Salt Buildup';
    } else if (ecDelta < -0.3 && ecStatus === 'Optimal') {
      ecStatus = 'Hungry';
    }
  }

  // Determine pH status
  let phStatus: FeedingAnalysis['phStatus'] = 'No Data';
  if (ph !== null) {
    if (ph < targets.phMin) {
      phStatus = 'Too Low';
    } else if (ph > targets.phMax) {
      phStatus = 'Too High';
    } else {
      phStatus = 'Optimal';
    }
  }

  // Generate recommendation using decision tree
  const recommendation = buildRecommendation(ecStatus, phStatus, ecDelta, ec, targets);

  return {
    inputEc: ec,
    inputPh: ph,
    runoffEc: rEc,
    runoffPh: rPh,
    ecDelta,
    phDelta,
    ecStatus,
    phStatus,
    recommendation,
    targets
  };
}

function buildRecommendation(
  ecStatus: FeedingAnalysis['ecStatus'],
  phStatus: FeedingAnalysis['phStatus'],
  ecDelta: number | null,
  inputEc: number | null,
  targets: NutrientTargets
): string {
  // Flush Ready
  if (ecStatus === 'Flush Ready') {
    return 'Flush immediately with plain water at EC 0.0. Check runoff until it drops below 1.0 before resuming feeding.';
  }

  // Salt buildup + overfeeding
  if (ecStatus === 'Salt Buildup' && inputEc !== null && inputEc > targets.ecMax) {
    return 'Salt buildup and overfeeding detected. Reduce feed strength by 0.2-0.3 EC and add a plain water flush next watering.';
  }

  // Salt buildup alone
  if (ecStatus === 'Salt Buildup') {
    return 'Salt buildup detected in runoff. Run a plain water flush at EC 0.0 on the next watering. Monitor runoff EC until it drops.';
  }

  // Hungry + underfeeding overlap check (via inputEc being low)
  if (ecStatus === 'Hungry' && inputEc !== null && inputEc < targets.ecMin) {
    return 'Plant is eating heavily and input EC is low. Increase EC gradually by 0.2-0.3 on next feeding.';
  }

  // Hungry
  if (ecStatus === 'Hungry') {
    return 'Plant is consuming heavily - runoff EC lower than input. Consider increasing feed strength slightly next time.';
  }

  // Underfeeding
  if (ecStatus === 'Underfeeding') {
    return 'Input EC is below the optimal range for this stage. Consider increasing feed strength gradually by 0.2 EC.';
  }

  // Overfeeding
  if (ecStatus === 'Overfeeding') {
    return 'Input EC is above the optimal range. Reduce feed EC by 0.2-0.3 to avoid nutrient burn.';
  }

  // pH issues + EC issues
  if (phStatus !== 'Optimal' && phStatus !== 'No Data') {
    if (ecStatus !== 'Optimal' && ecStatus !== 'No Data') {
      const phFix = phStatus === 'Too Low'
        ? 'Adjust pH up with pH Up solution.'
        : 'Adjust pH down with pH Down solution.';
      return `Both EC and pH need attention. ${phFix} Also address the EC issue before next feeding.`;
    }

    if (phStatus === 'Too Low') {
      return 'pH is too low. Adjust up with pH Up solution to the target range. Check runoff pH to confirm uptake.';
    }

    if (phStatus === 'Too High') {
      return 'pH is too high. Adjust down with pH Down solution to the target range. This may affect nutrient availability.';
    }
  }

  // All good
  return 'All parameters look good. Maintain current feeding regimen and monitor runoff periodically.';
}