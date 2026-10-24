import { neon, neonConfig } from '@neondatabase/serverless';

const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.VITE_NEON_DATABASE_URL;

if (!databaseUrl) {
  console.warn(
    '[Server DB] DATABASE_URL (or POSTGRES_URL / VITE_NEON_DATABASE_URL) is not set in environment.'
  );
}

// Resilient fetch wrapper with retry for cold starts and transient network resets
const getFetch = () => globalThis.fetch;

neonConfig.fetchFunction = async (url: any, options: any) => {
  const fetchFn = getFetch();
  let attempts = 0;
  const maxAttempts = 3;
  while (attempts < maxAttempts) {
    try {
      return await fetchFn(url, options);
    } catch (err: any) {
      attempts++;
      if (attempts >= maxAttempts) throw err;
      console.warn(
        `[Server NeonDB] Network request failed (${err?.message || err}). Retrying attempt ${attempts}/${maxAttempts}...`
      );
      await new Promise(resolve => setTimeout(resolve, attempts * 500));
    }
  }
};

const rawSql = databaseUrl ? neon(databaseUrl) : null;

function getActiveDbUrl(): string {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.VITE_NEON_DATABASE_URL ||
    databaseUrl ||
    ''
  );
}

// Proxy sql calls so if the database URL was missing at startup, it throws a descriptive error on query
export const sql = new Proxy((() => {}) as any, {
  apply(_target, _thisArg, argArray) {
    const url = getActiveDbUrl();
    if (!url) {
      throw new Error(
        'Database connection failed: DATABASE_URL (or POSTGRES_URL / VITE_NEON_DATABASE_URL) is not configured.'
      );
    }
    const client = rawSql || neon(url);
    return Reflect.apply(client, _thisArg, argArray);
  },
  get(_target, prop) {
    const url = getActiveDbUrl();
    if (!url) {
      throw new Error(
        'Database connection failed: DATABASE_URL (or POSTGRES_URL / VITE_NEON_DATABASE_URL) is not configured.'
      );
    }
    const client = rawSql || neon(url);
    return (client as any)[prop];
  },
});
