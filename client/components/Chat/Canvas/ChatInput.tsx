import React, { memo, useRef, useState, useEffect } from "react"; // Removed useCallback
import { ChatMessage, Document, File, ViewerMode, AgentType } from "@/types";
import { Textarea, Button, Group, Stack, Tooltip, ActionIcon, Box, Text, Progress, useMantineTheme, ScrollArea, Skeleton, Popover, UnstyledButton } from "@mantine/core"; // Import Badge
import { ContextBadges } from "./ContextBadges";
import { IconSend, IconMicrophone, IconPlayerStop, IconPlus, IconPlayerPlay, IconPlayerSkipForward, IconPlayerSkipBack, IconVideo, IconX, IconBook, IconFile, IconPencil, IconPresentation, IconTrash, IconClipboardText, IconChartScatter, IconReportAnalytics, IconQuestionMark, IconChevronDown } from "@tabler/icons-react";
import classes from './ChatInput.module.css';
import WaveSurfer from "wavesurfer.js";
import RecordPlugin from 'wavesurfer.js/dist/plugins/record.esm.js';
import { useOs } from "@mantine/hooks";
import { useMediaQuery } from "@mantine/hooks";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { useQuery } from "@tanstack/react-query";
import { getProfile } from "@/utils/queries/get-profile";
import { getUser } from "@/utils/queries/get-user";
import { getFiles } from "@/utils/queries/get-files";

interface ChatInputProps {
  activeChat: ChatMessage;
  viewerMode: ViewerMode;
  loading: boolean;
  isInitializing?: boolean;
  chatId: string;
  classId: string;
  onSend: () => void;
  onRemoveFile: (fileId: string) => void;
  onRemoveDocument: (documentId: string) => void;
  setViewerMode?: React.Dispatch<React.SetStateAction<ViewerMode>>
  setActiveChat: React.Dispatch<React.SetStateAction<ChatMessage>>
  files?: File[];
  fileDocuments?: Document[];
  onAddFileContext: (fileId: string) => void;
  onAddDocumentContext: (documentId: string) => void;
  // Removed animation props
}

// Helper function to get mode details with consistent color handling
const getModeDetails = (agentType: AgentType, isTeacher: boolean) => {
  switch (agentType) {
    // Student modes
    case 'learn': return { label: 'Learn', icon: IconBook, color: 'green' };
    case 'homework': return { label: 'Homework', icon: IconFile, color: 'indigo' };
    case 'review': return { label: 'Review', icon: IconClipboardText, color: 'teal' };
    
    // Teacher modes
    case 'analyze': return { label: 'Analyze', icon: IconChartScatter, color: 'violet' };
    case 'report': return { label: 'Report', icon: IconReportAnalytics, color: 'grape' };
    case 'content': return { label: 'Content', icon: IconBook, color: 'pink' };
    case 'grade': return { label: 'Grade', icon: IconPresentation, color: 'orange' };
    
    // Common modes
    case 'figure': return { label: 'Figure', icon: IconChartScatter, color: 'green' };
    case 'summary': return { label: 'Summary', icon: IconReportAnalytics, color: 'yellow' };
    case 'question': return { label: 'Question', icon: IconQuestionMark, color: 'blue' };
    case 'syllabus': return { label: 'Syllabus', icon: IconBook, color: 'lime' };
    
    // Default/General
    default: return { label: 'General', icon: IconClipboardText, color: 'orange' };
  }
};


export const ChatInput = memo(({
  activeChat,
  viewerMode,
  loading,
  chatId,
  classId,
  onSend,
  onRemoveFile,
  onRemoveDocument,
  setViewerMode,
  setActiveChat,
  isInitializing = false,
  files,
  fileDocuments,
  onAddFileContext,
  onAddDocumentContext,
}: ChatInputProps) => {
  const supabase = useSupabaseBrowser();

  const isMobile = useMediaQuery('(max-width: 768px)');
  const [modePopoverOpened, setModePopoverOpened] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const recordRef = useRef<any>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [recordingMode, setRecordingMode] = useState(false);   // 👈 back from OLD
  const [enterDuringRec, setEnterDuringRec] = useState(false);

  const os = useOs();

  const { data: user } = useQuery({
      queryKey: ["user"],
      queryFn: () => getUser(supabase)
  });

  const { data: profile } = useQuery({
      queryKey: ["profile", user?.id],
      queryFn: () => getProfile(supabase, user!.id),
      enabled: !!user?.id
  });


  const { data: filesData, isLoading: loadingFiles } = useQuery({
      queryKey: ["files", classId],
      // Use the 'files' prop if available, otherwise fetch (or adjust logic as needed)
      queryFn: () => files ?? getFiles(supabase, classId!),
      enabled: !!profile && !files // Only fetch if files prop isn't provided
  });

  // Use fileDocuments prop if available
  const documentsData = fileDocuments;


  // Add state to track if Enter was pressed during recording
  const [enterPressedDuringRecording, setEnterPressedDuringRecording] = useState(false);

  // useEffect to open popover on mount for new chats
  // useEffect(() => {
  //   if (chatId === "new") {
  //     setModePopoverOpened(true);
  //   }
  // }, [chatId]); // Run when chatId changes (e.g., navigating from existing chat to new)


  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!loading && activeChat.prompt.trim()) {
        onSend();
      }
    }
  };

  const getShortcutText = () => {
    if (os === 'macos') {
      return '⌘M';  // Command symbol + M for macOS
    } else {
      return 'Ctrl+M';  // Ctrl + M for Windows/Linux/others
    }
  };

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  /* ---------- WaveSurfer logic (identical to OLD) ---------- */
  const initWaveSurfer = async () => {
    wavesurferRef.current?.destroy();
    wavesurferRef.current = null;
    recordRef.current = null;

    if (!waveformRef.current) return;

    wavesurferRef.current = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: '#34374B',
      progressColor: '#F90',
      height: 60,
      barWidth: 3,
      barGap: 1,
      barRadius: 3,
      normalize: true,
    });

    recordRef.current = wavesurferRef.current.registerPlugin(
      RecordPlugin.create({
        renderRecordedAudio: false,
        scrollingWaveform: false,
        continuousWaveform: true,
      }),
    );

    recordRef.current.on('record-progress', (ms: number) =>
      setRecordTime(Math.floor(ms / 1000)));

    recordRef.current.on('record-end', (blob: Blob) => handleTranscribe(blob));

    await new Promise<void>((res) => {
      wavesurferRef.current?.on('ready', () => res());
      setTimeout(res, 500);
    });
  };

  const startRecording = async () => {
    try {
      await initWaveSurfer();
      await recordRef.current?.startRecording();
      setIsRecording(true);
    } catch (e) { console.error(e); setRecordingMode(false); }
  };

  const stopRecording = () => {
    recordRef.current?.isRecording() && recordRef.current.stopRecording();
    setIsRecording(false);
  };

  const toggleRecording = async () => {
    if (isRecording) {
      stopRecording();
    } else {
      setRecordTime(0);
      setRecordingMode(true);            // show recorder UI immediately
      setTimeout(startRecording, 50);     // old 50-ms trick
    }
  };

  const handleTranscribe = async (blob: Blob) => {
    setTranscribing(true);
    try {
      const fd = new FormData();
      fd.append('audio_file', blob, 'rec.webm');
      fd.append('task', 'transcribe');
      const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/parse/audio`, { method: 'POST', body: fd });
      const { text } = await r.json();
      setActiveChat(p => ({ ...p, prompt: p.prompt + text.trim() }));
    } catch (e) { console.error(e); }
    finally {
      setTranscribing(false);
      setRecordingMode(false);
    }
  };

  /* ---------- key handling ---------- */
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!loading && activeChat.prompt.trim()) onSend();
    }
  };

  // Modify the useEffect to ensure WaveSurfer is initialized properly
  useEffect(() => {
    // Initialize wavesurfer when the component mounts and waveformRef is available
    if (waveformRef.current && recordingMode) { // Only init if needed
      initWaveSurfer();
    }

    // Clean up function
    return () => {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }
    };
  }, [recordingMode]); // Re-run if recordingMode changes

  // Add back the useEffect for automatically focusing the chat
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // Only trigger if focus is not already on an input or contenteditable element
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      // Check if Enter key is pressed and not with modifiers
      if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();

        // If recording, stop recording and flag that Enter was pressed
        if (isRecording) {
          setEnterDuringRec(true);
          stopRecording();
          return;
        }

        // Send message if there's content and not loading or transcribing
        if (!loading && !transcribing && activeChat.prompt.trim()) {
          onSend();
        }
        return;
      }

      // Check if the key is a single character and not a modifier key
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Focus the text area if not already focused
        textareaRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [activeChat.prompt, loading, onSend, isRecording, transcribing]);

  // Add useEffect to send message after transcription completes if Enter was pressed
  useEffect(() => {
    if (enterDuringRec && !transcribing && !isRecording && !recordingMode) {
      if (!loading && activeChat.prompt.trim()) {
        onSend();
      }
      setEnterDuringRec(false);
    }
  }, [enterDuringRec, transcribing, isRecording, recordingMode, loading, activeChat.prompt, onSend]);


  // Function to render mode options in the popover
  const renderModeOptions = () => {
    const studentModes: AgentType[] = ['learn', 'homework', 'review'];
    const teacherModes: AgentType[] = ['analyze', 'report', 'content', 'grade'];
    const commonModes: AgentType[] = ['figure', 'summary', 'question', 'syllabus'];

    // Get the appropriate role-specific modes
    const roleModes = activeChat.teacher ? teacherModes : studentModes;
    const defaultType = 'general';

    return (
      <Stack gap="xs">
        {/* General Option */}
        <Button
          variant={activeChat.agentType === defaultType ? "light" : "subtle"}
          color="orange"
          size="sm"
          leftSection={<IconClipboardText size={16} style={{ color: getColorValue('orange') }} />}
          onClick={() => {
            setActiveChat((prev) => ({ ...prev, agentType: defaultType }));
            setModePopoverOpened(false);
          }}
          fullWidth
          justify="flex-start"
          data-active={activeChat.agentType === defaultType || undefined}
        >
          General
        </Button>

        {/* Role-specific Modes */}
        {roleModes.map((mode) => {
          // Special check for homework mode availability
          if (mode === 'homework' && !(files && files.some(file => file.content_type === 'homework'))) {
            return null;
          }
          const details = getModeDetails(mode, activeChat.teacher);
          return (
            <Button
              key={mode}
              variant={activeChat.agentType === mode ? "light" : "subtle"}
              color={details.color}
              size="sm"
              leftSection={<details.icon size={16} style={{ color: getColorValue(details.color) }} />}
              onClick={() => {
                setActiveChat((prev) => ({ ...prev, agentType: mode }));
                setModePopoverOpened(false);
              }}
              fullWidth
              justify="flex-start"
              data-active={activeChat.agentType === mode || undefined}
            >
              {details.label}
            </Button>
          );
        })}

        {/* Common Modes - Available to both teachers and students */}
        <Text size="xs" fw={500} c="dimmed" mt="xs" mb="xxs">Common Modes</Text>
        {commonModes.map((mode) => {
          const details = getModeDetails(mode, activeChat.teacher);
          return (
            <Button
              key={mode}
              variant={activeChat.agentType === mode ? "light" : "subtle"}
              color={details.color}
              size="sm"
              leftSection={<details.icon size={16} style={{ color: getColorValue(details.color) }} />}
              onClick={() => {
                setActiveChat((prev) => ({ ...prev, agentType: mode }));
                setModePopoverOpened(false);
              }}
              fullWidth
              justify="flex-start"
              data-active={activeChat.agentType === mode || undefined}
            >
              {details.label}
            </Button>
          );
        })}
      </Stack>
    );
  };

  // Inside the component, add this helper function to get the color value
  const getColorValue = (color: string) => {
    const theme = useMantineTheme();
    // Return the light variant color from Mantine's theme
    return theme.colors[color][4]; // Using index 4 for a medium brightness
  };

  const currentModeDetails = getModeDetails(activeChat.agentType, activeChat.teacher);
  const ModeIcon = currentModeDetails.icon;
  const modeColor = getColorValue(currentModeDetails.color);
  const hasContext = activeChat.files.length > 0 || activeChat.documents.length > 0;


  return (
    // Wrap the main Stack in a Box with relative positioning
    <Box style={{ position: 'relative', width: '100%' }}>
      {/* Conditionally render ContextBadges */}
      {!recordingMode && hasContext && (
        <Box
          style={{
            position: 'absolute',
            left: '0px',
            right: '0px',
            top: '0',
            zIndex: 10,
            transform: 'translateY(-100%)',
            pointerEvents: 'auto',
            paddingBottom: '8px',
          }}
        >
          <ContextBadges
            activeChat={activeChat}
            classId={classId}
            onRemoveFile={onRemoveFile}
            onRemoveDocument={onRemoveDocument}
            setViewerMode={setViewerMode}
          />
        </Box>
      )}

      <Stack gap={"md"}>
        {/* Mode Selector Popover - Now outside of conditionals to always be visible */}
        <Group wrap="nowrap" align="center" gap="xs" style={{ position: 'relative', zIndex: 5 }}>
          <Popover
            opened={modePopoverOpened}
            onChange={setModePopoverOpened}
            position="top-start"
            withArrow={false}
            shadow="md"
            offset={5}
            transitionProps={{
              duration: 150,
              transition: "fade",
              timingFunction: "ease",
              exitDuration: 150
            }}
          >
            <Popover.Target>
              <UnstyledButton
                className={classes.modeSelectorButton}
                onMouseEnter={() => setModePopoverOpened(true)}
                onMouseLeave={() => setModePopoverOpened(false)}
                data-active={modePopoverOpened || undefined}
                style={{ 
                  opacity: isInitializing ? 0.5 : 1,
                  pointerEvents: isInitializing ? 'none' : 'auto'
                }}
              >
                <ModeIcon size={28} color={modeColor} />
              </UnstyledButton>
            </Popover.Target>
            <Popover.Dropdown
              className={classes.modePopoverDropdown}
              style={{ border: 'none' }}
              onMouseEnter={() => setModePopoverOpened(true)}
              onMouseLeave={() => setModePopoverOpened(false)}
            >
              {renderModeOptions()}
            </Popover.Dropdown>
          </Popover>
        
          {isInitializing ? (
            <Box p={"xs"} style={{ flexGrow: 1 }}>
              <Skeleton height={60} />
            </Box>
          ) : recordingMode ? (
            // Recording UI - Fixed height to prevent shaking
            <Box
              className={classes.recordingBox}
              style={{ 
                flexGrow: 1, 
                marginLeft: 8, 
                position: 'relative',
                height: 120, // Fixed height to prevent layout shifts
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                overflow: 'hidden'
              }}
            >
              {/* Timer in top left corner */}
              {isRecording && (
                <Text 
                  className={classes.timer}
                  style={{
                    position: 'absolute',
                    top: 10,
                    left: 10,
                    fontSize: '0.9rem',
                    fontWeight: 500,
                    color: 'var(--mantine-color-red-6)',
                    zIndex: 5
                  }}
                >
                  {formatTime(recordTime * 1000)}
                </Text>
              )}
              
              {/* Waveform visualization */}
              <div 
                ref={waveformRef} 
                style={{ 
                  width: '100%', 
                  height: '60px',
                  opacity: transcribing ? 0.3 : 1,
                  transition: 'opacity 0.3s ease'
                }} 
              />
              
              {/* Pulsing recording indicator */}
              {isRecording && (
                <Box 
                  className={classes.recordingIndicator}
                  style={{
                    position: 'absolute',
                    top: 10,
                    right: 10,
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    backgroundColor: 'var(--mantine-color-red-6)',
                    animation: 'pulse 1.5s infinite'
                  }}
                />
              )}
              
              {/* Transcribing loader */}
              {transcribing && (
                <Box 
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8
                  }}
                >
                  <Box 
                    className={classes.loadingDots}
                    style={{
                      display: 'flex',
                      gap: 4
                    }}
                  >
                    <Box className={classes.dot} style={{ animationDelay: '0s' }} />
                    <Box className={classes.dot} style={{ animationDelay: '0.2s' }} />
                    <Box className={classes.dot} style={{ animationDelay: '0.4s' }} />
                  </Box>
                </Box>
              )}
              
              {/* Stop button - always in the same position */}
              <ActionIcon
                onClick={toggleRecording}
                size="lg"
                color="red"
                variant="filled"
                disabled={transcribing}
                loading={transcribing}
                style={{ 
                  position: 'absolute', 
                  bottom: 10, 
                  right: 10, 
                  zIndex: 10,
                  pointerEvents: 'auto'
                }}
              >
                <IconPlayerStop size={20} />
              </ActionIcon>
            </Box>
          ) : (
            // Normal Input UI - Now just the input part without the mode selector
            <Group wrap="nowrap" align="center" gap="5" className={classes.outerInputGroup} style={{ flexGrow: 1, marginLeft: 8 }}>
              <Group wrap="nowrap" align="flex-end" gap="xs" style={{ flexGrow: 1 }}>
                <Box className={classes.textareaContainer} style={{ position: 'relative' }}>
                  <Textarea
                    ref={textareaRef}
                    value={activeChat.prompt}
                    onChange={(e) => setActiveChat(prev => ({ ...prev, prompt: e.target.value }))}
                    onKeyDown={handleKeyDown}
                    placeholder="Add context and start chatting . . ."
                    autosize
                    minRows={1}
                    maxRows={6}
                    size={"md"}
                    classNames={{
                      root: classes.textareaRoot,
                      input: classes.textareaInput,
                      wrapper: classes.textareaWrapper
                    }}
                    disabled={isInitializing || loading}
                  />
                  <Box className={classes.actionButtonContainer}>
                    {activeChat.prompt.trim() ? (
                      <Tooltip label="Send Message (Enter)">
                        <ActionIcon
                          onClick={onSend}
                          size="lg"
                          loading={loading}
                          disabled={!activeChat.prompt.trim() || loading}
                          variant="subtle"
                          color="blue"
                          className={classes.sendButton}
                        >
                          <IconSend size={20} />
                        </ActionIcon>
                      </Tooltip>
                    ) : (
                      <Tooltip label="Record Audio">
                        <ActionIcon
                          onClick={toggleRecording}
                          size="lg"
                          color="blue"
                          variant="subtle"
                          className={classes.micButton}
                          disabled={loading}
                        >
                          <IconMicrophone size={20} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </Box>
                </Box>
              </Group>
            </Group>
          )}
        </Group>
      </Stack>
    </Box>
  );
});
ChatInput.displayName = 'ChatInput';
