export interface DailyAttemptStat {
  date?: string;
  total_attempts?: number | string;
  submitted?: number | string;
  graded?: number | string;
  avg_score?: number | string | null;
}

export interface AttemptKpis {
  totalAttempts: number;
  totalCompleted: number;
  completionRate: number;
  overallAvgScore: string | number;
}

/**
 * Computes executive attempt KPIs from daily aggregated attempt rows:
 * - `totalCompleted` includes both `submitted` and `graded` attempts.
 * - `overallAvgScore` weights each day's average score by attempt volume.
 */
export function computeAttemptKpis(rows: DailyAttemptStat[]): AttemptKpis {
  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      totalAttempts: 0,
      totalCompleted: 0,
      completionRate: 0,
      overallAvgScore: 0,
    };
  }

  let totalAttempts = 0;
  let totalCompleted = 0;
  let weightedScoreSum = 0;
  let weightedCount = 0;

  for (const row of rows) {
    const attempts = parseInt(String(row.total_attempts ?? 0), 10) || 0;
    const submitted = parseInt(String(row.submitted ?? 0), 10) || 0;
    const graded = parseInt(String(row.graded ?? 0), 10) || 0;
    const completed = submitted + graded;

    totalAttempts += attempts;
    totalCompleted += completed;

    const avg = parseFloat(String(row.avg_score ?? ''));
    const weight = completed > 0 ? completed : attempts;
    if (!isNaN(avg) && avg > 0 && weight > 0) {
      weightedScoreSum += avg * weight;
      weightedCount += weight;
    }
  }

  const completionRate =
    totalAttempts > 0 ? Math.min(100, Math.round((totalCompleted / totalAttempts) * 100)) : 0;

  const overallAvgScore =
    weightedCount > 0 ? (weightedScoreSum / weightedCount).toFixed(1) : 0;

  return {
    totalAttempts,
    totalCompleted,
    completionRate,
    overallAvgScore,
  };
}

