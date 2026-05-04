export interface ChatRoom {
  id: string;
  creatorName: string;
  title?: string;
  participants: Record<string, string>;
  createdAt: number;
}

export interface Message {
  id: string;
  senderName: string;
  text: string;
  timestamp: number;
}
