export type SupabaseConfig = { url: string; serviceRoleKey: string };

/** Server-only Supabase REST client. Never import this module from a client component. */
export function getSupabaseConfig(env: Record<string, string | undefined> = process.env): SupabaseConfig | null {
  const url = env.SUPABASE_URL?.replace(/\/$/, '');
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  return url && serviceRoleKey ? { url, serviceRoleKey } : null;
}

export async function supabaseRequest<T>(
  path: string,
  init: RequestInit = {},
  config = getSupabaseConfig(),
): Promise<T> {
  if (!config) throw new Error('SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son obligatorias.');
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) throw new Error(`Supabase respondió ${response.status}: ${await response.text()}`);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
