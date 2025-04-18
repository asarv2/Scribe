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
  splitTextByDocuments,
  groupConsecutiveDocuments,
  splitTextByTags,
} from "@/utils/chat/chat-helpers";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getUser } from "@/utils/queries/get-user";
import { getProfile } from "@/utils/queries/get-profile";
import { getProfessor } from "@/utils/queries/get-professor";
import { getMessages } from "@/utils/queries/get-messages";
import { Checkbox } from "@mantine/core";
import { useDrop, DropTargetMonitor } from 'react-dnd';
import { useHotkeys } from '@mantine/hooks';
import { TypeAnimation } from 'react-type-animation'; // Make sure this is imported
import { getSummaries } from "@/utils/queries/get-summaries";
import { getQuestions } from "@/utils/queries/get-questions";
import SummaryViewer from "@/components/Viewer/SummaryViewer";
import QuestionViewer from "@/components/Viewer/QuestionViewer";
import MessageViewer from "@/components/Viewer/MessageViewer";
import { getFigures } from "@/utils/queries/get-figures";
import FigureViewer from "@/components/Viewer/FigureViewer";
import { getFiles } from "@/utils/queries/get-files";
import { getFileDocuments } from "@/utils/queries/get-file-docs";

const CONTENT_COLORS = {
  lecture: 'blue',    // matches badge color
  textbook: 'green',   // matches badge color
  homework: 'orange', // matches badge color
  other: 'violet',     // now matches badge color in ContextBadges
} as const;

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

  const { data: files, isLoading: loadingFiles } = useQuery({
    queryKey: ["files", classId],
    queryFn: () => getFiles(supabase, [classId]),
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

  // Scroll to bottom handler
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

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
          queryClient.invalidateQueries({
            queryKey: ["summaryFigures"]
          });
          queryClient.invalidateQueries({
            queryKey: ["questionFigures"]
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
    const file = files?.find(f => f.id === doc?.file);
    return `${file?.title ?? 'File'} ${range ? `p.${range}` : `p.${doc?.page}`}`;
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
        context: [...prev.context, item.id]
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
              c={CONTENT_COLORS[file.content_type ?? 'other']}
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
        <>
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
                            message.response,
                            fileDocuments ?? [],
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
                                  <SummaryViewer classId={classId} chatId={chatId} summary={summaries.find(s => s.id === segment.summaryId)!} viewerMode={viewerMode} handleEnhancedDocumentClick={handleEnhancedDocumentClick} fileDocuments={fileDocuments ?? []} />
                                )
                              )
                            } else if (segment.questionIds && questions) {
                              return (
                                questions.filter(q => segment.questionIds.includes(q.id)) && (
                                  <QuestionViewer classId={classId} chatId={chatId} questions={questions.filter(q => segment.questionIds.includes(q.id)) ?? []} viewerMode={viewerMode} handleEnhancedDocumentClick={handleEnhancedDocumentClick} fileDocuments={fileDocuments ?? []} />
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
        </>
      )}

      <div ref={messagesEndRef} />
    </Stack>
  );
});

MessageList.displayName = 'MessageList';