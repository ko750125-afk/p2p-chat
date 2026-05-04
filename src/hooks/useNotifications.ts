import { useState, useCallback, useRef } from "react";
import { User } from "firebase/auth";
import { ref, set } from "firebase/database";
import { getToken, onMessage } from "firebase/messaging";
import { db, messaging } from "@/lib/firebase";

export function useNotifications() {
  const [enabled, setEnabled] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 초기화 시점에 오디오 객체 생성 (브라우저 정책상 사용자 상호작용 후 재생 가능)
  if (typeof window !== "undefined" && !audioRef.current) {
    audioRef.current = new Audio("/assets/universfield-new-notification-022-370046.mp3");
    audioRef.current.volume = 0.5;
  }

  const setup = useCallback(async (user: User) => {
    try {
      const msg = await messaging();
      if (!msg) return;

      let permission = Notification.permission;
      if (permission === "default") {
        permission = await Notification.requestPermission();
      }

      if (permission !== "granted") {
        setEnabled(false);
        return;
      }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_KEY;
      if (!vapidKey) return;

      const token = await getToken(msg, { vapidKey });
      if (token) {
        setEnabled(true);
        const tokenRef = ref(db, `p2pchat/users/${user.uid}/fcmToken`);
        await set(tokenRef, token);
      }

      // 포그라운드 메시지 리스너 (한 번만 등록되도록 로직 필요할 수 있음)
      onMessage(msg, (payload) => {
        if (payload.data?.senderId !== user.uid) {
          audioRef.current?.play().catch(() => {});
          new Notification(payload.notification?.title || "새 메시지", {
            body: payload.notification?.body,
            icon: user.photoURL || "/icon.png",
          });
        }
      });

    } catch (error) {
      console.error("Notification setup error:", error);
      setEnabled(false);
    }
  }, []);

  const playNotificationSound = useCallback(() => {
    audioRef.current?.play().catch(() => {});
  }, []);

  return { enabled, setup, playNotificationSound };
}
