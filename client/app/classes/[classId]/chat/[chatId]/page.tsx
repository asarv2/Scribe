/**
 * app/classes/[classId]/chat/[chatId]/page.tsx
 * 
 * This page is used to chat with the AI, which looks similar to the GenerateCanvas page, but instead with a chat interface.
 * 
 * @AshokSaravanan222
 * 16.02.2025
 */
"use client";
import ChatCanvas from "@/components/Chat/ChatCanvas";

export default function ChatPage({ params }: { params: { classId: string, chatId: string } }) {
    const classId = params.classId;
    const chatId = params.chatId;
    return <ChatCanvas classId={classId} chatId={chatId} />;
}

