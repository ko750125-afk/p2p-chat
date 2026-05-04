"use client";

import { useEffect, useState } from "react";
import { ref, onValue, push, set, update, get } from "firebase/database";
import { db } from "@/lib/firebase";
import { ChatRoom } from "@/types/chat";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export default function ChatListPage() {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [newRoomName, setNewRoomName] = useState("");
  const [userName, setUserName] = useState("");
  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const router = useRouter();

  useEffect(() => {
    // 닉네임 로드
    const storedName = sessionStorage.getItem("p2p-chat-username");
    if (storedName) setUserName(storedName);

    const roomsRef = ref(db, "p2pchat/rooms");
    const unsubscribe = onValue(roomsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const roomList = Object.entries(data).map(([id, room]: [string, any]) => ({
          id,
          ...room,
        }));
        setRooms(roomList);
      } else {
        setRooms([]);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleCreateRoom = async () => {
    if (!newRoomName.trim() || !userName.trim()) return;

    sessionStorage.setItem("p2p-chat-username", userName);
    const userId = sessionStorage.getItem("p2p-chat-userid") || Math.random().toString(36).substring(2, 11);
    sessionStorage.setItem("p2p-chat-userid", userId);

    const roomsRef = ref(db, "p2pchat/rooms");
    const newRoomRef = push(roomsRef);
    const roomId = newRoomRef.key;

    const roomData = {
      creatorName: userName,
      title: newRoomName,
      createdAt: Date.now(),
      participants: {
        [userId]: userName
      }
    };

    await set(newRoomRef, roomData);
    router.push(`/chat/${roomId}`);
  };

  const handleJoinRoom = async () => {
    if (!selectedRoom || !userName.trim()) return;

    sessionStorage.setItem("p2p-chat-username", userName);
    const userId = sessionStorage.getItem("p2p-chat-userid") || Math.random().toString(36).substring(2, 11);
    sessionStorage.setItem("p2p-chat-userid", userId);

    const roomRef = ref(db, `p2pchat/rooms/${selectedRoom.id}`);
    const snapshot = await get(roomRef);
    const roomData = snapshot.val();

    const participants = roomData?.participants || {};
    const participantCount = Object.keys(participants).length;

    if (roomData && (participantCount < 2 || participants[userId])) {
      await update(ref(db, `p2pchat/rooms/${selectedRoom.id}/participants`), {
        [userId]: userName
      });
      router.push(`/chat/${selectedRoom.id}`);
    } else {
      alert("방이 가득 찼거나 사라졌습니다.");
      setIsJoinDialogOpen(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-primary p-3 text-primary-foreground shadow-lg shadow-primary/20">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">1:1 P2P Chat</h1>
              <p className="text-slate-500">실시간으로 소통하는 가장 빠른 방법</p>
            </div>
          </div>
          
          <Dialog>
            <DialogTrigger className={cn(buttonVariants({ size: "lg" }), "gap-2 rounded-full shadow-lg hover:shadow-xl transition-all")}>
              <Plus className="h-5 w-5" />
              방 만들기
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold">새로운 채팅방 생성</DialogTitle>
              </DialogHeader>
              <div className="space-y-6 py-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">내 이름</label>
                  <Input 
                    placeholder="사용할 이름을 입력하세요" 
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="h-12 border-slate-200 focus-visible:ring-primary"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">방 이름 (또는 주제)</label>
                  <Input 
                    placeholder="예: 즐거운 대화방" 
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    className="h-12 border-slate-200 focus-visible:ring-primary"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setIsJoinDialogOpen(false)} className="h-12 px-6">취소</Button>
                <Button 
                  onClick={handleCreateRoom} 
                  disabled={!newRoomName.trim() || !userName.trim()}
                  className="h-12 px-8 font-bold"
                >
                  생성 및 입장
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </header>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-24 text-center">
              <div className="mb-4 rounded-full bg-slate-100 p-6 text-slate-300">
                <Users className="h-12 w-12" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900">현재 활성화된 방이 없습니다</h3>
              <p className="mt-2 text-slate-500">우측 상단의 버튼을 눌러 첫 번째 대화방을 만들어보세요!</p>
            </div>
          ) : (
            rooms.map((room) => {
              const participants = (room as any).participants || {};
              const count = Object.keys(participants).length;
              const isFull = count >= 2;

              return (
                <Card key={room.id} className="group overflow-hidden border-none shadow-sm ring-1 ring-slate-200 transition-all hover:-translate-y-1 hover:shadow-xl hover:ring-primary/20">
                  <CardHeader className="space-y-4 pb-4">
                    <div className="flex items-center justify-between">
                      <Badge 
                        variant={isFull ? "secondary" : "default"}
                        className={cn(
                          "px-2.5 py-0.5 font-bold transition-colors",
                          isFull ? "bg-slate-100 text-slate-500" : "bg-green-100 text-green-700 hover:bg-green-100"
                        )}
                      >
                        <div className={cn("mr-1.5 h-1.5 w-1.5 rounded-full", isFull ? "bg-slate-400" : "bg-green-500 animate-pulse")} />
                        {count}/2명 참여중
                      </Badge>
                    </div>
                    <div>
                      <CardTitle className="text-xl font-bold text-slate-900 line-clamp-1 group-hover:text-primary transition-colors">
                        {(room as any).title || `${room.creatorName}님의 대화방`}
                      </CardTitle>
                      <CardDescription className="mt-1 flex items-center text-sm font-medium text-slate-500" suppressHydrationWarning>
                        개설자: {room.creatorName}
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardFooter className="pt-0">
                    <Button 
                      className={cn(
                        "w-full gap-2 font-bold h-11 transition-all",
                        isFull ? "bg-slate-100 text-slate-400 hover:bg-slate-100" : "shadow-md hover:shadow-lg"
                      )}
                      variant={isFull ? "secondary" : "default"}
                      disabled={isFull}
                      onClick={() => {
                        setSelectedRoom(room);
                        setIsJoinDialogOpen(true);
                      }}
                    >
                      {isFull ? "가득 찬 방" : "대화 참여하기"}
                      {!isFull && <ArrowRight className="h-4 w-4" />}
                    </Button>
                  </CardFooter>
                </Card>
              );
            })
          )}
        </div>


        {/* 참여 닉네임 입력 다이얼로그 */}
        <Dialog open={isJoinDialogOpen} onOpenChange={setIsJoinDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>채팅방 참여</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">채팅에서 사용할 이름</label>
                <Input 
                  placeholder="이름을 입력하세요" 
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsJoinDialogOpen(false)}>취소</Button>
              <Button onClick={handleJoinRoom} disabled={!userName.trim()}>입장하기</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
}
