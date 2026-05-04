import { RefObject } from "react";
import { Message } from "@/types/chat";
import { cn } from "@/lib/utils";
import { MessageSquare } from "lucide-react";

interface MessageListProps {
  messages: Message[];
  currentUser: { uid: string } | null;
  containerRef: RefObject<HTMLDivElement>;
}

export function MessageList({ messages, currentUser, containerRef }: MessageListProps) {
  return (
    <main 
      ref={containerRef}
      className="flex-1 overflow-y-auto scroll-smooth px-4 py-6 md:px-12 bg-gradient-to-b from-white to-slate-50/50"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-6 pb-10">
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 bg-white/80 border border-slate-100 shadow-sm text-slate-500 text-xs font-bold py-2 px-8 rounded-full backdrop-blur-sm">
            <MessageSquare className="h-3 w-3 text-primary" />
            오늘의 대화가 시작되었습니다
          </div>
        </div>
        
        {messages.map((msg, index) => {
          const isMe = msg.senderId === currentUser?.uid;
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
      </div>
    </main>
  );
}
