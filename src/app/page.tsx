"use client";

import { useEffect, useState, useRef } from "react";
import { ref, onValue, push, set, onDisconnect, remove } from "firebase/database";
import { signInWithPopup, onAuthStateChanged, signOut, User } from "firebase/auth";
import { getToken, onMessage } from "firebase/messaging";
import { db, auth, googleProvider, messaging } from "@/lib/firebase";
import { Message } from "@/types/chat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Send, LogOut, MessageSquare, Bell, BellOff } from "lucide-react";
import { cn } from "@/lib/utils";

const GLOBAL_ROOM_ID = "global_lobby";

export default function GlobalChatPage() {
  const [user, setUser] = useState<User | null>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [participants, setParticipants] = useState<Record<string, {name: string, photo?: string}>>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessageCount = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isInitialLoad = useRef(true);

  // 1. 인증 상태 감시
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setIsJoined(true);
        setupNotifications(currentUser);
      } else {
        setIsJoined(false);
      }
    });

    audioRef.current = new Audio("/assets/universfield-new-notification-022-370046.mp3");
    audioRef.current.volume = 0.5;

    return () => unsubscribe();
  }, []);

  // 2. 알림 설정 (FCM 토큰 획득 및 저장)
  const setupNotifications = async (currentUser: User) => {
    try {
      const msg = await messaging();
      if (!msg) {
        console.warn("Messaging not supported in this browser");
        return;
      }

      // 권한 확인 및 요청
      let permission = Notification.permission;
      if (permission === "default") {
        permission = await Notification.requestPermission();
      }

      if (permission !== "granted") {
        setNotificationEnabled(false);
        return;
      }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_KEY;
      if (!vapidKey) {
        console.error("VAPID Key is missing in environment variables");
        return;
      }

      const token = await getToken(msg, { vapidKey });

      if (token) {
        setNotificationEnabled(true);
        // 토큰을 DB에 저장 (푸시 발송용)
        const tokenRef = ref(db, `p2pchat/users/${currentUser.uid}/fcmToken`);
        await set(tokenRef, token);
      }

      // 포그라운드 메시지 수신
      onMessage(msg, (payload) => {
        console.log("Foreground message received:", payload);
        // 포그라운드에서는 직접 알림을 띄우거나 소리를 재생
        if (payload.data?.senderId !== currentUser.uid) {
          audioRef.current?.play().catch(() => {});
          
          // 브라우저 알림 직접 띄우기 (포그라운드)
          new Notification(payload.notification?.title || "새 메시지", {
            body: payload.notification?.body,
            icon: currentUser.photoURL || "/icon.png",
          });
        }
      });

    } catch (error) {
      console.error("Notification setup error:", error);
      setNotificationEnabled(false);
    }
  };

  // 3. 채팅 참여 정보 및 메시지 리스닝
  useEffect(() => {
    if (!isJoined || !user) return;

    const participantRef = ref(db, `p2pchat/rooms/${GLOBAL_ROOM_ID}/participants/${user.uid}`);
    set(participantRef, {
      name: user.displayName || "익명",
      photo: user.photoURL || "",
      lastSeen: Date.now()
    });
    onDisconnect(participantRef).remove();

    const participantsRef = ref(db, `p2pchat/rooms/${GLOBAL_ROOM_ID}/participants`);
    const unsubscribeParticipants = onValue(participantsRef, (snapshot) => {
      setParticipants(snapshot.val() || {});
    });

    const messagesRef = ref(db, `p2pchat/messages/${GLOBAL_ROOM_ID}`);
    const unsubscribeMessages = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const msgList = Object.entries(data).map(([id, msg]: [string, any]) => ({
          id,
          ...msg,
        }));
        // 최근 100개만 표시
        setMessages(msgList.slice(-100));
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
  }, [isJoined, user]);

  // 4. 자동 스크롤 및 포그라운드 알림음
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
        if (lastMsg.senderId !== user?.uid) {
          audioRef.current?.play().catch(() => {});
        }
      }
      prevMessageCount.current = messages.length;
      return () => clearTimeout(timer);
    }
  }, [messages, user]);

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login Error:", error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !user) return;

    const tempText = inputText;
    setInputText("");

    const messagesRef = ref(db, `p2pchat/messages/${GLOBAL_ROOM_ID}`);
    const messageData = {
      senderName: user.displayName || "익명",
      senderId: user.uid,
      text: tempText,
      timestamp: Date.now(),
    };

    try {
      await push(messagesRef, messageData);

      // 푸시 알림 발송 요청 (API 호출)
      fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: user.displayName,
          body: tempText,
          senderId: user.uid
        })
      }).catch(err => console.error("Push API Call failed:", err));
      
    } catch (error) {
      console.error("Send Error:", error);
      setInputText(tempText); // 실패 시 텍스트 복구
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setIsJoined(false);
    window.location.reload();
  };

  if (!isJoined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50/30 p-4">
        <div className="w-full max-w-md space-y-8 rounded-[2.5rem] bg-white p-10 shadow-2xl shadow-blue-900/5 animate-in fade-in zoom-in duration-700 text-center border border-white">
          <div className="relative inline-block">
            <div className="mx-auto mb-8 flex h-28 w-28 items-center justify-center rounded-[2rem] bg-gradient-to-tr from-primary to-blue-400 text-primary-foreground shadow-2xl shadow-primary/30 transform hover:rotate-6 transition-transform">
              <MessageSquare className="h-14 w-14" />
            </div>
            <div className="absolute -right-2 -top-2 h-8 w-8 bg-green-500 rounded-full border-4 border-white animate-pulse" />
          </div>
          
          <div>
            <h1 className="text-4xl font-black tracking-tight text-slate-900">Global Square</h1>
            <p className="mt-4 text-slate-500 font-medium text-lg leading-relaxed">
              세계 어디서나 실시간으로<br/>자유롭게 대화를 나눠보세요.
            </p>
          </div>

          <div className="space-y-6 pt-4">
            <Button 
              onClick={handleGoogleLogin}
              className="w-full h-18 rounded-[1.5rem] text-xl font-bold shadow-xl shadow-primary/20 transition-all hover:scale-[1.03] active:scale-95 flex items-center justify-center gap-4 bg-primary hover:bg-primary/90" 
              size="lg"
            >
              <div className="bg-white p-1.5 rounded-lg shadow-sm">
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              </div>
              Google 계정으로 시작
            </Button>
            <div className="flex items-center justify-center gap-2 text-sm text-slate-400 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              보안 인증 로그인 완료 후 입장 가능
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-[#fcfdfe] overflow-hidden">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/90 backdrop-blur-xl px-6 py-4 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar className="h-14 w-14 border-2 border-primary/10 shadow-lg p-0.5 bg-white">
              <AvatarImage src={user?.photoURL || ""} className="rounded-full" />
              <AvatarFallback className="bg-gradient-to-br from-primary to-blue-500 text-white font-bold text-xl">
                {user?.displayName?.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 bg-green-500 rounded-full border-2 border-white shadow-sm" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-slate-900 tracking-tight leading-none">Global Square</h2>
              <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-none text-[10px] h-5 px-2 font-black tracking-widest uppercase">LIVE</Badge>
              <button 
                onClick={() => setupNotifications(user!)}
                className={cn(
                  "p-1 rounded-lg transition-colors",
                  notificationEnabled ? "text-primary bg-primary/5" : "text-slate-300 hover:text-slate-500 hover:bg-slate-50"
                )}
              >
                {notificationEnabled ? <Bell className="h-4 w-4 animate-bounce" /> : <BellOff className="h-4 w-4" />}
              </button>
            </div>
            <div className="mt-1.5 flex items-center gap-2 text-xs font-semibold text-slate-500">
              <span className="flex items-center gap-1.5 text-primary bg-primary/5 px-2.5 py-1 rounded-full">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                {Object.keys(participants).length} Members Online
              </span>
              <div className="flex -space-x-2 ml-1">
                {Object.entries(participants).slice(0, 3).map(([id, p]) => (
                  <Avatar key={id} className="h-6 w-6 border-2 border-white ring-1 ring-slate-100">
                    <AvatarImage src={p.photo} />
                    <AvatarFallback className="text-[8px]">{p.name[0]}</AvatarFallback>
                  </Avatar>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={handleLogout} className="text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-2xl h-11 w-11">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <ScrollArea className="flex-1 px-6 py-8 md:px-12 bg-gradient-to-b from-white to-slate-50/50">
        <div className="mx-auto flex max-w-4xl flex-col gap-8 pb-32">
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-2 bg-white/80 border border-slate-100 shadow-sm text-slate-500 text-xs font-bold py-2 px-8 rounded-full backdrop-blur-sm">
              <MessageSquare className="h-3 w-3 text-primary" />
              오늘의 대화가 시작되었습니다
            </div>
          </div>
          
          {messages.map((msg, index) => {
            const isMe = msg.senderId === user?.uid;
            const isFirstInGroup = index === 0 || messages[index-1].senderId !== msg.senderId;
            const isLastInGroup = index === messages.length - 1 || messages[index+1].senderId !== msg.senderId;

            return (
              <div key={msg.id || index} className={`flex flex-col ${isMe ? "items-end" : "items-start"} group animate-in fade-in slide-in-from-bottom-4 duration-500`}>
                {!isMe && isFirstInGroup && (
                  <span className="mb-2 ml-2 text-xs font-black text-slate-700 tracking-tight">
                    {msg.senderName}
                  </span>
                )}
                <div className={cn(
                  "relative flex max-w-[85%] items-end gap-3",
                  isMe ? "flex-row-reverse" : "flex-row"
                )}>
                  <div className={cn(
                    "rounded-[1.5rem] px-5 py-3.5 text-[15px] font-medium leading-relaxed shadow-sm break-all whitespace-pre-wrap transition-all transform hover:scale-[1.01]",
                    isMe 
                      ? "bg-primary text-primary-foreground shadow-primary/20 ring-4 ring-primary/5" 
                      : "bg-white text-slate-800 border border-slate-100 shadow-blue-900/5",
                    isMe && isFirstInGroup && "rounded-tr-md",
                    !isMe && isFirstInGroup && "rounded-tl-md",
                  )}>
                    {msg.text}
                  </div>
                  <span className={cn(
                    "mb-1 text-[10px] font-bold text-slate-400 transition-opacity",
                    isLastInGroup ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  )}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                  </span>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} className="h-8 w-full" />
        </div>
      </ScrollArea>

      <footer className="sticky bottom-0 z-20 bg-white/95 backdrop-blur-xl border-t border-slate-100 p-4 pb-6 md:p-6 shadow-[0_-4px_20px_rgba(0,0,0,0,03)]">
        <form className="mx-auto flex max-w-4xl gap-4" onSubmit={handleSendMessage}>
          <div className="relative flex-1 group">
            <Input
              placeholder="메시지를 입력하세요..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="h-16 pl-6 pr-16 bg-slate-50/50 border-slate-200 focus:bg-white focus:ring-4 focus:ring-primary/10 rounded-[1.5rem] text-[16px] font-semibold transition-all placeholder:text-slate-400"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-primary/5 flex items-center justify-center opacity-0 group-focus-within:opacity-100 transition-opacity">
              <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            </div>
          </div>
          <Button 
            type="submit" 
            size="icon" 
            disabled={!inputText.trim()}
            className="h-16 w-16 rounded-[1.5rem] shadow-xl shadow-primary/30 transition-all hover:scale-[1.05] active:scale-90 bg-primary hover:bg-primary/90"
          >
            <Send className="h-7 w-7" />
          </Button>
        </form>
      </footer>
    </div>
  );
}

