interface StoredMessage {
  sender: string;
  message: string;
  timestamp: number;
}

class MessageStore {
  private readonly messages: Map<string, StoredMessage[]> = new Map();

  addMessage(
    groupId: string,
    sender: string,
    message: string,
    timestamp?: number,
  ): void {
    const existing = this.messages.get(groupId) ?? [];

    const newMessage: StoredMessage = {
      sender,
      message,
      timestamp: timestamp ?? Date.now(),
    };

    const updated = [...existing, newMessage].slice(-100);
    this.messages.set(groupId, updated);
  }

  getMessages(groupId: string): StoredMessage[] {
    return this.messages.get(groupId) ?? [];
  }
}

const messageStore = new MessageStore();

export default messageStore;
