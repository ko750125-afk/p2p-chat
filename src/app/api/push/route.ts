import { NextResponse } from "next/server";
import * as admin from "firebase-admin";

// Firebase Admin 초기화 (중복 초기화 방지)
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    });
  } catch (error) {
    console.error("Firebase Admin init error:", error);
  }
}

export async function POST(request: Request) {
  try {
    const { title, body, senderId } = await request.json();

    // 1. 모든 유저의 FCM 토큰 조회
    const db = admin.database();
    const usersRef = db.ref("p2pchat/users");
    const snapshot = await usersRef.once("value");
    const usersData = snapshot.val();

    if (!usersData) {
      return NextResponse.json({ success: true, message: "No users found" });
    }

    // 2. 발신자를 제외한 토큰 필터링
    const tokens: string[] = [];
    Object.entries(usersData).forEach(([uid, data]: [string, any]) => {
      if (uid !== senderId && data.fcmToken) {
        tokens.push(data.fcmToken);
      }
    });

    if (tokens.length === 0) {
      return NextResponse.json({ success: true, message: "No tokens to send" });
    }

    // 3. FCM 발송
    const message = {
      notification: {
        title: title || "새 메시지",
        body: body || "내용이 없습니다.",
      },
      data: {
        click_action: "FLUTTER_NOTIFICATION_CLICK", // 또는 앱 URL
        senderId: senderId,
      },
      tokens: tokens,
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    
    console.log(`Successfully sent ${response.successCount} messages`);

    return NextResponse.json({ 
      success: true, 
      count: response.successCount,
      failure: response.failureCount 
    });

  } catch (error) {
    console.error("Push API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
