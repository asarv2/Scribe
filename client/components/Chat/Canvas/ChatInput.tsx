import { ChatMessage, Subchapter, Document, ViewerMode } from "@/types";
import { Textarea, Button, Group, Stack, Tooltip, ActionIcon, Box } from "@mantine/core";
import { ContextBadges } from "./ContextBadges";
import { memo, useRef, useState, useEffect } from "react";
import { Chapter } from "@/types";
import { useMantineColorScheme } from "@mantine/core";
import { IconSend } from "@tabler/icons-react";

interface ChatInputProps {
  activeChat: ChatMessage;
  loading: boolean;
  classId: string;
  onPromptChange: (prompt: string) => void;
  onSend: () => void;
  onRemoveContext: (contextType: keyof ChatMessage['context'], contextId: string) => void;
  onScrollToSection: (sectionId: string) => void;
  setViewerMode?: React.Dispatch<React.SetStateAction<ViewerMode>>
  expandedSections: Set<string>;
  toggleSection: (section: string) => void;
  immersiveMode?: boolean;
  onUserInterruption?: (isInterrupting: boolean) => void;
}

export const ChatInput = memo(({ 
  activeChat, 
  loading, 
  classId,
  onPromptChange, 
  onSend,
  onRemoveContext,
  onScrollToSection,
  setViewerMode,
  expandedSections,
  toggleSection,
}: ChatInputProps) => {
  const { colorScheme } = useMantineColorScheme();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!loading && activeChat.prompt.trim()) {
        onSend();
      }
    }
  };

  return (
    <Stack gap={"md"}>
      {/* Show context badges in normal mode only */}
        <Box>
          <ContextBadges 
            activeChat={activeChat}
            classId={classId}
            onRemoveContext={onRemoveContext}
            onScrollToSection={onScrollToSection}
            setViewerMode={setViewerMode}
            expandedSections={expandedSections}
            toggleSection={toggleSection}
          />
        </Box>

      <Box
        style={{
          position: 'relative',
          width: '100%',
        }}
      >
        <Textarea
          ref={textareaRef}
          value={activeChat.prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={"Type your message here..."}
          autosize
          style={{ paddingRight: '40px' }}
        />
        
        {/* Only show send icon in normal mode */}
          <ActionIcon
            disabled={loading || !activeChat.prompt.trim()}
            onClick={onSend}
            style={{
              position: 'absolute',
              right: '0',
              top: '50%',
              transform: 'translateY(-50%)',
            }}
          >
            <IconSend size={18} />
          </ActionIcon>
      </Box>
    </Stack>
  );
});

ChatInput.displayName = 'ChatInput';
