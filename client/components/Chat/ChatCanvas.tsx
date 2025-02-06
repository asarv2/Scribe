/**
 * ChatCanvas.tsx
 * This component is for chatting with the AI.
 * @AshokSaravanan222
 * 02.06.2025
 */

import { Text, Card, TextInput, Button, Stack, Group, Grid, AspectRatio, Badge, Switch, Modal, Textarea, ActionIcon } from "@mantine/core";
import { useRouter } from "next/navigation";
import { HeaderSimple } from "@/components/HeaderSimple";
import { Container, Flex } from "@mantine/core";
import { IconArrowLeft, IconPlus, IconCopy, IconTrash, IconX } from "@tabler/icons-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMediaQuery } from "@mantine/hooks";
import { em } from "@mantine/core";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { v4 as uuidv4 } from 'uuid';
import { createGeneration } from "@/utils/services/generation";
import { createQuestions } from "@/utils/services/questions";
import Latex from "../Latex";
import { getLectures } from "@/utils/queries/get-lectures";
import { getTextbooks } from "@/utils/queries/get-textbooks";
import { getChapters } from "@/utils/queries/get-chapters";
import { getExercises } from "@/utils/queries/get-exercises";
import { getDocumentsTextbook } from "@/utils/queries/get-documents-textbook";
import { getLectureDocuments } from "@/utils/queries/get-lecture-docs";
import { ContextPanel } from "./ContextPanel";

export interface ChatMessage {
    id: number;
    title: string
    prompt: string;
    context: {
        lectures: string[];     // lecture IDs
        textbooks: string[];   // textbook IDs
        chapters: string[];    // chapter IDs
        exercises: string[];   // exercise IDs
    };
}

// Add new interface for chat messages
interface ChatMessageDisplay {
    id: string;
    content: string;
    isUser: boolean;
    timestamp: Date;
}

export default function ChatCanvas({ classId }: { classId: string }) {
    const supabase = useSupabaseBrowser();

    const [activeChat, setActiveChat] = useState<ChatMessage>({
        id: 1,
        title: "New Chat",
        prompt: "",
        context: {
            lectures: [],
            textbooks: [],
            chapters: [],
            exercises: [],
        }
    });
    const [loading, setLoading] = useState(false);

    // Search and expansion states
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['lectures', 'textbooks']));

    const queryClient = useQueryClient();
    const router = useRouter();
    const isMobile = useMediaQuery(`(max-width: ${em(750)})`);

    // Add new state for chat messages
    const [messages, setMessages] = useState<ChatMessageDisplay[]>([]);
    const [currentMessage, setCurrentMessage] = useState('');

    const { data: lectures } = useQuery({
        queryKey: ["lectures", classId],
        queryFn: () => getLectures(supabase, classId)
    });

    const { data: lectureDocuments, isLoading: loadingLectureDocuments } = useQuery({
        queryKey: ["lectureDocuments", classId],
        queryFn: () => getLectureDocuments(supabase, lectures?.map(lecture => lecture.id) ?? []),
        enabled: !!lectures
    })

    const { data: textbooks } = useQuery({
        queryKey: ["textbooks", classId],
        queryFn: () => getTextbooks(supabase, classId),
    });

    const { data: textbookDocuments, isLoading: loadingTextbookDocuments } = useQuery({
        queryKey: ["textbookDocuments", classId],
        queryFn: () => getDocumentsTextbook(supabase, textbooks?.map(textbook => textbook.id) ?? []),
        enabled: !!textbooks
    })

    const { data: chapters } = useQuery({
        queryKey: ["chapters", classId],
        queryFn: () => getChapters(supabase, textbooks!.map(t => t.id)),
        enabled: !!textbooks
    });

    const { data: exercises } = useQuery({
        queryKey: ["exercises", classId],
        queryFn: () => getExercises(supabase, chapters!.map(c => c.id)),
        enabled: !!chapters
    });

    useEffect(() => {
        if (textbooks) {
            setExpandedNodes(new Set(textbooks.map(t => t.id)));
        }
    }, [textbooks]);

    // Modify handleChat to process messages
    const handleChat = async () => {
        if (!currentMessage.trim()) return;

        try {
            setLoading(true);
            
            // Add user message to chat
            const userMessage: ChatMessageDisplay = {
                id: uuidv4(),
                content: currentMessage,
                isUser: true,
                timestamp: new Date()
            };
            
            setMessages(prev => [...prev, userMessage]);
            
            // TODO: Call your AI service here with currentMessage and context
            // const response = await yourAIService(currentMessage, activeChat.context);
            
            // Placeholder AI response
            const aiMessage: ChatMessageDisplay = {
                id: uuidv4(),
                content: "This is a placeholder AI response. Implement your AI service integration here.",
                isUser: false,
                timestamp: new Date()
            };
            
            setMessages(prev => [...prev, aiMessage]);
            setCurrentMessage('');
        } catch (error) {
            console.error("Error in chat:", error);
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

    // Add context to chat
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

    const renderContextBadges = (chat: ChatMessage) => {
        return (
            <Group>
                {chat.context.lectures.map(lectureId => {
                    const lecture = lectures?.find(l => l.id === lectureId);
                    return lecture && (
                        <Badge
                            key={lectureId}
                            color="blue"
                            rightSection={
                                <IconX
                                    size={14}
                                    style={{ cursor: 'pointer' }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeContextFromChat('lectures', lectureId);
                                    }}
                                />
                            }
                        >
                            {lecture.name}
                        </Badge>
                    );
                })}
                {chat.context.textbooks.map(textbookId => {
                    const textbook = textbooks?.find(t => t.id === textbookId);
                    return textbook && (
                        <Badge
                            key={textbookId}
                            color="green"
                            rightSection={
                                <IconX
                                    size={14}
                                    style={{ cursor: 'pointer' }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeContextFromChat('textbooks', textbookId);
                                    }}
                                />
                            }
                        >
                            {textbook.title}
                        </Badge>
                    );
                })}
                {chat.context.chapters.map(chapterId => {
                    const chapter = chapters?.find(c => c.id === chapterId);
                    return chapter && (
                        <Badge
                            key={chapterId}
                            color="orange"
                            rightSection={
                                <IconX
                                    size={14}
                                    style={{ cursor: 'pointer' }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeContextFromChat('chapters', chapterId);
                                    }}
                                />
                            }
                        >
                            {`Chapter ${chapter.chapter_number}: ${chapter.title}`}
                        </Badge>
                    );
                })}
                {chat.context.exercises.map(exerciseId => {
                    const exercise = exercises?.find(e => e.id === exerciseId);
                    const chapter = exercise ? chapters?.find(c => c.id === exercise.chapter) : null;
                    return exercise && chapter && (
                        <Badge
                            key={exerciseId}
                            color="cyan"
                            rightSection={
                                <IconX
                                    size={14}
                                    style={{ cursor: 'pointer' }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeContextFromChat('exercises', exerciseId);
                                    }}
                                />
                            }
                        >
                            {`Exercise ${chapter.chapter_number}.${exercise.exercise_number}`}
                        </Badge>
                    );
                })}
            </Group>
        );
    };

    return (
        <>
            <HeaderSimple />
            <Container fluid style={{ marginTop: "30px" }}>
                <Grid>
                    {/* Chat Section */}
                    <Grid.Col span={isMobile ? 12 : 8}>
                        <Card shadow="sm" padding="lg" radius="md" withBorder style={{ height: "80vh", display: "flex", flexDirection: "column" }}>
                            {/* Messages Area */}
                            <Stack style={{ flex: 1, overflowY: "auto", marginBottom: "1rem" }}>
                                {messages.map((message) => (
                                    <Card
                                        key={message.id}
                                        padding="sm"
                                        radius="md"
                                        style={{
                                            alignSelf: message.isUser ? "flex-end" : "flex-start",
                                            maxWidth: "70%",
                                            backgroundColor: message.isUser ? "#228be6" : "#f1f3f5"
                                        }}
                                    >
                                        <Text c={message.isUser ? "white" : "black"}>
                                            {message.content}
                                        </Text>
                                    </Card>
                                ))}
                            </Stack>

                            {/* Context Badges */}
                            <Card p="xs" withBorder mb="sm">
                                {renderContextBadges(activeChat)}
                            </Card>

                            {/* Input Area */}
                            <Group align="flex-end">
                                <TextInput
                                    placeholder="Type your message..."
                                    value={currentMessage}
                                    onChange={(e) => setCurrentMessage(e.currentTarget.value)}
                                    style={{ flex: 1 }}
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleChat();
                                        }
                                    }}
                                />
                                <Button onClick={handleChat} loading={loading}>
                                    Send
                                </Button>
                            </Group>
                        </Card>
                    </Grid.Col>

                    {/* Context Panel */}
                    <Grid.Col span={isMobile ? 12 : 4}>
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
                        />
                    </Grid.Col>
                </Grid>
            </Container>
        </>
    );
}