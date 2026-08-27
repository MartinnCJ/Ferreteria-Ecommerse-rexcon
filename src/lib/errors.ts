const SAFE_SERVER_MESSAGES = [
  "Debes iniciar sesión",
  "Tipo de cuenta comercial no válido",
  "Debes indicar la empresa o ferretería",
  "RUT de empresa inválido",
  "RUT inválido",
  "El carrito está vacío",
  "El pedido contiene demasiadas líneas",
  "El pedido está cancelado",
  "Transición logística no válida",
  "Estado logístico no válido",
  "El pedido debe estar pagado",
  "La nota es demasiado extensa",
  "La cotización ya no está pendiente de revisión",
  "Cotización no encontrada",
  "Las notas son demasiado extensas",
  "La cotización contiene cantidades inválidas",
  "La cotización contiene demasiadas líneas",
  "Tu cuenta no está habilitada para solicitar cotizaciones",
  "Identificador de operación inválido",
  "El carrito contiene cantidades inválidas",
  "Nombre inválido",
  "Correo inválido",
  "Teléfono inválido",
  "Dirección inválida",
  "Región y comuna requeridas",
  "Uno de los productos ya no está disponible",
  "Stock insuficiente",
  "No fue posible calcular el precio",
  "No hay despacho configurado",
  "Pedido no encontrado",
  "No autorizado",
  "Un pedido pagado requiere",
  "El pedido ya no puede cancelarse",
  "El pedido ya fue despachado",
  "El pedido no está esperando una transferencia",
  "La reserva de stock del pedido es inconsistente",
];

export function userErrorMessage(error: unknown, fallback = "Ocurrió un problema. Intenta nuevamente.") {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (!message) return fallback;

  if (/invalid login credentials/i.test(message)) return "Correo o contraseña incorrectos.";
  if (/email not confirmed/i.test(message)) return "Confirma tu correo antes de ingresar.";
  if (/user already registered/i.test(message)) return "Ya existe una cuenta con ese correo.";
  if (/password should be at least|weak password/i.test(message)) return "La contraseña no cumple los requisitos de seguridad.";
  if (/failed to fetch|network|fetch failed/i.test(message)) return "No pudimos conectarnos. Revisa tu conexión e intenta nuevamente.";
  if (SAFE_SERVER_MESSAGES.some((safe) => message.startsWith(safe))) return message;

  console.error("Error técnico ocultado al usuario:", error);
  return fallback;
}
