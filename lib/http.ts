import { AppError } from './service';
export function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
export function failure(e: unknown) {
  if (e instanceof AppError) {
    const response = json({ error: e.message }, e.status);
    if ('retryAfter' in e)
      response.headers.set('Retry-After', String(e.retryAfter));
    return response;
  }
  console.error('request_failed', e instanceof Error ? e.name : 'unknown');
  return json(
    { error: 'No se pudo completar la operación. Vuelve a intentarlo.' },
    500,
  );
}
export async function body(req: Request) {
  const origin = req.headers.get('origin');
  if (!origin || origin !== new URL(req.url).origin)
    throw new AppError(403, 'Origen de solicitud no válido.');
  if (!req.headers.get('content-type')?.startsWith('application/json'))
    throw new AppError(415, 'Formato de solicitud no válido.');
  const reader = req.body?.getReader();
  if (!reader) throw new AppError(400, 'Solicitud vacía.');
  const decoder = new TextDecoder();
  let raw = '',
    bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 12000) {
        await reader.cancel();
        throw new AppError(413, 'Solicitud demasiado grande.');
      }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  try {
    const b = JSON.parse(raw);
    if (!b || typeof b !== 'object' || Array.isArray(b)) throw Error();
    return b;
  } catch {
    throw new AppError(400, 'Solicitud no válida.');
  }
}
