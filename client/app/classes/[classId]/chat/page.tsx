/**
 * app/classes/[classId]/chat/[chatId]/page.tsx
 * 
 * This page is used to chat with the AI, which looks similar to the GenerateCanvas page, but instead with a chat interface.
 * 
 * 
 */
"use client";
import ChatCanvas from "@/components/Chat/ChatCanvas";

export default function ChatPage({ params }: { params: { classId: string } }) {
    return <ChatCanvas classId={params.classId} />;
}

