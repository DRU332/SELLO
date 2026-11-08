// Mensajes en español para los códigos de error que devuelve la base.
const MESSAGES: Record<string, string> = {
  consent_required: "Para continuar debes aceptar el aviso de privacidad.",
  invalid_name: "Escribe tu nombre (mínimo 2 letras).",
  invalid_phone: "Escribe un número de WhatsApp de 10 dígitos.",
  invalid_birthday: "La fecha de cumpleaños no es válida.",
  not_found: "No encontramos lo que buscas.",
  suspended: "Este negocio tiene la tarjeta en pausa por el momento. Tus sellos están a salvo.",
  rate_limited: "Demasiados intentos. Espera unos minutos y vuelve a intentar.",
  program_ended: "La promoción ya terminó.",
  not_started: "La promoción todavía no empieza.",
  exists: "Este número ya tiene una tarjeta en este negocio.",
  invalid: "PIN incorrecto.",
  unauthorized: "Tu sesión terminó. Vuelve a entrar con tu PIN.",
  cooldown: "Este cliente ya recibió un sello hace poco.",
  card_full: "La tarjeta está completa: primero canjea el premio.",
  undo_expired: "Ya pasaron más de 2 minutos; no se puede deshacer.",
  card_redeemed: "La tarjeta ya se canjeó; no se puede deshacer.",
  not_enough: "Aún no tiene los sellos necesarios.",
  already_redeemed: "Este premio ya se canjeó en esta tarjeta.",
  forbidden: "No tienes permiso para hacer esto.",
  invalid_pin: "El PIN debe tener de 4 a 6 números.",
  weak_pin: "Ese PIN es muy fácil de adivinar. Elige otro.",
  pin_taken: "Otro empleado ya usa ese PIN.",
  too_short: "Escribe al menos 4 dígitos.",
};

export function errorMessage(code: string | undefined | null) {
  return (code && MESSAGES[code]) || "Algo salió mal. Intenta de nuevo.";
}
