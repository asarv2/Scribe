import { ChatMessage, Subchapter, Document, ViewerMode } from "@/types";
import { Textarea, Button, Group, Stack, Tooltip, ActionIcon, Box } from "@mantine/core";
import { ContextBadges } from "./ContextBadges";
import { memo, useRef, useState, useEffect } from "react";
import { Chapter } from "@/types";
import { useMantineColorScheme } from "@mantine/core";
import { IconSend, IconEye } from "@tabler/icons-react";

interface ChatInputProps {
  activeChat: ChatMessage;
  loading: boolean;
  classId: string;
  onPromptChange: (prompt: string) => void;
  onSend: () => void;
  onRemoveContext: (contextType: keyof ChatMessage['context'], contextId: string) => void;
  onScrollToSection: (sectionId: string) => void;
  viewerMode: ViewerMode;
  setViewerMode?: React.Dispatch<React.SetStateAction<ViewerMode>>
  expandedSections: Set<string>;
  toggleSection: (section: string) => void;
  toggleImmersive: () => void;
}

export const ChatInput = memo(({
  activeChat,
  loading,
  classId,
  onPromptChange,
  onSend,
  onRemoveContext,
  onScrollToSection,
  viewerMode,
  setViewerMode,
  expandedSections,
  toggleSection,
  toggleImmersive,
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

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // Only trigger if focus is not already on an input or contenteditable element
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      // Check if the key is a single character and not a modifier key (optional)
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Focus the text area if not already focused
        textareaRef.current?.focus();
        // Optionally, you could also add the pressed key to the current value:
        // onPromptChange(activeChat.prompt + e.key);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

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
          placeholder={viewerMode.immersive ? "" : "Type your message here..."}
          autosize
          size={"md"}
          style={{ paddingRight: '40px' }}
        // variant={viewerMode.immersive ? "unstyled" : "filled"}
        />

        <Tooltip label="Send">
          <ActionIcon
            onClick={onSend}
            style={{
              position: 'absolute',
              right: '0',
              top: '50%',
              transform: 'translateY(-50%)',
            }}
            size="lg"
            loading={loading}
            disabled={!activeChat.prompt.trim()}
          >
            <IconSend size={20} />
          </ActionIcon>
        </Tooltip>

        {/* Only show send icon in normal mode */}
        {/* {!viewerMode.immersive && (!!activeChat.prompt.trim() ?
          <Tooltip label="Send">
            <ActionIcon
              onClick={onSend}
              style={{
                position: 'absolute',
                right: '0',
                top: '50%',
                transform: 'translateY(-50%)',
              }}
              size="lg"
            >
              <IconSend size={20} />
            </ActionIcon>
          </Tooltip> :
          <Tooltip label="Immersive">
            <ActionIcon
              onClick={toggleImmersive}
              style={{
                position: 'absolute',
                right: '0',
                top: '50%',
                transform: 'translateY(-50%)',
              }}
              size="lg"
            >
              <IconEye size={20} />
            </ActionIcon>
          </Tooltip>)} */}
      </Box>
    </Stack>
  );
});

ChatInput.displayName = 'ChatInput';
