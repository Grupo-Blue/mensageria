import fs from 'fs/promises';
import path from 'path';

export interface GroupRecord {
  sessionId: string;
  groupId: string;
  groupName: string;
  lastMessageAt: string;
  lastMessageAtMs: number;
}

const STORAGE_FILE = path.resolve(process.cwd(), 'tmp', 'whatsapp-groups.json');

const isValidDate = (value: Date): boolean => !Number.isNaN(value.getTime());

class GroupStore {
  private groups = new Map<string, GroupRecord>();

  private persistTimer?: NodeJS.Timeout;

  private loaded = false;

  constructor() {
    void this.loadFromDisk();
  }

  private async loadFromDisk(): Promise<void> {
    try {
      const data = await fs.readFile(STORAGE_FILE, 'utf-8');
      const parsed: GroupRecord[] = JSON.parse(data);
      parsed.forEach(record => {
        if (record?.groupId) {
          this.groups.set(record.groupId, {
            ...record,
            lastMessageAtMs: record.lastMessageAtMs ?? new Date(record.lastMessageAt).getTime(),
          });
        }
      });
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
        console.error('Não foi possível carregar cache de grupos do disco:', error);
      }
    } finally {
      this.loaded = true;
    }
  }

  private schedulePersist(): void {
    if (!this.loaded) {
      if (!this.persistTimer) {
        this.persistTimer = setTimeout(() => {
          this.persistTimer = undefined;
          this.schedulePersist();
        }, 200);
      }
      return;
    }

    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
    }

    this.persistTimer = setTimeout(() => {
      this.persistTimer = undefined;
      void this.persistToDisk();
    }, 200);
  }

  private async persistToDisk(): Promise<void> {
    const payload = JSON.stringify(this.listAll(), null, 2);

    try {
      await fs.mkdir(path.dirname(STORAGE_FILE), { recursive: true });
      await fs.writeFile(STORAGE_FILE, payload, 'utf-8');
    } catch (error) {
      console.error('Não foi possível salvar cache de grupos no disco:', error);
    }
  }

  upsertGroup(params: {
    sessionId: string;
    groupId: string;
    groupName: string;
    lastMessageAt?: Date;
  }): void {
    const { sessionId, groupId, groupName, lastMessageAt } = params;

    const timestamp = lastMessageAt && isValidDate(lastMessageAt)
      ? lastMessageAt
      : new Date();

    const normalized: GroupRecord = {
      sessionId,
      groupId,
      groupName,
      lastMessageAt: timestamp.toISOString(),
      lastMessageAtMs: timestamp.getTime(),
    };

    const existing = this.groups.get(groupId);

    if (!existing || existing.lastMessageAtMs <= normalized.lastMessageAtMs) {
      this.groups.set(groupId, normalized);
      this.schedulePersist();
    }
  }

  listAll(): GroupRecord[] {
    return Array.from(this.groups.values()).sort(
      (a, b) => b.lastMessageAtMs - a.lastMessageAtMs,
    );
  }

  listBySession(sessionId: string): GroupRecord[] {
    return this.listAll().filter(group => group.sessionId === sessionId);
  }
}

const groupStore = new GroupStore();

export default groupStore;
