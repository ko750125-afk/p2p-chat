import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

interface ChatInputProps {
  onSendMessage: (text: string) => void;
}

export function ChatInput({ onSendMessage }: ChatInputProps) {
  const [inputText, setInputText] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText("");
  };

  return (
    <footer className="bg-white/95 backdrop-blur-xl border-t border-slate-100 p-4 pb-safe md:p-6 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
      <form 
        className="mx-auto flex max-w-4xl gap-4" 
        onSubmit={handleSubmit}
        autoComplete="off"
      >
        <div className="relative flex-1 group">
          <textarea
            id="message-input"
            rows={1}
            placeholder="메시지를 입력하세요..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            autoComplete="new-password"
            data-lpignore="true"
            spellCheck={false}
            className="w-full min-h-[60px] max-h-[120px] py-4 pl-6 pr-12 bg-slate-50/50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary/10 rounded-[1.5rem] text-[16px] font-semibold transition-all placeholder:text-slate-400 resize-none overflow-y-auto"
          />
        </div>
        <Button 
          type="submit" 
          size="icon" 
          disabled={!inputText.trim()}
          className="h-[60px] w-[60px] rounded-[1.5rem] shadow-xl shadow-primary/30 transition-all hover:scale-[1.05] active:scale-90 bg-primary hover:bg-primary/90 flex-shrink-0"
        >
          <Send className="h-7 w-7" />
        </Button>
      </form>
    </footer>
  );
}
