import fs from 'fs/promises';
import path from 'path';

export interface SettingsRecord {
  id: number;
  user_id: number;
  google_api_key: string | null;
  resume_group_id: string | null;
  resume_group_id_to_send: string | null;
  resume_hour_of_day: number | null;
  enable_group_resume: boolean;
  resume_prompt: string | null;
  resume_connection_id: string | null;
  webhook_url: string | null;
  created_at: string;
  updated_at: string;
}

type SettingsInput = Partial<{
  googleApiKey: string | null;
  resumeGroupId: string | null;
  resumeGroupIdToSend: string | null;
  resumeHourOfDay: number | null;
  enableGroupResume: boolean;
  resumePrompt: string | null;
  resumeConnectionId: string | number | null;
  webhookUrl: string | null;
}> & Partial<Omit<SettingsRecord, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

const SETTINGS_FILE = path.resolve(process.cwd(), 'tmp', 'settings.json');

const normalizeBoolean = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  if (typeof value === 'string') {
    return ['1', 'true', 'on', 'yes'].includes(value.toLowerCase());
  }
  return fallback;
};

const normalizeNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeString = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return String(value);
};

class SettingsStore {
  private cache: SettingsRecord | null = null;

  private loaded = false;

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) {
      return;
    }

    try {
      const raw = await fs.readFile(SETTINGS_FILE, 'utf-8');
      const parsed: SettingsRecord = JSON.parse(raw);

      this.cache = {
        ...parsed,
        enable_group_resume: Boolean(parsed.enable_group_resume),
        resume_hour_of_day: normalizeNumber(parsed.resume_hour_of_day),
      };
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
        console.error('Não foi possível carregar configurações do disco:', error);
      }
      this.cache = this.createDefaultRecord();
      await this.persist();
    } finally {
      this.loaded = true;
    }
  }

  private createDefaultRecord(): SettingsRecord {
    const now = new Date().toISOString();
    return {
      id: 1,
      user_id: 1,
      google_api_key: null,
      resume_group_id: null,
      resume_group_id_to_send: null,
      resume_hour_of_day: null,
      enable_group_resume: false,
      resume_prompt: null,
      resume_connection_id: null,
      webhook_url: null,
      created_at: now,
      updated_at: now,
    };
  }

  private async persist(): Promise<void> {
    if (!this.cache) {
      return;
    }

    try {
      await fs.mkdir(path.dirname(SETTINGS_FILE), { recursive: true });
      await fs.writeFile(SETTINGS_FILE, JSON.stringify(this.cache, null, 2), 'utf-8');
    } catch (error) {
      console.error('Não foi possível salvar configurações no disco:', error);
    }
  }

  async getSettings(userId = 1): Promise<SettingsRecord> {
    await this.ensureLoaded();

    if (!this.cache) {
      this.cache = this.createDefaultRecord();
      await this.persist();
    }

    if (this.cache.user_id !== userId) {
      return {
        ...this.cache,
        user_id: userId,
      };
    }

    return this.cache;
  }

  async updateSettings(userId: number, payload: SettingsInput): Promise<SettingsRecord> {
    await this.ensureLoaded();

    const current = await this.getSettings(userId);
    const now = new Date().toISOString();

    const normalizedPayload: Partial<SettingsRecord> = {
      google_api_key: normalizeString(payload.google_api_key ?? payload.googleApiKey),
      resume_group_id: normalizeString(payload.resume_group_id ?? payload.resumeGroupId),
      resume_group_id_to_send: normalizeString(payload.resume_group_id_to_send ?? payload.resumeGroupIdToSend),
      resume_hour_of_day: normalizeNumber(payload.resume_hour_of_day ?? payload.resumeHourOfDay),
      enable_group_resume: normalizeBoolean(
        payload.enable_group_resume ?? payload.enableGroupResume,
        current.enable_group_resume,
      ),
      resume_prompt: normalizeString(payload.resume_prompt ?? payload.resumePrompt),
      resume_connection_id: normalizeString(
        payload.resume_connection_id ?? payload.resumeConnectionId,
      ),
      webhook_url: normalizeString(payload.webhook_url ?? payload.webhookUrl),
    };

    const updated: SettingsRecord = {
      ...current,
      ...normalizedPayload,
      user_id: current.user_id ?? userId,
      updated_at: now,
    };

    this.cache = updated;
    await this.persist();

    return updated;
  }
}

const settingsStore = new SettingsStore();

export default settingsStore;
