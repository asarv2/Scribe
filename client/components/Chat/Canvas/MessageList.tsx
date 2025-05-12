/**
 * MessageList.tsx
 * Used to show all the messages in the chat.
 */

import { Stack, Flex, Group, Avatar, Text, Card, Box, Badge, Button, ActionIcon, Skeleton, Loader, Switch, Tooltip, useMantineColorScheme, Divider } from "@mantine/core";
import { IconArrowDown, IconChevronRight, IconExternalLink, IconFileText, IconRefresh, IconX, IconBulb, IconAlertCircle } from "@tabler/icons-react";
import { memo, useRef, useEffect, useState } from "react";
import { Message, Profile, Document, Chat, ChatMessage, ViewerMode, CONTENT_COLORS, AgentType } from "@/types";
import Latex from "../../Latex";
import Image from "next/image";
import { getAvatarUrl, getFigureUrl } from "@/utils/services/images";
import {
  getPageRanges,
  splitTextByDocuments,
  splitTextByGenerationTags,
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
import PulseText from "./PulseText";
import { submitFeedback } from "@/utils/services/feedback";
import styles from "../../Viewer/MessageViewer.module.css";
import { getClass } from "@/utils/queries/get-class";
import { notifications } from "@mantine/notifications";
import ReportViewer from "@/components/Viewer/ReportViewer";
import { getReports } from "@/utils/queries/get-reports";
import { HandoffViewer } from "@/components/Viewer/HandoffViewer";

interface MessageListProps {
  chatId: string;
  classId: string;
  existingChat: Chat | null;
  activeChat: ChatMessage;
  setActiveChat: React.Dispatch<React.SetStateAction<ChatMessage>>;
  onOptionClick: (type: AgentType, isTeacherMode?: boolean, teacherOption?: string) => void;
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

  const { data: classData } = useQuery({
    queryKey: ["class", classId],
    queryFn: () => getClass(supabase, classId!),
    enabled: !!classId
  });

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

  const { data: files, isLoading: loadingFiles } = useQuery({
    queryKey: ["files", classId],
    queryFn: () => getFiles(supabase, classId!),
    enabled: !!profile
  });


  const { data: fileDocuments } = useQuery({
    queryKey: ["fileDocuments", classId],
    queryFn: () => getFileDocuments(supabase, files!.map(f => f.id)),
    enabled: !!files
  });

  const { data: figures } = useQuery({
    queryKey: ["figures", classId],
    queryFn: () => getFigures(supabase, classId!),
    enabled: !!classId
  });

  const { data: summaries } = useQuery({
    queryKey: ["summaries", classId],
    queryFn: () => getSummaries(supabase, classId!),
    enabled: !!classId
  });

  const { data: questions } = useQuery({
    queryKey: ["questions", classId],
    queryFn: () => getQuestions(supabase, classId!),
    enabled: !!classId
  });

  const { data: reports } = useQuery({
    queryKey: ["reports", classId],
    queryFn: () => getReports(supabase, classId!),
    enabled: !!classId
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

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

  // Add scroll event listener to show/hide scroll button
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      // Show button whenever user is not at the bottom
      const isScrolledUp = scrollHeight - scrollTop - clientHeight > 100;
      setShowScrollButton(isScrolledUp);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const firstMessage = messages && messages.length > 0 ? messages[0] : null;

  const renderWelcomeMessages = () => {
    return (
      <Stack>
        <Flex gap="md" align="flex-start">
          <Stack gap="xs" align="flex-start" style={{ maxWidth: "75%" }}>
            <Group gap="xs" align="center">
              <Avatar
                src={undefined}
                size="sm"
                radius="xl"
                alt="AI Assistant"
              />
              <Text size="sm" c="dimmed">
                AI Assistant
              </Text>
            </Group>
            <Card
              className={styles.messageCard}
              padding="sm"
              radius="md"
            >
              <Box>
                {!(existingChat ? existingChat.teacher : activeChat.teacher) ? (
                  <>
                    {/* Student follow-up text */}
                    {existingChat && firstMessage ? (
                      // Use latest message.start_agent as a reference
                      firstMessage.start_agent === 'learn' ? (
                        <>What specific <Text span fw={600} c="green">concepts</Text> do you need help understanding?</>
                      ) : firstMessage.start_agent === 'homework' ? (
                        <>Which <Text span fw={600} c="indigo">homework</Text> question can I help you figure out?</>
                      ) : firstMessage.start_agent === 'review' ? (
                        <>Which <Text span fw={600} c="teal">topics</Text> would you like me to help you review?</>
                      ) : firstMessage.start_agent === 'grade' ? (
                        <>Which <Text span fw={600} c="orange">assignment or question</Text> can I help you grade?</>
                      ) : firstMessage.start_agent === 'figure' ? (
                        <>What <Text span fw={600} c="green">figures</Text> would you like me to generate?</>
                      ) : firstMessage.start_agent === 'summary' ? (
                        <>What <Text span fw={600} c="yellow">content</Text> would you like me to summarize?</>
                      ) : firstMessage.start_agent === 'question' ? (
                        <>What types of <Text span fw={600} c="blue">questions</Text> would you like me to generate?</>
                      ) : firstMessage.start_agent === 'syllabus' ? (
                        <>What <Text span fw={600} c="lime">course information</Text> would you like me to organize into a syllabus?</>
                      ) : firstMessage.start_agent === 'analyze' ? (
                        <>What <Text span fw={600} c="violet">student data</Text> would you like me to analyze?</>
                      ) : firstMessage.start_agent === 'report' ? (
                        <>What kind of <Text span fw={600} c="grape">report</Text> would you like me to generate?</>
                      ) : firstMessage.start_agent === 'content' ? (
                        <>What <Text span fw={600} c="pink">educational content</Text> would you like me to create?</>
                      ) : (
                        <><Text>Hi {profile?.first_name || 'there'}, how can I assist you today?</Text></>
                      )
                    ) : (
                      // Fall back to activeChat data for new chats
                      activeChat.agentType === 'learn' ? (
                        <>What specific <Text span fw={600} c="green">concepts</Text> do you need help understanding?</>
                      ) : activeChat.agentType === 'homework' ? (
                        <>Which <Text span fw={600} c="indigo">homework</Text> question can I help you figure out?</>
                      ) : activeChat.agentType === 'review' ? (
                        <>Which <Text span fw={600} c="teal">topics</Text> would you like me to help you review?</>
                      ) : activeChat.agentType === 'grade' ? (
                        <>Which <Text span fw={600} c="orange">assignment or question</Text> can I help you grade?</>
                      ) : activeChat.agentType === 'figure' ? (
                        <>What <Text span fw={600} c="green">figures</Text> would you like me to generate?</>
                      ) : activeChat.agentType === 'summary' ? (
                        <>What <Text span fw={600} c="yellow">content</Text> would you like me to summarize?</>
                      ) : activeChat.agentType === 'question' ? (
                        <>What types of <Text span fw={600} c="blue">questions</Text> would you like me to generate?</>
                      ) : activeChat.agentType === 'syllabus' ? (
                        <>What <Text span fw={600} c="lime">course information</Text> would you like me to organize into a syllabus?</>
                      ) : activeChat.agentType === 'analyze' ? (
                        <>What <Text span fw={600} c="violet">student data</Text> would you like me to analyze?</>
                      ) : activeChat.agentType === 'report' ? (
                        <>What kind of <Text span fw={600} c="grape">report</Text> would you like me to generate?</>
                      ) : activeChat.agentType === 'content' ? (
                        <>What <Text span fw={600} c="pink">educational content</Text> would you like me to create?</>
                      ) : (
                        <><Text>Hi {profile?.first_name || 'there'}, how can I assist you today?</Text></>
                      )
                    )}
                  </>
                ) : (
                  <>
                    {/* Teacher follow-up text */}
                    {existingChat && firstMessage ? (
                      // Use existingChat data when available
                      firstMessage.start_agent === 'analyze' ? (
                        <>What <Text span fw={600} c="violet">student data</Text> would you like me to analyze?</>
                      ) : firstMessage.start_agent === 'report' ? (
                        <>What kind of <Text span fw={600} c="grape">report</Text> would you like me to generate?</>
                      ) : firstMessage.start_agent === 'content' ? (
                        <>What <Text span fw={600} c="pink">educational content</Text> would you like me to create?</>
                      ) : firstMessage.start_agent === 'grade' ? (
                        <>Which <Text span fw={600} c="orange">assignment or question</Text> can I help you grade?</>
                      ) : firstMessage.start_agent === 'figure' ? (
                        <>What <Text span fw={600} c="green">figures</Text> would you like me to generate?</>
                      ) : firstMessage.start_agent === 'summary' ? (
                        <>What <Text span fw={600} c="yellow">content or topics</Text> would you like me to summarize for your students?</>
                      ) : firstMessage.start_agent === 'question' ? (
                        <>What types of <Text span fw={600} c="blue">questions</Text> would you like me to generate?</>
                      ) : firstMessage.start_agent === 'syllabus' ? (
                        <>What <Text span fw={600} c="lime">course information</Text> would you like me to organize into a syllabus?</>
                      ) : (
                        <><Text>Hi {profile?.first_name || 'there'}, how can I assist you today?</Text></>
                      )
                    ) : (
                      // Fall back to activeChat data for new chats
                      activeChat.agentType === 'analyze' ? (
                        <>What <Text span fw={600} c="violet">student data</Text> would you like me to analyze?</>
                      ) : activeChat.agentType === 'report' ? (
                        <>What kind of <Text span fw={600} c="grape">report</Text> would you like me to generate?</>
                      ) : activeChat.agentType === 'content' ? (
                        <>What <Text span fw={600} c="pink">educational content</Text> would you like me to create?</>
                      ) : activeChat.agentType === 'grade' ? (
                        <>Which <Text span fw={600} c="orange">assignment or question</Text> can I help you grade?</>
                      ) : activeChat.agentType === 'figure' ? (
                        <>What <Text span fw={600} c="green">figures</Text> would you like me to generate?</>
                      ) : activeChat.agentType === 'summary' ? (
                        <>What <Text span fw={600} c="yellow">content or topics</Text> would you like me to summarize for your students?</>
                      ) : activeChat.agentType === 'question' ? (
                        <>What types of <Text span fw={600} c="blue">questions</Text> would you like me to generate?</>
                      ) : activeChat.agentType === 'syllabus' ? (
                        <>What <Text span fw={600} c="lime">course information</Text> would you like me to organize into a syllabus?</>
                      ) : (
                        <><Text>Hi {profile?.first_name || 'there'}, how can I assist you today?</Text></>
                      )
                    )}
                  </>
                )}
              </Box>
            </Card>
          </Stack>
        </Flex>
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
  const isLoading = isInitializing || isLoadingMessages || loading

  // Define proper drop handler that matches the context click behavior
  const handleContextDrop = (item: { id: string, type: string }) => {
    if (item && item.id) {
      if (item.type === 'file') {
        // Update the active chat context, similar to addContextToChat in ChatCanvas
        setActiveChat(prev => ({
          ...prev,
          files: [...prev.files, item.id]
        }));
      } else if (item.type === 'document') {
        setActiveChat(prev => ({
          ...prev,
          documents: [...prev.documents, item.id]
        }));
      }
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

  // Enhanced document click handler
  const handleEnhancedDocumentClick = (
    contextId: string,
    documentId?: string,
  ) => {
    setViewerMode(prev => ({
      ...prev,
      active: true,
      documentId,
      fileId: contextId,
    }));
  };

  const getDocumentLabel = (
    doc?: Document,
    range?: string
  ): string => {
    const file = files?.find(f => f.id === doc?.file);
    if (file?.type === 'video' || file?.type === 'audio') {
      const formatTime = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
      };
      return `${file?.title ?? 'File'} ${formatTime(doc?.start_time ?? 0)} - ${formatTime(doc?.end_time ?? 0)}`;
    } else {
      return `${file?.title ?? 'File'} ${range ? `p.${range}` : `p.${doc?.page}`}`;
    }
  };


  // Function to render context badges for user messages
  const renderMessageContext = (message: Message) => {
    // Check if this message has any context attached
    const hasFiles = message.files && message.files.length > 0;
    const hasDocuments = message.documents && message.documents.length > 0;
    if (!hasFiles && !hasDocuments) {
      return null;
    }

    // Helper to find previous context to avoid showing duplicates
    const isPreviousContext = (type: string, id: string, currentMsgIndex: number) => {
      if (currentMsgIndex === 0) return false; // First message, nothing to compare with

      // Check if this context item was already in a previous message
      for (let i = 0; i < currentMsgIndex; i++) {
        const prevMsg = messages?.[i];
        if (!prevMsg) continue;
        if (type === 'file' && prevMsg.files?.includes(id)) return true;
        if (type === 'document' && prevMsg.documents?.includes(id)) return true;
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
                  handleEnhancedDocumentClick(fileId, document.id);
                }
              }}
            >
              ({file.title})
            </Text>
          );
        })}

        {hasDocuments && getPageRanges(message.documents.map(d => fileDocuments?.find(fd => fd.id === d)).filter(d => d !== undefined)).map(({ startDocument, endDocument, range }) => {
          // find all documents with startDocument.page <= range <= endDocument.page
          const documents = fileDocuments?.filter(d => startDocument && endDocument && d.page >= startDocument.page && d.page <= endDocument.page);
          // Skip if this was already shown in a previous message's context
          if (documents?.some(d => isPreviousContext('document', d.id, messageIndex))) return null;

          const file = files?.find(f => f.id === startDocument?.file);
          if (!startDocument || !endDocument || !file) return null;

          return (
            <Text
              key={`document-${startDocument.id}-${endDocument.id}`}
              size="sm"
              c={CONTENT_COLORS[file.content_type ?? 'other']}
              className="inline-reference document-reference"
              style={{
                cursor: 'pointer',
                transition: 'text-decoration 0.2s ease',
                '&:hover': {
                  textDecoration: 'underline',
                }
              }}
              onClick={() => {
                const document = fileDocuments?.find(d => d.id === startDocument.id);
                if (document && document.file) {
                  handleEnhancedDocumentClick(document.file, document.id);
                }
              }}
            >
              ({getDocumentLabel(startDocument, range)})
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

  // Add this new function to handle bug reports
  const handleBugReport = async (message: Message) => {
    try {
      if (existingChat && classData) {
        // Call the submitFeedback function with empty likes/wishlist and the bug report as dislikes
        await submitFeedback(`BUG REPORT: ${classData.title}`, message.generation_error, existingChat.name);
      } else {
        throw new Error("No existing chat or class data found");
      }

      // Show success notification
      notifications.show({
        title: 'Bug Report Submitted',
        message: 'Thank you for helping us improve!',
        color: 'green',
      });
    } catch (error) {
      console.error('Failed to submit bug report:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to submit bug report. Please try again later.',
        color: 'red',
      });
    }
  };

  return (
    <Stack
      ref={(el) => {
        drop(el);
        if (containerRef) {
          containerRef.current = el;
        }
      }}
      style={{
        flex: 1,
        overflowY: "auto",
        position: "relative",
        opacity: isLoading ? 0.7 : 1,
        transition: "all 0.2s ease-in-out",
        borderRadius: '8px',
        padding: '10px',
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        margin: '0',
        // Clean drop target - just a dashed border
        border: isOver ? '3px dashed #228be6' : 'none',
        backgroundColor: 'transparent', // Keep transparent
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
                  </Card>}
                  {(message.files?.length > 0 || message.documents?.length > 0) &&
                    renderMessageContext(message)
                  }
                </Stack>
              </Flex>

              {/* AI response */}
              <Flex gap="md" align="flex-start">
                <Stack gap="xs" align="flex-start" style={{ maxWidth: "75%" }}>
                  {/* AI info container */}
                  <Flex justify="space-between" align="center" w="100%">
                    <Group gap="xs" align="center">
                      <Avatar
                        src={undefined}
                        size="sm"
                        radius="xl"
                        alt="AI Assistant"
                      />
                      <Text size="sm" c="dimmed">
                        AI Assistant
                      </Text>
                    </Group>
                    {!message.correct && message.reason && (
                      <Tooltip label={`This response may be incorrect: ${message.reason}`} withArrow multiline w="200px">
                        <IconAlertCircle size={16} color="#ff6b6b" opacity={0.7} style={{ cursor: "pointer" }} />
                      </Tooltip>
                    )}
                  </Flex>

                  {/* Message container */}
                  {!message.response || message.response.trim() === '' ? (
                    message.generation_status === "error" ? (
                      <Card
                        padding="sm"
                        radius="md"
                        className={styles.messageCard}
                        style={{
                          border: "1px solid #fa5252",
                        }}
                      >
                        <Text c="red" size="sm" fw={500}>
                          We ran into an issue while creating your response
                          {message.generation_error ? `: ${message.generation_error}` : ""}{message.generation_error && message.generation_error.endsWith(".") ? "" : "."} Try again, or{' '}
                          <Text span c="red" fw={700} style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => handleBugReport(message)}>
                            press here
                          </Text>{' '}
                          to send us the bug report.
                        </Text>
                      </Card>
                    ) : (
                      <PulseText key={index} text={message.status_text !== "" ? message.status_text : "Thinking..."} />
                    )
                  ) : (
                    <Stack gap="xs" style={{ width: "100%" }}>
                      {message.generation_status === "error" && (
                        <Card
                          padding="sm"
                          radius="md"
                          className={styles.messageCard}
                          style={{
                            border: "1px solid #fa5252",
                            marginBottom: "8px"
                          }}
                        >
                          <Text c="red" size="sm" fw={500}>
                            We ran into an issue while creating your response
                            {message.generation_error ? `: ${message.generation_error}` : ""}{message.generation_error && message.generation_error.endsWith(".") ? "" : "."} Try again, or{' '}
                            <Text span c="red" fw={700} style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => handleBugReport(message)}>
                              press here
                            </Text>{' '}
                            to send us the bug report.
                          </Text>
                        </Card>
                      )}
                      {message.generation_status !== "error" && <Box key={index} style={{ maxWidth: "100%", overflow: "hidden" }}>
                        <Stack>
                          {splitTextByGenerationTags(splitTextByDocuments(
                            message.response,
                            fileDocuments ?? [],
                          )).map((segment, figIndex) => {
                            if (segment.text) {
                              if (segment.handoff) {
                                return (
                                  <HandoffViewer
                                    key={figIndex}
                                    text={segment.text}
                                    handleEnhancedDocumentClick={handleEnhancedDocumentClick}
                                    classId={classId}
                                  />
                                )
                              } else if (segment.text.trim() !== '') {
                                return (
                                  <MessageViewer
                                    key={figIndex}
                                    text={segment.text}
                                    handleEnhancedDocumentClick={handleEnhancedDocumentClick}
                                    classId={classId}
                                  />
                                )
                              }
                            } else if (segment.figure && figures) {
                              return (
                                <FigureViewer
                                  key={`figures-${message.id}`}
                                  classId={classId}
                                  chatId={chatId}
                                  figures={figures.filter(f => f.message === message.id)}
                                  viewerMode={viewerMode}
                                  handleEnhancedDocumentClick={handleEnhancedDocumentClick}
                                  fileDocuments={fileDocuments ?? []}
                                />
                              )
                            } else if (segment.summary && summaries) {
                              return (
                                <SummaryViewer
                                  key={`summaries-${message.id}`}
                                  classId={classId}
                                  chatId={chatId}
                                  summaries={summaries.filter(s => s.message === message.id)}
                                  viewerMode={viewerMode}
                                  handleEnhancedDocumentClick={handleEnhancedDocumentClick}
                                  fileDocuments={fileDocuments ?? []}
                                />
                              )
                            } else if (segment.question && questions) {
                              return (
                                <QuestionViewer
                                  key={`questions-${message.id}`}
                                  classId={classId}
                                  chatId={chatId}
                                  questions={questions.filter(q => q.message === message.id)}
                                  viewerMode={viewerMode}
                                  handleEnhancedDocumentClick={handleEnhancedDocumentClick}
                                  fileDocuments={fileDocuments ?? []}
                                />
                              )
                            } else if (segment.report && reports) {
                              return (
                                <ReportViewer
                                  key={`reports-${message.id}`}
                                  classId={classId}
                                  chatId={chatId}
                                  reports={reports.filter(r => r.message === message.id)}
                                  viewerMode={viewerMode}
                                  handleEnhancedDocumentClick={handleEnhancedDocumentClick}
                                  fileDocuments={fileDocuments ?? []}
                                />
                              )
                            }
                            return null;
                          })}
                        </Stack>
                      </Box>}
                    </Stack>
                  )}
                </Stack>
              </Flex>
            </Stack>
          ))}
        </>
      )}
      <div ref={messagesEndRef} />

      {/* Scroll to bottom button - centered and sticky */}
      {showScrollButton && (
        <ActionIcon
          variant="filled"
          color="blue"
          radius="xl"
          size="lg"
          onClick={scrollToBottom}
          style={{
            position: 'sticky',
            bottom: '0px',
            left: '50%',
            transform: 'translateX(-50%)',
            marginTop: '-40px', // Pull it up a bit so it doesn't add to the scroll height
            zIndex: 10,
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
          }}
        >
          <IconArrowDown size={20} />
        </ActionIcon>
      )}
    </Stack>
  );
});

MessageList.displayName = 'MessageList';