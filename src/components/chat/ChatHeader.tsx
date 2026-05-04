import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LogOut, Bell, BellOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Participant } from "@/types/chat";

interface ChatHeaderProps {
  user: { displayName: string | null, photoURL: string | null } | null;
  participants: Record<string, Participant>;
  notificationEnabled: boolean;
  onLogout: () => void;
  onSetupNotifications: () => void;
}

export function ChatHeader({ 
  user, 
  participants, 
  notificationEnabled, 
  onLogout, 
  onSetupNotifications 
}: ChatHeaderProps) {
  return (
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
              onClick={onSetupNotifications}
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
        <Button variant="ghost" size="icon" onClick={onLogout} className="text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-2xl h-11 w-11">
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
