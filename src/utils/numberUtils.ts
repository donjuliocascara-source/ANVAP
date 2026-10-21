/**
 * Utilidades para sanitización numérica y prevención de valores NaN en atributos de React (HTML input)
 */

/**
 * Retorna un número válido o una cadena vacía (o fallback) para pasar con seguridad a la propiedad `value` de un <input>.
 * Evita estrictamente la advertencia de React: "Received NaN for the %s attribute".
 */
export function safeNumVal(val: unknown, fallback: string | number = ""): string | number {
  if (val === undefined || val === null) {
    return fallback;
  }
  if (typeof val === "number") {
    return isNaN(val) || !isFinite(val) ? fallback : val;
  }
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (trimmed === "" || trimmed === "NaN" || trimmed === "undefined" || trimmed === "null") {
      return fallback;
    }
    return val;
  }
  return fallback;
}

/**
 * Parsea un input de usuario a número opcional de forma segura.
 * Si el usuario borra el campo ("") o introduce caracteres inválidos, retorna `undefined` en lugar de `NaN`.
 */
export function parseOptionalNumber(val: string): number | undefined {
  if (val === "" || val === undefined || val === null) return undefined;
  const parsed = parseFloat(val);
  return isNaN(parsed) || !isFinite(parsed) ? undefined : parsed;
}

/**
 * Parsea un input numérico con fallback 0 si está vacío o es inválido.
 */
export function parseNumberOrZero(val: string): number {
  if (val === "" || val === undefined || val === null) return 0;
  const parsed = parseFloat(val);
  return isNaN(parsed) || !isFinite(parsed) ? 0 : parsed;
}

/**
 * Retorna un número seguro para operaciones matemáticas (nunca devuelve NaN).
 */
export function safeNumber(val: unknown, fallback: number = 0): number {
  if (val === undefined || val === null) return fallback;
  if (typeof val === "number") {
    return isNaN(val) || !isFinite(val) ? fallback : val;
  }
  const parsed = parseFloat(String(val));
  return isNaN(parsed) || !isFinite(parsed) ? fallback : parsed;
}

/**
 * Formatea un número con decimales de forma segura, retornando fallback si es NaN o inválido.
 */
export function safeFixed(val: unknown, digits: number = 2, fallback: string = "—"): string {
  const num = safeNumber(val, NaN);
  if (isNaN(num)) return fallback;
  return num.toFixed(digits);
}
