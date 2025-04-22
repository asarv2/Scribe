/**
 * app/class/[classId]/chat/[chatId]/page.tsx
 * 
 * This page is used to chat with the AI, which looks similar to the GenerateCanvas page, but instead with a chat interface.
 * 
 * @AshokSaravanan222
 * 16.02.2025
 */
"use client";

import ChatCanvas from "@/components/Chat/Canvas/ChatCanvas";
import { ClassLayout } from "@/components/Class/ClassLayout";
import { use } from "react";

export default function ChatPage({ params }: { params: Promise<{ classId: string, chatId: string }> }) {
    const { classId, chatId } = use(params);

    // define all realtime listeners here

    return <ClassLayout classId={classId}>
        <ChatCanvas classId={classId} chatId={chatId} />
    </ClassLayout>;
}
