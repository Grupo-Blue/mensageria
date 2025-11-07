interface StoredMessage {
  sender: string;
  text: string;
  timestamp: number;
}

const MAX_MESSAGES_PER_GROUP = 100;

class MessageStore {
  private readonly messages = new Map<string, StoredMessage[]>();

  addMessage(groupId: string, sender: string, text: string, timestamp?: number): void {
    const bucket = this.messages.get(groupId) ?? [];
    bucket.unshift({
      sender,
      text,
      timestamp: timestamp ?? Date.now(),
    });

    if (bucket.length > MAX_MESSAGES_PER_GROUP) {
      bucket.length = MAX_MESSAGES_PER_GROUP;
    }

    this.messages.set(groupId, bucket);
  }

  list(groupId: string): StoredMessage[] {
    return this.messages.get(groupId) ?? [];
  }
}

const messageStore = new MessageStore();

export default messageStore;
