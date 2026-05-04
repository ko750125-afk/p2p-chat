"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ref, onValue, push, set, onDisconnect, update, remove, get, serverTimestamp } from "firebase/database";
import { db } from "@/lib/firebase";
import { Message, ChatRoom } from "@/types/chat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LogOut, Send } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ChatRoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  
  const [participants, setParticipants] = useState<Record<string, string>>({});
  const [roomInfo, setRoomInfo] = useState<ChatRoom | null>(null);
  const [inputText, setInputText] = useState("");
  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessageCount = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isInitialLoad = useRef(true);

  // 자동 스크롤 및 알림음 로직
  useEffect(() => {
    if (messages.length > 0) {
      // 1. 하단 스크롤 (setTimeout으로 렌더링 완료 후 실행 보장)
      const scrollToBottom = () => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ 
            behavior: isInitialLoad.current ? "auto" : "smooth",
            block: "end"
          });
        }
      };

      // 즉시 실행 및 약간의 지연 실행으로 렌더링 타이밍 대응
      scrollToBottom();
      const timer = setTimeout(scrollToBottom, 100);

      // 2. 알림음 재생 (새 메시지가 왔고, 내가 보낸 게 아닐 때)
      if (!isInitialLoad.current && messages.length > prevMessageCount.current) {
        const lastMsg = messages[messages.length - 1];
        if (lastMsg.senderId !== userId) {
          audioRef.current?.play().catch(e => console.log("Audio play blocked:", e));
        }
      }
      
      prevMessageCount.current = messages.length;
      return () => clearTimeout(timer);
    }
  }, [messages, userId]);

  useEffect(() => {
    const storedName = sessionStorage.getItem("p2p-chat-username");
    const storedId = sessionStorage.getItem("p2p-chat-userid");
    
    if (!storedName || !storedId) {
      router.push("/");
      return;
    }
    
    setUserName(storedName);
    setUserId(storedId);

    // 0. 알림음 객체 초기화 (브라우저 상호작용 후 재생 가능)
    audioRef.current = new Audio("/assets/universfield-new-notification-022-370046.mp3");
    audioRef.current.volume = 0.5;

    // 1. 참여자 존재 설정 및 연결 해제 시 자동 제거
    const participantRef = ref(db, `p2pchat/rooms/${roomId}/participants/${storedId}`);
    set(participantRef, storedName);
    onDisconnect(participantRef).remove();

    // 2. 참여자 목록 및 방 정보 모니터링
    const roomRef = ref(db, `p2pchat/rooms/${roomId}`);
    const unsubscribeRoom = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        router.push("/");
        return;
      }
      setRoomInfo({ id: roomId, ...data });
      if (data.participants) {
        setParticipants(data.participants);
      }
    });

    // 3. 메시지 리스닝
    const messagesRef = ref(db, `p2pchat/messages/${roomId}`);
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
        isInitialLoad.current = false;
      }
    });

    return () => {
      unsubscribeRoom();
      unsubscribeMessages();
      // 수동으로 나갈 때도 participants에서 제거
      remove(participantRef);
    };
  }, [roomId, router]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const messagesRef = ref(db, `p2pchat/messages/${roomId}`);
    const newMessageRef = push(messagesRef);
    
    await set(newMessageRef, {
      senderName: userName,
      senderId: userId,
      text: inputText,
      timestamp: Date.now(),
    });

    setInputText("");
  };

  const handleLeaveRoom = async () => {
    const participantRef = ref(db, `p2pchat/rooms/${roomId}/participants/${userId}`);
    await remove(participantRef);
    
    // 남은 인원 확인
    const participantsRef = ref(db, `p2pchat/rooms/${roomId}/participants`);
    const snapshot = await get(participantsRef);
    if (!snapshot.exists()) {
      // 마지막 인원이라면 방과 메시지 전체 삭제
      await remove(ref(db, `p2pchat/rooms/${roomId}`));
      await remove(ref(db, `p2pchat/messages/${roomId}`));
    }
    
    router.push("/");
  };

  return (
    <div className="flex h-screen flex-col bg-[#f8fafc]">
      {/* 헤더 */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-white/80 backdrop-blur-md px-6 py-4 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar className="h-12 w-12 border-2 border-primary/20 shadow-inner">
              <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-white font-bold text-lg">
                {userName.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-green-500 shadow-sm animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-slate-900 leading-none">실시간 그룹 대화</h2>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] h-5 px-1.5 font-bold">GROUP</Badge>
            </div>
            <p className="mt-1 text-xs font-medium text-slate-500 flex flex-wrap items-center gap-1">
              <span className="text-primary/70 font-bold bg-primary/5 px-2 py-0.5 rounded-full">
                접속 {Object.keys(participants || {}).length}명
              </span>
              <span className="text-slate-300 mx-1">|</span>
              {(Object.entries(participants || {})).map(([id, name], index, array) => {
                const isCreator = id === roomInfo?.creatorId;
                const isMe = id === userId;
                return (
                  <span key={id} className="inline-flex items-center">
                    <span className={cn(
                      "px-1.5 py-0.5 rounded-md transition-all",
                      isMe && "bg-primary/10 font-bold text-primary shadow-sm", 
                      isCreator && "text-slate-900 font-semibold"
                    )}>
                      {isCreator && <span className="mr-0.5" title="방장">👑</span>}
                      {name}
                      {isMe && <span className="ml-0.5 text-[10px] opacity-70">(나)</span>}
                    </span>
                    {index < array.length - 1 && <span className="text-slate-300 ml-1">·</span>}
                  </span>
                );
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleLeaveRoom} 
            className="gap-2 text-slate-500 hover:text-red-500 hover:bg-red-50 font-semibold"
          >
            <LogOut className="h-4 w-4" />
            <span>나가기</span>
          </Button>
        </div>
      </header>

      {/* 메시지 영역 */}
      <ScrollArea className="flex-1 px-4 py-6 md:px-8" viewportRef={scrollRef}>
        <div className="mx-auto flex max-w-4xl flex-col gap-6">
          <div className="flex justify-center">
            <Badge variant="secondary" className="bg-slate-200/50 text-slate-500 font-medium py-1 px-4 rounded-full border-none">
              대화가 시작되었습니다. 서로 인사를 나눠보세요!
            </Badge>
          </div>
          
          {messages.map((msg, index) => {
            const isMe = msg.senderId === userId;
            const showName = index === 0 || messages[index-1].senderId !== msg.senderId;

            return (
              <div
                key={msg.id || index}
                className={`flex flex-col ${isMe ? "items-end" : "items-start"} group animate-in fade-in slide-in-from-bottom-2 duration-300`}
              >
                {!isMe && showName && (
                  <span className="mb-1.5 ml-1 text-xs font-bold text-slate-600 flex items-center gap-1">
                    {msg.senderName}
                    {msg.senderId === roomInfo?.creatorId && <span className="text-[10px] text-amber-500">👑</span>}
                  </span>
                )}
                <div className="relative flex max-w-[85%] items-end gap-2">
                  {isMe && (
                    <span className="mb-0.5 text-[10px] font-medium text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" suppressHydrationWarning>
                      {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
                    </span>
                  )}
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed shadow-sm transition-all hover:shadow-md break-all whitespace-pre-wrap",
                      isMe
                        ? "bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-tr-none"
                        : "bg-white text-slate-800 rounded-tl-none border border-slate-100"
                    )}
                  >
                    {msg.text}
                  </div>
                  {!isMe && (
                    <span className="mb-0.5 text-[10px] font-medium text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" suppressHydrationWarning>
                      {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {/* 스크롤 하단 앵커 - 더 확실하게 보이기 위해 높이 조절 */}
          <div ref={messagesEndRef} className="h-4 w-full flex-shrink-0" aria-hidden="true" />
        </div>
      </ScrollArea>

      {/* 입력 영역 */}
      <footer className="sticky bottom-0 bg-white/80 backdrop-blur-md border-t p-4 pb-6">
        <form 
          className="mx-auto flex max-w-4xl gap-3"
          onSubmit={handleSendMessage}
        >
          <div className="relative flex-1">
            <Input
              placeholder="메시지를 입력하세요..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="h-12 pl-4 pr-12 bg-slate-50 border-slate-200 focus-visible:ring-primary rounded-xl text-[15px]"
            />
          </div>
          <Button 
            type="submit" 
            size="icon" 
            disabled={!inputText.trim()}
            className="h-12 w-12 rounded-xl shadow-lg shadow-primary/20 transition-transform active:scale-95"
          >
            <Send className="h-5 w-5" />
          </Button>
        </form>
      </footer>
    </div>
  );
}

