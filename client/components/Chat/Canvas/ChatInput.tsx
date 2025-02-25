import { ChatMessage, Subchapter, Document, ViewerMode } from "@/types";
import { Textarea, Button, Group, Stack } from "@mantine/core";
import { ContextBadges } from "./ContextBadges";
import { memo } from "react";
import { Chapter } from "@/types";

interface ChatInputProps {
  activeChat: ChatMessage;
  loading: boolean;
  classId: string;
  onPromptChange: (prompt: string) => void;
  onSend: () => void;
  onRemoveContext: (contextType: keyof ChatMessage['context'], contextId: string) => void;
  onScrollToSection: (sectionId: string) => void;
  handleContextClick?: (
    contextType: keyof ChatMessage['context'],
    contextId: string,
    documents: Document[],
    chapters: Chapter[],
    subchapters: Subchapter[],
    setViewerMode: React.Dispatch<React.SetStateAction<ViewerMode>>
  ) => void;
  setViewerMode?: React.Dispatch<React.SetStateAction<ViewerMode>>
}

export const ChatInput = memo(({ 
  activeChat, 
  loading, 
  classId,
  onPromptChange, 
  onSend,
  onRemoveContext,
  onScrollToSection,
  handleContextClick,
  setViewerMode
}: ChatInputProps) => {
  return (
    <Stack>
      <ContextBadges 
        activeChat={activeChat}
        classId={classId}
        onRemoveContext={onRemoveContext}
        onScrollToSection={onScrollToSection}
        setViewerMode={setViewerMode}
      />
      
      <Group align="flex-end" style={{ width: '100%' }}>
        <Textarea
          placeholder="Type your message..."
          value={activeChat.prompt}
          onChange={(e) => onPromptChange(e.currentTarget.value)}
          minRows={1}
          maxRows={5}
          autosize
          style={{ flex: 1 }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
        />
        <Button onClick={onSend} loading={loading}>
          Send
        </Button>
      </Group>
    </Stack>
  );
});

ChatInput.displayName = 'ChatInput';
