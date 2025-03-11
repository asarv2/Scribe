/**
 * MessageList.tsx
 * Used to show all the messages in the chat.
 */

import { Stack, Flex, Group, Avatar, Text, Card, Box, Badge, Button, ActionIcon, Skeleton, Loader, Switch } from "@mantine/core";
import { IconArrowDown, IconChevronRight, IconExternalLink, IconFileText, IconRefresh, IconX } from "@tabler/icons-react";
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
interface MessageListProps {
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
                    {/* {(profile?.admin || profile?.professor) && (
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
                    )} */}
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
        maxHeight: "calc(80vh - 150px)",
        position: "relative",
        opacity: isLoading ? 0.7 : 1,
        transition: "all 0.2s ease-in-out",
        border: isOver ? `2px dashed ${canDrop ? '#228be6' : '#fa5252'}` : '2px solid transparent',
        backgroundColor: isOver && canDrop ? (colorScheme === "dark" ? 'rgba(34, 139, 230, 0.1)' : 'rgba(34, 139, 230, 0.05)') : 'transparent',
        padding: isOver ? '8px' : '10px'
      }}
    >
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
                                              handleDocumentClick('lectures', doc.lecture, setViewerMode, doc.id);
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
                                            if (doc.textbook && doc.chapter) {
                                              handleDocumentClick('chapters', doc.chapter, setViewerMode, doc.id, doc.textbook);
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
                                              handleDocumentClick('homeworks', exercise.homework, setViewerMode, undefined, undefined, exercise.id);
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
                                      // Find the textbook for this chapter exercise
                                      const chapter = chapters?.find(c => c.id === exercise.chapter);
                                      return (
                                        <Badge
                                          key={exerciseIndex}
                                          color="teal"
                                          style={{ cursor: 'pointer' }}
                                          onClick={() => {
                                            if (exercise.chapter) {
                                              handleDocumentClick('chapters', exercise.chapter, setViewerMode, undefined, undefined, exercise.id);
                                            }
                                          }}
                                          leftSection={
                                            <Avatar 
                                              src={chapter?.textbook ? 
                                                `${process.env.NEXT_PUBLIC_STORAGE_URL}/exercises/${classId}/${chapter.textbook}/${exercise.id}.png` : 
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
      <div ref={messagesEndRef} />

      {/* Scroll to bottom button */}
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