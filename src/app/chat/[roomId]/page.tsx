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
  const [inputText, setInputText] = useState("");
  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isInitialLoad = useRef(true);

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

    // 2. 참여자 목록 모니터링
    const participantsRef = ref(db, `p2pchat/rooms/${roomId}/participants`);
    const unsubscribeParticipants = onValue(participantsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        // 모든 참여자가 나갔다면 방 삭제 (방장 또는 마지막 인원이 나갈 때 처리될 수도 있음)
        // 여기서는 클라이언트 측에서 감지하여 홈으로 이동
        router.push("/");
        return;
      }
      setParticipants(data);
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
        
        // 새로운 메시지가 추가되었고 초기 로드가 아닐 때 알림음 재생
        if (!isInitialLoad.current && msgList.length > messages.length) {
          const lastMsg = msgList[msgList.length - 1];
          if (lastMsg.senderId !== storedId) {
            audioRef.current?.play().catch(e => console.log("Audio play blocked:", e));
          }
        }
        
        setMessages(msgList);
        isInitialLoad.current = false;

        // 스크롤 하단 이동
        setTimeout(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          }
        }, 100);
      } else {
        isInitialLoad.current = false;
      }
    });

    return () => {
      unsubscribeParticipants();
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
            <p className="mt-1 text-xs font-medium text-slate-500">
              참여자: {Object.values(participants).join(", ")}
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
            const isMe = (msg as any).senderId === userId;
            const showName = index === 0 || (messages[index-1] as any).senderId !== (msg as any).senderId;

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? "items-end" : "items-start"} group animate-in fade-in slide-in-from-bottom-2 duration-300`}
              >
                {!isMe && showName && (
                  <span className="mb-1.5 ml-1 text-xs font-bold text-slate-600">
                    {msg.senderName}
                  </span>
                )}
                <div className="relative flex max-w-[85%] items-end gap-2">
                  {isMe && (
                    <span className="mb-0.5 text-[10px] font-medium text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" suppressHydrationWarning>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed shadow-sm transition-all hover:shadow-md",
                      isMe
                        ? "bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-tr-none"
                        : "bg-white text-slate-800 rounded-tl-none border border-slate-100"
                    )}
                  >
                    {msg.text}
                  </div>
                  {!isMe && (
                    <span className="mb-0.5 text-[10px] font-medium text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" suppressHydrationWarning>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
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

