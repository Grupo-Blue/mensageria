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
    const bodyComponent: any = {
      type: "BODY",
      text: template.bodyText,
    };
    
    if (bodyVariables.length > 0) {
      // Check if using named variables or numbered
      const isNamed = bodyVariables.some(v => !/^\{\{\d+\}\}$/.test(v));
      
      if (isNamed) {
        // Named parameters
        bodyComponent.example = {
          body_text_named_params: bodyVariables.map(v => {
            const paramName = v.replace(/[{}]/g, "").trim();
            return {
              param_name: paramName,
              example: `[${paramName}]`,
            };
          }),
        };
      } else {
        // Numbered parameters
        bodyComponent.example = {
          body_text: [bodyVariables.map((_, i) => `[Exemplo ${i + 1}]`)],
        };
      }
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

    const payload = {
      name: template.name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""),
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
      return {
        id: response.data.id,
        status: response.data.status || "PENDING",
        category: response.data.category || template.category,
      };
    } catch (error) {
      console.error("[MetaWhatsAppApi] Error creating template:", error);
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
