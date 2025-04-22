import React, { memo, useRef, useState, useEffect } from "react";
import { ChatMessage, Document, File, ViewerMode } from "@/types";
import { Textarea, Button, Group, Stack, Tooltip, ActionIcon, Box, Text, Progress, useMantineTheme, ScrollArea, Skeleton } from "@mantine/core";
import { ContextBadges } from "./ContextBadges";
import { IconSend, IconMicrophone, IconPlayerStop, IconPlus, IconPlayerPlay, IconPlayerSkipForward, IconPlayerSkipBack, IconVideo, IconX, IconBook, IconFile, IconPencil, IconPresentation, IconTrash, IconMessage, IconChartInfographic, IconReportAnalytics, IconQuestionMark } from "@tabler/icons-react";
import classes from './ChatInput.module.css';
import WaveSurfer from "wavesurfer.js";
import RecordPlugin from 'wavesurfer.js/dist/plugins/record.esm.js';
import Image from "next/image";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { getClass } from "@/utils/queries/get-class";
import { getUser } from "@/utils/queries/get-user";
import { getProfile } from "@/utils/queries/get-profile";
import * as tus from 'tus-js-client';
import { RecordedVideo } from "./ChatCanvas";
import { useMediaQuery } from "@mantine/hooks";
import { getFiles } from "@/utils/queries/get-files";
import { getFileDocuments } from "@/utils/queries/get-file-docs";

interface ChatInputProps {
  activeChat: ChatMessage;
  loading: boolean;
  isInitializing?: boolean;
  chatId: string;
  classId: string;
  onSend: () => void;
  onRemoveFile: (fileId: string) => void;
  onRemoveDocument: (documentId: string) => void;
  setViewerMode?: React.Dispatch<React.SetStateAction<ViewerMode>>
  setActiveChat: React.Dispatch<React.SetStateAction<ChatMessage>>
}

export const ChatInput = memo(({
  activeChat,
  loading,
  chatId,
  classId,
  onSend,
  onRemoveFile,
  onRemoveDocument,
  setViewerMode,
  setActiveChat,
  isInitializing = false
}: ChatInputProps) => {
  const supabase = useSupabaseBrowser();

  const isMobile = useMediaQuery('(max-width: 768px)');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingMode, setRecordingMode] = useState(false);

  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const recordPluginRef = useRef<any>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

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


  // Add state to track if Enter was pressed during recording
  const [enterPressedDuringRecording, setEnterPressedDuringRecording] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!loading && activeChat.prompt.trim()) {
        onSend();
      }
    }
  };

  const initWaveSurfer = async () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
      wavesurferRef.current = null;
      recordPluginRef.current = null;
    }

    if (!waveformRef.current) return;

    console.log("Initializing WaveSurfer");

    // Create wavesurfer instance
    wavesurferRef.current = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: "#34374B",
      progressColor: "#F90",
      height: 60,
      barWidth: 3,
      barGap: 1,
      barRadius: 3,
      normalize: true,
    });

    // Initialize record plugin
    recordPluginRef.current = wavesurferRef.current.registerPlugin(
      RecordPlugin.create({
        renderRecordedAudio: false,
        scrollingWaveform: false,
        continuousWaveform: true,
      })
    );

    // Set up record progress event
    recordPluginRef.current.on('record-progress', (time: number) => {
      console.log("Recording progress:", time);
      setRecordingTime(Math.floor(time / 1000)); // Convert ms to seconds
    });

    // Modify the record-end event handler in initWaveSurfer
    recordPluginRef.current.on('record-end', (blob: Blob) => {
      console.log("Recording ended, got blob:", blob);
      // Return early if the recording was stopped by the user
      handleTranscribe(blob);
    });

    // Return a promise that resolves when wavesurfer is ready
    return new Promise<void>(resolve => {
      wavesurferRef.current?.on('ready', () => {
        console.log("WaveSurfer is ready");
        resolve();
      });
      // Also resolve after a timeout in case 'ready' doesn't fire
      setTimeout(() => {
        console.log("WaveSurfer ready timeout reached");
        resolve();
      }, 500);
    });
  };


  const startRecording = async () => {
    try {
      console.log("Starting recording...");
      // Always reinitialize WaveSurfer before recording
      await initWaveSurfer();

      if (!recordPluginRef.current) {
        console.error('Record plugin not initialized');
        setRecordingMode(false);
        return;
      }

      await recordPluginRef.current.startRecording();
      console.log("Recording started successfully");
      setIsRecording(true);
      setRecordingMode(true);



    } catch (error) {
      console.error('Error starting recording:', error);
      setRecordingMode(false);
    }
  };

  const stopRecording = async () => {
    console.log("Stopping recording...");

    // Stop audio recording
    if (recordPluginRef.current && recordPluginRef.current.isRecording()) {
      recordPluginRef.current.stopRecording();
    }


    setIsRecording(false);
  };


  const handleToggleRecording = async () => {
    console.log("Toggle recording, current state:", isRecording);
    if (isRecording) {
      await stopRecording();
    } else {
      setRecordingTime(0);
      setRecordingMode(true); // Set recording mode immediately
      setTimeout(async () => {
        await startRecording();
      }, 50);
    }
  };

  const handleTranscribe = async (blob: Blob) => {
    setTranscribing(true);

    try {
      // only transcribe lecture if it is not a plain video
      const formData = new FormData();
      formData.append('audio_file', blob, 'recording.webm');
      formData.append('task', 'transcribe');

      // Make sure this URL matches your server endpoint
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/parse/audio`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Failed to transcribe audio: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log("Transcription result:", result);
      setActiveChat(prev => ({ ...prev, prompt: prev.prompt + result.text }));
      setRecordingMode(false);
    } catch (error) {
      console.error('Error transcribing audio:', error);
      alert(`Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setRecordingMode(false);
    } finally {
      setTranscribing(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const renderLeftChatIcons = () => {
    const newChat = chatId === "new"

    if (isInitializing) {
      return (
        <>
          <Skeleton height={36} width={100} radius="xl" />
          <Skeleton height={36} width={100} radius="xl" />
          <Skeleton height={36} width={100} radius="xl" />
        </>
      );
    }

    return (
      <>
        {newChat && !activeChat.teacher && (isMobile ?
          <Tooltip label="Learn">
            <ActionIcon
              onClick={() => setActiveChat((prev) => ({
                ...prev,
                chatType: prev.chatType === 'learn' ? 'student' : 'learn'
              }))}
              size="lg"
              color={"green"}
              variant={activeChat.chatType === 'learn' ? "light" : "subtle"}
              style={{
                border: `1px solid ${activeChat.chatType === 'learn' ? 'var(--mantine-color-green-filled)' : 'var(--mantine-color-green-outline)'}`
              }}
            >
              <IconBook size={20} />
            </ActionIcon>
          </Tooltip> : <Button
            color={"green"}
            variant={activeChat.chatType === 'learn' ? "light" : "subtle"}
            size="sm"
            leftSection={<IconBook size={16} />}
            radius="xl"
            onClick={() => setActiveChat((prev) => ({
              ...prev,
              chatType: prev.chatType === 'learn' ? 'student' : 'learn'
            }))}
            style={{
              border: `1px solid ${activeChat.chatType === 'learn' ? 'var(--mantine-color-green-filled)' : 'var(--mantine-color-green-outline)'}`
            }}
          >Learn</Button>)
        }

        {/* TODO: check that we have at least one homework file, a file with .content_type = homework */}

        {
          newChat && files && files.some(file => file.content_type === 'homework') && !activeChat.teacher && (isMobile ?
            <Tooltip label="Homework">
              <ActionIcon
                onClick={() => setActiveChat((prev) => ({
                  ...prev,
                  chatType: prev.chatType === 'homework' ? 'student' : 'homework'
                }))}
                size="lg"
                color={"indigo"}
                variant={activeChat.chatType === 'homework' ? "light" : "subtle"}
                style={{
                  border: `1px solid ${activeChat.chatType === 'homework' ? 'var(--mantine-color-indigo-filled)' : 'var(--mantine-color-indigo-outline)'}`
                }}
              >
                <IconFile size={20} />
              </ActionIcon>
            </Tooltip> : <Button
              color={"indigo"}
              variant={activeChat.chatType === 'homework' ? "light" : "subtle"}
              size="sm"
              leftSection={<IconFile size={16} />}
              radius="xl"
              onClick={() => setActiveChat((prev) => ({
                ...prev,
                chatType: prev.chatType === 'homework' ? 'student' : 'homework'
              }))}
              style={{
                border: `1px solid ${activeChat.chatType === 'homework' ? 'var(--mantine-color-indigo-filled)' : 'var(--mantine-color-indigo-outline)'}`
              }}
            >Homework</Button>)
        }

        {
          newChat && !activeChat.teacher && (isMobile ?
            <Tooltip label="Test-Prep">
              <ActionIcon
                onClick={() => setActiveChat((prev) => ({
                  ...prev,
                  chatType: prev.chatType === 'test' ? 'student' : 'test'
                }))}
                size="lg"
                color={"cyan"}
                variant={activeChat.chatType === 'test' ? "light" : "subtle"}
                style={{
                  border: `1px solid ${activeChat.chatType === 'test' ? 'var(--mantine-color-cyan-filled)' : 'var(--mantine-color-cyan-outline)'}`
                }}
              >
                <IconPencil size={20} />
              </ActionIcon>
            </Tooltip> : <Button
              color={"cyan"}
              variant={activeChat.chatType === 'test' ? "light" : "subtle"}
              size="sm"
              leftSection={<IconPencil size={16} />}
              radius="xl"
              onClick={() => setActiveChat((prev) => ({
                ...prev,
                chatType: prev.chatType === 'test' ? 'student' : 'test'
              }))}
              style={{
                border: `1px solid ${activeChat.chatType === 'test' ? 'var(--mantine-color-cyan-filled)' : 'var(--mantine-color-cyan-outline)'}`
              }}
            >Test-Prep</Button>)
        }

        {
          newChat && activeChat.teacher && (isMobile ?
            <Tooltip label="Figure">
              <ActionIcon
                onClick={() => setActiveChat((prev) => ({
                  ...prev,
                  chatType: prev.chatType === 'figure' ? 'professor' : 'figure'
                }))}
                size="lg"
                color={"grape"}
                variant={activeChat.chatType === 'figure' ? "light" : "subtle"}
                style={{
                  border: `1px solid ${activeChat.chatType === 'figure' ? 'var(--mantine-color-grape-filled)' : 'var(--mantine-color-grape-outline)'}`
                }}
              >
                <IconChartInfographic size={20} />
              </ActionIcon>
            </Tooltip> : <Button
              color={"grape"}
              variant={activeChat.chatType === 'figure' ? "light" : "subtle"}
              size="sm"
              leftSection={<IconChartInfographic size={16} />}
              radius="xl"
              onClick={() => setActiveChat((prev) => ({
                ...prev,
                chatType: prev.chatType === 'figure' ? 'professor' : 'figure'
              }))}
              style={{
                border: `1px solid ${activeChat.chatType === 'figure' ? 'var(--mantine-color-grape-filled)' : 'var(--mantine-color-grape-outline)'}`
              }}
            >Figure</Button>)
        }

        {
          newChat && activeChat.teacher && (isMobile ?
            <Tooltip label="Summary">
              <ActionIcon
                onClick={() => setActiveChat((prev) => ({
                  ...prev,
                  chatType: prev.chatType === 'summary' ? 'professor' : 'summary'
                }))}
                size="lg"
                color={"yellow"}
                variant={activeChat.chatType === 'summary' ? "light" : "subtle"}
                style={{
                  border: `1px solid ${activeChat.chatType === 'summary' ? 'var(--mantine-color-yellow-filled)' : 'var(--mantine-color-yellow-outline)'}`
                }}
              >
                <IconReportAnalytics size={20} />
              </ActionIcon>
            </Tooltip> : <Button
              color={"yellow"}
              variant={activeChat.chatType === 'summary' ? "light" : "subtle"}
              size="sm"
              leftSection={<IconReportAnalytics size={16} />}
              radius="xl"
              onClick={() => setActiveChat((prev) => ({
                ...prev,
                chatType: prev.chatType === 'summary' ? 'professor' : 'summary'
              }))}
              style={{
                border: `1px solid ${activeChat.chatType === 'summary' ? 'var(--mantine-color-yellow-filled)' : 'var(--mantine-color-yellow-outline)'}`
              }}
            >Summary</Button>)
        }

        {
          newChat && activeChat.teacher && (isMobile ?
            <Tooltip label="Question">
              <ActionIcon
                onClick={() => setActiveChat((prev) => ({
                  ...prev,
                  chatType: prev.chatType === 'question' ? 'professor' : 'question'
                }))}
                size="lg"
                color={"blue"}
                variant={activeChat.chatType === 'question' ? "light" : "subtle"}
                style={{
                  border: `1px solid ${activeChat.chatType === 'question' ? 'var(--mantine-color-blue-filled)' : 'var(--mantine-color-blue-outline)'}`
                }}
              >
                <IconQuestionMark size={20} />
              </ActionIcon>
            </Tooltip> : <Button
              color={"blue"}
              variant={activeChat.chatType === 'question' ? "light" : "subtle"}
              size="sm"
              leftSection={<IconQuestionMark size={16} />}
              radius="xl"
              onClick={() => setActiveChat((prev) => ({
                ...prev,
                chatType: prev.chatType === 'question' ? 'professor' : 'question'
              }))}
              style={{
                border: `1px solid ${activeChat.chatType === 'question' ? 'var(--mantine-color-blue-filled)' : 'var(--mantine-color-blue-outline)'}`
              }}
            >Question</Button>)
        }

        {
          newChat && (isMobile ?
            <Tooltip label="Grade">
              <ActionIcon
                onClick={() => setActiveChat((prev) => ({
                  ...prev,
                  chatType: prev.chatType === 'grade' ? (activeChat.teacher ? 'professor' : 'student') : 'grade'
                }))}
                size="lg"
                color={"orange"}
                variant={activeChat.chatType === 'grade' ? "light" : "subtle"}
                style={{
                  border: `1px solid ${activeChat.chatType === 'grade' ? 'var(--mantine-color-orange-filled)' : 'var(--mantine-color-orange-outline)'}`
                }}
              >
                <IconPresentation size={20} />
              </ActionIcon>
            </Tooltip> : <Button
              color={"orange"}
              variant={activeChat.chatType === 'grade' ? "light" : "subtle"}
              size="sm"
              leftSection={<IconPresentation size={16} />}
              radius="xl"
              onClick={() => setActiveChat((prev) => ({
                ...prev,
                chatType: prev.chatType === 'grade' ? (activeChat.teacher ? 'professor' : 'student') : 'grade'
              }))}
              style={{
                border: `1px solid ${activeChat.chatType === 'grade' ? 'var(--mantine-color-orange-filled)' : 'var(--mantine-color-orange-outline)'}`
              }}
            >Grade</Button>)
        }
      </>
    )
  }

  const renderRightChatIcons = () => {
    if (isInitializing) {
      return (
        <>
          <Skeleton height={36} width={36} radius="md" />
          <Skeleton height={36} width={36} radius="md" />
        </>
      );
    }

    return (
      <>
        <Tooltip label={isRecording ? "Stop Audio" : "Start Audio"}>
          <ActionIcon
            onClick={() => handleToggleRecording()}
            size="lg"
            color={isRecording ? "red" : "blue"}
            variant="subtle"
          >
            {isRecording ? <IconPlayerStop size={20} /> : <IconMicrophone size={20} />}
          </ActionIcon>
        </Tooltip>

        <Tooltip label="Send">
          <ActionIcon
            onClick={onSend}
            size="lg"
            loading={loading}
            disabled={!activeChat.prompt.trim()}
            variant="transparent"
            color="blue"
            style={{
              border: 'none',
              background: 'transparent',
              opacity: (!activeChat.prompt.trim()) ? 0.5 : 1
            }}
            classNames={{
              root: classes.sendButton
            }}
          >
            <IconSend size={20} />
          </ActionIcon>
        </Tooltip>
      </>
    )
  }
  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
      }
    };
  }, []);

  // Modify the useEffect to ensure WaveSurfer is initialized properly
  useEffect(() => {
    // Initialize wavesurfer when the component mounts and waveformRef is available
    if (waveformRef.current) {
      initWaveSurfer();
    }

    return () => {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
      }
    };
  }, []);

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
          setEnterPressedDuringRecording(true);
          stopRecording();
          return;
        }

        // Send message if there's content and not loading or transcribing
        if (!loading && !transcribing && (activeChat.prompt.trim())) {
          onSend();
        }
        return;
      }

      // Check if the key is a single character and not a modifier key (optional)
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
    if (enterPressedDuringRecording && !transcribing && !isRecording && !recordingMode) {
      if (!loading && (activeChat.prompt.trim())) {
        onSend();
      }
      setEnterPressedDuringRecording(false);
    }
  }, [enterPressedDuringRecording, transcribing, isRecording, recordingMode, loading, activeChat.prompt, onSend]);

  return (
    <Stack gap={"md"}>
      {!isRecording && <Box
        style={{
          position: 'absolute',
          left: '25px',
          right: '25px',
          zIndex: 10,
          transform: 'translateY(-100%)',
          pointerEvents: 'auto'
        }}
      >
        <ContextBadges
          activeChat={activeChat}
          classId={classId}
          onRemoveFile={onRemoveFile}
          onRemoveDocument={onRemoveDocument}
          setViewerMode={setViewerMode}
        />
      </Box>}


      <Box className={classes.inputBox}>
        {isInitializing ? (
          <Box p={"xs"}>
            <Skeleton height={60} />
          </Box>
        ) : !recordingMode ? (
          <Textarea
            ref={textareaRef}
            value={activeChat.prompt}
            onChange={(e) => setActiveChat(prev => ({ ...prev, prompt: e.target.value }))}
            onKeyDown={handleKeyDown}
            placeholder={activeChat.teacher ? "Add context and start creating..." : "Add context and start learning..."}
            autosize
            minRows={1}
            maxRows={4}
            size={"md"}
            classNames={{
              root: classes.textarea,
              input: classes.textareaInput,
              wrapper: classes.textareaWrapper
            }}
            disabled={isInitializing}
          />
        ) : (
          <Box
            style={{
              padding: '16px',
              minHeight: '80px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {isRecording ? (
              <>
                <Text size="lg" fw={500}>Recording... {formatTime(recordingTime)}</Text>
                <div ref={waveformRef} style={{ width: '100%', height: '60px' }} />
              </>
            ) : transcribing ? (
              <Text size="lg" fw={500}>Transcribing...</Text>
            ) : (
              <>
                <Text size="lg" fw={500}>Initializing...</Text>
                <div ref={waveformRef} style={{ width: '100%', height: '60px' }} />
              </>
            )}
          </Box>
        )}

        {/* Controls */}
        {!recordingMode && (
          <Box className={classes.controlsBackground}>
            {isMobile ? (
              <>
                <Group gap={4}>
                  {/* {renderFileUpload()} */}
                  {renderLeftChatIcons()}
                </Group>
                <Group gap={4}>
                  {renderRightChatIcons()}
                </Group>
              </>
            ) : (
              <>
                <Group gap={"xs"}>
                  {/* {renderFileUpload()} */}
                  {renderLeftChatIcons()}
                </Group>
                <Group gap={8}>
                  {renderRightChatIcons()}
                </Group>
              </>
            )}
          </Box>
        )}

        {/* Recording mode controls */}
        {recordingMode && (
          <Group gap={8} style={{
            position: 'absolute',
            right: '8px',
            bottom: '8px',
            zIndex: 10
          }}>
            <Tooltip label="Stop Recording">
              <ActionIcon
                onClick={() => handleToggleRecording()}
                size="lg"
                color="green"
                loading={transcribing}
                variant="subtle"
              >
                <IconPlayerStop size={20} />
              </ActionIcon>
            </Tooltip>
          </Group>
        )}
      </Box>
    </Stack>
  );
});

ChatInput.displayName = 'ChatInput';
