import { getRawDb } from '@/db';
import { AppError, hash } from './service';

// Contadores persistentes y atómicos: comparten presupuesto entre Workers.
// Solo se guardan hashes con ventana temporal; nunca tokens, correos ni IP.
export async function consumeBudget(
  subject: string,
  limit: number,
  at = Date.now(),
) {
  const window = Math.floor(at / 60000),
    expires = (window + 1) * 60000;
  const id = await hash(`${window}:${subject}`),
    db = getRawDb();
  await db
    .prepare(
      'DELETE FROM request_windows WHERE id IN (SELECT id FROM request_windows WHERE expires_at<=? ORDER BY expires_at LIMIT 32)',
    )
    .bind(at)
    .run();
  const accepted = await db
    .prepare(
      'INSERT INTO request_windows (id,used,expires_at) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET used=request_windows.used+1 WHERE request_windows.used<? RETURNING request_windows.used AS used',
    )
    .bind(id, expires, limit)
    .first();
  if (!accepted) {
    const e = new AppError(
      429,
      'Demasiadas solicitudes. Espera un momento y vuelve a intentarlo.',
    );
    Object.assign(e, {
      retryAfter: Math.max(1, Math.ceil((expires - at) / 1000)),
    });
    throw e;
  }
}
export async function reviewBudget(token: string, write = false) {
  await consumeBudget('public-review-global', 1200);
  if (!/^[a-f0-9]{64}$/.test(token))
    throw new AppError(404, 'Enlace no encontrado.');
  await consumeBudget(
    `review-${write ? 'write' : 'read'}:${token}`,
    write ? 30 : 120,
  );
}
