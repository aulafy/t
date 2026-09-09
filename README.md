# ExtraClaro · Aplicación web

MVP privado para registrar extras de reforma, congelar una versión, compartir una revisión, aprobar/rechazar y registrar ejecución/cobro manual. No está abierto a clientes externos.

## Desarrollo

Requiere Node.js 22.13 o posterior y npm. Instalar con `npm install` y arrancar con `npm run dev -- --host 127.0.0.1`. El starter ofrece inicio de sesión local en `/signin-with-chatgpt?return_to=/`, solo desde localhost.

En una base local nueva, aplicar el SQL generado con `npx wrangler d1 execute DB --local --config wrangler.local.json --persist-to .wrangler/state --file drizzle/0000_*.sql`. Este comando inicial se ejecuta una sola vez; no repetir sobre una base con tablas. Producción aplica y registra las migraciones mediante Sites; nunca se inicializa el esquema desde las rutas HTTP.

## Verificación

- `npm test`: pruebas del servicio real y sus consultas contra SQLite aislado. El adaptador serializa lotes como D1.
- `npm run typecheck`: TypeScript.
- `npm run build`: Worker y aplicación de producción.
- El flujo HTTP local también se ha probado con autenticación de desarrollo, creación, envío, revisión anónima por token, aprobación, reintento, ejecución y cobro.

No se ha realizado prueba visual en navegador. La herramienta WebMCP de lectura usa detección de soporte y no ha sido verificada en un contexto compatible.

## Límites actuales

- En Sites el acceso inicial es solo del propietario. Los enlaces de clientes tienen un flujo anónimo implementado, pero la política privada del sitio impide compartirlos con terceros por ahora.
- Un usuario equivale a un espacio de empresa. No hay invitaciones de equipo.
- El enlace solo se muestra al generarlo. Se almacena su hash; para reemplazar uno perdido se crea otra versión.
- Exportación JSON del historial e impresión/guardar PDF desde la revisión. No hay adjuntos ni PDF generado por el servidor.
- No hay facturación, conexión bancaria, pagos parciales ni mensajes enviados automáticamente.
- El registro de nombre es identidad declarada; no se presenta como firma cualificada.
- Pendientes antes del piloto público: límites de frecuencia, política de retención, evaluación de privacidad, respaldo/restauración de producción y elección de autenticación comercial.

Los secretos no se guardan en el repositorio. `.openai/hosting.json` contiene únicamente el proyecto y bindings lógicos.
