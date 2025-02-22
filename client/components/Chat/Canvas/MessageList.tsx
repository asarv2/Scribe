/**
 * MessageList.tsx
 * Used to show all the messages in the chat.
 */

import { Stack, Flex, Group, Avatar, Text, Card, Box, Badge } from "@mantine/core";
import { memo, useRef, useEffect } from "react";
import { Message, Profile, Document, Chapter } from "@/types";
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

interface MessageListProps {
  messages: Message[];
  professor: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
  profile: Profile | null;
  lectures: any[];
  textbooks: any[];
  chapters: Chapter[];
  lectureDocuments: Document[];
  textbookDocuments: Document[];
  colorScheme: string;
  setViewerMode: (mode: {
    active: boolean;
    documentId?: string;
    lectureId?: string;
    textbookId?: string;
    chapterId?: string;
  }) => void;
}

export const MessageList = memo(({
  messages,
  professor,
  profile,
  lectures,
  textbooks,
  chapters,
  lectureDocuments,
  textbookDocuments,
  colorScheme,
  setViewerMode
}: MessageListProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const allDocuments = [...(lectureDocuments ?? []), ...(textbookDocuments ?? [])];

  return (
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
                                <Box p="xl">
                                  <Image
                                    src={getFigureUrl(segment.figureId)}
                                    alt="Figure"
                                    width={800}
                                    height={600}
                                    style={{
                                      width: '70%',
                                      height: 'auto',
                                      borderRadius: '10px'
                                    }}
                                    priority={false}
                                  />
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
              </Card>
            </Stack>
          </Flex>
        </Stack>
      ))}
      <div ref={messagesEndRef} />
    </Stack>
  );
});

MessageList.displayName = 'MessageList';