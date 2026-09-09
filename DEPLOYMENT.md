# Despliegue

El repositorio contiene el MVP funcional de ExtraClaro y está preparado para revisión en GitHub.

## Estado actual

- Frontend y rutas: Vinext/React/TypeScript.
- Runtime actual: Cloudflare Worker.
- Persistencia actual: D1 compatible con SQLite/Drizzle.
- No se ha desplegado automáticamente en Vercel ni se han creado recursos Supabase.

## Vercel + Supabase

Para usar Vercel y Supabase hay que adaptar el adaptador de persistencia de `lib/service.ts` y las rutas de servidor al runtime de Vercel, y crear las tablas equivalentes en PostgreSQL de Supabase. No se deben reutilizar credenciales de D1 ni inventar variables de entorno.

Variables mínimas esperadas para esa adaptación:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (solo servidor)

El Site de Sites y D1 siguen siendo la referencia funcional validada; Vercel/Supabase deben probarse con la misma suite antes de sustituirlos.
