/**
 * Normaliza números de telefone brasileiros para o formato padrão: 5561999999999
 * 
 * Formatos aceitos:
 * - 5561998626334
 * - +5561998626334
 * - 61998626334 (assume +55)
 * - +55 (61) 99862 6334
 * - +55 (61) 99862-6334
 * - Sem o nono dígito: 556198626334, 6198626334, etc.
 * 
 * IMPORTANTE: Telefones fixos (que não começam com 9, 8, 7 ou 6) são INVÁLIDOS
 * pois não recebem WhatsApp.
 */
export function normalizePhoneNumber(phone: string): string | null {
  if (!phone) return null;

  // Remove tudo que não é número
  let cleaned = phone.replace(/\D/g, "");

  // Se começar com 0, remove
  if (cleaned.startsWith("0")) {
    cleaned = cleaned.substring(1);
  }

  // Se tiver menos de 10 dígitos, é inválido
  if (cleaned.length < 10) {
    return null;
  }

  // Se não começar com 55, adiciona
  if (!cleaned.startsWith("55")) {
    cleaned = "55" + cleaned;
  }

  // Agora deve ter 55 + DDD (2 dígitos) + número (8 ou 9 dígitos)
  // Formato esperado: 55 + DD + NNNNNNNNN (12 ou 13 dígitos)

  // Se tiver 12 dígitos (55 + DD + 8 dígitos)
  if (cleaned.length === 12) {
    const ddd = cleaned.substring(2, 4);
    const number = cleaned.substring(4);
    
    // Números de celular começam com 9, 8, 7 ou 6 (antes do nono dígito)
    // Se o número começa com esses dígitos, adiciona o 9 na frente
    if (/^[6-9]/.test(number)) {
      cleaned = "55" + ddd + "9" + number;
    } else {
      // Telefone fixo - NÃO recebe WhatsApp, então é INVÁLIDO
      return null;
    }
  }

  // Se tiver 13 dígitos, verifica se é celular válido
  if (cleaned.length === 13) {
    const numberPart = cleaned.substring(4); // Pega os 9 dígitos do número
    // Celular com 9º dígito deve começar com 9
    if (!numberPart.startsWith("9")) {
      // Pode ser um número mal formatado ou fixo, marca como inválido
      return null;
    }
    return cleaned;
  }

  // Se tiver mais de 13 dígitos, pode ter algo errado
  if (cleaned.length > 13) {
    // Tenta extrair os últimos 13 dígitos (pode ter código de país duplicado)
    cleaned = cleaned.slice(-13);
    if (cleaned.startsWith("55") && cleaned.length === 13) {
      const numberPart = cleaned.substring(4);
      if (numberPart.startsWith("9")) {
        return cleaned;
      }
    }
    return null;
  }

  return null; // Qualquer outro caso é inválido
}

/**
 * Valida se um número de telefone é válido para WhatsApp
 * - Deve ser celular (começa com 9 após o DDD)
 * - Telefones fixos são INVÁLIDOS
 */
export function isValidBrazilianPhone(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) return false;
  
  // Deve ter 13 dígitos (55 + DDD + 9 dígitos de celular)
  if (normalized.length !== 13) return false;
  
  // Deve começar com 55
  if (!normalized.startsWith("55")) return false;
  
  // DDD deve ser válido (11-99)
  const ddd = parseInt(normalized.substring(2, 4));
  if (ddd < 11 || ddd > 99) return false;
  
  // Número deve começar com 9 (celular com nono dígito)
  const numberPart = normalized.substring(4);
  if (!numberPart.startsWith("9")) return false;
  
  return true;
}

/**
 * Verifica se um número é telefone fixo (não recebe WhatsApp)
 */
export function isLandline(phone: string): boolean {
  if (!phone) return false;
  
  let cleaned = phone.replace(/\D/g, "");
  
  if (cleaned.startsWith("0")) {
    cleaned = cleaned.substring(1);
  }
  
  if (!cleaned.startsWith("55")) {
    cleaned = "55" + cleaned;
  }
  
  // Telefone com 12 dígitos que não começa com 6-9 é fixo
  if (cleaned.length === 12) {
    const number = cleaned.substring(4);
    return !/^[6-9]/.test(number);
  }
  
  // Telefone com 13 dígitos que não começa com 9 é provavelmente fixo ou inválido
  if (cleaned.length === 13) {
    const number = cleaned.substring(4);
    return !number.startsWith("9");
  }
  
  return false;
}

/**
 * Formata um número para exibição: +55 (61) 99999-9999
 */
export function formatPhoneForDisplay(phone: string): string {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) return phone;
  
  if (normalized.length === 13) {
    // Celular com 9 dígitos
    return `+${normalized.slice(0, 2)} (${normalized.slice(2, 4)}) ${normalized.slice(4, 9)}-${normalized.slice(9)}`;
  } else if (normalized.length === 12) {
    // Fixo ou celular sem o 9
    return `+${normalized.slice(0, 2)} (${normalized.slice(2, 4)}) ${normalized.slice(4, 8)}-${normalized.slice(8)}`;
  }
  
  return phone;
}

/**
 * Processa dados de uma linha (CSV ou Excel) e extrai telefone e nome
 */
export function parseContactRow(row: any[], headers?: string[]): { phoneNumber: string; name?: string; email?: string; phoneIndex?: number } | null {
  if (!row || row.length === 0) return null;

  let phoneNumber = "";
  let name = "";
  let email = "";
  let phoneIndex = -1;

  // Se tiver headers, tenta encontrar as colunas pelo nome
  if (headers && headers.length > 0) {
    // Busca mais flexível para headers de telefone
    phoneIndex = headers.findIndex(h => {
      const normalized = String(h).trim().toLowerCase();
      return /^(telefone|phone|celular|mobile|whatsapp|numero|number|fone|tel|contato|whats)$/i.test(normalized) ||
             normalized.includes('telefone') ||
             normalized.includes('phone') ||
             normalized.includes('celular') ||
             normalized.includes('whatsapp') ||
             normalized.includes('fone');
    });
    
    // Busca mais flexível para headers de nome
    const nameIndex = headers.findIndex(h => {
      const normalized = String(h).trim().toLowerCase();
      return /^(nome|name|cliente|customer|contato|contact|razao|razão|empresa)$/i.test(normalized) ||
             normalized.includes('nome') ||
             normalized.includes('name') ||
             normalized.includes('cliente') ||
             normalized.includes('razao') ||
             normalized.includes('razão');
    });
    
    // Busca mais flexível para headers de email
    const emailIndex = headers.findIndex(h => {
      const normalized = String(h).trim().toLowerCase();
      return /^(email|e-mail|mail)$/i.test(normalized) ||
             normalized.includes('email') ||
             normalized.includes('e-mail');
    });

    if (phoneIndex >= 0 && row[phoneIndex]) {
      phoneNumber = String(row[phoneIndex]).trim();
    }
    if (nameIndex >= 0 && row[nameIndex]) {
      name = String(row[nameIndex]).trim();
    }
    if (emailIndex >= 0 && row[emailIndex]) {
      email = String(row[emailIndex]).trim();
    }
  }

  // Se não encontrou por headers ou não achou telefone, usa posição padrão
  if (!phoneNumber) {
    // Primeira coluna com número (que parece telefone)
    for (let i = 0; i < row.length; i++) {
      const value = String(row[i] || "").trim();
      const digits = value.replace(/\D/g, "");
      
      // Verifica se parece ser um telefone (tem pelo menos 10 dígitos - DDD + número)
      if (digits.length >= 10 && digits.length <= 15) {
        phoneNumber = value;
        phoneIndex = i;
        break;
      }
    }
    
    // Se achou telefone, procura por nome e email nas outras colunas
    if (phoneNumber) {
      for (let i = 0; i < row.length; i++) {
        if (i === phoneIndex) continue;
        
        const value = String(row[i] || "").trim();
        if (!value) continue;
        
        // Se parece um email
        if (value.includes('@') && value.includes('.') && !email) {
          email = value;
          continue;
        }
        
        // Se não é número e não é email, provavelmente é nome
        const digits = value.replace(/\D/g, "");
        if (digits.length < 8 && !name && !value.includes('@')) {
          name = value;
        }
      }
    }
  }

  if (!phoneNumber) return null;

  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  if (!normalizedPhone) return null;

  // Extrai apenas o primeiro nome
  const firstName = name ? extractFirstName(name) : undefined;

  return {
    phoneNumber: normalizedPhone,
    name: firstName,
    email: email || undefined,
    phoneIndex,
  };
}

/**
 * Extrai apenas o primeiro nome de um nome completo
 * Exemplos:
 * - "João Silva" → "João"
 * - "Maria das Graças" → "Maria"
 * - "José" → "José"
 * - "CARLOS EDUARDO" → "Carlos"
 */
export function extractFirstName(fullName: string): string {
  if (!fullName) return "";
  
  // Remove espaços extras e trim
  const cleaned = fullName.trim().replace(/\s+/g, " ");
  
  // Pega apenas a primeira palavra
  const firstName = cleaned.split(" ")[0];
  
  // Capitaliza corretamente (primeira letra maiúscula, resto minúsculo)
  return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
}

