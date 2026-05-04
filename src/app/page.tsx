"use client";

import { useEffect, useState, useRef } from "react";
import { ref, onValue, push, set, onDisconnect, remove } from "firebase/database";
import { db } from "@/lib/firebase";
import { Message } from "@/types/chat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Send, Users, LogOut, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

const GLOBAL_ROOM_ID = "global_lobby";

export default function GlobalChatPage() {
  const [isJoined, setIsJoined] = useState(false);
  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState("");
  const [participants, setParticipants] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessageCount = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isInitialLoad = useRef(true);

  // 1. 초기 닉네임 로드
  useEffect(() => {
    const storedName = sessionStorage.getItem("p2p-chat-username");
    const storedId = sessionStorage.getItem("p2p-chat-userid");
    
    if (storedName && storedId) {
      setUserName(storedName);
      setUserId(storedId);
      setIsJoined(true);
    } else {
      // 닉네임이 없으면 ID만 미리 생성 (선택사항)
      const newId = Math.random().toString(36).substring(2, 11);
      setUserId(newId);
    }

    // 알림음 초기화
    audioRef.current = new Audio("/assets/universfield-new-notification-022-370046.mp3");
    audioRef.current.volume = 0.5;
  }, []);

  // 2. 채팅 입장 후 Firebase 연결
  useEffect(() => {
    if (!isJoined || !userId) return;

    // 참여 정보 설정
    const participantRef = ref(db, `p2pchat/rooms/${GLOBAL_ROOM_ID}/participants/${userId}`);
    set(participantRef, userName);
    onDisconnect(participantRef).remove();

    // 참여자 목록 모니터링
    const participantsRef = ref(db, `p2pchat/rooms/${GLOBAL_ROOM_ID}/participants`);
    const unsubscribeParticipants = onValue(participantsRef, (snapshot) => {
      setParticipants(snapshot.val() || {});
    });

    // 메시지 리스닝
    const messagesRef = ref(db, `p2pchat/messages/${GLOBAL_ROOM_ID}`);
    const unsubscribeMessages = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const msgList = Object.entries(data).map(([id, msg]: [string, any]) => ({
          id,
          ...msg,
        }));
        setMessages(msgList);
        isInitialLoad.current = false;
      } else {
        setMessages([]);
        isInitialLoad.current = false;
      }
    });

    return () => {
      unsubscribeParticipants();
      unsubscribeMessages();
      remove(participantRef);
    };
  }, [isJoined, userId, userName]);

  // 3. 자동 스크롤 및 알림음
  useEffect(() => {
    if (messages.length > 0) {
      const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ 
          behavior: isInitialLoad.current ? "auto" : "smooth",
          block: "end"
        });
      };
      scrollToBottom();
      const timer = setTimeout(scrollToBottom, 100);

      if (!isInitialLoad.current && messages.length > prevMessageCount.current) {
        const lastMsg = messages[messages.length - 1];
        if (lastMsg.senderId !== userId) {
          audioRef.current?.play().catch(() => {});
        }
      }
      prevMessageCount.current = messages.length;
      return () => clearTimeout(timer);
    }
  }, [messages, userId]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = userName.trim();
    if (!trimmedName) return;
    
    // 유저 ID가 없는 경우 즉석 생성 (안전장치)
    const currentId = userId || Math.random().toString(36).substring(2, 11);
    if (!userId) setUserId(currentId);

    sessionStorage.setItem("p2p-chat-username", trimmedName);
    sessionStorage.setItem("p2p-chat-userid", currentId);
    setIsJoined(true);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const messagesRef = ref(db, `p2pchat/messages/${GLOBAL_ROOM_ID}`);
    await push(messagesRef, {
      senderName: userName,
      senderId: userId,
      text: inputText,
      timestamp: Date.now(),
    });
    setInputText("");
  };

  const handleLogout = () => {
    sessionStorage.clear();
    setIsJoined(false);
    window.location.reload();
  };

  if (!isJoined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8fafc] p-4">
        <div className="w-full max-w-md space-y-8 rounded-3xl bg-white p-8 shadow-2xl shadow-slate-200 animate-in fade-in zoom-in duration-500">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <MessageSquare className="h-10 w-10" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">P2P Real-time Chat</h1>
            <p className="mt-2 text-slate-500 font-medium text-lg">광장에 입장하기 위해 이름을 알려주세요</p>
          </div>

          <form onSubmit={handleJoin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 ml-1">내 이름</label>
              <Input 
                placeholder="사용할 닉네임을 입력하세요" 
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="h-14 rounded-xl border-slate-200 bg-slate-50 text-lg focus:ring-primary shadow-sm"
                autoFocus
                required
              />
            </div>
            <Button 
              type="submit"
              className="w-full h-14 rounded-xl text-lg font-bold shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95" 
              size="lg"
            >
              입장하기
            </Button>
          </form>
          
          <p className="text-center text-xs text-slate-400">
            접속하면 모든 사용자들과 즉시 대화를 나눌 수 있습니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-[#f8fafc]">
      {/* 헤더 */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-white/80 backdrop-blur-md px-6 py-4 shadow-sm">
        <div className="flex items-center gap-4">
          <Avatar className="h-12 w-12 border-2 border-primary/20 shadow-inner">
            <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-white font-bold text-lg">
              {userName.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-slate-900 leading-none">Global Square</h2>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px] h-5 px-1.5 font-bold">LIVE</Badge>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] font-medium text-slate-500">
              <span className="text-primary/70 font-bold bg-primary/5 px-2 py-0.5 rounded-full">
                {Object.keys(participants).length}명 접속 중
              </span>
              <span className="text-slate-300 mx-1">|</span>
              {Object.entries(participants).slice(0, 5).map(([id, name], index, array) => (
                <span key={id} className={cn("inline-flex items-center", id === userId && "text-primary font-bold")}>
                  {name}{id === userId && "(나)"}
                  {index < array.length - 1 && <span className="mx-0.5 opacity-30">·</span>}
                </span>
              ))}
              {Object.keys(participants).length > 5 && <span className="opacity-50">외 {Object.keys(participants).length - 5}명</span>}
            </div>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={handleLogout} className="text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full">
          <LogOut className="h-5 w-5" />
        </Button>
      </header>

      {/* 대화 영역 */}
      <ScrollArea className="flex-1 px-4 py-6 md:px-8">
        <div className="mx-auto flex max-w-4xl flex-col gap-6">
          <div className="flex justify-center mb-4">
            <Badge variant="secondary" className="bg-slate-200/50 text-slate-500 font-medium py-1.5 px-6 rounded-full border-none">
              대화 광장에 오신 것을 환영합니다!
            </Badge>
          </div>
          
          {messages.map((msg, index) => {
            const isMe = msg.senderId === userId;
            const showName = index === 0 || messages[index-1].senderId !== msg.senderId;

            return (
              <div key={msg.id || index} className={`flex flex-col ${isMe ? "items-end" : "items-start"} group animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                {!isMe && showName && (
                  <span className="mb-1.5 ml-1 text-xs font-bold text-slate-600">
                    {msg.senderName}
                  </span>
                )}
                <div className="relative flex max-w-[85%] items-end gap-2">
                  {isMe && (
                    <span className="mb-0.5 text-[10px] font-medium text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  <div className={cn(
                    "rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed shadow-sm break-all whitespace-pre-wrap transition-all",
                    isMe ? "bg-primary text-primary-foreground rounded-tr-none shadow-primary/10" : "bg-white text-slate-800 rounded-tl-none border border-slate-100 shadow-slate-100"
                  )}>
                    {msg.text}
                  </div>
                  {!isMe && (
                    <span className="mb-0.5 text-[10px] font-medium text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} className="h-4 w-full" />
        </div>
      </ScrollArea>

      {/* 입력 영역 */}
      <footer className="bg-white border-t p-4 pb-8">
        <form className="mx-auto flex max-w-4xl gap-3" onSubmit={handleSendMessage}>
          <div className="relative flex-1">
            <Input
              placeholder="메시지를 입력하세요..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="h-14 pl-5 pr-14 bg-slate-50 border-slate-200 focus:ring-primary rounded-2xl text-[15px]"
            />
          </div>
          <Button 
            type="submit" 
            size="icon" 
            disabled={!inputText.trim()}
            className="h-14 w-14 rounded-2xl shadow-lg shadow-primary/20 transition-transform active:scale-95"
          >
            <Send className="h-6 w-6" />
          </Button>
        </form>
      </footer>
    </div>
  );
}
