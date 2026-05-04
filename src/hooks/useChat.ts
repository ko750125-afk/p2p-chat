import { useState, useEffect, useCallback } from "react";
import { ref, onValue, push, set, onDisconnect, remove } from "firebase/database";
import { db } from "@/lib/firebase";
import { Message, Participant } from "@/types/chat";

export function useChat(roomId: string, user: { uid: string, displayName: string | null, photoURL: string | null } | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<Record<string, Participant>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    // 1. 참여 정보 설정
    const participantRef = ref(db, `p2pchat/rooms/${roomId}/participants/${user.uid}`);
    set(participantRef, {
      name: user.displayName || "익명",
      photo: user.photoURL || "",
      lastSeen: Date.now()
    });
    onDisconnect(participantRef).remove();

    // 2. 참여자 리스트 구독
    const participantsRef = ref(db, `p2pchat/rooms/${roomId}/participants`);
    const unsubscribeParticipants = onValue(participantsRef, (snapshot) => {
      setParticipants(snapshot.val() || {});
    });

    // 3. 메시지 리스트 구독
    const messagesRef = ref(db, `p2pchat/messages/${roomId}`);
    const unsubscribeMessages = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const msgList = Object.entries(data).map(([id, msg]: [string, any]) => ({
          id,
          ...msg,
        }));
        setMessages(msgList.slice(-100));
      } else {
        setMessages([]);
      }
      setLoading(false);
    });

    return () => {
      unsubscribeParticipants();
      unsubscribeMessages();
      remove(participantRef);
    };
  }, [roomId, user]);

  const sendMessage = useCallback(async (text: string) => {
    if (!user || !text.trim()) return;

    const messagesRef = ref(db, `p2pchat/messages/${roomId}`);
    const messageData = {
      senderName: user.displayName || "익명",
      senderId: user.uid,
      text: text,
      timestamp: Date.now(),
    };

    await push(messagesRef, messageData);

    // 푸시 알림 발송 요청
    fetch("/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: user.displayName,
        body: text,
        senderId: user.uid
      })
    }).catch(err => console.error("Push API Call failed:", err));
  }, [roomId, user]);

  return { messages, participants, loading, sendMessage };
}
