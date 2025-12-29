import axios, { AxiosError } from "axios";

const META_API_BASE = "https://graph.facebook.com/v21.0";

export interface TemplateComponent {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  format?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
  text?: string;
  buttons?: Array<{
    type: string;
    text: string;
    url?: string;
    phone_number?: string;
  }>;
  example?: {
    header_text?: string[];
    body_text?: string[][];
    header_handle?: string[];
  };
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  components: TemplateComponent[];
}

export interface BodyParam {
  value: string;
  parameterName?: string; // For named variables like {{customer_name}}
}

export interface SendTemplateMessageParams {
  phoneNumberId: string;
  accessToken: string;
  recipientPhone: string;
  templateName: string;
  templateLanguage: string;
  headerParams?: Array<{ type: string; [key: string]: any }>;
  bodyParams?: BodyParam[];
  buttonParams?: Array<{ type: string; [key: string]: any }>;
}

export interface SendMessageResponse {
  messaging_product: string;
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
}

export interface MetaApiError {
  message: string;
  type: string;
  code: number;
  error_subcode?: number;
  fbtrace_id: string;
}

/**
 * Extract variables from template text in the order they appear
 * Supports both {{1}} and {{named_variable}} formats
 */
export function extractTemplateVariablesInOrder(templateText: string): string[] {
  const variables: string[] = [];
  const regex = /\{\{([^}]+)\}\}/g;
  let match;
  
  while ((match = regex.exec(templateText)) !== null) {
    const varName = match[1].trim();
    if (!variables.includes(varName)) {
      variables.push(varName);
    }
  }
  
  console.log(`[extractTemplateVariablesInOrder] Found variables in order:`, variables);
  return variables;
}

/**
 * Map named variables to ordered array for Meta API
 * @param templateText The template body text with {{variable}} placeholders
 * @param variableValues Object with variable names as keys and values
 * @returns Array of BodyParam objects with value and parameterName
 */
export function mapVariablesToOrderedArray(
  templateText: string,
  variableValues: Record<string, string>
): BodyParam[] {
  const orderedVariables = extractTemplateVariablesInOrder(templateText);
  const result = orderedVariables.map((varName) => {
    const isNumeric = /^\d+$/.test(varName);
    return {
      value: variableValues[varName] || "",
      // Only include parameterName for named (non-numeric) variables
      parameterName: isNumeric ? undefined : varName,
    };
  });
  console.log(`[mapVariablesToOrderedArray] Variable values:`, variableValues);
  console.log(`[mapVariablesToOrderedArray] Ordered result:`, result);
  return result;
}

/**
 * Service for interacting with Meta's WhatsApp Business Cloud API
 */
export class MetaWhatsAppApi {
  private phoneNumberId: string;
  private accessToken: string;

  constructor(phoneNumberId: string, accessToken: string) {
    this.phoneNumberId = phoneNumberId;
    this.accessToken = accessToken;
  }

  private getHeaders() {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * Fetch all message templates from the WhatsApp Business Account
   */
  async getTemplates(businessAccountId: string): Promise<WhatsAppTemplate[]> {
    const url = `${META_API_BASE}/${businessAccountId}/message_templates`;
    console.log('[MetaWhatsAppApi] Fetching templates from:', url);
    console.log('[MetaWhatsAppApi] Using token prefix:', this.accessToken.substring(0, 20) + '...');
    
    try {
      const response = await axios.get(
        url,
        {
          headers: this.getHeaders(),
          params: {
            fields: "id,name,language,category,status,components",
            limit: 100,
          },
        }
      );

      console.log('[MetaWhatsAppApi] Templates fetched successfully:', response.data.data?.length || 0, 'templates');
      return response.data.data || [];
    } catch (error) {
      console.error('[MetaWhatsAppApi] Error fetching templates:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Send a template message to a recipient
   */
  async sendTemplateMessage(
    params: SendTemplateMessageParams
  ): Promise<SendMessageResponse> {
    const { recipientPhone, templateName, templateLanguage, headerParams, bodyParams, buttonParams } = params;

    // Format phone number (remove non-digits, ensure country code)
    const formattedPhone = this.formatPhoneNumber(recipientPhone);

    // Build template components
    const components: any[] = [];

    // Header component (for media or text variables)
    if (headerParams && headerParams.length > 0) {
      components.push({
        type: "header",
        parameters: headerParams,
      });
    }

    // Body component (text variables) - only add if there are non-empty params
    if (bodyParams && bodyParams.length > 0) {
      // Filter out empty values
      const validParams = bodyParams.filter(p => p.value && p.value.trim() !== "");
      if (validParams.length > 0) {
        components.push({
          type: "body",
          parameters: validParams.map((param) => {
            const paramObj: any = {
              type: "text",
              text: param.value,
            };
            // Add parameter_name for named variables (required for templates with named params)
            if (param.parameterName) {
              paramObj.parameter_name = param.parameterName;
            }
            return paramObj;
          }),
        });
      }
    }

    // Button component
    if (buttonParams && buttonParams.length > 0) {
      buttonParams.forEach((param, index) => {
        components.push({
          type: "button",
          sub_type: param.type,
          index: index.toString(),
          parameters: [param],
        });
      });
    }

    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: formattedPhone,
      type: "template",
      template: {
        name: templateName,
        language: {
          code: templateLanguage,
        },
        ...(components.length > 0 && { components }),
      },
    };

    // Debug logging
    console.log('[MetaWhatsAppApi] Sending template message:');
    console.log('[MetaWhatsAppApi] Template:', templateName);
    console.log('[MetaWhatsAppApi] Language:', templateLanguage);
    console.log('[MetaWhatsAppApi] To:', formattedPhone);
    console.log('[MetaWhatsAppApi] Body Params:', JSON.stringify(bodyParams));
    console.log('[MetaWhatsAppApi] Components:', JSON.stringify(components, null, 2));
    console.log('[MetaWhatsAppApi] Full Payload:', JSON.stringify(payload, null, 2));

    try {
      const response = await axios.post(
        `${META_API_BASE}/${this.phoneNumberId}/messages`,
        payload,
        { headers: this.getHeaders() }
      );

      console.log('[MetaWhatsAppApi] Message sent successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('[MetaWhatsAppApi] Error sending message:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Upload media to WhatsApp for use in templates
   */
  async uploadMedia(
    mediaBuffer: Buffer,
    mimeType: string,
    filename: string
  ): Promise<string> {
    const FormData = (await import("form-data")).default;
    const formData = new FormData();

    formData.append("file", mediaBuffer, {
      filename,
      contentType: mimeType,
    });
    formData.append("messaging_product", "whatsapp");
    formData.append("type", mimeType);

    try {
      const response = await axios.post(
        `${META_API_BASE}/${this.phoneNumberId}/media`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            ...formData.getHeaders(),
          },
        }
      );

      return response.data.id;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get phone number information
   * Note: This endpoint requires the access token to have permission to access this specific phone number.
   * If it fails, it may mean the token doesn't have phone number read permissions.
   */
  async getPhoneNumberInfo(): Promise<{
    id: string;
    display_phone_number: string;
    verified_name: string;
    quality_rating: string;
  }> {
    try {
      const response = await axios.get(
        `${META_API_BASE}/${this.phoneNumberId}`,
        {
          headers: this.getHeaders(),
          params: {
            fields: "id,display_phone_number,verified_name,quality_rating",
          },
        }
      );

      return response.data;
    } catch (error) {
      // If the direct phone number endpoint fails, it might be a permissions issue
      // The phone number ID might be correct but the token lacks permissions
      throw this.handleError(error);
    }
  }

  /**
   * Get phone numbers from Business Account (alternative validation method)
   * This is more reliable than direct phone number access
   */
  async getPhoneNumbersFromBusiness(businessAccountId: string): Promise<Array<{
    id: string;
    display_phone_number: string;
    verified_name: string;
    quality_rating: string;
  }>> {
    try {
      const response = await axios.get(
        `${META_API_BASE}/${businessAccountId}/phone_numbers`,
        {
          headers: this.getHeaders(),
          params: {
            fields: "id,display_phone_number,verified_name,quality_rating",
          },
        }
      );

      return response.data.data || [];
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Create a new message template
   */
  async createTemplate(
    businessAccountId: string,
    template: {
      name: string;
      language: string;
      category: "UTILITY" | "MARKETING" | "AUTHENTICATION";
      headerType?: "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
      headerText?: string;
      bodyText: string;
      footerText?: string;
      buttons?: Array<{
        type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
        text: string;
        url?: string;
        phoneNumber?: string;
      }>;
    }
  ): Promise<{ id: string; status: string; category: string }> {
    const components: any[] = [];

    // Header component (optional)
    if (template.headerType && template.headerType !== "NONE") {
      if (template.headerType === "TEXT" && template.headerText) {
        components.push({
          type: "HEADER",
          format: "TEXT",
          text: template.headerText,
        });
      } else if (template.headerType === "IMAGE") {
        components.push({
          type: "HEADER",
          format: "IMAGE",
          example: {
            header_handle: ["https://example.com/image.jpg"], // Placeholder
          },
        });
      }
    }

    // Body component (required)
    // Extract example values for variables
    const bodyVariables = template.bodyText.match(/\{\{[^}]+\}\}/g) || [];
    
    // Exemplos padrão para variáveis comuns (fallback se não fornecido)
    const defaultExamples: Record<string, string> = {
      'nome': 'João',
      'name': 'João',
      'primeiro_nome': 'Maria',
      'first_name': 'Maria',
      'cliente': 'Carlos',
      'customer': 'Carlos',
      'empresa': 'Empresa ABC',
      'company': 'Empresa ABC',
      'valor': 'R$ 1.500,00',
      'value': 'R$ 1.500,00',
      'data': '15/01/2025',
      'date': '15/01/2025',
      'codigo': 'ABC123',
      'code': 'ABC123',
      'produto': 'Produto Premium',
      'product': 'Produto Premium',
      'link': 'https://exemplo.com',
      'url': 'https://exemplo.com',
      'telefone': '+55 11 99999-9999',
      'phone': '+55 11 99999-9999',
      'endereco': 'Rua das Flores, 123',
      'address': 'Rua das Flores, 123',
      'hora': '14:30',
      'time': '14:30',
      'numero': '12345',
      'number': '12345',
    };

    // Função para obter exemplo: primeiro tenta o fornecido pelo usuário, depois o padrão
    const getExampleForVariable = (varName: string, index: number): string => {
      // Se o usuário forneceu um exemplo, usa ele
      if (template.variableExamples && template.variableExamples[varName]) {
        return template.variableExamples[varName];
      }
      
      // Senão, tenta o padrão
      const lowerName = varName.toLowerCase();
      for (const [key, value] of Object.entries(defaultExamples)) {
        if (lowerName.includes(key) || key.includes(lowerName)) {
          return value;
        }
      }
      
      // Fallback genérico
      return `Exemplo ${index + 1}`;
    };

    // Verifica o tipo de variável escolhido pelo usuário
    const useNamedVariables = template.variableType === "NAMED";
    
    let processedBodyText = template.bodyText;
    const variableExamplesList: string[] = [];
    const namedParams: Array<{ param_name: string; example: string }> = [];
    
    if (bodyVariables.length > 0) {
      // Verifica se as variáveis no texto são nomeadas ou numéricas
      const hasNamedVars = bodyVariables.some(v => !/^\{\{\d+\}\}$/.test(v));
      
      if (useNamedVariables && hasNamedVars) {
        // Usa variáveis nomeadas (body_text_named_params)
        bodyVariables.forEach((v, i) => {
          const paramName = v.replace(/[{}]/g, "").trim();
          namedParams.push({
            param_name: paramName,
            example: getExampleForVariable(paramName, i),
          });
        });
        
        console.log("[MetaWhatsAppApi] Using NAMED variables:");
        console.log("[MetaWhatsAppApi] Named params:", namedParams);
      } else {
        // Converte para variáveis numéricas (body_text)
        if (hasNamedVars) {
          // Converte variáveis nomeadas para numéricas
          bodyVariables.forEach((v, i) => {
            const paramName = v.replace(/[{}]/g, "").trim();
            const numericVar = `{{${i + 1}}}`;
            processedBodyText = processedBodyText.replace(v, numericVar);
            variableExamplesList.push(getExampleForVariable(paramName, i));
          });
          
          console.log("[MetaWhatsAppApi] Converted to POSITIONAL variables:");
          console.log("[MetaWhatsAppApi] Original:", template.bodyText);
          console.log("[MetaWhatsAppApi] Processed:", processedBodyText);
        } else {
          // Já são variáveis numéricas
          bodyVariables.forEach((v, i) => {
            const paramName = v.replace(/[{}]/g, "").trim();
            variableExamplesList.push(getExampleForVariable(paramName, i));
          });
        }
        console.log("[MetaWhatsAppApi] Examples:", variableExamplesList);
      }
    }

    const bodyComponent: any = {
      type: "BODY",
      text: useNamedVariables ? template.bodyText : processedBodyText,
    };
    
    // Adiciona exemplos se houver variáveis
    if (namedParams.length > 0) {
      // Formato para variáveis nomeadas
      bodyComponent.example = {
        body_text_named_params: namedParams,
      };
    } else if (variableExamplesList.length > 0) {
      // Formato para variáveis numéricas
      bodyComponent.example = {
        body_text: [variableExamplesList],
      };
    }
    
    components.push(bodyComponent);

    // Footer component (optional)
    if (template.footerText) {
      components.push({
        type: "FOOTER",
        text: template.footerText,
      });
    }

    // Buttons component (optional)
    if (template.buttons && template.buttons.length > 0) {
      const buttonsComponent: any = {
        type: "BUTTONS",
        buttons: template.buttons.map((btn) => {
          if (btn.type === "QUICK_REPLY") {
            return {
              type: "QUICK_REPLY",
              text: btn.text,
            };
          } else if (btn.type === "URL") {
            return {
              type: "URL",
              text: btn.text,
              url: btn.url,
            };
          } else if (btn.type === "PHONE_NUMBER") {
            return {
              type: "PHONE_NUMBER",
              text: btn.text,
              phone_number: btn.phoneNumber,
            };
          }
          return { type: btn.type, text: btn.text };
        }),
      };
      components.push(buttonsComponent);
    }

    // Sanitiza o nome do template
    let sanitizedName = template.name
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "")
      .replace(/_+/g, "_") // Remove underscores duplicados
      .replace(/^_|_$/g, ""); // Remove underscore no início/fim
    
    // Garante que o nome não está vazio e tem pelo menos 1 caractere
    if (!sanitizedName || sanitizedName.length < 1) {
      sanitizedName = "template_" + Date.now();
    }

    const payload = {
      name: sanitizedName,
      language: template.language,
      category: template.category,
      components,
    };

    console.log("[MetaWhatsAppApi] Creating template:", JSON.stringify(payload, null, 2));

    try {
      const response = await axios.post(
        `${META_API_BASE}/${businessAccountId}/message_templates`,
        payload,
        { headers: this.getHeaders() }
      );

      console.log("[MetaWhatsAppApi] Template created:", response.data);
      
      // Verifica se foi rejeitado e tenta obter mais detalhes
      if (response.data.status === "REJECTED") {
        console.log("[MetaWhatsAppApi] Template REJECTED - checking for rejection reason...");
        // A Meta às vezes retorna o motivo em rejected_reason
        const rejectionInfo = response.data.rejected_reason || response.data.quality_score || "Motivo não especificado";
        console.log("[MetaWhatsAppApi] Rejection info:", rejectionInfo);
      }
      
      return {
        id: response.data.id,
        status: response.data.status || "PENDING",
        category: response.data.category || template.category,
        rejectedReason: response.data.rejected_reason,
      };
    } catch (error) {
      console.error("[MetaWhatsAppApi] Error creating template:", error);
      if (axios.isAxiosError(error)) {
        const errorData = error.response?.data;
        console.error("[MetaWhatsAppApi] Error details:", JSON.stringify(errorData, null, 2));
      }
      throw this.handleError(error);
    }
  }

  /**
   * Delete a message template
   */
  async deleteTemplate(
    businessAccountId: string,
    templateName: string
  ): Promise<{ success: boolean }> {
    try {
      const response = await axios.delete(
        `${META_API_BASE}/${businessAccountId}/message_templates`,
        {
          headers: this.getHeaders(),
          params: { name: templateName },
        }
      );

      console.log("[MetaWhatsAppApi] Template deleted:", response.data);
      return { success: response.data.success || true };
    } catch (error) {
      console.error("[MetaWhatsAppApi] Error deleting template:", error);
      throw this.handleError(error);
    }
  }

  /**
   * Verify webhook subscription
   */
  static verifyWebhook(
    mode: string,
    token: string,
    challenge: string,
    verifyToken: string
  ): string | null {
    if (mode === "subscribe" && token === verifyToken) {
      return challenge;
    }
    return null;
  }

  /**
   * Parse webhook event for message status updates
   */
  static parseWebhookEvent(body: any): {
    type: "status" | "message" | "unknown";
    data: any;
  } {
    try {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      if (value?.statuses) {
        // Status update (sent, delivered, read, failed)
        const status = value.statuses[0];
        return {
          type: "status",
          data: {
            messageId: status.id,
            recipientId: status.recipient_id,
            status: status.status,
            timestamp: status.timestamp,
            errors: status.errors,
          },
        };
      }

      if (value?.messages) {
        // Incoming message
        const message = value.messages[0];
        return {
          type: "message",
          data: {
            messageId: message.id,
            from: message.from,
            timestamp: message.timestamp,
            type: message.type,
            text: message.text?.body,
          },
        };
      }

      return { type: "unknown", data: body };
    } catch {
      return { type: "unknown", data: body };
    }
  }

  /**
   * Get message status from Meta API
   */
  async getMessageStatus(messageId: string): Promise<{
    id: string;
    status: string;
    timestamp: string;
    recipient_id: string;
    errors?: Array<{ code: number; title: string; message: string }>;
  } | null> {
    try {
      // Note: Meta API doesn't have a direct endpoint to check message status
      // Status updates come via webhook only
      // This is a placeholder for future implementation if Meta adds this feature
      console.log('[MetaWhatsAppApi] Message status check requested for:', messageId);
      console.log('[MetaWhatsAppApi] Note: Status updates are only available via webhook');
      return null;
    } catch (error) {
      console.error('[MetaWhatsAppApi] Error checking message status:', error);
      return null;
    }
  }

  /**
   * Format phone number for WhatsApp API
   */
  private formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters
    let formatted = phone.replace(/\D/g, "");

    // If starts with 0, remove it and add Brazil country code
    if (formatted.startsWith("0")) {
      formatted = "55" + formatted.substring(1);
    }

    // If doesn't have country code (less than 12 digits for Brazil), add it
    if (formatted.length <= 11) {
      formatted = "55" + formatted;
    }

    return formatted;
  }

  private handleError(error: unknown): Error {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error: MetaApiError }>;
      const metaError = axiosError.response?.data?.error;

      if (metaError) {
        const message = `Meta API Error: ${metaError.message} (Code: ${metaError.code})`;
        console.error("[MetaWhatsAppApi]", message, metaError);
        return new Error(message);
      }

      if (axiosError.response?.status === 401) {
        return new Error("Token de acesso inválido ou expirado");
      }

      if (axiosError.response?.status === 403) {
        return new Error("Acesso negado. Verifique as permissões do app");
      }

      return new Error(
        `Erro de rede: ${axiosError.message}`
      );
    }

    return error instanceof Error ? error : new Error("Erro desconhecido");
  }
}
