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
  splitTextByFigures,
  groupConsecutiveDocuments,
  handleDocumentClick
} from "@/utils/chat/chat-helpers";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { useQuery } from "@tanstack/react-query";
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

interface MessageListProps {
  chatId: string;
  classId: string;
  colorScheme: string;
  existingChat: Chat | null;
  activeChat: ChatMessage;
  setActiveChat: React.Dispatch<React.SetStateAction<ChatMessage>>;
  onOptionClick: (type: ChatType, isTeacherMode?: boolean, teacherOption?: string) => void;
  setViewerMode: (viewerMode: ViewerMode) => void; // Changed to function instead of React.Dispatch
  isInitializing?: boolean;
  loading?: boolean;
  immersiveMode?: boolean;
  currentChunkIndex?: number;
  setCurrentChunkIndex?: React.Dispatch<React.SetStateAction<number>>;
  isUserInterrupting?: boolean;
}

export const MessageList = memo(({
  chatId,
  classId,
  colorScheme,
  activeChat,
  setActiveChat,
  setViewerMode,
  existingChat,
  isInitializing = false,
  loading,
  immersiveMode = false,
  currentChunkIndex = 0,
  setCurrentChunkIndex,
  isUserInterrupting = false,
}: MessageListProps) => {
  const supabase = useSupabaseBrowser();

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

  const { data: homeworks } = useQuery({
    queryKey: ["homeworks", classId],
    queryFn: () => getHomeworks(supabase, classId),
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
    const totalUniqueWords = new Set([...uniqueWords1, ...uniqueWords2]).size;
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
  
  // Function to render auto-added context badges for the first message
  const renderAutoAddedContextBadges = () => {
    if (!autoAddedContext || 
        (!autoAddedContext.lectures.length && 
         !autoAddedContext.chapters.length && 
         !autoAddedContext.homeworks.length)) {
      return null;
    }
    
    return (
      <Stack mt="xs" spacing="xs">
        <Group position="apart">
          <Text size="xs" italic c="dimmed">AI automatically added relevant context:</Text>
          <ActionIcon 
            size="xs" 
            color="gray" 
            onClick={() => setAutoAddedContext({ lectures: [], chapters: [], homeworks: [] })}
            title="Dismiss"
          >
            <IconX size={12} />
          </ActionIcon>
        </Group>
        <Group gap="xs">
          {/* Lecture badges */}
          {autoAddedContext.lectures.map(lectureId => {
            const lecture = lectures?.find(l => l.id === lectureId);
            if (!lecture) return null;
            
            return (
              <Badge 
                key={`auto-lecture-${lectureId}`}
                size="sm" 
                color="blue"
                radius="xl"
                leftSection={<IconBulb size={12} />}
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  const document = lectureDocuments?.find(d => d.lecture === lectureId);
                  if (document) {
                    handleEnhancedDocumentClick('lectures', lectureId, document.id);
                  }
                }}
              >
                {lecture.name}
              </Badge>
            );
          })}
          
          {/* Chapter badges */}
          {autoAddedContext.chapters.map(chapterId => {
            const chapter = chapters?.find(c => c.id === chapterId);
            if (!chapter) return null;
            
            return (
              <Badge 
                key={`auto-chapter-${chapterId}`} 
                size="sm" 
                color="green"
                leftSection={<IconBulb size={12} />}
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  if (chapter.textbook) {
                    const document = chapterDocuments?.find(d => 
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
                {chapter.chapter_number ? `Ch. ${chapter.chapter_number}` : chapter.title}
              </Badge>
            );
          })}
          
          {/* Homework badges */}
          {autoAddedContext.homeworks.map(homeworkId => {
            const homework = homeworks?.find(h => h.id === homeworkId);
            if (!homework) return null;
            
            return (
              <Badge 
                key={`auto-homework-${homeworkId}`} 
                size="sm" 
                color="orange"
                leftSection={<IconBulb size={12} />}
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  const exercise = homeworkExercises?.find(e => e.homework === homeworkId);
                  if (exercise) {
                    handleEnhancedDocumentClick('homeworks', homeworkId, undefined, undefined, exercise.id);
                  }
                }}
              >
                {homework.homework_number ? `HW ${homework.homework_number}` : homework.title}
              </Badge>
            );
          })}
        </Group>
      </Stack>
    );
  };

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

  const renderWelcomeMessages = () => {
    return (
      <Stack>
        {(!existingChat && (chatId === 'new')) && (
          <Flex gap="md" align="flex-start">
            <Stack gap="xs" align="flex-start" style={{ width: "100%" }}>
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
                  width: "100%",
                  maxWidth: "100%",
                  border: colorScheme === "dark" ? "1px solid #373A40" : "1px solid #e9ecef",
                  position: "relative"
                }}
              >
                <Stack gap="sm">
                  <Flex justify="space-between" align="center">
                    <Text>
                      Hi {profile?.first_name || 'there'}, how can I assist you today?
                    </Text>
                    {(profile?.admin || profile?.professor) && (
                      <Group justify="flex-end">
                        <Group gap="xs" align="center">
                          <Badge size="xs" variant="light" color="blue">Teacher</Badge>
                          <Checkbox
                            size="xs"
                            checked={activeChat.teacher}
                            onChange={() => setActiveChat((prev) => ({
                              ...prev,
                              teacher: !prev.teacher,
                              chatType: prev.teacher ? 'general-student' : 'general-teacher'
                            }))}
                          />
                        </Group>
                      </Group>
                    )}
                  </Flex>
                  <Flex justify="space-between" align="center">
                    <Group gap="xs">
                      {!activeChat.teacher ? (
                        <>
                          {/* Student options */}
                          <Button
                            variant="light"
                            color="green"
                            onClick={() => setActiveChat((prev) => ({
                              ...prev,
                              chatType: 'concept'
                            }))}
                          >
                            Learn
                          </Button>
                        <Button
                          variant="light"
                          color="indigo"
                          onClick={() => setActiveChat((prev) => ({
                            ...prev,
                            chatType: 'homework-student'
                          }))}
                        >
                          Homework
                        </Button>
                        <Button
                          variant="light"
                          color="cyan"
                          onClick={() => setActiveChat((prev) => ({
                            ...prev,
                            chatType: 'review'
                          }))}
                        >
                          Test-Prep
                        </Button>
                      </>
                    ) : (
                      <>
                        {/* Teacher options */}
                        <Button
                          variant="light"
                          color="green"
                          onClick={() => setActiveChat((prev) => ({
                            ...prev,
                            chatType: 'method'
                          }))}
                        >
                          Methodology
                        </Button>
                        <Button
                          variant="light"
                          color="indigo"
                          onClick={() => setActiveChat((prev) => ({
                            ...prev,
                            chatType: 'homework-professor'
                          }))}
                        >
                          Homework
                        </Button>
                        <Button
                          variant="light"
                          color="cyan"
                          onClick={() => setActiveChat((prev) => ({
                            ...prev,
                            chatType: 'generate'
                          }))}
                        >
                          Generate
                        </Button>
                      </>
                      )}
                    </Group>
                    {/* Clear button in bottom right */}
                    {activeChat.chatType &&
                      !activeChat.chatType.startsWith('general') && (
                        <Group justify="flex-end" mt="xs">
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            size="sm"
                            onClick={() => setActiveChat((prev) => ({
                              ...prev,
                              chatType: prev.teacher ? 'general-student' : 'general-teacher'
                            }))}
                            title="Clear Selection"
                          >
                            <IconRefresh size={16} />
                          </ActionIcon>
                        </Group>
                      )}
                  </Flex>
                </Stack>
              </Card>
            </Stack>
          </Flex>
        )}

        {/* Only show follow-up message if:
            1. It's a new chat with a non-general chat type, OR
            2. It's an existing chat with a non-general chat type */}
        {((existingChat && !existingChat.type.startsWith('general')) ||
          (!existingChat && activeChat.chatType && !activeChat.chatType.startsWith('general'))) && (
            <Flex gap="md" align="flex-start">
              <Stack gap="xs" align="flex-start" style={{ width: "100%" }}>
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
                    width: "100%",
                    maxWidth: "100%",
                    border: colorScheme === "dark" ? "1px solid #373A40" : "1px solid #e9ecef",
                    position: "relative"
                  }}
                >
                  <Text>
                    {!(existingChat ? existingChat.teacher : activeChat.teacher)  ? (
                      <>
                        {/* Student follow-up text */}
                        {existingChat ? (
                          // Use existingChat data when available
                          existingChat.type === 'concept' ? (
                            <>What specific <Text span fw={600} c="green">concepts</Text> do you need help understanding?</>
                          ) : existingChat.type === 'homework-student' ? (
                            <>Which <Text span fw={600} c="indigo">homework</Text> question can I help you figure out?</>
                          ) : existingChat.type === 'review' ? (
                            <>Which topics would you like me to help you <Text span fw={600} c="cyan">review</Text>?</>
                          ) : (
                            <>What specific <Text span fw={600} c="blue">teaching approaches</Text> would you like me to take when helping out the students?</>
                          )
                        ) : (
                          // Fall back to activeChat data for new chats
                          activeChat.chatType === 'concept' ? (
                            <>What specific <Text span fw={600} c="green">concepts</Text> do you need help understanding?</>
                          ) : activeChat.chatType === 'homework-student' ? (
                            <>Which <Text span fw={600} c="indigo">homework</Text> question can I help you figure out?</>
                          ) : activeChat.chatType === 'review' ? (
                            <>Which topics would you like me to help you <Text span fw={600} c="cyan">review</Text>?</>
                          ) : (
                            <>What specific <Text span fw={600} c="blue">teaching approaches</Text> would you like me to take when helping out the students?</>
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
                            <>What specific <Text span fw={600} c="blue">teaching approaches</Text> would you like me to take when helping out the students?</>
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
                            <>What specific <Text span fw={600} c="blue">teaching approaches</Text> would you like me to take when helping out the students?</>
                          )
                        )}
                      </>
                    )}
                  </Text>
                </Card>
              </Stack>
            </Flex>
          )}
      </Stack>
    );
  };

  // Get document label for display
  const getDocumentLabel = (
    type: 'lecture' | 'chapter' | 'homework-problem' | 'chapter-exercise',
    doc?: Document,
    exercise?: Exercise,
  ): string => {
    if (type === 'lecture' && doc) {
      const lecture = lectures?.find(l => l.id === doc.lecture);
      return `${lecture?.name ?? 'Lecture'} p.${doc.page}`;
    } else if (type === 'chapter' && doc) {
      const textbook = textbooks?.find(t => t.id === doc.textbook);
      return `${textbook?.title ?? 'Textbook'} p.${doc.page}`;
    } else if (type === 'chapter-exercise' && exercise) {
      const chapter = chapters?.find(c => c.id === exercise.chapter);
      return `Ch.${chapter?.chapter_number ?? '?'} Ex.${exercise.exercise_number}`;
    } else if (type === 'homework-problem' && exercise) {
      const homework = homeworks?.find(h => h.id === exercise.homework);
      return `HW ${homework?.homework_number ?? '?'} Problem ${exercise.problem_number}`;
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
      setViewerMode({
        active: true,
        documentId,
        lectureId: contextId,
      });
    }
    // For chapters
    else if (contextType === 'chapters' && textbookId) {
      setViewerMode({
        active: true,
        documentId: documentId || undefined,
        textbookId,
        chapterId: contextId,
      });
    }
    // For chapter exercises
    else if (contextType === 'chapters' && exerciseId) {
      setViewerMode({
        active: true,
        chapterId: contextId,
        exerciseId,
      });
    }
    // For homework exercises
    else if (contextType === 'homeworks' && exerciseId) {
      setViewerMode({
        active: true,
        homeworkId: contextId,
        exerciseId,
      });
    }
  };

  // Get the appropriate textbook ID for a chapter
  const getTextbookForChapter = (chapterId: string) => {
    const chapter = chapters?.find(c => c.id === chapterId);
    return chapter?.textbook || null;
  };

  // Function to render context badges for user messages
  const renderMessageContext = (message: any) => {
    // Check if this message has any context attached
    const hasLectures = message.lectures && message.lectures.length > 0;
    const hasChapters = message.chapters && message.chapters.length > 0;
    const hasHomeworks = message.homeworks && message.homeworks.length > 0;

    if (!hasLectures && !hasChapters && !hasHomeworks) {
      return null;
    }

    return (
      <Group gap="xs" mt="xs" style={{ justifyContent: 'flex-end' }}>
        {/* Render lecture badges */}
        {hasLectures && message.lectures.map((lectureId: string) => {
          const lecture = lectures?.find(l => l.id === lectureId);
          if (!lecture) return null;
          
          return (
            <Badge 
              key={`lecture-${lectureId}`}
              size="md" 
              color="blue"
              radius="xl"
              styles={{ root: { borderColor: 'white' } }}
              style={{ cursor: 'pointer' }}
              onClick={() => {
                const document = lectureDocuments?.find(d => d.lecture === lectureId);
                if (document) {
                  handleEnhancedDocumentClick('lectures', lectureId, document.id);
                }
              }}
            >
              {lecture.name}
            </Badge>
          );
        })}
        
        {/* Render chapter badges */}
        {hasChapters && message.chapters.map((chapterId: string) => {
          const chapter = chapters?.find(c => c.id === chapterId);
          if (!chapter) return null;
          
          return (
            <Badge 
              key={`chapter-${chapterId}`} 
              size="md" 
              color="green"
              style={{ cursor: 'pointer' }}
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
              {chapter.chapter_number ? `Ch. ${chapter.chapter_number}` : chapter.title}
            </Badge>
          );
        })}
        
        {/* Render homework badges */}
        {hasHomeworks && message.homeworks.map((homeworkId: string) => {
          const homework = homeworks?.find(h => h.id === homeworkId);
          if (!homework) return null;
          
          return (
            <Badge 
              key={`homework-${homeworkId}`} 
              size="md" 
              color="orange"
              style={{ cursor: 'pointer' }}
              onClick={() => {
                const exercise = exercises?.find(e => e.homework === homeworkId);
                if (exercise) {
                  handleEnhancedDocumentClick('homeworks', homeworkId, undefined, undefined, exercise.id);
                }
              }}
            >
              {homework.homework_number ? `HW ${homework.homework_number}` : homework.title}
            </Badge>
          );
        })}
      </Group>
    );
  };

  // Add state for chunked AI responses
  const [messageChunks, setMessageChunks] = useState<{ text: string, index: number }[]>([]);
  const [visibleChunks, setVisibleChunks] = useState<number[]>([]);
  const [lastVisibleMessage, setLastVisibleMessage] = useState<number | null>(null);
  const [chunkTypingComplete, setChunkTypingComplete] = useState<Record<number, boolean>>({});
  
  // Process messages into chunks when they change or when immersive mode is toggled
  useEffect(() => {
    if (!immersiveMode || !messages || messages.length === 0) return;

    const chunks: { text: string, index: number }[] = [];
    
    // Process only AI responses into chunks for immersive mode
    messages.forEach((message, messageIndex) => {
      if (!message.response) return;
      
      // Split response into logical chunks (paragraphs or sentences)
      const messageText = message.response.trim();
      const paragraphs = messageText.split(/\n\s*\n/).filter(p => p.trim().length > 0);
      
      // Temporary array to hold paragraphs before committing them to chunks
      let tempChunks: string[] = [];
      
      for (let i = 0; i < paragraphs.length; i++) {
        const paragraph = paragraphs[i];
        
        // Check if this is a small header-like text (e.g., "1." or "Step 1:")
        const isSmallHeader = /^(\d+\.|\w+\s*\d+:)$/i.test(paragraph.trim()) && paragraph.length < 15;
        const isNumberedItemStart = /^\d+\.\s*\w+/.test(paragraph.trim());
        
        // If it's a small header and there's a next paragraph, combine them
        if (isSmallHeader && i + 1 < paragraphs.length) {
          tempChunks.push(`${paragraph}\n\n${paragraphs[i + 1]}`);
          i++; // Skip the next paragraph as we've combined it
        }
        // If it's a numbered item with content, keep as is
        else if (isNumberedItemStart || paragraph.length >= 30) {
          tempChunks.push(paragraph);
        }
        // If it's a very short paragraph, try to combine with the next one
        else if (paragraph.length < 30 && i + 1 < paragraphs.length && paragraphs[i + 1].length < 100) {
          tempChunks.push(`${paragraph}\n\n${paragraphs[i + 1]}`);
          i++;
        }
        // Otherwise, keep as is
        else {
          tempChunks.push(paragraph);
        }
      }
      
      // Process the temporary chunks into final chunks
      tempChunks.forEach(text => {
        // For longer paragraphs, split by sentences
        if (text.length > 300) {
          const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
          
          let currentSentenceGroup = "";
          sentences.forEach((sentence, idx) => {
            // Check if this is a numbered item or a small fragment
            const isSmallFragment = sentence.length < 30 && /^\d+\./.test(sentence.trim());
            
            // If it's a small numbered item and there's a next sentence, combine them
            if (isSmallFragment && idx + 1 < sentences.length) {
              currentSentenceGroup = sentence + " " + sentences[idx + 1];
              chunks.push({ text: currentSentenceGroup.trim(), index: messageIndex });
              currentSentenceGroup = "";
              // Skip the next sentence as we've combined it
              sentences[idx + 1] = "";
            }
            // If current sentence is not empty (wasn't used in a previous combination)
            else if (sentence.trim()) {
              // If it's very short, try to combine with next sentence
              if (sentence.length < 15 && idx + 1 < sentences.length) {
                currentSentenceGroup = sentence + " " + sentences[idx + 1];
                chunks.push({ text: currentSentenceGroup.trim(), index: messageIndex });
                currentSentenceGroup = "";
                // Skip the next sentence as we've used it
                sentences[idx + 1] = "";
              } else {
                chunks.push({ text: sentence.trim(), index: messageIndex });
              }
            }
          });
        } else {
          chunks.push({ text: text.trim(), index: messageIndex });
        }
      });
    });
    
    setMessageChunks(chunks);
    
    // Initialize with only the first chunk visible
    if (chunks.length > 0) {
      setVisibleChunks([0]);
      setLastVisibleMessage(chunks[0].index);
    }
  }, [messages, immersiveMode]);
  
  // Update visible chunks when currentChunkIndex changes
  useEffect(() => {
    if (!immersiveMode || messageChunks.length === 0) return;
    
    // Show chunks up to current index
    const newVisibleChunks = Array.from({ length: currentChunkIndex + 1 }, (_, i) => i)
      .filter(i => i < messageChunks.length);
      
    setVisibleChunks(newVisibleChunks);
    
    // Update last visible message
    if (newVisibleChunks.length > 0) {
      const lastChunkIndex = newVisibleChunks[newVisibleChunks.length - 1];
      setLastVisibleMessage(messageChunks[lastChunkIndex].index);
    }
  }, [currentChunkIndex, messageChunks, immersiveMode]);
  
  // Handle spacebar press in immersive mode
  useHotkeys([
    ['space', () => {
      if (immersiveMode && !isUserInterrupting && setCurrentChunkIndex) {
        const latestChunkIndex = visibleChunks[visibleChunks.length - 1];
        // Only advance to next chunk if current chunk has finished typing
        if (chunkTypingComplete[latestChunkIndex] && currentChunkIndex < messageChunks.length - 1) {
          setCurrentChunkIndex(prev => prev + 1);
        } else if (!chunkTypingComplete[latestChunkIndex]) {
          // If typing is not complete, mark it as complete to skip animation
          setChunkTypingComplete(prev => ({ ...prev, [latestChunkIndex]: true }));
        }
      }
    }],
  ]);
  
  // Scroll to the latest chunk when it becomes visible
  useEffect(() => {
    if (immersiveMode && visibleChunks.length > 0) {
      const lastVisibleChunk = visibleChunks[visibleChunks.length - 1];
      const element = document.getElementById(`chunk-${lastVisibleChunk}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [visibleChunks, immersiveMode]);

  // Render immersive mode view
  const renderImmersiveView = () => {
    if (!messages || messages.length === 0) {
      return (
        <Flex justify="center" align="center" style={{ height: '100%' }}>
          <Text size="lg" c="dimmed">No messages yet. Start typing to begin the conversation.</Text>
        </Flex>
      );
    }

    return (
      <Stack spacing="xl" align="center" justify="center" style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px' }}>
        {messageChunks
          .filter((_, index) => visibleChunks.includes(index))
          .map((chunk, index) => {
            const isLatestChunk = index === visibleChunks[visibleChunks.length - 1];
            
            return (
              <Card
                key={`chunk-${index}`}
                id={`chunk-${index}`}
                shadow="sm"
                padding="lg"
                radius="md"
                style={{
                  width: '100%',
                  opacity: 1,
                  transform: 'translateY(0)',
                  animation: 'fadeIn 0.5s ease-out',
                  marginBottom: '20px',
                  minHeight: '80px', // Add minimum height to prevent layout shifts
                }}
              >
                {isLatestChunk && !chunkTypingComplete[index] ? (
                  <TypeAnimation
                    sequence={[
                      chunk.text,
                      () => setChunkTypingComplete(prev => ({ ...prev, [index]: true }))
                    ]}
                    wrapper="div"
                    cursor={true}
                    repeat={0}
                    speed={60}
                    style={{ fontSize: '1.125rem', whiteSpace: 'pre-wrap' }}
                    className="latex-wrapper"
                    omitDeletionAnimation={true}
                  />
                ) : (
                  <Text size="lg" className="latex-wrapper" style={{ whiteSpace: 'pre-wrap' }}>
                    <Latex>{chunk.text}</Latex>
                  </Text>
                )}
              </Card>
            );
          })}
          
        {currentChunkIndex < messageChunks.length - 1 && chunkTypingComplete[visibleChunks[visibleChunks.length - 1]] && (
          <Text size="sm" c="dimmed" style={{ marginTop: '20px', animation: 'pulse 1.5s infinite' }}>
            Press space to continue...
          </Text>
        )}
      </Stack>
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
    `;
    document.head.appendChild(styleEl);
    
    return () => {
      document.head.removeChild(styleEl);
    };
  }, []);

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
        maxHeight: immersiveMode ? "calc(90vh - 150px)" : "calc(80vh - 150px)",
        position: "relative",
        opacity: isLoading ? 0.7 : 1,
        transition: "all 0.2s ease-in-out",
        border: !immersiveMode && isOver ? `2px dashed ${canDrop ? '#228be6' : '#fa5252'}` : '2px solid transparent',
        backgroundColor: !immersiveMode && isOver && canDrop ? (colorScheme === "dark" ? 'rgba(34, 139, 230, 0.1)' : 'rgba(34, 139, 230, 0.05)') : 'transparent',
        padding: immersiveMode ? '20px 0' : (isOver ? '8px' : '10px'),
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {immersiveMode ? (
        renderImmersiveView()
      ) : (
        // Regular view - existing code
        <>
          {(isInitializing || isLoadingMessages) ? renderLoadingState() : (
            <>
              {renderWelcomeMessages()}
              {messages?.map((message, index) => (
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
                      <Card
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
                        {(message.lectures?.length > 0 || message.chapters?.length > 0 || message.homeworks?.length > 0) &&
                          renderMessageContext(message)
                        }
                        
                        {/* Show auto-added context badges only for the first message */}
                        {index === 0 && !message.lectures?.length && !message.chapters?.length && !message.homeworks?.length &&
                          renderAutoAddedContextBadges()
                        }
                      </Card>
                    </Stack>
                  </Flex>

                  {/* AI response */}
                  <Flex gap="md" align="flex-start">
                    <Stack gap="xs" align="flex-start">
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
                      <Card
                        padding="sm"
                        radius="md"
                        style={{
                          backgroundColor: colorScheme === "dark" ? "#25262b" : "#f1f3f5",
                          minWidth: "200px",
                          maxWidth: "100%",
                          border: colorScheme === "dark" ? "1px solid #373A40" : "1px solid #e9ecef"
                        }}
                      >
                        {!message.response || message.response.trim() === '' ? (
                          <Group justify="center">
                            <Loader size="sm" />
                          </Group>
                        ) : (
                          <Stack gap="xs">
                            {groupConsecutiveDocuments(
                              splitTextByDocuments(
                                splitTextByFigures(filterCodeBlocks(message.response))
                                  .map(segment => segment.figureId
                                    ? `<FIGURE>${segment.figureId}</FIGURE>`
                                    : segment.text)
                                  .join('')
                              ),
                              lectureDocuments ?? [],
                              chapterDocuments ?? [],
                              chapterExercises ?? [],
                              homeworkExercises ?? []
                            ).map((group, index) => (
                              <Box key={index}>
                                {group.text && (
                                  <Stack gap="xs">
                                    {splitTextByFigures(group.text).map((segment, figIndex) => (
                                      <Box key={figIndex}>
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
                                      </Box>
                                    ))}
                                  </Stack>
                                )}
                                <Group gap="xs" pt={group.text ? "xs" : 0}>
                                  {group.documents.length > 0 && (
                                    <>
                                      {Array.from(new Map(group.documents.map(doc => [doc.id, doc])).values()).slice(0, 3).map((doc, docIndex) => {
                                        const lectureDocument: boolean = doc.lecture !== null;
                                        const chapterDocument: boolean = doc.textbook !== null && doc.chapter !== null;

                                        if (lectureDocument) {
                                          return (
                                            <Badge
                                              key={docIndex}
                                              color="blue"
                                              style={{ cursor: 'pointer' }}
                                              onClick={() => {
                                                if (doc.lecture) {
                                                  handleEnhancedDocumentClick('lectures', doc.lecture, doc.id);
                                                }
                                              }}
                                              leftSection={
                                                <Avatar 
                                                  src={`${process.env.NEXT_PUBLIC_STORAGE_URL}/lectures/${classId}/${doc.lecture}/${doc.id}.png`}
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
                                                doc,
                                                undefined
                                              )}
                                            </Badge>
                                          );
                                        } else if (chapterDocument) {
                                          return (
                                            <Badge
                                              key={docIndex}
                                              color="green"
                                              style={{ cursor: 'pointer' }}
                                              onClick={() => {
                                                if (doc.chapter) {
                                                  handleEnhancedDocumentClick('chapters', doc.chapter, doc.id, doc.textbook || undefined);
                                                }
                                              }}
                                              leftSection={
                                                <Avatar 
                                                  src={`${process.env.NEXT_PUBLIC_STORAGE_URL}/textbooks/${classId}/${doc.textbook}/${doc.id}.png`}
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
                                                doc,
                                                undefined
                                              )}
                                            </Badge>
                                          );
                                        } else {
                                          return null;
                                        }
                                      })}
                                    </>
                                  )}
                                  {group.exercises.length > 0 && (
                                    <>
                                      {Array.from(new Map(group.exercises.map(exercise => [exercise.id, exercise])).values()).slice(0, 3).map((exercise, exerciseIndex) => {
                                        const chapterExercise: boolean = exercise.chapter !== null;
                                        const homeworkExercise: boolean = exercise.homework !== null;

                                        if (homeworkExercise) {
                                          return (
                                            <Badge
                                              key={exerciseIndex}
                                              color="orange"
                                              style={{ cursor: 'pointer' }}
                                              onClick={() => {
                                                if (exercise.homework) {
                                                  handleEnhancedDocumentClick('homeworks', exercise.homework, undefined, undefined, exercise.id);
                                                }
                                              }}
                                              leftSection={
                                                <Avatar 
                                                  src={`${process.env.NEXT_PUBLIC_STORAGE_URL}/exercises/${classId}/${exercise.id}.png`}
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
                                                exercise
                                              )}
                                            </Badge>
                                          );
                                        } if (chapterExercise) {
                                          return (
                                            <Badge
                                              key={exerciseIndex}
                                              color="teal"
                                              style={{ cursor: 'pointer' }}
                                              onClick={() => {
                                                if (exercise.chapter) {
                                                  // Get the textbook ID for this chapter
                                                  const textbookId = getTextbookForChapter(exercise.chapter);
                                                  handleEnhancedDocumentClick('chapters', exercise.chapter, undefined, textbookId || undefined, exercise.id);
                                                }
                                              }}
                                              leftSection={
                                                <Avatar 
                                                  src={exercise.chapter ? 
                                                    `${process.env.NEXT_PUBLIC_STORAGE_URL}/exercises/${classId}/${exercise.id}.png` : 
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
                                                exercise
                                              )}
                                            </Badge>
                                          );
                                        } else {
                                          return null;
                                        }
                                      })}
                                    </>
                                  )}
                                </Group>
                              </Box>
                            ))}

                          </Stack>
                        )}
                      </Card>
                    </Stack>
                  </Flex>
                </Stack>
              ))}
            </>
          )}
        </>
      )}
      <div ref={messagesEndRef} />

      {/* Scroll to bottom button - only show in normal mode */}
      {!immersiveMode && showScrollButton && (
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