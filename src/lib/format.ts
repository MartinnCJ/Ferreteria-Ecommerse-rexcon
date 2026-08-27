export const money = (value: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(Math.round(value || 0));

export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

/** Limpia un RUT chileno dejando solo dígitos y dígito verificador. */
export function cleanRut(rut: string) {
  return (rut || "").replace(/[^0-9kK]/g, "").toUpperCase();
}

/** Formatea 123456789 -> 12.345.678-9 */
export function formatRut(rut: string) {
  const clean = cleanRut(rut);
  if (clean.length < 2) return clean;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  return `${body.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}-${dv}`;
}

/** Validación módulo 11 del RUT chileno. */
export function isValidRut(rut: string) {
  const clean = cleanRut(rut);
  if (clean.length < 7) return false;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  if (!/^\d+$/.test(body)) return false;
  let sum = 0;
  let multiplier = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const rest = 11 - (sum % 11);
  const expected = rest === 11 ? "0" : rest === 10 ? "K" : String(rest);
  return expected === dv;
}
