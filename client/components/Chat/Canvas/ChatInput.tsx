import React, { memo, useRef, useState, useEffect, useCallback, useMemo } from "react"; // Removed useCallback
import { ChatMessage, Document, File, ViewerMode, AgentType, Message } from "@/types";
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
import { debounce } from "lodash";
import { getMessages } from "@/utils/queries/get-messages";

interface ChatInputProps {
  activeChat: ChatMessage;
  viewerMode: ViewerMode;
  loading: boolean;
  isInitializing?: boolean;
  chatId: string;
  classId: string;
  onSend: () => Promise<void>;
  onRemoveFile: (fileId: string) => void;
  onRemoveDocument: (documentId: string) => void;
  setViewerMode?: React.Dispatch<React.SetStateAction<ViewerMode>>
  setActiveChat: React.Dispatch<React.SetStateAction<ChatMessage>>
  files?: File[];
  messages?: Message[];
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
    case 'content': return { label: 'Content', icon: IconBook, color: 'pink' };
    case 'grade': return { label: 'Grade', icon: IconPresentation, color: 'orange' };

    default: return { label: 'Learn', icon: IconBook, color: 'green' };
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
  messages
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


  // Modify the debounced input handler to use useMemo instead of useCallback
  const debouncedSetPrompt = useMemo(
    () => debounce((value: string) => {
      setActiveChat(prev => ({ ...prev, prompt: value }));
    }, 10),
    [setActiveChat]
  );

  // Add cleanup for debounce on unmount
  useEffect(() => () => debouncedSetPrompt.cancel(), [debouncedSetPrompt]);

  const handleSendClick = async () => {
    // Sync the last keystroke into state before sending
    const text = textareaRef.current?.value.trim() ?? "";
    setActiveChat(prev => ({ ...prev, prompt: text }));

    await onSend();

    // Cancel any pending debounced updates
    debouncedSetPrompt.cancel();

    // Clear the DOM input
    if (textareaRef.current) {
      textareaRef.current.value = '';
    }
  };

  // Optimize the onChange handler to just update DOM and debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    // No need to manually set textareaRef.current.value as it happens automatically
    debouncedSetPrompt(e.target.value);
  };

  // Update the keydown handler to use the centralized send function
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!loading && textareaRef.current?.value.trim()) {
        handleSendClick();
      }
    }
  }, [loading, handleSendClick]);

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Update the global keydown handler to use the same centralized send function
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();

        if (isRecording) {
          setEnterDuringRec(true);
          stopRecording();
          return;
        }

        const currentValue = textareaRef.current?.value || '';
        if (!loading && !transcribing && currentValue.trim()) {
          handleSendClick();
        }
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        textareaRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [loading, handleSendClick, isRecording, transcribing]);

  // Update the useEffect for sending after transcription
  useEffect(() => {
    if (enterDuringRec && !transcribing && !isRecording && !recordingMode) {
      if (!loading && textareaRef.current?.value.trim()) {
        handleSendClick();
      }
      setEnterDuringRec(false);
    }
  }, [enterDuringRec, transcribing, isRecording, recordingMode, loading, handleSendClick]);

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

      // Update the textarea directly
      if (textareaRef.current) {
        const currentValue = textareaRef.current.value;
        const newValue = currentValue + text.trim();
        textareaRef.current.value = newValue;

        // Also update the state
        debouncedSetPrompt(newValue);
      }
    } catch (e) { console.error(e); }
    finally {
      setTranscribing(false);
      setRecordingMode(false);
    }
  };

  // Function to render mode options in the popover
  const renderModeOptions = () => {
    const studentModes: AgentType[] = ['learn', 'review', 'homework'];
    const teacherModes: AgentType[] = ['content', 'analyze', 'grade'];

    // Get the appropriate role-specific modes
    const roleModes = activeChat.teacher ? teacherModes : studentModes;

    return (
      <Stack gap="xs">
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
              leftSection={<details.icon size={16} />}
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

  const currentModeDetails = getModeDetails(
    activeChat.agentType,
    activeChat.teacher
  )
  const ModeIcon = currentModeDetails.icon;
  const modeColor = currentModeDetails.color;
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
              <ActionIcon
                variant="transparent"
                color={modeColor}
                onMouseEnter={() => setModePopoverOpened(true)}
                onMouseLeave={() => setModePopoverOpened(false)}
                style={{
                  opacity: isInitializing ? 0.5 : 1,
                  pointerEvents: isInitializing ? 'none' : 'auto'
                }}
                size="lg"
                onClick={() => setModePopoverOpened(!modePopoverOpened)}
              >
                <ModeIcon size={28} />
              </ActionIcon>
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
                    // Change from controlled to uncontrolled component
                    defaultValue={activeChat.prompt}
                    onChange={handleInputChange}
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
                    {textareaRef.current?.value?.trim() ? (
                      <Tooltip label="Send Message (Enter)">
                        <ActionIcon
                          onClick={handleSendClick}
                          size="lg"
                          loading={loading}
                          disabled={loading}
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
