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
  immersiveMode = false,
  onUserInterruption
}: ChatInputProps) => {
  const { colorScheme } = useMantineColorScheme();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isTyping, setIsTyping] = useState(false);
  
  // Debug what context we have available
  useEffect(() => {
    if (!immersiveMode) {
      console.log('Current context:', activeChat.context);
      const hasAnyContext = Object.entries(activeChat.context).some(([_, ids]) => 
        Array.isArray(ids) && ids.length > 0
      );
      console.log('Has any context:', hasAnyContext);
    }
  }, [activeChat.context, immersiveMode]);

  const handleInputChange = (value: string) => {
    onPromptChange(value);
    if (immersiveMode && onUserInterruption) {
      const isCurrentlyTyping = value.trim().length > 0;
      if (isCurrentlyTyping !== isTyping) {
        setIsTyping(isCurrentlyTyping);
        onUserInterruption(isCurrentlyTyping);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!loading && activeChat.prompt.trim()) {
        onSend();
      }
    }
  };

  return (
    <Stack spacing={immersiveMode ? 8 : "md"}>
      {/* Show context badges in normal mode only */}
      {!immersiveMode && (
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
      )}

      <Box
        style={{
          position: immersiveMode ? 'fixed' : 'relative',
          width: immersiveMode ? '70%' : '100%',
          maxWidth: immersiveMode ? '800px' : 'none',
          bottom: immersiveMode ? '20px' : 'auto',
          left: immersiveMode ? '50%' : 'auto',
          transform: immersiveMode ? 'translateX(-50%)' : 'none',
          zIndex: immersiveMode ? 100 : 'auto',
          background: immersiveMode ? (colorScheme === 'dark' ? 'rgba(36, 36, 36, 0.6)' : 'rgba(255, 255, 255, 0.6)') : 'transparent',
          borderRadius: immersiveMode ? '8px' : '0',
          backdropFilter: immersiveMode ? 'blur(5px)' : 'none',
          boxShadow: immersiveMode ? '0 4px 12px rgba(0, 0, 0, 0.15)' : 'none',
          padding: immersiveMode ? '10px' : '0',
        }}
      >
        <Textarea
          ref={textareaRef}
          value={activeChat.prompt}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={immersiveMode ? "Ask a question or type to interrupt..." : "Type your message here..."}
          autosize
          minRows={immersiveMode ? 1 : 2}
          maxRows={immersiveMode ? 2 : 4}
          style={{ paddingRight: immersiveMode ? '12px' : '40px' }}
          styles={{
            input: {
              fontSize: immersiveMode ? '14px' : 'inherit',
              padding: immersiveMode ? '8px 12px' : undefined,
            }
          }}
        />
        
        {/* Only show send icon in normal mode */}
        {!immersiveMode && (
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
        )}
      </Box>
    </Stack>
  );
});

ChatInput.displayName = 'ChatInput';
