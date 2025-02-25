/**
 * ChatCanvas.tsx
 * This component is for chatting with the AI.
 */

import { Text, Card, Stack, Group, Grid, Badge, Modal, ActionIcon, Avatar, useMantineColorScheme } from "@mantine/core";
import { useRouter } from "next/navigation";
import { Container, Flex } from "@mantine/core";
import { IconArrowLeft, IconRefresh, IconX } from "@tabler/icons-react";
import { useEffect, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMediaQuery } from "@mantine/hooks";
import { em } from "@mantine/core";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { getChat } from "@/utils/queries/get-chat";
import { getMessages } from "@/utils/queries/get-messages";
import { getProfile } from "@/utils/queries/get-profile";
import { getProfessor } from "@/utils/queries/get-professor";
import { createChat } from "@/utils/services/chat";
import { getAvatarUrl } from "@/utils/services/images";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";

import { Chapter, ChatMessage, ChatType, Subchapter, Document, ViewerMode } from "@/types";
import { getUser } from "@/utils/queries/get-user";
import { ClassLayout } from "@/components/Class/ClassLayout";
import { ContextPanel } from "../ContextPanel";
import { ViewerPanel } from "./ViewerPanel";
import { notifications } from "@mantine/notifications";
import { createMessages } from "@/utils/services/messages";
import { getLectureDocuments } from "@/utils/queries/get-lecture-docs";
import { getTextbookDocuments } from "@/utils/queries/get-textbook-docs";
import { getChapters } from "@/utils/queries/get-chapters";
import { getSubchapters } from "@/utils/queries/get-subchapters";
import { getHomeworks } from "@/utils/queries/get-homeworks";
import { getProblems } from "@/utils/queries/get-problems";
import { getExercises } from "@/utils/queries/get-exercises";
import { getLectures } from "@/utils/queries/get-lectures";
import { getTextbooks } from "@/utils/queries/get-textbooks";

export default function ChatCanvas({ classId, chatId }: { classId: string, chatId: string }) {
    const queryClient = useQueryClient();
    const supabase = useSupabaseBrowser();
    const [welcomeMessages, setWelcomeMessages] = useState({ followUp: chatId === "new" ? false : true });
    const [viewerMode, setViewerMode] = useState<ViewerMode>({
        active: false
    });

    const [activeChat, setActiveChat] = useState<ChatMessage>({
        id: 1,
        title: "Chat",
        prompt: "",
        context: {
            lectures: [],
            textbooks: [],
            chapters: [],
            subchapters: [],
            exercises: [],
            homeworks: [],
            problems: [],
        },
        chatType: 'general'
    });
    const [loading, setLoading] = useState(false);

    // Search and expansion states
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['lectures', 'textbooks', 'homeworks', 'chapters', 'subchapters', 'exercises', 'problems', 'homeworks']));

    const router = useRouter();
    const isMobile = useMediaQuery(`(max-width: ${em(750)})`);
    const { colorScheme } = useMantineColorScheme();

    // Fetch necessary data
    const { data: existingChat } = useQuery({
        queryKey: ["chat", chatId],
        queryFn: () => getChat(supabase, chatId),
        enabled: chatId !== "new"
    });

    const { data: messages } = useQuery({
        queryKey: ["messages", chatId],
        queryFn: () => getMessages(supabase, [chatId]),
        enabled: !!existingChat
    });

    const { data: user } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase)
    });

    const { data: profile } = useQuery({
        queryKey: ["profile", user?.id],
        queryFn: () => getProfile(supabase, user!.id),
        enabled: !!user?.id
    });

    const { data: professor } = useQuery({
        queryKey: ["professor", classId],
        queryFn: () => getProfessor(supabase, classId),
    });

    // Queries for data
    const { data: lectures } = useQuery({
        queryKey: ["lectures", classId],
        queryFn: () => getLectures(supabase, classId)
    });

    const { data: lectureDocuments } = useQuery({
        queryKey: ["lectureDocuments", classId],
        queryFn: () => getLectureDocuments(supabase, lectures!.map(l => l.id)),
        enabled: !!lectures
    });

    const { data: textbooks } = useQuery({
        queryKey: ["textbooks", classId],
        queryFn: () => getTextbooks(supabase, classId),
    });

    const { data: textbookDocuments } = useQuery({
        queryKey: ["textbookDocuments", classId],
        queryFn: () => getTextbookDocuments(supabase, textbooks!.map(t => t.id)),
        enabled: !!textbooks
    });

    const { data: chapters } = useQuery({
        queryKey: ["chapters", classId],
        queryFn: () => getChapters(supabase, textbooks!.map(t => t.id)),
        enabled: !!textbooks
    });

    const { data: subchapters } = useQuery({
        queryKey: ["subchapters", classId],
        queryFn: () => getSubchapters(supabase, chapters!.map(c => c.id)),
        enabled: !!chapters
    });

    const { data: homeworkData } = useQuery({
        queryKey: ["homeworks", classId],
        queryFn: () => getHomeworks(supabase, classId),
    });

    const { data: problems } = useQuery({
        queryKey: ["problems", classId],
        queryFn: () => getProblems(supabase, homeworkData!.map(h => h.id)),
        enabled: !!homeworkData
    });

    const { data: exercises } = useQuery({
        queryKey: ["exercises", classId],
        queryFn: () => getExercises(supabase, chapters?.map(c => c.id) ?? [], homeworkData?.map(h => h.id) ?? []),
        enabled: !!chapters && !!homeworkData
    });

    // Combine all loading states
    const isInitializing = !user || !profile || !professor || !lectures || !textbooks;

    const getDocuments = () => {
        // Previous document references from context
        const lectureDocs = lectureDocuments?.filter(document =>
            activeChat.context.lectures.includes(document.lecture ?? "")
        ) ?? [];
        const textbookDocs = textbookDocuments?.filter(document =>
            activeChat.context.textbooks.includes(document.textbook ?? "")
        ) ?? [];
        const chapterDocs = textbookDocuments?.filter(document => {
            // Find the chapters that are in our context
            const activeChapters = chapters?.filter(c =>
                activeChat.context.chapters.includes(c.id)
            );
            // Check if the document's page falls within any active chapter's page range
            return activeChapters?.some(chapter =>
                document.textbook === chapter.textbook &&
                document.page >= chapter.start_page &&
                document.page <= chapter.end_page
            );
        }) ?? [];
        const subchapterDocs = textbookDocuments?.filter(document => {
            const activeSubchapters = subchapters?.filter(s =>
                activeChat.context.subchapters.includes(s.id)
            );
            // Check if document's page falls within any active subchapter's range
            return activeSubchapters?.some(subchapter => {
                const parentChapter = chapters?.find(c => c.id === subchapter.chapter);
                return parentChapter?.textbook === document.textbook &&
                    document.page >= subchapter.start_page &&
                    document.page <= subchapter.end_page;
            });
        }) ?? [];
        const exerciseDocs = textbookDocuments?.filter(document => {
            const activeExercises = exercises?.filter(e =>
                activeChat.context.exercises.includes(e.id)
            );
            // Check if document's page falls within any active exercise's range
            return activeExercises?.some(exercise => {
                const parentChapter = chapters?.find(c => c.id === exercise.chapter);
                return parentChapter?.textbook === document.textbook &&
                    document.page >= exercise.start_page &&
                    document.page <= exercise.end_page;
            });
        }) ?? [];
        const homeworkDocs = textbookDocuments?.filter(document => {
            const homework = homeworkData?.find(h => h.id === document.homework);
            return homework && activeChat.context.homeworks.includes(homework.id);
        }) ?? [];
        const problemDocs = textbookDocuments?.filter(document => {
            const homework = homeworkData?.find(h => h.id === document.homework);
            const problem = problems?.find(p => p.homework === homework?.id && activeChat.context.problems.includes(p.id));
            return problem && homework && activeChat.context.problems.includes(problem.id);
        }) ?? [];

        // Previous message references
        const previousMessagesDocs = messages?.flatMap(message =>
            // Check if references exists and is an array before accessing
            Array.isArray(message.documents) ? message.documents : []
        ) ?? [];

        // Get the actual documents from the references
        const messageDocuments = ([...textbookDocuments ?? [], ...lectureDocuments ?? []]).filter(document =>
            previousMessagesDocs.includes(document.id)
        ) ?? [];

        // Combine all references, removing duplicates
        return Array.from(new Set([
            ...lectureDocs,
            ...textbookDocs,
            ...chapterDocs,
            ...subchapterDocs,
            ...exerciseDocs,
            ...homeworkDocs,
            ...problemDocs,
            ...messageDocuments
        ]));
    }

    const getAdditionalContextForBareQuestion = () => {
        const contextParts: string[] = [];

        // Add lecture context
        activeChat.context.lectures.forEach(lectureId => {
            const lecture = lectures?.find(l => l.id === lectureId);
            if (lecture) {
                contextParts.push(`Lecture: ${lecture.name}`);
            }
        });

        // Add textbook context
        activeChat.context.textbooks.forEach(textbookId => {
            const textbook = textbooks?.find(t => t.id === textbookId);
            if (textbook) {
                contextParts.push(`Textbook: ${textbook.title}`);
            }
        });

        // Add chapter context
        activeChat.context.chapters.forEach(chapterId => {
            const chapter = chapters?.find(c => c.id === chapterId);
            if (chapter) {
                contextParts.push(`Chapter ${chapter.chapter_number}: ${chapter.title}`);
            }
        });

        // Add exercise context
        activeChat.context.exercises.forEach(exerciseId => {
            const exercise = exercises?.find(e => e.id === exerciseId);
            const chapter = exercise ? chapters?.find(c => c.id === exercise.chapter) : null;
            if (exercise && chapter) {
                const exerciseTitle = exercise.title !== ""
                    ? exercise.title
                    : `Exercise ${chapter.chapter_number}.${exercise.exercise_number}`;
                contextParts.push(`Exercise: ${exerciseTitle}`);
            }
        });

        // Add subchapter context
        activeChat.context.subchapters.forEach(subchapterId => {
            const subchapter = subchapters?.find(s => s.id === subchapterId);
            if (subchapter) {
                contextParts.push(`Subchapter ${subchapter.subchapter_number}: ${subchapter.title}`);
            }
        });

        // Add homework context
        activeChat.context.homeworks.forEach(homeworkId => {
            const homework = homeworkData?.find(h => h.id === homeworkId);
            if (homework) {
                contextParts.push(`Homework: ${homework.title}`);
            }
        });

        // Add problem context
        activeChat.context.problems.forEach(problemId => {
            const problem = problems?.find(p => p.id === problemId);
            const homework = homeworkData?.find(h => h.id === problem?.homework);
            const exercise = exercises?.find(e => e.id === problem?.exercise);
            if (problem && homework) {
                contextParts.push(`Problem: ${homework.title} - Problem ${problem.problem_number}, Exercise ${exercise?.title} .${exercise?.exercise_number} (${exercise?.type})`);
            }
        });

        // If there's any context, add a prefix
        if (contextParts.length > 0) {
            return `\n\nContext:\n${contextParts.join('\n')}`;
        }

        return '';
    };

    // Handlers
    const handlePromptChange = useCallback((prompt: string) => {
        setActiveChat(prev => ({ ...prev, prompt }));
    }, []);

    const handleChat = async () => {
        if (!activeChat.prompt.trim()) return;

        try {
            setLoading(true);
            let profileId = profile?.id;
            let newChatId = chatId;

            if (chatId === "new") {
                // Create new generation with type
                const chat = await createChat(
                    classId,
                    activeChat.title,
                    profileId,
                    activeChat.chatType
                );
                newChatId = chat.id;
                router.replace(`/classes/c/${classId}/chat/${chat.id}`);
            }

            const additionalContextForBareQuestion = getAdditionalContextForBareQuestion();

            // Create the message
            const newMessage = {
                chat: newChatId,
                profile: profileId,
                bare_question: activeChat.prompt + additionalContextForBareQuestion,
                question: activeChat.prompt,
                response_url: `${process.env.NEXT_PUBLIC_API_URL}`,
                documents: getDocuments().map(doc => doc.id),
                exercises: activeChat.context.exercises, // these can stay as they are
                problems: activeChat.context.problems, // these can stay as they are
            };

            const { success, error, data: messagesData } = await createMessages([newMessage]);
            if (!success) {
                throw new Error(error);
            }

            const messageData = messagesData?.[0];
            if (!messageData) {
                throw new Error("No message data returned");
            }

            // Trigger generation, no need to wait for response
            fetch(`${process.env.NEXT_PUBLIC_API_URL}/generate/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: newChatId,
                    message_id: messageData.id
                })
            });

            // Reset states
            setActiveChat({
                ...activeChat,
                prompt: "",
                context: {
                    lectures: [],
                    textbooks: [],
                    chapters: [],
                    exercises: [],
                    subchapters: [],
                    homeworks: [],
                    problems: []
                }
            });

        } catch (error) {
            console.error("Error in message processing:", error);
            notifications.show({
                title: "Error",
                message: "Failed to send message. Please try again.",
                color: "red"
            });
        } finally {
            setLoading(false);
        }
    };

    const toggleNode = (nodeId: string) => {
        setExpandedNodes(prev => {
            const next = new Set(prev);
            if (next.has(nodeId)) {
                next.delete(nodeId);
            } else {
                next.add(nodeId);
            }
            return next;
        });
    };

    const toggleSection = (section: string) => {
        setExpandedSections(prev => {
            const next = new Set(prev);
            if (next.has(section)) {
                next.delete(section);
            } else {
                next.add(section);
            }
            return next;
        });
    };

    // Modify addContextToChat to remove drag-related state updates
    const addContextToChat = (contextType: keyof ChatMessage['context'], contextId: string) => {
        setActiveChat(prev => ({
            ...prev,
            context: {
                ...prev.context,
                [contextType]: [...prev.context[contextType], contextId]
            }
        }));
    };

    // Remove context from chat
    const removeContextFromChat = (contextType: keyof ChatMessage['context'], contextId: string) => {
        setActiveChat(prev => ({
            ...prev,
            context: {
                ...prev.context,
                [contextType]: prev.context[contextType].filter(id => id !== contextId)
            }
        }));
    };

    const scrollToSection = (sectionId: string) => {
        const element = document.getElementById(sectionId);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const handleRemoveContext = useCallback((contextType: keyof ChatMessage['context'], contextId: string) => {
        setActiveChat(prev => ({
            ...prev,
            context: {
                ...prev.context,
                [contextType]: prev.context[contextType].filter(id => id !== contextId)
            }
        }));
    }, []);

    const handleScrollToSection = useCallback((sectionId: string) => {
        const element = document.getElementById(sectionId);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    }, []);

    const handleOptionClick = useCallback((type: ChatType) => {
        setActiveChat(prev => ({ ...prev, chatType: type }));
        setWelcomeMessages({ followUp: true });
    }, []);

    const handleContextClick = useCallback((
        contextType: string,
        contextId: string,
        allDocuments: Document[],
        chapters: Chapter[],
        subchapters: Subchapter[],
        setViewerMode: React.Dispatch<React.SetStateAction<{
            active: boolean;
            documentId?: string;
            lectureId?: string;
            textbookId?: string;
            chapterId?: string;
        }>>
    ) => {
        // For lectures
        if (contextType === 'lectures') {
            const doc = allDocuments.find(d => d.lecture === contextId);
            if (doc) {
                setViewerMode({
                    active: true,
                    documentId: doc.id,
                    lectureId: doc.lecture ?? undefined,
                });
            }
        }
        // For textbooks, chapters, subchapters
        else if (['textbooks', 'chapters', 'subchapters'].includes(contextType)) {
            const doc = allDocuments.find(d => d.textbook === contextId);
            if (doc) {
                setViewerMode({
                    active: true,
                    documentId: doc.id,
                    textbookId: doc.textbook ?? undefined,
                    chapterId: contextId,
                });
            }
        }
    }, []);

    // Set up realtime subscription for messages
    useEffect(() => {
        if (chatId === "new") return;

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
                    console.log("Received message update:", payload);

                    // Immediately update the cache with the new data
                    queryClient.setQueryData(
                        ["messages", chatId],
                        (oldData: any) => {
                            if (!oldData) return [payload.new];

                            // For INSERT, add the new message
                            if (payload.eventType === 'INSERT') {
                                return [...oldData, payload.new];
                            }

                            // For UPDATE, update the existing message
                            if (payload.eventType === 'UPDATE') {
                                return oldData.map((message: any) =>
                                    message.id === payload.new.id ? payload.new : message
                                );
                            }

                            return oldData;
                        }
                    );

                    // Then trigger a refetch to ensure we're in sync
                    await queryClient.invalidateQueries({
                        queryKey: ["messages", chatId],
                        exact: true
                    });
                }
            )
            .subscribe();

        console.log("Subscribed to channel:", `realtime-messages-${chatId}`);

        return () => {
            console.log("Unsubscribing from channel:", `realtime-messages-${chatId}`);
            supabase.removeChannel(channel);
        };
    }, [chatId, queryClient, supabase]);


    // Set up realtime subscription for chat
    useEffect(() => {
        const channel = supabase
            .channel(`realtime-chats-${chatId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'prod',
                    table: 'chats',
                    filter: `id=eq.${chatId}`
                },
                async (payload) => {
                    console.log("Received chat update:", payload);

                    // Immediately update the cache with the new data
                    queryClient.setQueryData(
                        ["chat", chatId],
                        (oldData: any) => {
                            // The existing chat data is a single object, not an array
                            if (!oldData) return payload.new;  // Return single object, not array

                            // For UPDATE, just return the new data
                            if (payload.eventType === 'UPDATE') {
                                return payload.new;
                            }

                            return oldData;
                        }
                    );

                    // Then trigger a refetch to ensure we're in sync
                    await queryClient.invalidateQueries({
                        queryKey: ["chat", chatId],
                        exact: true
                    });
                }
            )
            .subscribe();

        console.log("Subscribed to channel:", `realtime-chats-${chatId}`);

        return () => {
            console.log("Unsubscribing from channel:", `realtime-chats-${chatId}`);
            supabase.removeChannel(channel);
        };
    }, [chatId, queryClient, supabase]);

    return (
        <ClassLayout classId={classId}>
            <Container fluid style={{ marginTop: "30px" }}>
                <Stack>
                    <Flex justify="space-between" align="center">
                        <Group>
                            <Text size="xl" fw={700} mb={6}>
                                {existingChat ? existingChat.name : activeChat.title}
                            </Text>
                            {existingChat?.type && existingChat.type !== 'general' && (
                                <Badge color={
                                    existingChat.type === 'homework' ? 'blue' :
                                        existingChat.type === 'conceptual' ? 'cyan' :
                                            existingChat.type === 'review' ? 'teal' :
                                                existingChat.type === 'summary' ? 'violet' : 'gray'
                                }>
                                    {existingChat.type.charAt(0).toUpperCase() + existingChat.type.slice(1)}
                                </Badge>
                            )}
                        </Group>
                        <Group>
                            {/* TODO: Add an option to rate out of 5 starts */}
                        </Group>
                    </Flex>

                    <Grid>
                        <Grid.Col span={isMobile ? 12 : 8}>
                            <Card
                                shadow="sm"
                                padding="lg"
                                radius="md"
                                withBorder
                                style={{
                                    height: "80vh"
                                }}
                            >
                                <MessageList
                                    chatId={chatId}
                                    classId={classId}
                                    colorScheme={colorScheme}
                                    showWelcome={existingChat && existingChat.type === 'general' ? false : true}
                                    welcomeFollowUp={existingChat && existingChat.type === 'general' ? false : welcomeMessages.followUp}
                                    existingChat={existingChat ?? null}
                                    activeChat={activeChat}
                                    onOptionClick={handleOptionClick}
                                    setViewerMode={setViewerMode}
                                    isInitializing={isInitializing}
                                />

                                <ChatInput
                                    activeChat={activeChat}
                                    loading={loading}
                                    classId={classId}
                                    onPromptChange={handlePromptChange}
                                    onSend={handleChat}
                                    onRemoveContext={handleRemoveContext}
                                    onScrollToSection={handleScrollToSection}
                                    handleContextClick={handleContextClick}
                                    setViewerMode={setViewerMode}
                                />
                            </Card>
                        </Grid.Col>

                        {/* Context Panel or Document Viewer */}
                        <Grid.Col span={isMobile ? 12 : 4}>
                            {viewerMode.active ? (
                                <ViewerPanel
                                    viewerMode={viewerMode}
                                    setViewerMode={setViewerMode}
                                    classId={classId}
                                />
                            ) : (
                                <ContextPanel
                                    classId={classId}
                                    isMobile={isMobile ?? false}
                                    searchQuery={searchQuery}
                                    setSearchQuery={setSearchQuery}
                                    expandedSections={expandedSections}
                                    toggleSection={toggleSection}
                                    addContextToChat={addContextToChat}
                                    expandedNodes={expandedNodes}
                                    toggleNode={toggleNode}
                                    activeChat={activeChat}
                                    scrollToSection={scrollToSection}
                                />
                            )}
                        </Grid.Col>
                    </Grid>
                </Stack>
            </Container>
        </ClassLayout>
    );
} 