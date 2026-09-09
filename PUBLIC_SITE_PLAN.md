# Plan de Site público para ExtraClaro

## Objetivo

Permitir que un cliente externo revise y decida un extra mediante `/c/:token`, sin iniciar sesión, mientras el workspace profesional permanece en el Site privado.

## Incluye

- `GET /c/:token`: lectura de una única revisión identificada por token.
- `POST /api/review/:token`: aprobación o rechazo explícitos.
- Token aleatorio de alta entropía almacenado solo como hash.
- Caducidad, revocación, `snapshot_hash` y `context_version`.
- Desglose de base, IVA, extras previos y total resultante.
- Rate limiting, respuestas sin caché y ausencia de scripts de terceros.

## Excluye

- Workspace, proyectos, listado de obras y cualquier ruta autenticada.
- Acceso a D1 que no esté limitado al token y a su revisión.
- Datos personales adicionales, analítica de terceros o credenciales del profesional.
- Creación, edición, ejecución y cobro de extras.

## Verificación previa al despliegue

1. Abrir el enlace sin sesión desde un móvil externo.
2. Confirmar que solo aparece la revisión autorizada.
3. Aprobar y comprobar el resultado en el workspace privado.
4. Repetir la decisión y verificar idempotencia.
5. Intentar usar un token caducado o revocado y confirmar el rechazo.

No desplegar esta variante hasta confirmar la política de acceso anónimo del proveedor de hosting.
