/**
 * app/classes/[classId]/chat/[generationId]/page.tsx
 * 
 * This page is used to chat with the AI, which looks similar to the GenerateCanvas page, but instead with a chat interface.
 * 
 * @AshokSaravanan222
 * 07.02.2025
 */
"use client";
import ChatCanvas from "@/components/Chat/ChatCanvas";

export default function ChatPage({ params }: { params: { classId: string, generationId: string } }) {
    const classId = params.classId;
    const generationId = params.generationId; // "new" or an actual generation ID
    return <ChatCanvas classId={classId} generationId={generationId} />;
}

