/**
 * MessageList.tsx
 * Used to show all the messages in the chat.
 */

import { Stack, Flex, Group, Avatar, Text, Card, Box, Badge, Button, ActionIcon, Skeleton, Loader, Switch } from "@mantine/core";
import { IconArrowDown, IconChevronRight, IconExternalLink, IconFileText, IconRefresh, IconX, IconBulb } from "@tabler/icons-react";
import { memo, useRef, useEffect, useState } from "react";
import { Message, Profile, Document, Chapter, ChatType, Chat, Lecture, Textbook, ChatMessage, ViewerMode, Exercise } from "@/types";
import Latex from "../../Latex";
import Image from "next/image";
import { getAvatarUrl, getFigureUrl } from "@/utils/services/images";
import {
    filterCodeBlocks,
    splitTextByDocuments,
    groupConsecutiveDocuments,
    splitTextByTags,
} from "@/utils/chat/chat-helpers";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getUser } from "@/utils/queries/get-user";
import { getProfile } from "@/utils/queries/get-profile";
import { getProfessor } from "@/utils/queries/get-professor";
import { getLectures } from "@/utils/queries/get-lectures";
import { getLectureDocuments } from "@/utils/queries/get-lecture-docs";
import { getTextbooks } from "@/utils/queries/get-textbooks";
import { getTextbookDocuments } from "@/utils/queries/get-textbook-docs";
import { getChapters } from "@/utils/queries/get-chapters";
import { getHomeworks } from "@/utils/queries/get-homeworks";
import { getMessages } from "@/utils/queries/get-messages";
import { getExercises } from "@/utils/queries/get-exercises";
import { getChapterDocuments } from "@/utils/queries/get-chapter-docs";
import { Checkbox } from "@mantine/core";
import { useDrop, DropTargetMonitor } from 'react-dnd';
import { useHotkeys } from '@mantine/hooks';
import { TypeAnimation } from 'react-type-animation'; // Make sure this is imported
import { getSummaries } from "@/utils/queries/get-summaries";
import { getQuestions } from "@/utils/queries/get-questions";
import SummaryViewer from "@/components/Viewer/SummaryViewer";
import QuestionViewer from "@/components/Viewer/QuestionViewer";

interface ImmersiveMessageListProps {
    chatId: string;
    classId: string;
    colorScheme: string;
    existingChat: Chat | null;
    activeChat: ChatMessage;
    setActiveChat: React.Dispatch<React.SetStateAction<ChatMessage>>;
    onOptionClick: (type: ChatType, isTeacherMode?: boolean, teacherOption?: string) => void;
    setViewerMode: React.Dispatch<React.SetStateAction<ViewerMode>>;
    isInitializing?: boolean;
    loading?: boolean;
    fullscreen?: boolean;
}

export const ImmersiveMessageList = memo(({
    chatId,
    classId,
    colorScheme,
    activeChat,
    setActiveChat,
    setViewerMode,
    existingChat,
    isInitializing = false,
    loading,
    fullscreen = false,
}: ImmersiveMessageListProps) => {
    const supabase = useSupabaseBrowser();
    const queryClient = useQueryClient();

    const { data: messages, isLoading: isLoadingMessages } = useQuery({
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
        queryFn: () => getLectures(supabase, [classId])
    });

    const { data: lectureDocuments } = useQuery({
        queryKey: ["lectureDocuments", classId],
        queryFn: () => getLectureDocuments(supabase, lectures!.map(l => l.id)),
        enabled: !!lectures
    });

    const { data: textbooks } = useQuery({
        queryKey: ["textbooks", classId],
        queryFn: () => getTextbooks(supabase, [classId]),
    });

    const { data: chapters } = useQuery({
        queryKey: ["chapters", classId],
        queryFn: () => getChapters(supabase, textbooks!.map(t => t.id)),
        enabled: !!textbooks
    });

    const { data: chapterDocuments } = useQuery({
        queryKey: ["chapterDocuments", classId],
        queryFn: () => getChapterDocuments(supabase, chapters!.map(c => c.id)),
        enabled: !!chapters
    });

    const { data: textbookDocuments } = useQuery({
        queryKey: ["textbookDocuments", classId],
        queryFn: () => getTextbookDocuments(supabase, textbooks!.map(t => t.id)),
        enabled: !!textbooks
    });

    const { data: homeworks } = useQuery({
        queryKey: ["homeworks", classId],
        queryFn: () => getHomeworks(supabase, [classId]),
    });

    const { data: chapterExercises } = useQuery({
        queryKey: ["chapterExercises", classId],
        queryFn: () => getExercises(supabase, chapters!.map(c => c.id), []),
        enabled: !!chapters
    });

    const { data: homeworkExercises } = useQuery({
        queryKey: ["homeworkExercises", classId],
        queryFn: () => getExercises(supabase, [], homeworks!.map(h => h.id)),
        enabled: !!homeworks
    });

    const { data: summaries } = useQuery({
        queryKey: ["summaries", chatId],
        queryFn: () => getSummaries(supabase, messages!.map(m => m.id)),
        enabled: !!messages
    });

    const { data: questions } = useQuery({
        queryKey: ["questions", chatId],
        queryFn: () => getQuestions(supabase, messages!.map(m => m.id)),
        enabled: !!messages
    });

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [showScrollButton, setShowScrollButton] = useState(false);

    // Add state to track if context was automatically added
    const [autoAddedContext, setAutoAddedContext] = useState<{
        lectures: string[],
        chapters: string[],
        homeworks: string[]
    }>({
        lectures: [],
        chapters: [],
        homeworks: []
    });

    // Function to calculate simple text similarity based on shared words
    const calculateTextSimilarity = (text1: string, text2: string): number => {
        const words1 = text1.toLowerCase().split(/\W+/).filter(word => word.length > 2);
        const words2 = text2.toLowerCase().split(/\W+/).filter(word => word.length > 2);

        // Count matching unique words
        const uniqueWords1 = new Set(words1);
        const uniqueWords2 = new Set(words2);

        let matchCount = 0;
        uniqueWords1.forEach(word => {
            if (uniqueWords2.has(word)) matchCount++;
        });

        // Calculate similarity score
        const totalUniqueWords = Array.from(uniqueWords1).concat(Array.from(uniqueWords2)).length;
        return totalUniqueWords > 0 ? matchCount / totalUniqueWords : 0;
    };

    // Function to find relevant context based on user's question
    const findRelevantContext = (question: string) => {
        if (!question || question.length < 5) return null;

        const relevantContext = {
            lectures: [] as string[],
            chapters: [] as string[],
            homeworks: [] as string[]
        };

        // Match with lectures
        if (lectures) {
            const lectureMatches = lectures
                .map(lecture => ({
                    id: lecture.id,
                    similarity: calculateTextSimilarity(question, lecture.name || ''),
                    name: lecture.name || ''
                }))
                .filter(match => match.similarity > 0.15) // Set minimum similarity threshold
                .sort((a, b) => b.similarity - a.similarity)
                .slice(0, 2); // Get top 2 matches

            relevantContext.lectures = lectureMatches.map(match => match.id);
            console.log('Lecture matches:', lectureMatches.map(m => `${m.name} (${(m.similarity * 100).toFixed(1)}%)`));
        }

        // Match with chapters
        if (chapters) {
            const chapterMatches = chapters
                .map(chapter => ({
                    id: chapter.id,
                    similarity: calculateTextSimilarity(question, chapter.title || ''),
                    title: chapter.title || ''
                }))
                .filter(match => match.similarity > 0.15)
                .sort((a, b) => b.similarity - a.similarity)
                .slice(0, 2);

            relevantContext.chapters = chapterMatches.map(match => match.id);
            console.log('Chapter matches:', chapterMatches.map(m => `${m.title} (${(m.similarity * 100).toFixed(1)}%)`));
        }

        // Match with homeworks
        if (homeworks) {
            const homeworkMatches = homeworks
                .map(homework => ({
                    id: homework.id,
                    similarity: calculateTextSimilarity(question, homework.title || ''),
                    title: homework.title || ''
                }))
                .filter(match => match.similarity > 0.15)
                .sort((a, b) => b.similarity - a.similarity)
                .slice(0, 2);

            relevantContext.homeworks = homeworkMatches.map(match => match.id);
            console.log('Homework matches:', homeworkMatches.map(m => `${m.title} (${(m.similarity * 100).toFixed(1)}%)`));
        }

        // Only return context if we found any matches
        const hasMatches =
            relevantContext.lectures.length > 0 ||
            relevantContext.chapters.length > 0 ||
            relevantContext.homeworks.length > 0;

        return hasMatches ? relevantContext : null;
    };

    // Auto-add context when a new message is displayed without context
    useEffect(() => {
        if (!messages || messages.length === 0 || !activeChat) return;

        // Only check the first message
        const firstMessage = messages[0];

        // Skip if message already has context or if we've already added context
        if ((firstMessage.lectures?.length || firstMessage.chapters?.length || firstMessage.homeworks?.length) ||
            (autoAddedContext.lectures.length || autoAddedContext.chapters.length || autoAddedContext.homeworks.length)) {
            return;
        }

        // Find relevant context
        const relevantContext = findRelevantContext(firstMessage.question);
        if (relevantContext) {
            console.log('Auto-adding context based on question similarity:', relevantContext);
            setAutoAddedContext(relevantContext);

            // Update active chat context - this will be used for future messages
            setActiveChat(prev => ({
                ...prev,
                context: {
                    ...prev.context,
                    lectures: [...(prev.context.lectures || []), ...relevantContext.lectures],
                    chapters: [...(prev.context.chapters || []), ...relevantContext.chapters],
                    homeworks: [...(prev.context.homeworks || []), ...relevantContext.homeworks]
                }
            }));
        }
    }, [messages]);


    // Check scroll position to show/hide scroll button
    const handleScroll = () => {
        if (!containerRef.current) return;

        const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
        // Show button if we're more than 400px from bottom
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 400;
        setShowScrollButton(!isNearBottom);
    };

    // Scroll to bottom handler
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // Add scroll listener
    useEffect(() => {
        const container = containerRef.current;
        if (container) {
            container.addEventListener('scroll', handleScroll);
            return () => container.removeEventListener('scroll', handleScroll);
        }
    }, []);

    // Scroll to bottom on new messages only if already at bottom
    useEffect(() => {
        if (!containerRef.current) return;

        const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 400;

        if (isNearBottom) {
            scrollToBottom();
        }
    }, [messages]);

    // realtime subscriptions for summaries and questions
    // Add realtime subscriptions for course-specific data when viewing a course
    useEffect(() => {
        if (!user || !messages) return;
        // Create channels for lectures, textbooks, and homeworks
        const summariesChannel = supabase
            .channel('realtime-summaries')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'prod',
                    table: 'summaries',
                    filter: `message=in.(${messages.map(m => m.id).join(',')})`
                },
                () => {
                    queryClient.invalidateQueries({
                        queryKey: ["summaries"]
                    });
                }
            )
            .subscribe();

        const questionsChannel = supabase
            .channel('realtime-questions')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'prod',
                    table: 'questions',
                    filter: `message=in.(${messages.map(m => m.id).join(',')})`
                },
                () => {
                    queryClient.invalidateQueries({
                        queryKey: ["questions"]
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(summariesChannel);
            supabase.removeChannel(questionsChannel);
        };
    }, [user, queryClient, messages]);

    // Get document label for display
    const getDocumentLabel = (
        type: 'lecture' | 'chapter' | 'homework-problem' | 'chapter-exercise',
        doc?: Document,
        exercise?: Exercise,
        range?: string
    ): string => {
        if (type === 'lecture' && doc) {
            const lecture = lectures?.find(l => l.id === doc.lecture);
            return `${lecture?.name ?? 'Lecture'} ${range ? `p.${range}` : `p.${doc.page}`}`;
        } else if (type === 'chapter' && doc) {
            const textbook = textbooks?.find(t => t.id === doc.textbook);
            return `${textbook?.title ?? 'Textbook'} ${range ? `p.${range}` : `p.${doc.page}`}`;
        } else if (type === 'chapter-exercise' && exercise) {
            const chapter = chapters?.find(c => c.id === exercise.chapter);
            return `Ch.${chapter?.chapter_number ?? '?'} Ex.${exercise.exercise_number} ${range ? `p.${range}` : ''}`;
        } else if (type === 'homework-problem' && exercise) {
            const homework = homeworks?.find(h => h.id === exercise.homework);
            return `HW ${homework?.homework_number ?? '?'} Problem ${exercise.problem_number} ${range ? `p.${range}` : ''}`;
        }
        return 'Document Reference';
    };

    // Combine loading states
    const isLoading = isInitializing || isLoadingMessages || loading

    // Define document item type
    interface DocumentItem {
        id: string;
        type: string;
        // Add other properties as needed
        [key: string]: any;
    }

    // Define proper drop handler that matches the context click behavior
    const handleContextDrop = (item: { id: string, type: string }) => {
        if (item && item.id && item.type) {
            // Update the active chat context, similar to addContextToChat in ChatCanvas
            setActiveChat(prev => ({
                ...prev,
                context: {
                    ...prev.context,
                    [item.type]: [...prev.context[item.type as keyof typeof prev.context] || [], item.id]
                }
            }));

            console.log(`Added context: ${item.type} - ${item.id}`);
            return { dropped: true };
        }
        return { dropped: false };
    };

    // Set up drop functionality with the correct item type
    const [{ isOver, canDrop }, drop] = useDrop(() => ({
        // Accept the CONTEXT_ITEM type - this must match what's used in ContextPanel
        accept: 'CONTEXT_ITEM',

        // Handle the drop event
        drop: handleContextDrop,

        // Collect properties to determine the current state
        collect: (monitor) => ({
            isOver: !!monitor.isOver(),
            canDrop: !!monitor.canDrop(),
        }),
    }), [setActiveChat]); // Add dependency on setActiveChat

    const isActive = isOver && canDrop;

    // Enhanced document click handler
    const handleEnhancedDocumentClick = (
        contextType: 'lectures' | 'chapters' | 'homeworks',
        contextId: string,
        documentId?: string,
        textbookId?: string,
        exerciseId?: string
    ) => {
        console.log(`Opening ${contextType} with ID: ${contextId}`);

        // For lectures
        if (contextType === 'lectures' && documentId) {
            // Use the setViewerMode function prop instead of directly setting state
            setViewerMode(prev => ({
                active: true,
                open: true,
                immersive: false,
                documentId,
                lectureId: contextId,
                exerciseId: undefined,
                textbookId: undefined,
                chapterId: undefined,
                homeworkId: undefined,
            }));
        }
        else if (contextType === 'chapters' && exerciseId) {
            setViewerMode(prev => ({
                ...prev,
                active: true,
                open: true,
                immersive: false,
                chapterId: contextId,
                exerciseId,
                lectureId: undefined,
                textbookId: undefined,
                homeworkId: undefined,
                documentId: undefined,
            }));
        }
        // For chapters
        else if (contextType === 'chapters' && textbookId) {
            setViewerMode(prev => ({
                ...prev,
                active: true,
                open: true,
                immersive: false,
                documentId: documentId || undefined,
                textbookId,
                chapterId: contextId,
                exerciseId: undefined,
                lectureId: undefined,
                homeworkId: undefined,
            }));
        }
        // For chapter exercises

        // For homework exercises
        else if (contextType === 'homeworks' && exerciseId) {
            setViewerMode(prev => ({
                ...prev,
                active: true,
                open: true,
                immersive: false,
                homeworkId: contextId,
                exerciseId,
                textbookId: undefined,
                chapterId: undefined,
                lectureId: undefined,
                documentId: undefined,
            }));
        }
    };

    // Get the appropriate textbook ID for a chapter
    const getTextbookForChapter = (chapterId: string) => {
        const chapter = chapters?.find(c => c.id === chapterId);
        return chapter?.textbook || null;
    };

    // Add CSS animation for pulse effect
    useEffect(() => {
        // Create style element for animations
        const styleEl = document.createElement('style');
        styleEl.textContent = `
      @keyframes pulse {
        0% { opacity: 0.6; }
        50% { opacity: 1; }
        100% { opacity: 0.6; }
      }
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .latex-wrapper .mantine-Text-root {
        white-space: pre-wrap;
      }
    `;
        document.head.appendChild(styleEl);

        return () => {
            document.head.removeChild(styleEl);
        };
    }, []);

    // Add this helper function to generate page ranges
    const getPageRanges = (documents: Document[], exercises: Exercise[]): { startDocument: Document | null, startExercise: Exercise | null, range: string }[] => {
        if (!documents.length && !exercises.length) return [];

        const pageRanges: { startDocument: Document | null, startExercise: Exercise | null, range: string }[] = [];


        if (documents.length > 0) {
            // Remove duplicates and sort
            const uniquePages = Array.from(new Set(documents.map(doc => doc.page))).sort((a, b) => a - b);
            let start = uniquePages[0];
            let prev = uniquePages[0];

            for (let i = 1; i <= uniquePages.length; i++) {
                if (i === uniquePages.length || uniquePages[i] !== prev + 1) {
                    const document = documents.find(doc => doc.page === start);
                    if (document) {
                        pageRanges.push({ startDocument: document, startExercise: null, range: start === prev ? `${start}` : `${start}-${prev}` });
                    }
                    if (i < uniquePages.length) {
                        start = uniquePages[i];
                        prev = uniquePages[i];
                    }
                } else {
                    prev = uniquePages[i];
                }
            }
        } else {
            // Remove duplicates and sort
            const uniqueChapterPages = Array.from(new Set(exercises.map(e => e.exercise_number))).sort((a, b) => a - b);
            let chapterStart = uniqueChapterPages[0];
            let chapterPrev = uniqueChapterPages[0];

            for (let i = 1; i <= uniqueChapterPages.length; i++) {
                if (i === uniqueChapterPages.length || uniqueChapterPages[i] !== chapterPrev + 1) {
                    const exercise = exercises.find(e => e.exercise_number === chapterStart);
                    if (exercise) {
                        pageRanges.push({ startDocument: null, startExercise: exercise, range: chapterStart === chapterPrev ? `${chapterStart}` : `${chapterStart}-${chapterPrev}` });
                    }
                    if (i < uniqueChapterPages.length) {
                        chapterStart = uniqueChapterPages[i];
                        chapterPrev = uniqueChapterPages[i];
                    }
                } else {
                    chapterPrev = uniqueChapterPages[i];
                }
            }

            const uniqueHomeworkPages = Array.from(new Set(exercises.map(e => e.problem_number))).sort((a, b) => a - b);
            let homeworkStart = uniqueHomeworkPages[0];
            let homeworkPrev = uniqueHomeworkPages[0];

            for (let i = 1; i <= uniqueHomeworkPages.length; i++) {
                if (i === uniqueHomeworkPages.length || uniqueHomeworkPages[i] !== homeworkPrev + 1) {
                    const exercise = exercises.find(e => e.problem_number === homeworkStart);
                    if (exercise) {
                        pageRanges.push({ startDocument: null, startExercise: exercise, range: homeworkStart === homeworkPrev ? `${homeworkStart}` : `${homeworkStart}-${homeworkPrev}` });
                    }
                    if (i < uniqueHomeworkPages.length) {
                        homeworkStart = uniqueHomeworkPages[i];
                        homeworkPrev = uniqueHomeworkPages[i];
                    }
                } else {
                    homeworkPrev = uniqueHomeworkPages[i];
                }
            }

        }

        return pageRanges;
    };

    const renderBadges = (group: {
        text: string;
        documents: Document[];
        exercises: Exercise[];
    }) => {
        // find all of the distinct lectures and chapters in the group
        const groupLectures = Array.from(new Set(group.documents.filter(doc => doc.lecture !== null).map(doc => doc.lecture).filter((lectureId) => lectureId !== null)))
        const groupChapters = Array.from(new Set(group.documents.filter(doc => doc.textbook !== null && doc.chapter !== null).map(doc => doc.chapter).filter((chapterId) => chapterId !== null)))

        // get the page ranges for each lecture and chapter
        const lecturePageRanges = groupLectures.map(lecture => getPageRanges(group.documents.filter(doc => doc.lecture === lecture), [])).flat()
        const chapterPageRanges = groupChapters.map(chapter => getPageRanges(group.documents.filter(doc => doc.chapter === chapter), [])).flat()

        // combine the page ranges for each lecture and chapter
        const allDocumentPageRanges = [...lecturePageRanges, ...chapterPageRanges]

        // find all of the distinct exercises and chapters in the group
        const groupExercises = Array.from(new Set(group.exercises.map(exercise => exercise.homework).filter((homeworkId) => homeworkId !== null)))

        // get the page ranges for each lecture and chapter
        const exercisePageRanges = groupExercises.map(homework => getPageRanges([], group.exercises.filter(exercise => exercise.homework === homework))).flat()

        return (
            <Flex gap="xs" wrap="wrap">
                {allDocumentPageRanges.length > 0 && allDocumentPageRanges.map((pageRange, pageRangeIndex) => {
                    const lectureDocument: boolean = pageRange.startDocument?.lecture !== null;
                    const chapterDocument: boolean = pageRange.startDocument?.textbook !== null && pageRange.startDocument?.chapter !== null;

                    if (lectureDocument) {
                        return (
                            <Badge
                                key={pageRangeIndex}
                                color="blue"
                                style={{ cursor: 'pointer' }}
                                onClick={() => {
                                    if (pageRange.startDocument?.lecture) {
                                        handleEnhancedDocumentClick('lectures', pageRange.startDocument.lecture, pageRange.startDocument.id);
                                    }
                                }}
                                leftSection={
                                    <Avatar
                                        src={`${process.env.NEXT_PUBLIC_STORAGE_URL}/lectures/${classId}/${pageRange.startDocument?.lecture}/${pageRange.startDocument?.id}.png`}
                                        size="xs"
                                        radius="sm"
                                    />
                                }
                                rightSection={
                                    <IconChevronRight size={16} />
                                }
                            >
                                {getDocumentLabel(
                                    'lecture',
                                    pageRange.startDocument ?? undefined,
                                    undefined,
                                    pageRange.range
                                )}
                            </Badge>
                        );
                    } else if (chapterDocument) {
                        return (
                            <Badge
                                key={pageRangeIndex}
                                color="green"
                                style={{ cursor: 'pointer' }}
                                onClick={() => {
                                    if (pageRange.startDocument?.chapter) {
                                        handleEnhancedDocumentClick('chapters', pageRange.startDocument.chapter, pageRange.startDocument.id, pageRange.startDocument.textbook || undefined);
                                    }
                                }}
                                leftSection={
                                    <Avatar
                                        src={`${process.env.NEXT_PUBLIC_STORAGE_URL}/textbooks/${classId}/${pageRange.startDocument?.textbook}/${pageRange.startDocument?.id}.png`}
                                        size="xs"
                                        radius="sm"
                                    />
                                }
                                rightSection={
                                    <IconChevronRight size={16} />
                                }
                            >
                                {getDocumentLabel(
                                    'chapter',
                                    pageRange.startDocument ?? undefined,
                                    undefined,
                                    pageRange.range
                                )}
                            </Badge>
                        );
                    } else {
                        return null;
                    }
                })}
                {exercisePageRanges.length > 0 && exercisePageRanges.map((pageRange, pageRangeIndex) => {
                    const chapterExercise: boolean = pageRange.startExercise?.chapter !== null;
                    const homeworkExercise: boolean = pageRange.startExercise?.homework !== null;

                    if (homeworkExercise) {
                        return (
                            <Badge
                                key={pageRangeIndex}
                                color="orange"
                                style={{ cursor: 'pointer' }}
                                onClick={() => {
                                    if (pageRange.startExercise?.homework) {
                                        handleEnhancedDocumentClick('homeworks', pageRange.startExercise.homework, undefined, undefined, pageRange.startExercise.id);
                                    }
                                }}
                                leftSection={
                                    <Avatar
                                        src={`${process.env.NEXT_PUBLIC_STORAGE_URL}/exercises/${classId}/${pageRange.startExercise?.homework}/${pageRange.startExercise?.id}.png`}
                                        size="xs"
                                        radius="sm"
                                    />
                                }
                                rightSection={
                                    <IconChevronRight size={16} />
                                }
                            >
                                {getDocumentLabel(
                                    'homework-problem',
                                    undefined,
                                    pageRange.startExercise ?? undefined
                                )}
                            </Badge>
                        );
                    } if (chapterExercise) {
                        return (
                            <Badge
                                key={pageRangeIndex}
                                color="teal"
                                style={{ cursor: 'pointer' }}
                                onClick={() => {
                                    if (pageRange.startExercise?.chapter) {
                                        // Get the textbook ID for this chapter
                                        const textbookId = getTextbookForChapter(pageRange.startExercise.chapter);
                                        handleEnhancedDocumentClick('chapters', pageRange.startExercise.chapter, undefined, textbookId || undefined, pageRange.startExercise.id);
                                    }
                                }}
                                leftSection={
                                    <Avatar
                                        src={pageRange.startExercise?.chapter ?
                                            `${process.env.NEXT_PUBLIC_STORAGE_URL}/exercises/${classId}/${getTextbookForChapter(pageRange.startExercise.chapter)}/${pageRange.startExercise.id}.png` :
                                            '/placeholder_image.svg'}
                                        size="xs"
                                        radius="sm"
                                    />
                                }
                                rightSection={
                                    <IconChevronRight size={16} />
                                }
                            >
                                {getDocumentLabel(
                                    'chapter-exercise',
                                    undefined,
                                    pageRange.startExercise ?? undefined
                                )}
                            </Badge>
                        );
                    } else {
                        return null;
                    }
                })}
            </Flex>
        )
    }

    const message = messages?.[messages.length - 1];

    return (

        // Then replace the Stack component
        <Stack
            ref={(el) => {
                // Use the drop function which returns a ref function
                drop(el);

                // Update container ref without directly assigning to .current
                if (containerRef) {
                    // Store the reference for scrolling functionality
                    containerRef.current = el;
                }
            }}
            style={{
                flex: 1,
                overflowY: "auto",
                marginBottom: "1rem",
                maxHeight: fullscreen ? "calc(90vh - 150px)" : "calc(80vh - 150px)",
                position: "relative",
                opacity: isLoading ? 0.7 : 1,
                transition: "all 0.2s ease-in-out",
                border: isOver ? `2px dashed ${canDrop ? '#228be6' : '#fa5252'}` : '2px solid transparent',
                backgroundColor: isOver && canDrop ? (colorScheme === "dark" ? 'rgba(34, 139, 230, 0.1)' : 'rgba(34, 139, 230, 0.05)') : 'transparent',
                padding: isOver ? '8px' : '10px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
            }}
        >
            {!message?.response || message?.response.trim() === '' ? (
                <Group justify="center">
                    <Loader size="sm" />
                </Group>
            ) : (
                <Stack gap="xs">
                    {groupConsecutiveDocuments(
                        splitTextByDocuments(
                            filterCodeBlocks(message.response)
                        ),
                        lectureDocuments ?? [],
                        chapterDocuments ?? [],
                        chapterExercises ?? [],
                        homeworkExercises ?? []
                    ).map((group, index) => (
                        <Box key={index}>
                            <Stack>
                                {splitTextByTags(group.text).map((segment, figIndex) => {
                                    if (segment.text) {
                                        return (
                                            <Card
                                                key={figIndex}
                                                padding="sm"
                                                radius="md"
                                                style={{
                                                    backgroundColor: colorScheme === "dark" ? "#25262b" : "#f1f3f5",
                                                    minWidth: "200px",
                                                    maxWidth: "100%",
                                                    border: colorScheme === "dark" ? "1px solid #373A40" : "1px solid #e9ecef"
                                                }}
                                            >
                                                {segment.text && <Latex>{segment.text}</Latex>}
                                                {segment.figureId && (
                                                    <Box
                                                        pos="relative"
                                                        style={{
                                                            maxWidth: '100%',
                                                            display: 'flex',
                                                            justifyContent: 'center',
                                                            margin: 0,
                                                            padding: 0
                                                        }}
                                                    >
                                                        <Box style={{ width: '100%', position: 'relative' }}>
                                                            {segment.figureId === 'code-placeholder' ? (
                                                                // Code placeholder - show a skeleton without trying to load an image
                                                                <Skeleton
                                                                    visible={true}
                                                                    height={"100%"}
                                                                    radius="md"
                                                                    style={{
                                                                        position: 'absolute',
                                                                        top: 0,
                                                                        left: 0,
                                                                        maxWidth: '60%',
                                                                        display: 'block',
                                                                        margin: 0
                                                                    }}
                                                                />
                                                            ) : (
                                                                // Regular figure - show the image with loading skeleton
                                                                <>
                                                                    <Skeleton
                                                                        visible={true}
                                                                        height={"100%"}
                                                                        radius="md"
                                                                        style={{
                                                                            position: 'absolute',
                                                                            top: 0,
                                                                            left: 0,
                                                                            maxWidth: '60%',
                                                                            display: 'block',
                                                                            margin: 0
                                                                        }}
                                                                    />
                                                                    <Image
                                                                        src={getFigureUrl(segment.figureId)}
                                                                        alt="Figure"
                                                                        width={800}
                                                                        height={600}
                                                                        style={{
                                                                            maxWidth: '60%',
                                                                            height: 'auto',
                                                                            borderRadius: '24px',
                                                                            objectFit: 'contain',
                                                                            opacity: 0,
                                                                            transition: 'opacity 0.2s',
                                                                            padding: '1rem'
                                                                        }}
                                                                        onLoad={(e) => {
                                                                            const img = e.target as HTMLImageElement;
                                                                            const aspectRatio = img.naturalWidth / img.naturalHeight;
                                                                            if (aspectRatio > 1.5) {
                                                                                img.style.padding = '0.5rem';
                                                                            }
                                                                            img.style.opacity = '1';
                                                                            const skeleton = img.parentElement?.querySelector('.mantine-Skeleton-root');
                                                                            if (skeleton) {
                                                                                (skeleton as HTMLElement).style.display = 'none';
                                                                            }
                                                                        }}
                                                                        priority={false}
                                                                    />
                                                                </>
                                                            )}
                                                        </Box>
                                                    </Box>
                                                )}
                                            </Card>
                                        )
                                    } else if (segment.summaryId && summaries) {
                                        return (
                                            summaries.find(s => s.id === segment.summaryId) && (
                                                <SummaryViewer classId={classId} summary={summaries.find(s => s.id === segment.summaryId)!} />
                                            )
                                        )
                                    } else if (segment.questionId && questions) {
                                        return (
                                            questions.find(q => q.id === segment.questionId) && (
                                                <QuestionViewer question={questions.find(q => q.id === segment.questionId)!} />
                                            )
                                        )
                                    }
                                })}
                            </Stack>
                            {renderBadges(group)}
                        </Box>
                    ))}
                </Stack>
            )}

            <div ref={messagesEndRef} />

            {showScrollButton && (
                <ActionIcon
                    variant="filled"
                    color="blue"
                    radius="xl"
                    size="lg"
                    onClick={scrollToBottom}
                    style={{
                        position: "sticky",
                        bottom: 16,
                        left: "50%",
                        transform: "translateX(-50%)",
                        zIndex: 10,
                        boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
                    }}
                >
                    <IconArrowDown size={20} />
                </ActionIcon>
            )}
        </Stack >
    );
});

ImmersiveMessageList.displayName = 'ImmersiveMessageList';