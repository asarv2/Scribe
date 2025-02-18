/**
 * ChatCanvas.tsx
 * This component is for chatting with the AI.
 * @AshokSaravanan222
 * 02.06.2025
 */

import { Text, Card, TextInput, Button, Stack, Group, Grid, AspectRatio, Badge, Switch, Modal, Textarea, ActionIcon, Loader, Avatar, useMantineColorScheme } from "@mantine/core";
import { useRouter } from "next/navigation";
import { Container, Flex } from "@mantine/core";
import { IconArrowLeft, IconPlus, IconCopy, IconTrash, IconX, IconAlertCircle } from "@tabler/icons-react";
import Link from "next/link";
import { useEffect, useState, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMediaQuery } from "@mantine/hooks";
import { em } from "@mantine/core";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { v4 as uuidv4 } from 'uuid';
import { getLectures } from "@/utils/queries/get-lectures";
import { getTextbooks } from "@/utils/queries/get-textbooks";
import { getChapters } from "@/utils/queries/get-chapters";
import { getDocumentsTextbook } from "@/utils/queries/get-documents-textbook";
import { getLectureDocuments } from "@/utils/queries/get-lecture-docs";
import { ContextPanel } from "./ContextPanel";
import { notifications } from "@mantine/notifications";
import { createMessages } from "@/utils/services/messages";
import { getUser } from "@/utils/queries/get-user";
import { Document, Message, Profile } from "@/types";
import { getProfile } from "@/utils/queries/get-profile";
import Latex from "../Latex";
import { getSubchapters } from "@/utils/queries/get-subchapters";
import { getProfessor } from "@/utils/queries/get-professor";
import { getHomeworks } from "@/utils/queries/get-homeworks";
import { getProblems } from "@/utils/queries/get-problems";
import { getChat } from "@/utils/queries/get-chat";
import { getMessages } from "@/utils/queries/get-messages";
import DeleteChatModal from "../Delete/DeleteChatModal";
import { createChat } from "@/utils/services/chat";
import { ClassLayout } from "../Class/ClassLayout";
import { getChapterExercises } from "@/utils/queries/get-chapter-exercises";
import { getExercises } from "@/utils/queries/get-exercises";

export interface ChatMessage {
    id: number;
    title: string
    prompt: string;
    context: {
        lectures: string[];     // lecture IDs
        textbooks: string[];   // textbook IDs
        chapters: string[];    // chapter IDs
        subchapters: string[]; // subchapter IDs
        exercises: string[];   // exercise IDs
        homework: string[];   // homework IDs
        problems: string[];   // problem IDs
    };
}

export default function ChatCanvas({ classId, chatId }: { classId: string, chatId: string }) {
    const supabase = useSupabaseBrowser();

    const [activeChat, setActiveChat] = useState<ChatMessage>({
        id: 1,
        title: "New Chat",
        prompt: "",
        context: {
            lectures: [],
            textbooks: [],
            chapters: [],
            subchapters: [],
            exercises: [],
            homework: [],
            problems: [],
        }
    });
    const [loading, setLoading] = useState(false);

    // Search and expansion states
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['lectures', 'textbooks', 'homework']));

    const queryClient = useQueryClient();
    const router = useRouter();
    const isMobile = useMediaQuery(`(max-width: ${em(750)})`);

    const { colorScheme } = useMantineColorScheme();

    const { data: existingChat } = useQuery({
        queryKey: ["chat", chatId],
        queryFn: () => getChat(supabase, chatId),
        enabled: chatId !== "new"
    });

    // Single source of truth for messages
    const { data: messages } = useQuery({
        queryKey: ["messages", chatId],
        queryFn: () => getMessages(supabase, [chatId]),
        enabled: !!existingChat
    });

    const { data: lectures } = useQuery({
        queryKey: ["lectures", classId],
        queryFn: () => getLectures(supabase, classId)
    });

    const { data: textbooks } = useQuery({
        queryKey: ["textbooks", classId],
        queryFn: () => getTextbooks(supabase, classId),
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

    const { data: professor } = useQuery({
        queryKey: ["professor", classId],
        queryFn: () => getProfessor(supabase, classId),
    })

    const { data: problemExercises } = useQuery({
        queryKey: ["problemExercises", classId],
        queryFn: () => getExercises(supabase, problems?.map(p => p.exercise).filter(e => e !== null) ?? []),
        enabled: !!problems
    });

    const { data: chapterExercises } = useQuery({
        queryKey: ["chapterExercises", classId],
        queryFn: () => getChapterExercises(supabase, chapters?.map(c => c.id) ?? []),
        enabled: !!chapters
    });

    const { data: exercises } = useQuery({
        queryKey: ["exercises", classId],
        queryFn: () => [...(problemExercises ?? []), ...(chapterExercises ?? [])],
        enabled: !!problemExercises && !!chapterExercises
    });


    const { data: user, isLoading: loadingUser } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase),
    })

    const { data: profile, isLoading: loadingProfile } = useQuery({
        queryKey: ["profile", user?.id],
        queryFn: () => getProfile(supabase, user!.id),
        enabled: !!user
    })

    const { data: textbookDocuments, isLoading: loadingTextbookDocuments } = useQuery({
        queryKey: ["textbookDocuments", classId],
        queryFn: () => getDocumentsTextbook(supabase, textbooks?.map(textbook => textbook.id) ?? []),
        enabled: !!textbooks
    })

    const { data: lectureDocuments, isLoading: loadingLectureDocuments } = useQuery({
        queryKey: ["lectureDocuments", classId],
        queryFn: () => getLectureDocuments(supabase, lectures?.map(lecture => lecture.id) ?? []),
        enabled: !!lectures
    })

    // Ref for message container
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Scroll to bottom whenever messages change
    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

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

    useEffect(() => {
        if (textbooks) {
            setExpandedNodes(new Set(textbooks.map(t => t.id)));
        }
    }, [textbooks]);

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
            return homework && activeChat.context.homework.includes(homework.id);
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

    const getAvatarUrl = (profile: Profile) => {
        return `${process.env.NEXT_PUBLIC_STORAGE_URL}/profiles/${profile.id}.png`
    }

    const getProfessorAvatarUrl = () => {
        return `${process.env.NEXT_PUBLIC_STORAGE_URL}/profiles/${professor?.id}.png`
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
        activeChat.context.homework.forEach(homeworkId => {
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

    const handleChat = async () => {
        if (!activeChat.prompt.trim()) return;

        try {
            setLoading(true);
            let profileId = profile?.admin ? null : profile?.id;
            let newChatId = chatId;

            if (chatId === "new") {
                // Create new generation
                const chat = await createChat(
                    classId,
                    activeChat.title,
                    profileId
                );
                newChatId = chat.id;
                router.replace(`/classes/c/${classId}/chat/${chat.id}`);
            }

            const additionalContextForBareQuestion = getAdditionalContextForBareQuestion();

            // Create the message
            const newMessage = {
                chat: newChatId,
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
                    homework: [],
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
                            {exercise.title !== "" ? exercise.title : `Exercise ${chapter.chapter_number}.${exercise.exercise_number}`}
                        </Badge>
                    );
                })}
                {chat.context.subchapters.map(subchapterId => {
                    const subchapter = subchapters?.find(s => s.id === subchapterId);
                    return subchapter && (
                        <Badge
                            key={subchapterId}
                            color="purple"
                            rightSection={
                                <IconX
                                    size={14}
                                    style={{ cursor: 'pointer' }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeContextFromChat('subchapters', subchapterId);
                                    }}
                                />
                            }
                        >
                            {`Subchapter ${subchapter.subchapter_number}: ${subchapter.title}`}
                        </Badge>
                    );
                })}
                {chat.context.homework.map(homeworkId => {
                    const homework = homeworkData?.find(h => h.id === homeworkId);
                    return homework && (
                        <Badge
                            key={homeworkId}
                            color="orange"
                            rightSection={
                                <IconX
                                    size={14}
                                    style={{ cursor: 'pointer' }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeContextFromChat('homework', homeworkId);
                                    }}
                                />
                            }
                        >
                            {`${homework.title}`}
                        </Badge>
                    );
                })}
                {chat.context.problems.map(problemId => {
                    const problem = problems?.find(p => p.id === problemId);
                    const homework = homeworkData?.find(h => h.id === problem?.homework);
                    return problem && homework && (
                        <Badge
                            key={problemId}
                            color="cyan"
                            rightSection={
                                <IconX
                                    size={14}
                                    style={{ cursor: 'pointer' }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeContextFromChat('problems', problemId);
                                    }}
                                />
                            }
                        >
                            {`${homework.title}: Problem ${problem.problem_number}`}
                        </Badge>
                    );
                })}

            </Group>
        );
    };

    const renderDocuments = (lectureDocuments: Document[], textbookDocuments: Document[], chatDocuments: string[]) => {
        // Add safety check
        if (!Array.isArray(lectureDocuments) || !Array.isArray(textbookDocuments)) {
            return null;
        }

        const documents = [...lectureDocuments, ...textbookDocuments];
        // Filter to only matching documents
        const matchingDocs = documents.filter(doc => chatDocuments.includes(doc.id));

        // Group documents by source (lecture/textbook) and sort by page
        const groupedDocs = matchingDocs.reduce((acc, doc) => {
            const key = doc.lecture ?
                `lecture-${doc.lecture}` :
                `textbook-${doc.textbook}`;

            if (!acc[key]) acc[key] = [];
            acc[key].push(doc);
            return acc;
        }, {} as Record<string, typeof documents>);

        // Process each group to combine consecutive pages
        const processedDocs = Object.entries(groupedDocs).flatMap(([key, docs]) => {
            docs.sort((a, b) => a.page - b.page);

            const ranges: { start: number; end: number; doc: any; }[] = [];
            let current = { start: docs[0].page, end: docs[0].page, doc: docs[0] };

            for (let i = 1; i < docs.length; i++) {
                if (docs[i].page === current.end + 1) {
                    current.end = docs[i].page;
                } else {
                    ranges.push({ ...current });
                    current = { start: docs[i].page, end: docs[i].page, doc: docs[i] };
                }
            }
            ranges.push(current);

            return ranges.map(range => ({
                ...range.doc,
                pageRange: range.start === range.end ?
                    `p.${range.start}` :
                    `pp.${range.start}-${range.end}`
            }));
        });

        // Take only the 3 most important documents (prioritizing shorter page ranges)
        const topDocs = processedDocs
            .sort((a, b) => {
                const aPages = a.pageRange.includes('-') ?
                    Number(a.pageRange.split('-')[1]) - Number(a.pageRange.split('-')[0]) :
                    0;
                const bPages = b.pageRange.includes('-') ?
                    Number(b.pageRange.split('-')[1]) - Number(b.pageRange.split('-')[0]) :
                    0;
                return aPages - bPages;
            })
            .slice(0, 3);

        return (
            <Group>
                {topDocs.map(doc => (
                    <Link href={doc.lecture ? `/classes/c/${classId}/lecture/${doc.lecture}?page=${doc.page}` : `/classes/c/${classId}/textbook/${doc.textbook}/chapter/${doc.chapter}?page=${doc.page}`} key={doc.id}>
                        <Badge key={doc.id}>
                            {doc.lecture ?
                                `${lectures?.find(l => l.id === doc.lecture)?.name} ${doc.pageRange}` :
                                `${textbooks?.find(t => t.id === doc.textbook)?.title} ${doc.pageRange}`
                            }
                        </Badge>
                    </Link>
                ))}
            </Group>
        );
    };

    return (
        <ClassLayout classId={classId}>
            <Container fluid style={{ marginTop: "30px" }}>
                <Stack>
                    <Flex justify="space-between" align="center">
                        <Group>
                            {/* <Link href={`/classes/${classId}/chat`}>
                                <IconArrowLeft size={24} color={colorScheme === "dark" ? "white" : "black"} style={{ cursor: "pointer" }} />
                            </Link> */}
                            <Text size="xl" fw={700} mb={6}>{existingChat ? existingChat.name : activeChat.title}</Text>
                        </Group>
                        <Group>
                            {existingChat && <DeleteChatModal chatId={chatId} chatTitle={existingChat?.name ?? ""} profile={profile ?? undefined} classId={classId} />}
                        </Group>
                    </Flex>
                    <Grid>
                        {/* Chat Section */}
                        <Grid.Col span={isMobile ? 12 : 8}>
                            <Card shadow="sm" padding="lg" radius="md" withBorder style={{ height: "80vh", display: "flex", flexDirection: "column" }}>
                                {/* Messages Area */}
                                <Stack
                                    style={{
                                        flex: 1,
                                        overflowY: "auto",
                                        marginBottom: "1rem",
                                        maxHeight: "calc(80vh - 150px)"
                                    }}
                                >
                                    {messages?.map((message, index) => (
                                        <Stack key={`${message.id}`}>
                                            {/* User message */}
                                            <Group align="flex-start" justify="flex-end">
                                                <Card
                                                    padding="sm"
                                                    radius="md"
                                                    style={{
                                                        maxWidth: "70%",
                                                        backgroundColor: "#228be6"
                                                    }}
                                                >
                                                    <Text c="white"><Latex>{message.question}</Latex></Text>
                                                </Card>
                                                <Avatar
                                                    src={profile ? getAvatarUrl(profile) : undefined}
                                                    radius="xl"
                                                    size="md"
                                                    alt={`${profile?.first_name} ${profile?.last_name}`}
                                                >
                                                    {profile ? `${profile.first_name[0]}${profile.last_name[0]}` : 'U'}
                                                </Avatar>
                                            </Group>

                                            {/* AI response */}
                                            <Group align="flex-start">
                                                <Avatar
                                                    src={professor ? getProfessorAvatarUrl() : undefined}
                                                    size="md"
                                                    radius="xl"
                                                    alt="AI Assistant"
                                                />
                                                <Card
                                                    padding="sm"
                                                    radius="md"
                                                    style={{
                                                        alignSelf: "flex-start",
                                                        maxWidth: "70%",
                                                        backgroundColor: colorScheme === "dark" ? "#25262b" : "#f1f3f5",
                                                        minWidth: "200px",
                                                        border: colorScheme === "dark" ? "1px solid #373A40" : "1px solid #e9ecef"
                                                    }}
                                                >
                                                    <Text>
                                                        {message.generation_status === "idle" ?
                                                            <Group>
                                                                <Loader size="sm" />
                                                                <Text>Generating response...</Text>
                                                            </Group>
                                                            : message.generation_status === "error" ?
                                                                <Group>
                                                                    <IconAlertCircle size={16} />
                                                                    <Text>{message.generation_error === null || message.generation_error === undefined || message.generation_error === "" ? "An error occurred while generating the response. Please try again." : message.generation_error}</Text>
                                                                </Group>
                                                                : (
                                                                    <Latex>
                                                                        {message.response}
                                                                    </Latex>
                                                                )}
                                                        {message.references && lectureDocuments && textbookDocuments &&
                                                            renderDocuments(
                                                                lectureDocuments ?? [],
                                                                textbookDocuments ?? [],
                                                                message.references
                                                            )
                                                        }
                                                    </Text>
                                                </Card>
                                            </Group>
                                        </Stack>
                                    )
                                    )}
                                    <div ref={messagesEndRef} />
                                </Stack>

                                {/* Context Badges */}
                                <Card p="xs" withBorder mb="sm">
                                    <Group>
                                        <Text fw={600}>Context: </Text>
                                        {renderContextBadges(activeChat)}
                                    </Group>
                                </Card>

                                {/* Input Area */}
                                <Group align="flex-end">
                                    <TextInput
                                        placeholder="Type your message..."
                                        value={activeChat.prompt}
                                        onChange={(e) => setActiveChat({ ...activeChat, prompt: e.currentTarget.value })}
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
                </Stack>
            </Container>
        </ClassLayout>
    );
}