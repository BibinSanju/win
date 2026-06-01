import type { EvaluationRecord, EventType, RatingLabel } from "./types";

export interface TestInputDefinition {
  id: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: string;
  placeholder: string;
}

export interface TestCalculation {
  value: number;
  unit: string;
  score: number;
  zScore: number;
  rating: RatingLabel;
  detail: string;
}

export interface TestDefinition {
  id: string;
  eventType: EventType;
  title: string;
  shortTitle: string;
  description: string;
  weight: number;
  resultLabel: string;
  benchmarkLabel: string;
  inputs: TestInputDefinition[];
  calculate: (inputs: Record<string, number>) => TestCalculation;
}

export interface EventContribution {
  test: TestDefinition;
  record: EvaluationRecord;
}

export interface EventSummary {
  eventType: EventType;
  score: number | null;
  zScore: number | null;
  rating: RatingLabel | null;
  completeness: number;
  completedWeight: number;
  totalWeight: number;
  completedTests: number;
  totalTests: number;
  strengths: EventContribution[];
  gaps: EventContribution[];
}

export interface TestHistoryStats {
  count: number;
  latest: EvaluationRecord | null;
  bestScore: number | null;
  averageScore: number | null;
  standardDeviation: number | null;
  changeFromPrevious: number | null;
  rollingTrend: number | null;
}

interface BenchmarkOptions {
  floor: number;
  target: number;
  higherIsBetter: boolean;
}

interface BenchmarkResult {
  score: number;
  zScore: number;
}

export const EVENT_LABELS: Record<EventType, string> = {
  "long-jump": "Long Jump",
  "triple-jump": "Triple Jump",
};

export const EVENT_KICKERS: Record<EventType, string> = {
  "long-jump": "Speed, takeoff quality, and horizontal power",
  "triple-jump": "Rhythm, elastic strength, and phase control",
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

function erf(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value);
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t -
      0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-x * x));

  return sign * y;
}

function normalCdf(zScore: number): number {
  return 0.5 * (1 + erf(zScore / Math.SQRT2));
}

function scoreFromZ(zScore: number): number {
  return clamp(Math.round(normalCdf(zScore) * 100), 0, 100);
}

function benchmarkScore(value: number, options: BenchmarkOptions): BenchmarkResult {
  const midpoint = (options.floor + options.target) / 2;
  const sd = Math.abs(options.target - options.floor) / 4;
  const zScore =
    sd === 0
      ? 0
      : options.higherIsBetter
        ? (value - midpoint) / sd
        : (midpoint - value) / sd;

  return {
    score: scoreFromZ(zScore),
    zScore: roundOne(zScore),
  };
}

function ratingForScore(score: number): RatingLabel {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Strong";
  if (score >= 55) return "Developing";
  return "Needs focus";
}

function ensurePositive(value: number, message: string): void {
  if (value <= 0) throw new Error(message);
}

function calculateCmj(inputs: Record<string, number>): TestCalculation {
  const value = roundOne(inputs.jumpTouchCm - inputs.standingReachCm);
  ensurePositive(value, "Jump touch must be higher than standing reach.");
  const result = benchmarkScore(value, {
    floor: 20,
    target: 60,
    higherIsBetter: true,
  });

  return {
    value,
    unit: "cm",
    score: result.score,
    zScore: result.zScore,
    rating: ratingForScore(result.score),
    detail: "Jump height from touch mark minus standing reach.",
  };
}

function calculateStandingBroad(inputs: Record<string, number>): TestCalculation {
  const value = roundOne(inputs.bestDistanceCm);
  const result = benchmarkScore(value, {
    floor: 150,
    target: 300,
    higherIsBetter: true,
  });

  return {
    value,
    unit: "cm",
    score: result.score,
    zScore: result.zScore,
    rating: ratingForScore(result.score),
    detail: "Best standing broad jump distance.",
  };
}

function calculateSprint30m(inputs: Record<string, number>): TestCalculation {
  const value = Math.round(inputs.timeSec * 100) / 100;
  const result = benchmarkScore(value, {
    floor: 5.2,
    target: 3.8,
    higherIsBetter: false,
  });

  return {
    value,
    unit: "sec",
    score: result.score,
    zScore: result.zScore,
    rating: ratingForScore(result.score),
    detail: "Lower time scores higher against the 30m benchmark range.",
  };
}

function calculateFiveStrideLongJump(inputs: Record<string, number>): TestCalculation {
  const value = Math.round(inputs.distanceM * 100) / 100;
  const result = benchmarkScore(value, {
    floor: 3.5,
    target: 6.5,
    higherIsBetter: true,
  });

  return {
    value,
    unit: "m",
    score: result.score,
    zScore: result.zScore,
    rating: ratingForScore(result.score),
    detail: "Short approach long jump distance.",
  };
}

function calculateTakeoffAccuracy(inputs: Record<string, number>): TestCalculation {
  const value = roundOne(inputs.averageMissCm);
  const result = benchmarkScore(value, {
    floor: 35,
    target: 3,
    higherIsBetter: false,
  });

  return {
    value,
    unit: "cm",
    score: result.score,
    zScore: result.zScore,
    rating: ratingForScore(result.score),
    detail: "Average board miss across attempts. Lower is better.",
  };
}

function calculateStandingTripleJump(inputs: Record<string, number>): TestCalculation {
  const value = Math.round(inputs.distanceM * 100) / 100;
  const result = benchmarkScore(value, {
    floor: 5.5,
    target: 10.5,
    higherIsBetter: true,
  });

  return {
    value,
    unit: "m",
    score: result.score,
    zScore: result.zScore,
    rating: ratingForScore(result.score),
    detail: "Standing hop-step-jump total distance.",
  };
}

function calculateSingleLegHopBalance(inputs: Record<string, number>): TestCalculation {
  const left = inputs.leftHopCm;
  const right = inputs.rightHopCm;
  const averageDistance = roundOne((left + right) / 2);
  const asymmetryPercent = roundOne((Math.abs(left - right) / averageDistance) * 100);
  const distanceResult = benchmarkScore(averageDistance, {
    floor: 120,
    target: 240,
    higherIsBetter: true,
  });
  const symmetryResult = benchmarkScore(asymmetryPercent, {
    floor: 18,
    target: 0,
    higherIsBetter: false,
  });
  const score = Math.round(distanceResult.score * 0.7 + symmetryResult.score * 0.3);
  const zScore = roundOne(distanceResult.zScore * 0.7 + symmetryResult.zScore * 0.3);

  return {
    value: averageDistance,
    unit: "cm",
    score,
    zScore,
    rating: ratingForScore(score),
    detail: `Average hop distance with ${asymmetryPercent}% side-to-side asymmetry.`,
  };
}

function calculatePhaseBalance(inputs: Record<string, number>): TestCalculation {
  const hop = inputs.hopM;
  const step = inputs.stepM;
  const jump = inputs.jumpM;
  const total = Math.round((hop + step + jump) * 100) / 100;
  const hopRatio = (hop / total) * 100;
  const stepRatio = (step / total) * 100;
  const jumpRatio = (jump / total) * 100;
  const ratioError = roundOne(
    Math.abs(hopRatio - 35) + Math.abs(stepRatio - 30) + Math.abs(jumpRatio - 35)
  );
  const totalResult = benchmarkScore(total, {
    floor: 6.5,
    target: 11.5,
    higherIsBetter: true,
  });
  const ratioResult = benchmarkScore(ratioError, {
    floor: 30,
    target: 0,
    higherIsBetter: false,
  });
  const score = Math.round(totalResult.score * 0.7 + ratioResult.score * 0.3);
  const zScore = roundOne(totalResult.zScore * 0.7 + ratioResult.zScore * 0.3);

  return {
    value: total,
    unit: "m",
    score,
    zScore,
    rating: ratingForScore(score),
    detail: `Total distance with ${ratioError} ratio-error points from 35/30/35.`,
  };
}

const cmjInputs: TestInputDefinition[] = [
  {
    id: "standingReachCm",
    label: "Standing reach",
    unit: "cm",
    min: 100,
    max: 300,
    step: "0.1",
    placeholder: "235.0",
  },
  {
    id: "jumpTouchCm",
    label: "Jump touch",
    unit: "cm",
    min: 120,
    max: 380,
    step: "0.1",
    placeholder: "284.0",
  },
];

export const TEST_DEFINITIONS: TestDefinition[] = [
  {
    id: "cmj",
    eventType: "long-jump",
    title: "Countermovement Jump",
    shortTitle: "CMJ",
    description: "Vertical power from a standing reach and jump touch mark.",
    weight: 25,
    resultLabel: "Jump height",
    benchmarkLabel: "20-60 cm",
    inputs: cmjInputs,
    calculate: calculateCmj,
  },
  {
    id: "standing-broad",
    eventType: "long-jump",
    title: "Standing Broad Jump",
    shortTitle: "Broad jump",
    description: "Horizontal explosive power using best measured distance.",
    weight: 20,
    resultLabel: "Best distance",
    benchmarkLabel: "150-300 cm",
    inputs: [
      {
        id: "bestDistanceCm",
        label: "Best distance",
        unit: "cm",
        min: 50,
        max: 400,
        step: "0.1",
        placeholder: "245.0",
      },
    ],
    calculate: calculateStandingBroad,
  },
  {
    id: "sprint-30m",
    eventType: "long-jump",
    title: "30m Sprint",
    shortTitle: "30m sprint",
    description: "Acceleration profile from a stopwatch time.",
    weight: 25,
    resultLabel: "Time",
    benchmarkLabel: "5.20-3.80 sec",
    inputs: [
      {
        id: "timeSec",
        label: "30m time",
        unit: "sec",
        min: 2.5,
        max: 10,
        step: "0.01",
        placeholder: "4.45",
      },
    ],
    calculate: calculateSprint30m,
  },
  {
    id: "five-stride-lj",
    eventType: "long-jump",
    title: "5-Stride Long Jump",
    shortTitle: "5-stride LJ",
    description: "Short-approach jump distance with controlled approach length.",
    weight: 20,
    resultLabel: "Distance",
    benchmarkLabel: "3.5-6.5 m",
    inputs: [
      {
        id: "distanceM",
        label: "Jump distance",
        unit: "m",
        min: 1,
        max: 10,
        step: "0.01",
        placeholder: "5.12",
      },
    ],
    calculate: calculateFiveStrideLongJump,
  },
  {
    id: "takeoff-accuracy",
    eventType: "long-jump",
    title: "Takeoff Accuracy",
    shortTitle: "Board accuracy",
    description: "Average takeoff-board miss measured across attempts.",
    weight: 10,
    resultLabel: "Average miss",
    benchmarkLabel: "35-3 cm",
    inputs: [
      {
        id: "averageMissCm",
        label: "Average board miss",
        unit: "cm",
        min: 0,
        max: 100,
        step: "0.1",
        placeholder: "11.5",
      },
    ],
    calculate: calculateTakeoffAccuracy,
  },
  {
    id: "cmj",
    eventType: "triple-jump",
    title: "Countermovement Jump",
    shortTitle: "CMJ",
    description: "Vertical power from a standing reach and jump touch mark.",
    weight: 15,
    resultLabel: "Jump height",
    benchmarkLabel: "20-60 cm",
    inputs: cmjInputs,
    calculate: calculateCmj,
  },
  {
    id: "standing-triple",
    eventType: "triple-jump",
    title: "Standing Triple Jump",
    shortTitle: "Standing TJ",
    description: "Hop-step-jump distance from a standing start.",
    weight: 25,
    resultLabel: "Total distance",
    benchmarkLabel: "5.5-10.5 m",
    inputs: [
      {
        id: "distanceM",
        label: "Total distance",
        unit: "m",
        min: 2,
        max: 15,
        step: "0.01",
        placeholder: "8.40",
      },
    ],
    calculate: calculateStandingTripleJump,
  },
  {
    id: "single-leg-hop",
    eventType: "triple-jump",
    title: "Single-Leg Hop Balance",
    shortTitle: "Hop balance",
    description: "Left/right single-leg hop distance and symmetry.",
    weight: 15,
    resultLabel: "Average hop",
    benchmarkLabel: "120-240 cm plus symmetry",
    inputs: [
      {
        id: "leftHopCm",
        label: "Left hop",
        unit: "cm",
        min: 50,
        max: 350,
        step: "0.1",
        placeholder: "190.0",
      },
      {
        id: "rightHopCm",
        label: "Right hop",
        unit: "cm",
        min: 50,
        max: 350,
        step: "0.1",
        placeholder: "188.0",
      },
    ],
    calculate: calculateSingleLegHopBalance,
  },
  {
    id: "sprint-30m",
    eventType: "triple-jump",
    title: "30m Sprint",
    shortTitle: "30m sprint",
    description: "Acceleration profile from a stopwatch time.",
    weight: 20,
    resultLabel: "Time",
    benchmarkLabel: "5.20-3.80 sec",
    inputs: [
      {
        id: "timeSec",
        label: "30m time",
        unit: "sec",
        min: 2.5,
        max: 10,
        step: "0.01",
        placeholder: "4.45",
      },
    ],
    calculate: calculateSprint30m,
  },
  {
    id: "phase-balance",
    eventType: "triple-jump",
    title: "Short-Approach Phase Balance",
    shortTitle: "Phase balance",
    description: "Hop, step, and jump distances compared with a 35/30/35 rhythm.",
    weight: 25,
    resultLabel: "Total distance",
    benchmarkLabel: "Total distance plus 35/30/35 ratio",
    inputs: [
      {
        id: "hopM",
        label: "Hop distance",
        unit: "m",
        min: 0.5,
        max: 6,
        step: "0.01",
        placeholder: "3.10",
      },
      {
        id: "stepM",
        label: "Step distance",
        unit: "m",
        min: 0.5,
        max: 6,
        step: "0.01",
        placeholder: "2.75",
      },
      {
        id: "jumpM",
        label: "Jump distance",
        unit: "m",
        min: 0.5,
        max: 6,
        step: "0.01",
        placeholder: "3.15",
      },
    ],
    calculate: calculatePhaseBalance,
  },
];

export function getEventTests(eventType: EventType): TestDefinition[] {
  return TEST_DEFINITIONS.filter((test) => test.eventType === eventType);
}

export function getTestDefinition(
  eventType: EventType,
  testId: string
): TestDefinition | undefined {
  return TEST_DEFINITIONS.find(
    (test) => test.eventType === eventType && test.id === testId
  );
}

export function getRating(score: number): RatingLabel {
  return ratingForScore(score);
}

export function formatScore(score: number | null): string {
  return score === null ? "-" : String(Math.round(score));
}

export function formatZScore(zScore: number | null): string {
  if (zScore === null) return "-";
  if (zScore > 0) return `+${zScore.toFixed(1)}`;
  return zScore.toFixed(1);
}

export function formatDelta(value: number | null): string {
  if (value === null) return "-";
  const rounded = roundOne(value);
  if (rounded > 0) return `+${rounded}`;
  return String(rounded);
}

export function calculateEventSummary(
  eventType: EventType,
  evaluations: EvaluationRecord[]
): EventSummary {
  const tests = getEventTests(eventType);
  const latestRecords = latestRecordByTest(eventType, evaluations);
  const totalWeight = tests.reduce((sum, test) => sum + test.weight, 0);
  let completedWeight = 0;
  let scoreNumerator = 0;
  let zNumerator = 0;
  const contributions: EventContribution[] = [];

  for (const test of tests) {
    const record = latestRecords.get(test.id);
    if (!record) continue;
    completedWeight += test.weight;
    scoreNumerator += record.score * test.weight;
    zNumerator += record.zScore * test.weight;
    contributions.push({ test, record });
  }

  const score = completedWeight > 0 ? roundOne(scoreNumerator / completedWeight) : null;
  const zScore = completedWeight > 0 ? roundOne(zNumerator / completedWeight) : null;
  const completeness = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;
  const sortedByScore = [...contributions].sort((a, b) => b.record.score - a.record.score);
  const sortedGaps = [...contributions].sort((a, b) => a.record.score - b.record.score);

  return {
    eventType,
    score,
    zScore,
    rating: score === null ? null : ratingForScore(score),
    completeness,
    completedWeight,
    totalWeight,
    completedTests: contributions.length,
    totalTests: tests.length,
    strengths: sortedByScore.slice(0, 2),
    gaps: sortedGaps.slice(0, 2),
  };
}

export function calculateTestStats(records: EvaluationRecord[]): TestHistoryStats {
  const sorted = [...records].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const scores = sorted.map((record) => record.score);
  const count = scores.length;

  if (count === 0) {
    return {
      count,
      latest: null,
      bestScore: null,
      averageScore: null,
      standardDeviation: null,
      changeFromPrevious: null,
      rollingTrend: null,
    };
  }

  const latest = sorted[count - 1] ?? null;
  const averageScore = average(scores);
  const variance = average(scores.map((score) => Math.pow(score - averageScore, 2)));
  const recentStart = Math.max(0, count - 3);
  const previousEnd = recentStart;
  const previousStart = Math.max(0, previousEnd - 3);
  const recentScores = scores.slice(recentStart);
  const previousScores = scores.slice(previousStart, previousEnd);
  const rollingTrend =
    previousScores.length > 0
      ? roundOne(average(recentScores) - average(previousScores))
      : count > 1
        ? roundOne(scores[count - 1] - scores[0])
        : null;

  return {
    count,
    latest,
    bestScore: Math.max(...scores),
    averageScore: roundOne(averageScore),
    standardDeviation: roundOne(Math.sqrt(variance)),
    changeFromPrevious:
      count > 1 ? roundOne(scores[count - 1] - scores[count - 2]) : null,
    rollingTrend,
  };
}

function latestRecordByTest(
  eventType: EventType,
  evaluations: EvaluationRecord[]
): Map<string, EvaluationRecord> {
  const latest = new Map<string, EvaluationRecord>();

  for (const record of evaluations) {
    if (record.eventType !== eventType) continue;
    const previous = latest.get(record.testId);
    if (!previous || record.createdAt > previous.createdAt) {
      latest.set(record.testId, record);
    }
  }

  return latest;
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
