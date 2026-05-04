"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useChat } from "@/hooks/useChat";
import { useNotifications } from "@/hooks/useNotifications";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { MessageList } from "@/components/chat/MessageList";
import { ChatInput } from "@/components/chat/ChatInput";
import { LoginView } from "@/components/chat/LoginView";

const GLOBAL_ROOM_ID = "global_lobby";

export default function GlobalChatPage() {
  const { user, login, logout } = useAuth();
  const { messages, participants, sendMessage } = useChat(GLOBAL_ROOM_ID, user);
  const { enabled: notificationEnabled, setup: setupNotifications } = useNotifications();
  
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);
  const prevMessageCount = useRef(0);

  // 1. 초기 입장 시 알림 설정 시도
  useEffect(() => {
    if (user) {
      setupNotifications(user);
    }
  }, [user, setupNotifications]);

  // 2. 자동 스크롤 로직
  useEffect(() => {
    if (messages.length > 0) {
      const scrollToBottom = () => {
        if (messagesContainerRef.current) {
          const container = messagesContainerRef.current;
          container.scrollTo({
            top: container.scrollHeight,
            behavior: isInitialLoad.current ? "instant" : "smooth"
          });
        }
      };

      scrollToBottom();
      const timer = setTimeout(scrollToBottom, 100);
      
      isInitialLoad.current = false;
      prevMessageCount.current = messages.length;
      
      return () => clearTimeout(timer);
    }
  }, [messages]);

  if (!user) {
    return <LoginView onLogin={login} />;
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-[#fcfdfe] overflow-hidden">
      <ChatHeader 
        user={user}
        participants={participants}
        notificationEnabled={notificationEnabled}
        onLogout={logout}
        onSetupNotifications={() => setupNotifications(user)}
      />

      <MessageList 
        messages={messages}
        currentUser={user}
        containerRef={messagesContainerRef}
      />

      <ChatInput onSendMessage={sendMessage} />
    </div>
  );
}
