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
import { Chat, Message } from "@/types";
import { getChat } from "@/utils/queries/get-chat";
import { getFiles } from "@/utils/queries/get-files";
import { getMessages } from "@/utils/queries/get-messages";
import { getUser } from "@/utils/queries/get-user";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { use, useEffect, useState } from "react";

export default function ChatPage({ params }: { params: Promise<{ classId: string, chatId: string }> }) {
    const { classId, chatId } = use(params);
    const supabase = useSupabaseBrowser();
    const queryClient = useQueryClient();

    const [chatTitleUpdated, setChatTitleUpdated] = useState<boolean>(false);

    const {data: chat} = useQuery({
        queryKey: ["chat", chatId],
        queryFn: () => getChat(supabase, chatId),
        enabled: chatId !== "new"
    });

    const {data: messages} = useQuery({
        queryKey: ["messages", chatId],
        queryFn: () => getMessages(supabase, [chatId]),
        enabled: chatId !== "new"
    });

    const { data: files } = useQuery({
        queryKey: ["files", classId],
        queryFn: () => getFiles(supabase, classId)
    });

    useEffect(() => {
        const channel = supabase
            .channel(`realtime-chats-${classId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'prod',
                    table: 'chats',
                    filter: `class=eq.${classId}`
                },
                async (payload) => {
                    const newChat = payload.new as Chat
                    if (newChat.name !== chat?.name && newChat.name !== "Chat" && newChat.name !== "Office Hours") {
                        setChatTitleUpdated(true);
                    }
                    queryClient.invalidateQueries({
                        queryKey: ["chat", chatId]
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient, supabase, classId, chatId]);

    useEffect(() => {
        const channel = supabase
            .channel(`realtime-messages-${chatId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'prod',
                    table: 'messages',
                    filter: `chat=eq.${chatId}`
                },
                async (payload) => {
                    const newMessage = payload.new as Message
                    console.log("messages changed: ", newMessage);
                    queryClient.invalidateQueries({
                        queryKey: ["messages", chatId]
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient, supabase, chatId]);

    useEffect(() => {
        const channel = supabase
            .channel(`realtime-files-${classId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'prod',
                    table: 'files',
                    filter: `class=eq.${classId}`
                },
                () => {
                    console.log("files changed");
                    queryClient.invalidateQueries({
                        queryKey: ["files", classId]
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient, supabase, classId]);

    useEffect(() => {
        if (!files || files.length === 0) return;

        const channel = supabase
            .channel(`realtime-file-documents-${classId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'prod',
                    table: 'documents',
                    filter: `file=in.(${files.map(file => file.id).join(',')})`
                },
                () => {
                    console.log("documents changed");
                    queryClient.invalidateQueries({
                        queryKey: ["fileDocuments", classId]
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient, supabase, classId, files]);

    useEffect(() => {
        if (!messages || chatId === "new") return;

        const figuresChannel = supabase
          .channel(`realtime-figures-${chatId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'prod',
              table: 'figures',
              filter: `message=in.(${messages.map(m => m.id).join(',')})`
            },
            () => {
              console.log("figures changed");
              queryClient.invalidateQueries({
                queryKey: ["figures", chatId]
              });
              queryClient.invalidateQueries({
                queryKey: ["summaryFigures", chatId]
              });
              queryClient.invalidateQueries({
                queryKey: ["questionFigures", chatId]
              });
            }
          )
          .subscribe();
    
        const summariesChannel = supabase
          .channel(`realtime-summaries-${chatId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'prod',
              table: 'summaries',
              filter: `message=in.(${messages.map(m => m.id).join(',')})`
            },
            () => {
              console.log("summaries changed");
              queryClient.invalidateQueries({
                queryKey: ["summaries", chatId]
              });
            }
          )
          .subscribe();
    
        const questionsChannel = supabase
          .channel(`realtime-questions-${chatId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'prod',
              table: 'questions',
              filter: `message=in.(${messages.map(m => m.id).join(',')})`
            },
            () => {
              console.log("questions changed");
              queryClient.invalidateQueries({
                queryKey: ["questions", chatId]
              });
            }
          )
          .subscribe();
    
        return () => {
          supabase.removeChannel(figuresChannel);
          supabase.removeChannel(summariesChannel);
          supabase.removeChannel(questionsChannel);
        };
    }, [chatId, supabase, queryClient, messages]);

    return <ClassLayout classId={classId}>
        <ChatCanvas classId={classId} chatId={chatId} chatTitleUpdated={chatTitleUpdated} />
    </ClassLayout>;
}
