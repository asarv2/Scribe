/**
 * MessageList.tsx
 * Used to show all the messages in the chat.
 */

import { Stack, Flex, Group, Avatar, Text, Card, Box, Badge, Button, ActionIcon, Skeleton, Loader, Switch } from "@mantine/core";
import { IconArrowDown, IconFileText, IconRefresh, IconX } from "@tabler/icons-react";
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
  const containerRef = useRef<HTMLDivElement>(null);
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
                            color="cyan"
                            onClick={() => setActiveChat({
                              ...activeChat,
                              chatType: 'concept'
                            })}
                          >
                            Conceptual
                          </Button>
                          <Button
                            variant="light"
                            color="teal"
                            onClick={() => setActiveChat({
                              ...activeChat,
                              chatType: 'homework-student'
                            })}
                          >
                            Homework
                          </Button>
                          <Button
                            variant="light"
                            color="violet"
                            onClick={() => setActiveChat({
                              ...activeChat,
                              chatType: 'review'
                            })}
                          >
                            Review
                          </Button>
                        </>
                      ) : (
                        <>
                          {/* Teacher options */}
                          <Button
                            variant="light"
                            color="green"
                            onClick={() => setActiveChat({
                              ...activeChat,
                              chatType: 'method'
                            })}
                          >
                            Methodology
                          </Button>
                          <Button
                            variant="light"
                            color="indigo"
                            onClick={() => setActiveChat({
                              ...activeChat,
                              chatType: 'homework-professor'
                            })}
                          >
                            Homework
                          </Button>
                          <Button
                            variant="light"
                            color="orange"
                            onClick={() => setActiveChat({
                              ...activeChat,
                              chatType: 'generate'
                            })}
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

        {(existingChat ||
          (activeChat.chatType &&
            !activeChat.chatType.startsWith('general'))) && (
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
                    {!activeChat.teacher ? (
                      <>
                        Sounds good! I can definitely help you with{' '}
                        {(existingChat?.type || activeChat.chatType) === 'homework-student' ? (
                          <Text span fw={600} c="blue">your homework</Text>
                        ) : (existingChat?.type || activeChat.chatType) === 'concept' ? (
                          <Text span fw={600} c="cyan">understanding the material</Text>
                        ) : (existingChat?.type || activeChat.chatType) === 'review' ? (
                          <Text span fw={600} c="teal">visualizing key concepts</Text>
                        ) : (
                          <Text span fw={600} c="violet">general questions</Text>
                        )}. What specific {
                          (existingChat?.type || activeChat.chatType) === 'homework-student' ? 'problem' :
                            (existingChat?.type || activeChat.chatType) === 'homework-professor' ? 'problem' :
                              (existingChat?.type || activeChat.chatType) === 'concept' ? 'topic' :
                                'material'
                        } would you like to go over?
                      </>
                    ) : (
                      <>
                        {/* Teacher follow-up text */}
                        {(existingChat?.type || activeChat.chatType) === 'method' ? (
                          <>What specific <Text span fw={600} c="green">teaching approaches</Text> would you like me to take when helping out the students?</>
                        ) : (existingChat?.type || activeChat.chatType) === 'homework-professor' ? (
                          <>What are some <Text span fw={600} c="indigo">FAQ's and responses</Text> students tend to have that I can address if they ask me?</>
                        ) : (existingChat?.type || activeChat.chatType) === 'generate' ? (
                          <>What are some <Text span fw={600} c="orange">common misconceptions</Text> students usually have that cause them to make mistakes?</>
                        ) : (
                          <>What specific <Text span fw={600} c="blue">teaching approaches</Text> would you like me to take when helping out the students?</>
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

  return (
    <Stack
      ref={containerRef}
      style={{
        flex: 1,
        overflowY: "auto",
        marginBottom: "1rem",
        maxHeight: "calc(80vh - 150px)",
        position: "relative",
        opacity: isLoading ? 0.7 : 1,
        transition: "opacity 0.2s ease-in-out"
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
                                  {Array.from(new Set(group.documents)).slice(0, 3).map((doc, docIndex) => {
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
                                  {Array.from(new Set(group.exercises)).slice(0, 3).map((exercise, exerciseIndex) => {
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
                                              handleDocumentClick('chapters', exercise.chapter, setViewerMode, undefined, undefined, exercise.id);
                                            }
                                          }}
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