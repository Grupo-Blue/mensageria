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

export interface SendTemplateMessageParams {
  phoneNumberId: string;
  accessToken: string;
  recipientPhone: string;
  templateName: string;
  templateLanguage: string;
  headerParams?: Array<{ type: string; [key: string]: any }>;
  bodyParams?: string[];
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
    try {
      const response = await axios.get(
        `${META_API_BASE}/${businessAccountId}/message_templates`,
        {
          headers: this.getHeaders(),
          params: {
            fields: "id,name,language,category,status,components",
            limit: 100,
          },
        }
      );

      return response.data.data || [];
    } catch (error) {
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

    // Body component (text variables)
    if (bodyParams && bodyParams.length > 0) {
      components.push({
        type: "body",
        parameters: bodyParams.map((text) => ({
          type: "text",
          text,
        })),
      });
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

    try {
      const response = await axios.post(
        `${META_API_BASE}/${this.phoneNumberId}/messages`,
        payload,
        { headers: this.getHeaders() }
      );

      return response.data;
    } catch (error) {
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
