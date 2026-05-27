/**
 * Normalização de telefones brasileiros para WhatsApp (E.164 sem +).
 * Formato alvo: 55 + DDD (2) + 9 dígitos de celular (13 dígitos no total).
 */

export function normalizePhoneNumber(phone: string): string | null {
  if (!phone) return null;

  let cleaned = phone.replace(/\D/g, "");

  if (cleaned.startsWith("0")) {
    cleaned = cleaned.substring(1);
  }

  if (cleaned.length < 10) {
    return null;
  }

  if (!cleaned.startsWith("55")) {
    cleaned = "55" + cleaned;
  }

  if (cleaned.length === 12) {
    const ddd = cleaned.substring(2, 4);
    const number = cleaned.substring(4);
    if (/^[6-9]/.test(number)) {
      cleaned = "55" + ddd + "9" + number;
    } else {
      return null;
    }
  }

  if (cleaned.length === 13) {
    const numberPart = cleaned.substring(4);
    if (!numberPart.startsWith("9")) {
      return null;
    }
    return cleaned;
  }

  if (cleaned.length > 13) {
    cleaned = cleaned.slice(-13);
    if (cleaned.startsWith("55") && cleaned.length === 13) {
      const numberPart = cleaned.substring(4);
      if (numberPart.startsWith("9")) {
        return cleaned;
      }
    }
    return null;
  }

  return null;
}

export function isValidBrazilianPhone(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized || normalized.length !== 13 || !normalized.startsWith("55")) {
    return false;
  }
  const ddd = parseInt(normalized.substring(2, 4), 10);
  if (ddd < 11 || ddd > 99) return false;
  return normalized.substring(4).startsWith("9");
}
