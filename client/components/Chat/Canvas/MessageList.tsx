/**
 * MessageList.tsx
 * Used to show all the messages in the chat.
 */

import { Stack, Flex, Group, Avatar, Text, Card, Box, Badge, Button, ActionIcon, Skeleton, Loader, Switch, Tooltip, useMantineColorScheme, Divider } from "@mantine/core";
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
import FadeList from "./FadeList";
import MessageViewer from "@/components/Viewer/MessageViewer";
import { getFigures } from "@/utils/queries/get-figures";
import FigureViewer from "@/components/Viewer/FigureViewer";
import { getFiles } from "@/utils/queries/get-files";
import { getFileDocuments } from "@/utils/queries/get-file-docs";

interface MessageListProps {
  chatId: string;
  classId: string;
  existingChat: Chat | null;
  activeChat: ChatMessage;
  setActiveChat: React.Dispatch<React.SetStateAction<ChatMessage>>;
  onOptionClick: (type: ChatType, isTeacherMode?: boolean, teacherOption?: string) => void;
  viewerMode: ViewerMode;
  setViewerMode: React.Dispatch<React.SetStateAction<ViewerMode>>;
  isInitializing?: boolean;
  loading?: boolean;
  fullscreen?: boolean;
}

export const MessageList = memo(({
  chatId,
  classId,
  activeChat,
  setActiveChat,
  setViewerMode,
  viewerMode,
  existingChat,
  isInitializing = false,
  loading,
  fullscreen = false,
}: MessageListProps) => {
  const supabase = useSupabaseBrowser();
  const queryClient = useQueryClient();
  const { colorScheme } = useMantineColorScheme();

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

  const { data: files, isLoading: loadingFiles } = useQuery({
    queryKey: ["files", profile?.id, classId],
    queryFn: () => getFiles(supabase, profile!.id, [classId]),
    enabled: !!profile
  });


  const { data: fileDocuments } = useQuery({
    queryKey: ["fileDocuments", classId],
    queryFn: () => getFileDocuments(supabase, files!.map(f => f.id)),
    enabled: !!files
  });

  const { data: figures } = useQuery({
    queryKey: ["figures", chatId],
    queryFn: () => getFigures(supabase, messages!.map(m => m.id)),
    enabled: !!messages
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

    const figuresChannel = supabase
      .channel('realtime-figures')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'prod',
          table: 'figures',
          filter: `message=in.(${messages.map(m => m.id).join(',')})`
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["figures"]
          });
        }
      )
      .subscribe();

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
      supabase.removeChannel(figuresChannel);
      supabase.removeChannel(summariesChannel);
      supabase.removeChannel(questionsChannel);
    };
  }, [user, queryClient, messages]);

  const renderWelcomeMessages = () => {
    return (
      <Stack>
        <Flex gap="md" align="flex-start">
          <Stack gap="xs" align="flex-start" style={{ maxWidth: "75%" }}>
            <Group gap="xs" align="center">
              <Avatar
                src={professor ? getAvatarUrl(professor.id) : undefined}
                size="sm"
                radius="xl"
                alt="AI Assistant"
              />
              <Text size="sm" c="dimmed">
                {professor ? `${professor.first_name} ${professor.last_name} (AI)` : 'AI Assistant'}
              </Text>
            </Group>

            <Card
              padding="sm"
              radius="md"
              style={{
                backgroundColor: colorScheme === "dark" ? "#25262b" : "#f1f3f5",
                minWidth: "200px",
                width: "auto",
                maxWidth: "100%",
                border: colorScheme === "dark" ? "1px solid #373A40" : "1px solid #e9ecef",
                position: "relative"
              }}
            >
              <Text>
                {!(existingChat ? existingChat.teacher : activeChat.teacher) ? (
                  <>
                    {/* Student follow-up text */}
                    {existingChat ? (
                      // Use existingChat data when available
                      existingChat.type === 'concept' ? (
                        <>What specific <Text span fw={600} c="green">concepts</Text> do you need help understanding?</>
                      ) : existingChat.type === 'homework-student' ? (
                        <>Which <Text span fw={600} c="indigo">homework</Text> question can I help you figure out?</>
                      ) : existingChat.type === 'present' ? (
                        <>I'd love to see your <Text span fw={600} c="orange">presentation</Text> and help you prepare!</>
                      ) : existingChat.type === 'review' ? (
                        <>Which topics would you like me to help you <Text span fw={600} c="cyan">review</Text>?</>
                      ) : (
                        <><Text>Hi {profile?.first_name || 'there'}, how can I assist you today?</Text></>
                      )
                    ) : (
                      // Fall back to activeChat data for new chats
                      activeChat.chatType === 'concept' ? (
                        <>What specific <Text span fw={600} c="green">concepts</Text> do you need help understanding?</>
                      ) : activeChat.chatType === 'homework-student' ? (
                        <>Which <Text span fw={600} c="indigo">homework</Text> question can I help you figure out?</>
                      ) : activeChat.chatType === 'present' ? (
                        <>I'd love to see your <Text span fw={600} c="orange">presentation</Text> and help you prepare!</>
                      ) : activeChat.chatType === 'review' ? (
                        <>Which topics would you like me to help you <Text span fw={600} c="cyan">review</Text>?</>
                      ) : (
                        <><Text>Hi {profile?.first_name || 'there'}, how can I assist you today?</Text></>
                      )
                    )}
                  </>
                ) : (
                  <>
                    {/* Teacher follow-up text */}
                    {existingChat ? (
                      // Use existingChat data when available
                      existingChat.type === 'method' ? (
                        <>What specific <Text span fw={600} c="green">method</Text> would you like me to use when helping the students?</>
                      ) : existingChat.type === 'homework-professor' ? (
                        <>Which <Text span fw={600} c="indigo">homework</Text> requires some extra guidance or information?</>
                      ) : existingChat.type === 'generate' ? (
                        <>What content would you like me to<Text span fw={600} c="cyan"> generate</Text>?</>
                      ) : (
                        <><Text>Hi {profile?.first_name || 'there'}, how can I assist you today?</Text></>
                      )
                    ) : (
                      // Fall back to activeChat data for new chats
                      activeChat.chatType === 'method' ? (
                        <>What specific <Text span fw={600} c="green">method</Text> would you like me to use when helping the students?</>
                      ) : activeChat.chatType === 'homework-professor' ? (
                        <>Which <Text span fw={600} c="indigo">homework</Text> requires some extra guidance or information?</>
                      ) : activeChat.chatType === 'generate' ? (
                        <>What content would you like me to<Text span fw={600} c="cyan"> generate</Text>?</>
                      ) : (
                        <><Text>Hi {profile?.first_name || 'there'}, how can I assist you today?</Text></>
                      )
                    )}
                  </>
                )}
              </Text>
            </Card>
          </Stack>
        </Flex>
      </Stack>
    );
  };

  // Get document label for display
  const getDocumentLabel = (
    type: 'lecture' | 'chapter' | 'homework-problem' | 'chapter-exercise' | 'files',
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
    } else if (type === 'files' && doc) {
      const file = files?.find(f => f.id === doc.file);
      return `${file?.title ?? 'File'} ${range ? `p.${range}` : `p.${doc.page}`}`;
    }
    return 'Document Reference';
  };

  const renderLoadingState = () => (
    <Stack>
      {[1, 2].map((_, index) => (
        <Stack key={index} gap="md">
          {/* AI response skeleton */}
          <Flex gap="md" align="flex-start">
            <Stack gap="xs" align="flex-start">
              <Group gap="xs" align="center">
                <Skeleton height={32} width={32} radius="xl" />
                <Skeleton height={20} width={120} radius="xl" />
              </Group>
              <Skeleton height={120} width={400} radius="md" />
            </Stack>
          </Flex>

          {/* User message skeleton */}
          <Flex gap="md" justify="flex-end" align="flex-start">
            <Stack gap="xs" align="flex-end">
              <Group gap="xs" align="center">
                <Skeleton height={20} width={100} radius="xl" />
                <Skeleton height={32} width={32} radius="xl" />
              </Group>
              <Skeleton height={80} width={300} radius="md" />
            </Stack>
          </Flex>
        </Stack>
      ))}
    </Stack>
  );

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
    contextType: 'lectures' | 'chapters' | 'homeworks' | 'files',
    contextId: string,
    documentId?: string,
    textbookId?: string,
    exerciseId?: string,
  ) => {

    // For lectures
    if (contextType === 'lectures' && documentId) {
      // Use the setViewerMode function prop instead of directly setting state
      setViewerMode(prev => ({
        ...prev,
        active: true,
        open: true,
        documentId,
        lectureId: contextId,
        exerciseId: undefined,
        textbookId: undefined,
        chapterId: undefined,
        homeworkId: undefined,
        fileId: undefined,
      }));
    }
    else if (contextType === 'chapters' && exerciseId) {
      setViewerMode(prev => ({
        ...prev,
        active: true,
        open: true,
        chapterId: contextId,
        exerciseId,
        lectureId: undefined,
        textbookId: undefined,
        homeworkId: undefined,
        documentId: undefined,
        fileId: undefined,
      }));
    }
    // For chapters
    else if (contextType === 'chapters' && textbookId) {
      setViewerMode(prev => ({
        ...prev,
        active: true,
        open: true,
        documentId: documentId || undefined,
        textbookId,
        chapterId: contextId,
        exerciseId: undefined,
        lectureId: undefined,
        homeworkId: undefined,
        fileId: undefined,
      }));
    }
    // For chapter exercises

    // For homework exercises
    else if (contextType === 'homeworks' && exerciseId) {
      setViewerMode(prev => ({
        ...prev,
        active: true,
        open: true,
        homeworkId: contextId,
        exerciseId,
        textbookId: undefined,
        chapterId: undefined,
        lectureId: undefined,
        documentId: undefined,
        fileId: undefined,
      }));
    }
    else if (contextType === 'files' && documentId) {
      setViewerMode(prev => ({
        ...prev,
        active: true,
        open: true,
        documentId,
        lectureId: undefined,
        textbookId: undefined,
        chapterId: undefined,
        homeworkId: undefined,
        fileId: contextId,
      }));
    }
  };

  // Get the appropriate textbook ID for a chapter
  const getTextbookForChapter = (chapterId: string) => {
    const chapter = chapters?.find(c => c.id === chapterId);
    return chapter?.textbook || null;
  };

  // Function to render context badges for user messages
  const renderMessageContext = (message: Message) => {
    // Check if this message has any context attached
    const hasLectures = message.lectures && message.lectures.length > 0;
    const hasChapters = message.chapters && message.chapters.length > 0;
    const hasHomeworks = message.homeworks && message.homeworks.length > 0;
    const hasFiles = message.files && message.files.length > 0;

    if (!hasLectures && !hasChapters && !hasHomeworks && !hasFiles) {
      return null;
    }

    // Helper to find previous context to avoid showing duplicates
    const isPreviousContext = (type: string, id: string, currentMsgIndex: number) => {
      if (currentMsgIndex === 0) return false; // First message, nothing to compare with
      
      // Check if this context item was already in a previous message
      for (let i = 0; i < currentMsgIndex; i++) {
        const prevMsg = messages?.[i];
        if (!prevMsg) continue;
        
        if (type === 'lecture' && prevMsg.lectures?.includes(id)) return true;
        if (type === 'chapter' && prevMsg.chapters?.includes(id)) return true;
        if (type === 'homework' && prevMsg.homeworks?.includes(id)) return true;
        if (type === 'file' && prevMsg.files?.includes(id)) return true;
      }
      return false;
    };

    // Get the index of the current message
    const messageIndex = messages?.findIndex(m => m.id === message.id) ?? -1;

    return (
      <Group gap="xs" style={{ justifyContent: 'flex-end' }}>
        {/* Render lecture references (only if not in previous messages) */}
        {hasLectures && message.lectures.map((lectureId: string) => {
          // Skip if this was already shown in a previous message's context
          if (isPreviousContext('lecture', lectureId, messageIndex)) return null;
          
          const lecture = lectures?.find(l => l.id === lectureId);
          if (!lecture) return null;

          return (
            <Text 
              key={`lecture-${lectureId}`}
              size="sm"
              c="blue"
              className="inline-reference lecture-reference"
              style={{ 
                cursor: 'pointer',
                transition: 'text-decoration 0.2s ease',
                '&:hover': {
                  textDecoration: 'underline',
                }
              }}
              onClick={() => {
                const document = lectureDocuments?.find(d => d.lecture === lectureId);
                if (document) {
                  handleEnhancedDocumentClick('lectures', lectureId, document.id);
                }
              }}
            >
              ({lecture.name})
            </Text>
          );
        })}

        {/* Render chapter references (only if not in previous messages) */}
        {hasChapters && message.chapters.map((chapterId: string) => {
          // Skip if this was already shown in a previous message's context
          if (isPreviousContext('chapter', chapterId, messageIndex)) return null;
          
          const chapter = chapters?.find(c => c.id === chapterId);
          if (!chapter) return null;

          return (
            <Text
              key={`chapter-${chapterId}`}
              size="sm"
              c="green"
              className="inline-reference chapter-reference"
              style={{ 
                cursor: 'pointer',
                transition: 'text-decoration 0.2s ease', 
                '&:hover': {
                  textDecoration: 'underline',
                }

              }}
              onClick={() => {
                if (chapter.textbook) {
                  const document = textbookDocuments?.find(d =>
                    d.chapter === chapterId &&
                    d.page >= chapter.start_page &&
                    d.page <= chapter.end_page
                  );
                  if (document) {
                    handleEnhancedDocumentClick('chapters', chapterId, document.id, chapter.textbook);
                  }
                }
              }}
            >
              ({chapter.chapter_number ? `Ch. ${chapter.chapter_number}` : chapter.title})
            </Text>
          );
        })}

        {/* Render homework references (only if not in previous messages) */}
        {hasHomeworks && message.homeworks.map((homeworkId: string) => {
          // Skip if this was already shown in a previous message's context
          if (isPreviousContext('homework', homeworkId, messageIndex)) return null;
          
          const homework = homeworks?.find(h => h.id === homeworkId);
          if (!homework) return null;

          return (
            <Text
              key={`homework-${homeworkId}`}
              size="sm"
              c="orange"
              className="inline-reference homework-reference"
              style={{ 
                cursor: 'pointer',
                transition: 'text-decoration 0.2s ease',
                '&:hover': {
                  textDecoration: 'underline',
                }
              }}
              onClick={() => {
                const exercise = homeworkExercises?.find(e => e.homework === homeworkId);
                if (exercise) {
                  handleEnhancedDocumentClick('homeworks', homeworkId, undefined, undefined, exercise.id);
                }
              }}
            >
              ({homework.homework_number ? `HW ${homework.homework_number}` : homework.title})
            </Text>
          );
        })}

        {/* Render file references (only if not in previous messages) */}
        {hasFiles && message.files.map((fileId: string) => {
          // Skip if this was already shown in a previous message's context
          if (isPreviousContext('file', fileId, messageIndex)) return null;
          
          const file = files?.find(f => f.id === fileId);
          if (!file) return null;

          return (
            <Text
              key={`file-${fileId}`}
              size="sm"
              c="violet"
              className="inline-reference file-reference"
              style={{ 
                cursor: 'pointer',
                transition: 'text-decoration 0.2s ease',
                '&:hover': {
                  textDecoration: 'underline',
                }
              }}
              onClick={() => {
                const document = fileDocuments?.find(d => d.file === fileId);
                if (document) {
                  handleEnhancedDocumentClick('files', fileId, document.id, undefined, undefined);
                }
              }}
            >
              ({file.title})
            </Text>
          );
        })}
      </Group>
    );
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
      
      /* Add these new global styles for context references */
      .inline-reference {
        transition: text-decoration 0.2s ease;
      }
      .inline-reference:hover {
        text-decoration: underline !important;
      }
      .context-reference-link {
        transition: text-decoration 0.2s ease;
      }
      .context-reference-link:hover {
        text-decoration: underline !important;
      }
    `;
    document.head.appendChild(styleEl);

    return () => {
      // Check if the element is still in document.head before removing
      if (styleEl.parentNode === document.head) {
        document.head.removeChild(styleEl);
      }
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
        maxHeight: "calc(100vh - 100px)",
        position: "relative",
        opacity: isLoading ? 0.7 : 1,
        transition: "all 0.2s ease-in-out",
        border: isOver ? `2px dashed ${canDrop ? '#228be6' : '#fa5252'}` : '2px solid transparent',
        backgroundColor: isOver && canDrop ? (colorScheme === "dark" ? 'rgba(34, 139, 230, 0.1)' : 'rgba(34, 139, 230, 0.05)') : 'transparent',
        padding: isOver ? '8px' : '10px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {(isInitializing || isLoadingMessages) ? renderLoadingState() : (
        // cannot get fade list to work with immersive mode
        <FadeList enabled={false}>
          {renderWelcomeMessages()}
          {/* Deduplicate messages before rendering them */}
          {(() => {
            // Deduplicate messages based on content similarity
            const uniqueMessages: Message[] = [];
            const seenResponses = new Set();
            
            messages?.forEach((message) => {
              // If no response yet, always include the message
              if (!message.response) {
                uniqueMessages.push(message);
                return;
              }
              
              // For messages with responses, check for duplicates
              // Create a simplified fingerprint of the response (first 50 chars) to detect duplicates
              const responseFingerprint = message.response.trim().substring(0, 100);
              if (!seenResponses.has(responseFingerprint)) {
                seenResponses.add(responseFingerprint);
                uniqueMessages.push(message);
              } else {
                console.log("Skipping duplicate message response");
              }
            });
            
            return uniqueMessages;
          })().map((message, index) => (
            <Stack key={`${message.id}`}>
              {/* User message */}
              <Flex gap="md" justify="flex-end" align="flex-start">
                <Stack gap="xs" align="flex-end">
                  {/* User info container */}
                  <Group gap="xs" align="center">
                    <Text size="sm" c="dimmed">
                      {profile ? `${profile.first_name} ${profile.last_name}` : 'User'}
                    </Text>
                    <Avatar
                      src={profile ? getAvatarUrl(profile.id) : undefined}
                      radius="xl"
                      size="sm"
                      alt={`${profile?.first_name} ${profile?.last_name}`}
                    />
                  </Group>

                  {/* Message container */}
                  {message.question && <Card
                    padding="sm"
                    radius="md"
                    style={{
                      backgroundColor: "#228be6",
                      maxWidth: "100%"
                    }}
                  >
                    <Text c="white">
                      {message.question}
                    </Text>

                    {/* Display message-specific context badges */}

                    {/* Show auto-added context badges only for the first message */}
                  </Card>}
                  {(message.lectures?.length > 0 || message.chapters?.length > 0 || message.homeworks?.length > 0 || message.files?.length > 0) &&
                    renderMessageContext(message)
                  }
                </Stack>
              </Flex>

              {/* AI response */}
              <Flex gap="md" align="flex-start">
                <Stack gap="xs" align="flex-start" style={{ maxWidth: "75%" }}>
                  {/* AI info container */}
                  <Group gap="xs" align="center">
                    <Avatar
                      src={professor ? getAvatarUrl(professor.id) : undefined}
                      size="sm"
                      radius="xl"
                      alt="AI Assistant"
                    />
                    <Text size="sm" c="dimmed">
                      {professor ? `${professor.first_name} ${professor.last_name} (AI)` : 'AI Assistant'}
                    </Text>

                    {/* Admin-only file link icon. Temporary disabled. */}
                    {profile?.admin && (
                      <ActionIcon
                        component="a"
                        href={`${process.env.NEXT_PUBLIC_API_URL}/files/messages/${message.id}.txt`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="View message file"
                        variant="subtle"
                        size="sm"
                      >
                        <IconFileText size={16} />
                      </ActionIcon>
                    )}
                  </Group>

                  {/* Message container */}
                  {!message.response || message.response.trim() === '' ? (
                    <Group justify="center">
                      <Loader size="sm" />
                    </Group>
                  ) : (
                    <Stack gap="xs" style={{ width: "100%" }}>
                      <Box key={index} style={{ maxWidth: "100%", overflow: "hidden" }}>
                        <Stack>
                          {splitTextByTags(splitTextByDocuments(
                            filterCodeBlocks(message.response),
                            lectureDocuments ?? [],
                            chapterDocuments ?? [],
                            fileDocuments ?? [],
                            chapterExercises ?? [],
                            homeworkExercises ?? []
                          )).map((segment, figIndex) => {
                            if (segment.text && segment.text.trim() !== '') {
                              return (
                                <MessageViewer
                                  key={figIndex}
                                  text={segment.text}
                                  handleEnhancedDocumentClick={handleEnhancedDocumentClick}
                                  classId={classId}
                                />
                              )
                            } else if (segment.figureId && figures) {
                              return (
                                figures.find(f => f.id === segment.figureId) && (
                                  <FigureViewer key={segment.figureId} figure={figures.find(f => f.id === segment.figureId)!} classId={classId} viewerMode={viewerMode} />
                                )
                              )
                            } else if (segment.summaryId && summaries) {
                              return (
                                summaries.find(s => s.id === segment.summaryId) && (
                                  <SummaryViewer classId={classId} chatId={chatId} summary={summaries.find(s => s.id === segment.summaryId)!} viewerMode={viewerMode} handleEnhancedDocumentClick={handleEnhancedDocumentClick} lectureDocuments={lectureDocuments ?? []} chapterDocuments={chapterDocuments ?? []} fileDocuments={fileDocuments ?? []} chapterExercises={chapterExercises ?? []} homeworkExercises={homeworkExercises ?? []} />
                                )
                              )
                            } else if (segment.questionIds && questions) {
                              return (
                                questions.filter(q => segment.questionIds.includes(q.id)) && (
                                  <QuestionViewer classId={classId} chatId={chatId} questions={questions.filter(q => segment.questionIds.includes(q.id)) ?? []} viewerMode={viewerMode} handleEnhancedDocumentClick={handleEnhancedDocumentClick} lectureDocuments={lectureDocuments ?? []} chapterDocuments={chapterDocuments ?? []} fileDocuments={fileDocuments ?? []} chapterExercises={chapterExercises ?? []} homeworkExercises={homeworkExercises ?? []} />
                                )
                              )
                            }
                          })}
                        </Stack>
                      </Box>
                    </Stack>
                  )}
                </Stack>
              </Flex>
            </Stack>
          ))}
        </FadeList>
      )}

      <div ref={messagesEndRef} />

      {/* Scroll to bottom button - only show in normal mode */}
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
    </Stack>
  );
});

MessageList.displayName = 'MessageList';