import { env } from 'cloudflare:workers';
export function getRawDb(): D1Database {
  if (!env.DB) throw new Error('Almacenamiento no disponible.');
  return env.DB;
}
