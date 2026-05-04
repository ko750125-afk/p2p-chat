export interface ChatRoom {
  id: string;
  creatorId: string;
  creatorName: string;
  title?: string;
  participants: Record<string, string>;
  createdAt: number;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}
