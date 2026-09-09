# ExtraClaro

Aplicación web para acordar trabajos extra en reformas.

Prueba privada: https://extraclaro.rmn1978.chatgpt.site Arquitectura en [ARQUITECTURA.md](ARQUITECTURA.md) y código en web/.

## Implementado

Obras persistentes, borradores editables, versiones congeladas, enlaces de revisión, aprobación/rechazo, anulación, nueva versión, ejecución y cobro completo manual. Historial exportable a JSON y revisión imprimible para guardar como PDF desde el navegador.

El prototipo de Sites se publica inicialmente solo para su propietario. El flujo de cliente por token está implementado, pero el acceso de terceros permanece cerrado. No es todavía un servicio comercial abierto.

## Comprobaciones

- 9 pruebas de dominio e importes: `npm test` en esta carpeta.
- 14 pruebas del servicio, incluyendo concurrencia, idempotencia y aislamiento: `npm test` en web/.
- TypeScript y compilación del Worker correctos.
- Recorrido HTTP completo contra D1 local comprobado.
- Sin pruebas visuales de navegador. WebMCP de lectura incluido, sin validación en contexto compatible.

Las instrucciones de arranque están en web/README.md.

## Trabajo con modelos

Rapid-MLX se utilizó para generar módulos pequeños. Sus propuestas necesitaron correcciones de aritmética y validación; se integró solo código revisado y probado. Grok CLI aportó revisión de producto y de concurrencia. Una revisión adicional de código se interrumpió tras más de siete minutos sin respuesta; no se usa como evidencia de validación.

Prompts y revisiones en docs/. Las referencias de X siguen pendientes de comprobación independiente. Los modelos de desarrollo no reciben datos de clientes y la aplicación no necesita IA para funcionar.

## Pendiente antes de un piloto comercial

Acceso de clientes externos, membresías de empresa, límites de frecuencia, revisión de privacidad/retención y respaldo/restauración. Adjuntos y PDF generado en servidor están pendientes. La validación de demanda requiere empresas reales y no se sustituye con pruebas técnicas.
