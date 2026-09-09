// Generado con Rapid-MLX y revisado por el integrador.
export function calculateTotal(baseCents, taxBasisPoints) {
  if (!Number.isSafeInteger(baseCents) || baseCents < 0) {
    throw new Error('baseCents debe ser un entero seguro no negativo');
  }
  if (
    !Number.isSafeInteger(taxBasisPoints) ||
    taxBasisPoints < 0 ||
    taxBasisPoints > 10000
  ) {
    throw new Error('taxBasisPoints debe ser un entero entre 0 y 10000');
  }

  const baseBig = BigInt(baseCents);
  const taxBig = (baseBig * BigInt(taxBasisPoints) + 5000n) / 10000n;
  const totalBig = baseBig + taxBig;

  // Comprobar el límite de enteros exactos de JavaScript (2^53 - 1).
  const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER;
  if (totalBig > BigInt(MAX_SAFE_INTEGER)) {
    throw new Error('El total excede el límite seguro de JavaScript');
  }

  const baseCentsResult = Number(baseBig);
  const taxCents = Number(taxBig);
  const totalCents = Number(totalBig);

  return { baseCents: baseCentsResult, taxCents, totalCents };
}

const validTransitions = new Map([
  ['draft:send', 'sent'],
  ['draft:void', 'void'],
  ['sent:approve', 'approved'],
  ['sent:reject', 'rejected'],
  ['sent:void', 'void'],
  ['approved:execute', 'executed'],
  ['executed:pay', 'paid'],
]);

export function transition(status, action) {
  if (typeof status !== 'string' || typeof action !== 'string') {
    throw new Error('Estado y acción deben ser texto');
  }
  const key = status + ':' + action;
  if (!validTransitions.has(key)) {
    throw new Error('Transición no permitida: ' + key);
  }
  return validTransitions.get(key);
}
