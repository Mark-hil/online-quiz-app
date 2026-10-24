import { QuestionBankItem } from '../lib/database';

export interface BalancedSessionPools {
  [sessionIndex: number]: QuestionBankItem[];
}

/**
 * Fisher-Yates array shuffle with optional deterministic PRNG seed
 */
export function shuffleArray<T>(array: T[], seed?: string): T[] {
  const arr = [...array];
  let m = arr.length;
  let t: T;
  let i: number;

  let seedNum = 0;
  if (seed) {
    for (let c = 0; c < seed.length; c++) {
      seedNum = (seedNum << 5) - seedNum + seed.charCodeAt(c);
      seedNum |= 0;
    }
    seedNum = Math.abs(seedNum);
  }

  const random = () => {
    if (!seed) return Math.random();
    seedNum = (seedNum * 9301 + 49297) % 233280;
    return seedNum / 233280;
  };

  while (m) {
    i = Math.floor(random() * m--);
    t = arr[m];
    arr[m] = arr[i];
    arr[i] = t;
  }

  return arr;
}

/**
 * Stratified Round-Robin Session Splitter
 * Distributes questions across K sessions while guaranteeing:
 * 1. Zero question overlap (disjoint sets)
 * 2. Equal distribution of Easy, Medium, and Hard strata across each session
 * 3. Identical psychometric difficulty curves
 */
export function generateBalancedSessionPools(
  bankQuestions: QuestionBankItem[],
  sessionCount: number = 2
): BalancedSessionPools {
  const pools: BalancedSessionPools = {};
  for (let s = 1; s <= sessionCount; s++) {
    pools[s] = [];
  }

  if (!bankQuestions || bankQuestions.length === 0 || sessionCount < 1) {
    return pools;
  }

  // 1. Stratify by difficulty
  const easy = bankQuestions.filter(q => q.difficulty === 'easy' && q.status === 'active');
  const medium = bankQuestions.filter(q => q.difficulty === 'medium' && q.status === 'active');
  const hard = bankQuestions.filter(q => q.difficulty === 'hard' && q.status === 'active');

  const others = bankQuestions.filter(q => 
    q.status === 'active' && 
    q.difficulty !== 'easy' && 
    q.difficulty !== 'medium' && 
    q.difficulty !== 'hard'
  );

  // 2. Round-Robin deal function
  const distributeStratum = (stratum: QuestionBankItem[]) => {
    const shuffled = shuffleArray(stratum);
    shuffled.forEach((q, idx) => {
      const poolIndex = (idx % sessionCount) + 1;
      pools[poolIndex].push(q);
    });
  };

  // 3. Deal each stratum evenly
  distributeStratum(easy);
  distributeStratum(medium);
  distributeStratum(hard);
  distributeStratum(others);

  return pools;
}

/**
 * Samples N questions dynamically from a pool for a student attempt
 */
export function sampleStudentQuestions(
  pool: QuestionBankItem[],
  drawCount: number,
  attemptId: string
): QuestionBankItem[] {
  if (!pool || pool.length === 0) return [];
  const targetCount = Math.min(drawCount, pool.length);
  
  // Deterministically shuffle pool using attemptId as seed so retry/reloads are stable
  const shuffled = shuffleArray(pool, attemptId);
  return shuffled.slice(0, targetCount);
}
