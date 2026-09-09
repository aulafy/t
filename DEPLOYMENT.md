# Despliegue

El repositorio contiene el MVP funcional de ExtraClaro y está preparado para revisión en GitHub.

## Estado actual

- Frontend y rutas: Vinext/React/TypeScript.
- Runtime actual: Cloudflare Worker.
- Persistencia actual: D1 compatible con SQLite/Drizzle.
- No se ha desplegado automáticamente en Vercel ni se han creado recursos Supabase.

## Vercel + Supabase

El build de Vercel usa Nitro y reemplaza el binding D1 por el adaptador PostgreSQL de `db/postgres-d1.ts`.

1. Ejecuta `supabase/schema.sql` en el editor SQL de Supabase.
2. Añade `SUPABASE_DB_URL` en Vercel con la URL del *transaction pooler* de Supabase.
3. Añade `EXTRACLARO_OWNER_ID` y `EXTRACLARO_OWNER_EMAIL` en Vercel.
4. Activa Vercel Deployment Protection o coloca autenticación delante de la app: todo visitante admitido usa la identidad del propietario configurado.
5. Vuelve a desplegar el último commit. Vercel lee el comando y la salida desde `vercel.json`.
