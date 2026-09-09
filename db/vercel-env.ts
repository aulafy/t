import { getPostgresD1 } from './postgres-d1';

/** Replacement for `cloudflare:workers` selected only during Vercel builds. */
export const env = {
  get DB() {
    return getPostgresD1();
  },
};
