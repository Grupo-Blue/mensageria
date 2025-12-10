interface StoredMessage {
  timestamp: Date;
  sender: string;
  message: string;
  groupId: string;
}

class MessageStore {
  private messages: Map<string, StoredMessage[]> = new Map();

  addMessage(groupId: string, sender: string, message: string): void {
    if (!this.messages.has(groupId)) {
      this.messages.set(groupId, []);
    }

    const messages = this.messages.get(groupId)!;
    messages.push({
      timestamp: new Date(),
      sender,
      message,
      groupId,
    });

    console.log(`[MessageStore] Mensagem armazenada para grupo ${groupId}. Total: ${messages.length}`);
  }

  getMessages(groupId: string): StoredMessage[] {
    return this.messages.get(groupId) || [];
  }

  clearMessages(groupId: string): void {
    const count = this.messages.get(groupId)?.length || 0;
    this.messages.delete(groupId);
    console.log(`[MessageStore] ${count} mensagens removidas do grupo ${groupId}`);
  }

  getMessageCount(groupId: string): number {
    return this.messages.get(groupId)?.length || 0;
  }
}

export const messageStore = new MessageStore();
