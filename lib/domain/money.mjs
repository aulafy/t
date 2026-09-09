// Contrato solicitado a Rapid-MLX; implementación corregida tras revisión.
export function parseEuroInput(value) {
  if (typeof value !== 'string') throw new Error('Escribe un importe.');
  const input = value.trim();
  if (input.length > 24 || !/^[0-9]+(?:[.,][0-9]{1,2})?$/.test(input))
    throw new Error(
      'Usa un importe sin separador de miles, por ejemplo 1200,50.',
    );
  const [whole, fraction = ''] = input.split(/[.,]/);
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (cents > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error('El importe es demasiado grande.');
  return Number(cents);
}
export function formatEuro(cents) {
  if (!Number.isSafeInteger(cents) || cents < 0)
    throw new Error('Importe inválido.');
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}
