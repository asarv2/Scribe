/**
 * app/classes/[classId]/chat/[chatId]/page.tsx
 * 
 * This page is used to chat with the AI, which looks similar to the GenerateCanvas page, but instead with a chat interface.
 * 
 * @AshokSaravanan222
 * 16.02.2025
 */
"use client";

import ChatCanvas from "@/components/Chat/Canvas/ChatCanvas";
import { useFullscreen } from "@mantine/hooks";
import { useEffect, useState } from "react";
import { use } from "react";

export default function ChatPage({ params }: { params: { classId: string, chatId: string } }) {
    const { classId, chatId } = params;
    const { toggle } = useFullscreen();
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        
        // Initial check
        setIsFullscreen(!!document.fullscreenElement);

        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, []);

    useEffect(() => {
        if (document.fullscreenElement) {
            toggle();
        }
    }, []);

    return <ChatCanvas classId={classId} chatId={chatId} toggle={toggle} fullscreen={isFullscreen} />;
}

