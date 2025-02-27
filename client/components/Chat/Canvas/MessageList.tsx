/**
 * MessageList.tsx
 * Used to show all the messages in the chat.
 */

import { Stack, Flex, Group, Avatar, Text, Card, Box, Badge, Button, ActionIcon, Skeleton, Loader } from "@mantine/core";
import { IconArrowDown } from "@tabler/icons-react";
import { memo, useRef, useEffect, useState } from "react";
import { Message, Profile, Document, Chapter, ChatType, Chat, Lecture, Textbook, ChatMessage, ViewerMode, UserMode } from "@/types";
import Latex from "../../Latex";
import Image from "next/image";
import { getAvatarUrl, getFigureUrl } from "@/utils/services/images";
import {
  filterCodeBlocks,
  splitTextByDocuments,
  splitTextByFigures,
  groupConsecutiveDocuments,
  getDocumentLabel,
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

interface MessageListProps {
  chatId: string;
  classId: string;
  colorScheme: string;
  showWelcome: boolean;
  welcomeFollowUp: boolean;
  existingChat: Chat | null;
  activeChat: ChatMessage;
  onOptionClick: (type: ChatType, isTeacherMode?: boolean, teacherOption?: string) => void;
  setViewerMode: React.Dispatch<React.SetStateAction<ViewerMode>>;
  isInitializing?: boolean;
  userMode: UserMode;
}

export const MessageList = memo(({
  chatId,
  classId,
  colorScheme,
  showWelcome,
  welcomeFollowUp,
  activeChat,
  onOptionClick,
  setViewerMode,
  existingChat,
  isInitializing = false,
  userMode
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
  }, [messages, showWelcome, welcomeFollowUp]);

  const allDocuments = [...(lectureDocuments ?? []), ...(textbookDocuments ?? [])];

  const handleTeacherOption = (option: string) => {
    // Map teacher UI options to existing database chat types
    let chatType: ChatType;
    
    switch(option) {
      case 'approach':
        chatType = 'conceptual';
        break;
      case 'faq':
        chatType = 'summary';
        break;
      case 'misconceptions':
        chatType = 'review';
        break;
      default:
        chatType = option as ChatType;
    }
    
    console.log(`Teacher selected option: ${option}, mapped to chat type: ${chatType}, setting teacherOption=${option}`);
    
    // We need to store what teacher option was selected
    onOptionClick(chatType, true, option);
  };

  const renderWelcomeMessages = () => {
    if (!showWelcome && !welcomeFollowUp) return null;
    
    // Parse teacher option from chat name instead of metadata
    let teacherOption = '';
    if (existingChat?.name) {
      const match = existingChat.name.match(/\[T:([a-z]+)\]/);
      if (match && match[1]) {
        teacherOption = match[1];
      }
    } else if (activeChat.metadata?.teacherOption) {
      teacherOption = activeChat.metadata.teacherOption;
    }
    
    console.log("Teacher option from chat name:", teacherOption);

    return (
      <Stack>
        {!existingChat && showWelcome && (
          <Flex gap="md" align="flex-start">
            <Stack gap="xs" align="flex-start">
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
                  maxWidth: "100%",
                  border: colorScheme === "dark" ? "1px solid #373A40" : "1px solid #e9ecef"
                }}
              >
                <Stack gap="xs">
                  <Text>
                    Hi {profile?.first_name || 'there'}, how can I assist you today?
                  </Text>
                  <Group gap="xs">
                    {userMode === 'student' ? (
                      <>
                        <Button
                          variant="light"
                          color="blue"
                          onClick={() => onOptionClick('homework')}
                        >
                          Homework Help
                        </Button>
                        <Button
                          variant="light"
                          color="cyan"
                          onClick={() => onOptionClick('conceptual')}
                        >
                          Conceptual Understanding
                        </Button>
                        <Button
                          variant="light"
                          color="teal"
                          onClick={() => onOptionClick('review')}
                        >
                          Content Review
                        </Button>
                        <Button
                          variant="light"
                          color="violet"
                          onClick={() => onOptionClick('summary')}
                        >
                          Summary
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="light"
                          color="green"
                          onClick={() => handleTeacherOption('approach')}
                        >
                          Specific Approach
                        </Button>
                        <Button
                          variant="light"
                          color="indigo"
                          onClick={() => handleTeacherOption('faq')}
                        >
                          FAQs and Responses
                        </Button>
                        <Button
                          variant="light"
                          color="orange"
                          onClick={() => handleTeacherOption('misconceptions')}
                        >
                          Common Misconceptions
                        </Button>
                      </>
                    )}
                  </Group>
                </Stack>
              </Card>
            </Stack>
          </Flex>
        )}

        {welcomeFollowUp && (
          <Flex gap="md" align="flex-start">
            <Stack gap="xs" align="flex-start">
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
                  maxWidth: "100%",
                  border: colorScheme === "dark" ? "1px solid #373A40" : "1px solid #e9ecef"
                }}
              >
                <Text>
                  {userMode === 'student' ? (
                    <>
                      Sounds good! I can definitely help you with{' '}
                      {(existingChat ? existingChat.type : activeChat.chatType) === 'homework' ? (
                        <Text span fw={600} c="blue">your homework</Text>
                      ) : (existingChat ? existingChat.type : activeChat.chatType) === 'conceptual' ? (
                        <Text span fw={600} c="cyan">understanding concepts</Text>
                      ) : (existingChat ? existingChat.type : activeChat.chatType) === 'review' ? (
                        <Text span fw={600} c="teal">reviewing the content</Text>
                      ) : (
                        <Text span fw={600} c="violet">creating a summary</Text>
                      )}. What specific {
                        (existingChat ? existingChat.type : activeChat.chatType) === 'homework' ? 'problem' :
                          (existingChat ? existingChat.type : activeChat.chatType) === 'conceptual' ? 'topic' :
                            'material'
                      } would you like to go over?
                    </>
                  ) : (
                    <>
                      {/* Teacher follow-up text */}
                      {teacherOption === 'approach' ? (
                        <>What specific <Text span fw={600} c="green">teaching approaches</Text> would you like me to take when helping out the students?</>
                      ) : teacherOption === 'faq' ? (
                        <>What are some <Text span fw={600} c="indigo">FAQ's and responses</Text> students tend to have that I can address if they ask me?</>
                      ) : (
                        <>What are some <Text span fw={600} c="orange">common misconceptions</Text> students usually have that cause them to make mistakes?</>
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
  const isLoading = isInitializing || isLoadingMessages;

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
      {isLoading ? renderLoadingState() : (
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
                          allDocuments
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
                                          <Skeleton
                                            visible={true}
                                            height={"100%"}
                                            radius="md"
                                            style={{
                                              position: 'absolute',
                                              top: 0,
                                              left: 0,
                                              width: '100%',
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
                                              maxWidth: '100%',
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
                                        </Box>
                                      </Box>
                                    )}
                                  </Box>
                                ))}
                              </Stack>
                            )}
                            {group.documents.length > 0 && (
                              <Group gap="xs" pt={group.text ? "xs" : 0}>
                                {group.documents.map((doc, docIndex) => (
                                  <Badge
                                    key={docIndex}
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => handleDocumentClick(doc, chapters ?? [], setViewerMode)}
                                  >
                                    {getDocumentLabel(doc, lectures ?? [], textbooks ?? [])}
                                  </Badge>
                                ))}
                              </Group>
                            )}
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