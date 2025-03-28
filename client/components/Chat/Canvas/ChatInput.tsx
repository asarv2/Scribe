import { ChatMessage, ViewerMode } from "@/types";
import { Textarea, Button, Group, Stack, Tooltip, ActionIcon, Box, Text, Progress, useMantineTheme, ScrollArea } from "@mantine/core";
import { ContextBadges } from "./ContextBadges";
import { memo, useRef, useState, useEffect } from "react";
import { IconSend, IconMicrophone, IconPlayerStop, IconPlus, IconPlayerPlay, IconPlayerSkipForward, IconPlayerSkipBack, IconVideo, IconX, IconBook, IconFile, IconPencil, IconPresentation } from "@tabler/icons-react";
import classes from './ChatInput.module.css';
import WaveSurfer from "wavesurfer.js";
import RecordPlugin from 'wavesurfer.js/dist/plugins/record.esm.js';
import Image from "next/image";
import { notifications } from "@mantine/notifications";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { getClass } from "@/utils/queries/get-class";
import { getUser } from "@/utils/queries/get-user";
import { getProfile } from "@/utils/queries/get-profile";

interface ChatInputProps {
  activeChat: ChatMessage;
  loading: boolean;
  classId: string;
  onSend: () => void;
  onRemoveContext: (contextType: keyof ChatMessage['context'], contextId: string) => void;
  onScrollToSection: (sectionId: string) => void;
  viewerMode: ViewerMode;
  setViewerMode?: React.Dispatch<React.SetStateAction<ViewerMode>>
  setActiveChat: React.Dispatch<React.SetStateAction<ChatMessage>>
  expandedSections: Set<string>;
  toggleSection: (section: string) => void;
  toggleImmersive: () => void;
  recordedVideos: { id: string, url: string }[];
  setRecordedVideos: React.Dispatch<React.SetStateAction<{ id: string, url: string }[]>>;
  addFile: (file: File) => void;
}

export const ChatInput = memo(({
  activeChat,
  loading,
  classId,
  onSend,
  onRemoveContext,
  onScrollToSection,
  viewerMode,
  setViewerMode,
  expandedSections,
  toggleSection,
  setActiveChat,
  addFile,
  recordedVideos,
  setRecordedVideos,
}: ChatInputProps) => {
  const supabase = useSupabaseBrowser();
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingMode, setRecordingMode] = useState(false);
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const recordPluginRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: user } = useQuery({
    queryKey: ["user"],
    queryFn: () => getUser(supabase)
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => getProfile(supabase, user!.id),
    enabled: !!user?.id
  });

  const { data: classData, isLoading: classDataLoading } = useQuery({
    queryKey: ["class", classId],
    queryFn: () => getClass(supabase, classId)
  });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!loading && (activeChat.prompt.trim() || recordedVideos.length > 0)) {
        onSend();
      }
    }
  };

  const handleFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!profile?.id) return;

    const files = e.target.files;
    if (files && files.length > 0) {
      for (const file of files) {
        try {
          // Show loading notification
          notifications.show({
            id: 'file-upload',
            title: 'Uploading file',
            message: 'Please wait while your file is being processed...',
            loading: true,
            autoClose: false
          });

          await addFile(file);

          queryClient.refetchQueries({
            queryKey: ["files", profile.id, classId]
          });

          queryClient.refetchQueries({
            queryKey: ["fileDocuments", classId]
          });

          // Update notification on success
          notifications.update({
            id: 'file-upload',
            title: 'File uploaded',
            message: `${file.name} has been added to the chat context`,
            color: 'green',
            loading: false,
            autoClose: 3000
          });
        } catch (error) {
          console.error('Error uploading file:', error);
          // Update notification on error
          notifications.update({
            id: 'file-upload',
            title: 'Upload failed',
            message: 'There was an error uploading your file. Please try again.',
            color: 'red',
            loading: false,
            autoClose: 3000
          });
        }
      }
    }

    // Reset the input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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

    // Set up record-end event
    recordPluginRef.current.on('record-end', (blob: Blob) => {
      console.log("Recording ended, got blob:", blob);
      setAudioBlob(blob);
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

  const initVideoStream = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true
    });
    setVideoStream(stream);
  }

  const startRecording = async (withVideo: boolean = false) => {
    try {
      console.log("Starting recording...", withVideo ? "with video" : "audio only");

      if (withVideo) {
        // Initialize the video stream first
        await initVideoStream();
      }

      // Get media stream based on recording type
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: withVideo ? {
          width: { ideal: 320 },
          height: { ideal: 240 },
          facingMode: "user"
        } : false
      });

      if (withVideo) {
        // Set the video stream first
        setVideoStream(stream);

        // Make sure video element exists and is ready
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Explicitly play with a catch to handle any autoplay issues
          videoRef.current.play().catch(e => {
            console.error("Error playing video:", e);
            // Try again with user interaction flag
            videoRef.current?.setAttribute('autoplay', '');
            videoRef.current?.setAttribute('playsinline', '');
          });
        }

        // Initialize video recording
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        videoChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            videoChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          const videoBlob = new Blob(videoChunksRef.current, { type: 'video/webm' });
          if (videoRef.current) {
            videoRef.current.srcObject = null;
            videoRef.current.src = URL.createObjectURL(videoBlob);
          }

          // Add the new video to our collection
          const videoUrl = URL.createObjectURL(videoBlob);
          setRecordedVideos(prev => [...prev, {
            id: `video-${Date.now()}`,
            url: videoUrl
          }]);

          setRecordingMode(false);  // Exit recording mode directly for video
        };

        mediaRecorder.start();
      }

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
      if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        setVideoStream(null);
      }
    }
  };

  const stopRecording = async () => {
    console.log("Stopping recording...");

    // Stop video recording if active
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    // Stop audio recording
    if (recordPluginRef.current && recordPluginRef.current.isRecording()) {
      recordPluginRef.current.stopRecording();
    }

    // Make sure to stop all tracks in the video stream and clear the reference
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
      setVideoStream(null);
    }

    setIsRecording(false);
  };

  const handleToggleRecording = async (withVideo: boolean = false) => {
    console.log("Toggle recording, current state:", isRecording);
    if (isRecording) {
      await stopRecording();
    } else {
      setRecordingTime(0);
      setRecordingMode(true); // Set recording mode immediately
      setTimeout(async () => {
        await startRecording(withVideo);
      }, 50);
    }
  };

  const handleTranscribe = async (blob: Blob) => {
    // Skip transcription if we're in video mode
    if (videoStream) {
      setTranscribing(false);
      return;
    }

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

  const handleRemoveVideo = (videoId?: string) => {
    if (videoId) {
      // Remove a specific video from the collection
      setRecordedVideos(prev => prev.filter(video => video.id !== videoId));
    } else if (videoRef.current) {
      // Clear the current recording preview
      videoRef.current.src = '';
    }

    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
      setVideoStream(null);
    }
  };

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

      <Box className={classes.inputContainer}>
        {(videoStream || (videoRef.current && (videoRef.current.srcObject || (videoRef.current.src && videoRef.current.src !== '')) || recordedVideos.length > 0)) && (
          <Box
            style={{
              position: 'absolute',
              top: '-160px',
              left: '8px',
              right: '8px',
              height: '150px',
              zIndex: 100
            }}
          >
            <ScrollArea scrollbarSize={6} type="auto" offsetScrollbars style={{ height: '100%' }}>
              <Group gap="sm" style={{ height: '100%' }}>
                {/* Current recording preview */}
                {(videoStream || (videoRef.current && ((videoRef.current.srcObject || (videoRef.current.src && videoRef.current.src !== '')) && isRecording))) && (
                  <Box
                    style={{
                      position: 'relative',
                      width: '240px',
                      height: '150px',
                      borderRadius: '4px',
                      overflow: 'hidden',
                      backgroundColor: '#f0f0f0',
                      border: '1px solid #ddd',
                      flexShrink: 0
                    }}
                  >
                    <video
                      ref={videoRef}
                      autoPlay
                      muted={isRecording}
                      playsInline
                      controls={!isRecording}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                    />
                    {!isRecording && (
                      <ActionIcon
                        onClick={() => handleRemoveVideo()}
                        style={{
                          position: 'absolute',
                          top: '4px',
                          right: '4px',
                          background: 'rgba(0,0,0,0.5)',
                          borderRadius: '50%'
                        }}
                        size="xs"
                        color="white"
                      >
                        <IconX size={14} />
                      </ActionIcon>
                    )}
                  </Box>
                )}

                {/* Past recordings */}
                {recordedVideos.map(video => (
                  <Box
                    key={video.id}
                    style={{
                      position: 'relative',
                      width: '240px',
                      height: '150px',
                      borderRadius: '4px',
                      overflow: 'hidden',
                      backgroundColor: '#f0f0f0',
                      border: '1px solid #ddd',
                      flexShrink: 0
                    }}
                  >
                    <video
                      src={video.url}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                      controls
                      playsInline
                    />
                    <ActionIcon
                      onClick={() => handleRemoveVideo(video.id)}
                      style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        background: 'rgba(0,0,0,0.5)',
                        borderRadius: '50%'
                      }}
                      size="xs"
                      color="white"
                    >
                      <IconX size={14} />
                    </ActionIcon>
                  </Box>
                )
                )}
              </Group>
            </ScrollArea>
          </Box>
        )}

        <Box className={classes.inputBox}>
          {!recordingMode ? (
            <Textarea
              ref={textareaRef}
              value={activeChat.prompt}
              onChange={(e) => setActiveChat(prev => ({ ...prev, prompt: e.target.value }))}
              onKeyDown={handleKeyDown}
              placeholder={viewerMode.immersive ? "" : "Type your message here..."}
              autosize
              minRows={1}
              maxRows={4}
              size={"md"}
              classNames={{
                root: classes.textarea,
                input: classes.textareaInput,
                wrapper: classes.textareaWrapper
              }}
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
              ) : transcribing && !videoStream ? (
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
              {/* Left side icons */}
              <Group gap={"xs"}>
                <Tooltip label="Add files">
                  <ActionIcon size="lg" variant="subtle" onClick={handleFileUpload}>
                    <IconPlus size={20} />
                  </ActionIcon>
                </Tooltip>
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                  accept="image/*,application/pdf,audio/*,video/*"
                />
                {classData?.learn_mode_enabled && <Button color={"green"} variant={activeChat.chatType === 'concept' ? "outline" : "subtle"} size="sm" leftSection={<IconBook size={16} />} radius="xl" onClick={() => setActiveChat((prev) => ({
                  ...prev,
                  chatType: prev.chatType === 'concept' ? 'general-student' : 'concept'
                }))}>Learn</Button>}
                {classData?.homework_mode_enabled && <Button color={"indigo"} variant={activeChat.chatType === 'homework-student' ? "outline" : "subtle"} size="sm" leftSection={<IconFile size={16} />} radius="xl" onClick={() => setActiveChat((prev) => ({
                  ...prev,
                  chatType: prev.chatType === 'homework-student' ? 'general-student' : 'homework-student'
                }))}>Homework</Button>}
                {classData?.test_prep_mode_enabled && <Button color={"cyan"} variant={activeChat.chatType === 'review' ? "outline" : "subtle"} size="sm" leftSection={<IconPencil size={16} />} radius="xl" onClick={() => setActiveChat((prev) => ({
                  ...prev,
                  chatType: prev.chatType === 'review' ? 'general-student' : 'review'
                }))}>Test-Prep</Button>}
                {classData?.present_mode_enabled && <Button color={"orange"} variant={activeChat.chatType === 'present' ? "outline" : "subtle"} size="sm" leftSection={<IconPresentation size={16} />} radius="xl" onClick={() => setActiveChat((prev) => ({
                  ...prev,
                  chatType: prev.chatType === 'present' ? 'general-student' : 'present'
                }))}>Present</Button>}
              </Group>

              {/* Right side icons */}
              <Group gap={8}>
                <Tooltip label={isRecording ? "Stop Video" : "Start Video"}>
                  <ActionIcon
                    onClick={() => handleToggleRecording(true)}
                    size="lg"
                    color={isRecording && videoStream ? "red" : "blue"}
                    variant="subtle"
                  >
                    <IconVideo size={20} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label={isRecording ? "Stop Audio" : "Start Audio"}>
                  <ActionIcon
                    onClick={() => handleToggleRecording(false)}
                    size="lg"
                    color={isRecording && !videoStream ? "red" : "blue"}
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
                    disabled={!activeChat.prompt.trim() && recordedVideos.length === 0}
                    variant="subtle"
                    color="blue"
                  >
                    <IconSend size={20} />
                  </ActionIcon>
                </Tooltip>
              </Group>
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
                  onClick={() => handleToggleRecording(!!videoStream)}
                  size="lg"
                  color="red"
                  loading={transcribing}
                  variant="subtle"
                >
                  <IconPlayerStop size={20} />
                </ActionIcon>
              </Tooltip>
            </Group>
          )}
        </Box>
      </Box>
    </Stack>
  );
});

ChatInput.displayName = 'ChatInput';
