# Despliegue

El repositorio contiene el MVP funcional de ExtraClaro y está preparado para revisión en GitHub.

## Estado actual

- Frontend y rutas: Vinext/React/TypeScript.
- Runtime actual: Cloudflare Worker.
- Persistencia actual: D1 compatible con SQLite/Drizzle.
- No se ha desplegado automáticamente en Vercel ni se han creado recursos Supabase.

## Vercel + Supabase

Se han añadido `vercel.json`, `.env.example` y `supabase/schema.sql`. Para usar Vercel y Supabase todavía hay que adaptar la persistencia de `lib/service.ts` y las rutas de servidor al runtime de Vercel: el servicio actual depende de `D1Database`, `prepare()`, `batch()` y transacciones condicionales. El esquema PostgreSQL no sustituye ese adaptador.

Variables mínimas esperadas para esa adaptación:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (solo servidor)

El Site de Sites y D1 siguen siendo la referencia funcional validada; Vercel/Supabase deben probarse con la misma suite antes de sustituirlos.
