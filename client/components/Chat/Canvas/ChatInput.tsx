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
import * as tus from 'tus-js-client';
import { RecordedVideo } from "./ChatCanvas";
import { useMediaQuery } from "@mantine/hooks";

interface ChatInputProps {
  activeChat: ChatMessage;
  loading: boolean;
  chatId: string;
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
  recordedVideos: RecordedVideo[];
  setRecordedVideos: React.Dispatch<React.SetStateAction<RecordedVideo[]>>;
}

export const ChatInput = memo(({
  activeChat,
  loading,
  chatId,
  classId,
  onSend,
  onRemoveContext,
  onScrollToSection,
  viewerMode,
  setViewerMode,
  expandedSections,
  toggleSection,
  setActiveChat,
  recordedVideos,
  setRecordedVideos,
}: ChatInputProps) => {
  const supabase = useSupabaseBrowser();
  const queryClient = useQueryClient();

  const isMobile = useMediaQuery('(max-width: 768px)');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingMode, setRecordingMode] = useState(false);

  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const recordPluginRef = useRef<any>(null);

  const waveformVideoRef = useRef<HTMLDivElement>(null);
  const waveSurferVideoRef = useRef<WaveSurfer | null>(null);
  const videoPluginRef = useRef<any>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadRef = useRef<tus.Upload | null>(null);

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

  // Add state to track if Enter was pressed during recording
  const [enterPressedDuringRecording, setEnterPressedDuringRecording] = useState(false);

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
          const notificationId = 'file-upload-' + Date.now();
          notifications.show({
            id: notificationId,
            title: 'Uploading file',
            message: `Preparing ${file.name}...`,
            loading: true,
            autoClose: false
          });

          // Create a unique file identifier based on file properties
          const fileFingerprint = `${file.name}-${file.size}-${file.lastModified}`;
          // Use the fingerprint as the fileId for consistency
          const fileId = fileFingerprint;

          // Get the base URL from environment
          const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? '';

          // Create a tus upload with better options
          const upload = new tus.Upload(file, {
            endpoint: `${baseUrl}/upload/tus`,
            retryDelays: [0, 1000, 3000, 5000, 10000], // More retries with increasing delays
            chunkSize: 5 * 1024 * 1024, // 5MB chunks
            metadata: {
              filename: file.name,
              filetype: file.type,
              filesize: file.size.toString(),
              classId: classId,
              profileId: profile.id,
              fileId: fileId,
              responseUrl: `${baseUrl}`,
              startParse: 'true',
              baseUrl: baseUrl,
              fingerprint: fileFingerprint // Add fingerprint for better resumability
            },
            // Use a fingerprint function to identify uploads
            fingerprint: () => Promise.resolve(fileFingerprint),
            // Show more detailed progress
            onProgress: (bytesUploaded, bytesTotal) => {
              const percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(0);
              const uploadedMB = (bytesUploaded / (1024 * 1024)).toFixed(1);
              const totalMB = (bytesTotal / (1024 * 1024)).toFixed(1);
              notifications.update({
                id: notificationId,
                title: 'Uploading file',
                message: `${file.name}: ${percentage}% (${uploadedMB}MB / ${totalMB}MB)`,
                loading: true,
                autoClose: false
              });
            },
            // Better error handling
            onError: (error) => {
              console.error('Error uploading file:', error);

              // Check if it's a network error that might be temporary
              if (error.name === 'NetworkError' || error.message.includes('network')) {
                notifications.update({
                  id: notificationId,
                  title: 'Upload paused',
                  message: `Connection issue with ${file.name}. Will retry automatically when connection is restored.`,
                  color: 'yellow',
                  loading: true,
                  autoClose: false
                });
              } else {
                notifications.update({
                  id: notificationId,
                  title: 'Upload failed',
                  message: `Error uploading ${file.name}: ${error.message}. Try again later.`,
                  color: 'red',
                  loading: false,
                  autoClose: 5000
                });
              }
            },
            // Callback for success
            onSuccess: async () => {
              try {
                // Update notification to "Processing"
                notifications.update({
                  id: notificationId,
                  title: 'Processing file',
                  message: `${file.name} uploaded, now processing...`,
                  loading: true,
                  autoClose: false
                });

                // Explicitly call finalize endpoint
                const finalizeResponse = await fetch(`${baseUrl}/upload/tus/finalize`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    fileId: fileId
                  })
                });

                if (!finalizeResponse.ok) {
                  throw new Error(`Failed to process file: ${finalizeResponse.statusText}`);
                }

                const fileData = await finalizeResponse.json();

                // Refresh queries
                queryClient.refetchQueries({
                  queryKey: ["files", profile.id, classId]
                });

                queryClient.refetchQueries({
                  queryKey: ["fileDocuments", classId]
                });

                // Update notification on success
                notifications.update({
                  id: notificationId,
                  title: 'File uploaded',
                  message: `${file.name} has been added to the chat context`,
                  color: 'green',
                  loading: false,
                  autoClose: 3000
                });

                // Update chat context with the new file
                setActiveChat(prev => ({
                  ...prev,
                  context: {
                    ...prev.context,
                    files: [...prev.context.files, fileData.file_id]
                  }
                }));
              } catch (error) {
                console.error('Error finalizing file:', error);
                notifications.update({
                  id: notificationId,
                  title: 'Processing failed',
                  message: `Error processing ${file.name}`,
                  color: 'red',
                  loading: false,
                  autoClose: 5000
                });
              }
            }
          });

          // Check for previous uploads to resume
          const previousUploads = await upload.findPreviousUploads();
          if (previousUploads.length) {
            notifications.update({
              id: notificationId,
              title: 'Resuming upload',
              message: `Continuing previous upload of ${file.name}...`,
              loading: true,
              autoClose: false
            });

            // Resume the upload
            upload.resumeFromPreviousUpload(previousUploads[0]);
          }

          // Start the upload
          upload.start();

        } catch (error) {
          console.error('Error setting up file upload:', error);
          notifications.show({
            id: 'file-upload-error',
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

  const initWaveSurferVideo = async () => {
    if (waveSurferVideoRef.current) {
      waveSurferVideoRef.current.destroy();
      waveSurferVideoRef.current = null;
      videoPluginRef.current = null;
    }

    if (!waveformVideoRef.current) return;

    console.log("Initializing WaveSurfer");

    // Create wavesurfer instance
    waveSurferVideoRef.current = WaveSurfer.create({
      container: waveformVideoRef.current,
      waveColor: "#34374B",
      progressColor: "#F90",
      height: 60,
      barWidth: 3,
      barGap: 1,
      barRadius: 3,
      normalize: true,
    });

    // Initialize record plugin
    videoPluginRef.current = waveSurferVideoRef.current.registerPlugin(
      RecordPlugin.create({
        renderRecordedAudio: false,
        scrollingWaveform: false,
        continuousWaveform: true,
      })
    );

    // Set up record progress event
    videoPluginRef.current.on('record-progress', (time: number) => {
      console.log("Recording progress:", time);
      setRecordingTime(Math.floor(time / 1000)); // Convert ms to seconds
    });

    // Return a promise that resolves when wavesurfer is ready
    return new Promise<void>(resolve => {
      waveSurferVideoRef.current?.on('ready', () => {
        console.log("WaveSurfer is ready");
        resolve();
      });
      // Also resolve after a timeout in case 'ready' doesn't fire
      setTimeout(() => {
        console.log("WaveSurfer ready timeout reached");
        resolve();
      }, 500);
    });
  }


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
        // Use a consistent ID format for videos
        const videoId = `video-${profile?.id}-${Date.now()}`;
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
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'video/webm;codecs=vp8,opus' // Explicitly set codec
        });
        mediaRecorderRef.current = mediaRecorder;
        videoChunksRef.current = [];

        // Create a ReadableStream from the MediaRecorder
        const readableStream = new ReadableStream({
          start(controller) {
            // When data is available, add it to the stream
            mediaRecorder.ondataavailable = (event) => {
              if (event.data.size > 0) {
                controller.enqueue(event.data);
                videoChunksRef.current.push(event.data);
              }
            };

            // When recording stops
            mediaRecorder.onstop = () => {
              controller.close();

              const videoBlob = new Blob(videoChunksRef.current, {
                type: 'video/webm'
              });

              // Debug the blob
              console.log("Video recording complete, blob size:", videoBlob.size, "bytes");

              if (videoRef.current) {
                videoRef.current.srcObject = null;
                videoRef.current.src = URL.createObjectURL(videoBlob);
              }

              // Add the new video to our collection
              const videoUrl = URL.createObjectURL(videoBlob);
              setRecordedVideos(prev => [...prev, {
                id: videoId,
                url: videoUrl,
                isLoading: true,
                fileId: undefined
              }]);

              setRecordingMode(false);
            };

            // Start recording
            mediaRecorder.start(1000); // Capture in 1-second chunks

            // Always reinitialize WaveSurfer before recording
            initWaveSurferVideo();

            if (!videoPluginRef.current) {
              console.error('Record plugin not initialized');
              setRecordingMode(false);
              return;
            }

            videoPluginRef.current.startRecording();
            console.log("Recording started successfully");
          },
          cancel() {
            mediaRecorder.stop();
          }
        });

        // Create a reader from the stream
        const reader = readableStream.getReader();

        // Get the base URL from environment
        const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? '';

        if (!profile) {
          console.error('Profile not found');
          return;
        }

        const upload = new tus.Upload(reader, {
          endpoint: `${baseUrl}/upload/tus`,
          retryDelays: [0, 1000, 3000, 5000],
          metadata: {
            filename: `${videoId}.webm`,
            filetype: 'video/webm',
            classId: classId,
            profileId: profile.id,
            fileId: videoId,
            baseUrl: baseUrl
          },
          // Required for streaming uploads
          uploadLengthDeferred: true,
          // Must set a chunk size for streaming
          chunkSize: 1024 * 1024, // 1MB chunks
          onError: (error) => {
            console.error('Error uploading stream:', error);
            stopRecording();
          },
          onProgress: (bytesUploaded) => {
            console.log(`Uploaded ${bytesUploaded} bytes`);
          },
          onSuccess: async () => {
            console.log('Stream upload complete');
            // Finalize the upload
            try {
              await finalizeUpload(videoId);
            } catch (error) {
              console.error('Error finalizing upload:', error);
            }
          }
        });

        // Start the upload
        upload.start();

        // Save the upload reference to stop it later
        uploadRef.current = upload;

        setIsRecording(true);
        setRecordingMode(true);
      } else {
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
      }



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

    // Stop audio recording
    if (recordPluginRef.current && recordPluginRef.current.isRecording()) {
      recordPluginRef.current.stopRecording();
    }

    if (videoPluginRef.current && videoPluginRef.current.isRecording()) {
      videoPluginRef.current.stopRecording();
    }

    // Stop video recording if active
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    // Make sure to stop all tracks in the video stream and clear the reference
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
      setVideoStream(null);
    }

    setIsRecording(false);
  };

  const finalizeUpload = async (videoId: string) => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? '';

      // Log before finalizing
      console.log(`Finalizing upload for video ${videoId}`);

      const finalizeResponse = await fetch(`${baseUrl}/upload/tus/finalize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fileId: videoId
        })
      });

      if (!finalizeResponse.ok) {
        const errorText = await finalizeResponse.text();
        console.error(`Finalize failed with status ${finalizeResponse.status}: ${errorText}`);
        throw new Error(`Failed to finalize upload: ${finalizeResponse.statusText}`);
      }

      const fileData = await finalizeResponse.json();
      console.log("Finalize response:", fileData);

      // Update the recorded video with the file ID and set loading to false
      setRecordedVideos(prev =>
        prev.map(video =>
          video.id === videoId
            ? { ...video, isLoading: false, fileId: fileData.file_id }
            : video
        )
      );

      // Refresh queries and update UI
      queryClient.refetchQueries({
        queryKey: ["files", profile?.id, classId]
      });

      // Update chat context with the new file
      setActiveChat(prev => ({
        ...prev,
        context: {
          ...prev.context,
          files: [...prev.context.files, fileData.file_id]
        }
      }));

      notifications.show({
        title: 'Recording Complete',
        message: 'Your video has been uploaded and added to the chat',
        color: 'green'
      });

    } catch (error) {
      console.error('Error finalizing upload:', error);
      notifications.show({
        title: 'Processing Failed',
        message: 'There was an error processing your recording',
        color: 'red'
      });
    }
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


  const renderFileUpload = () => {
    if (classData?.files_enabled) {
      return (
        <>
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
        </>
      )
    }
  }

  const renderLeftChatIcons = () => {
    const newChat = chatId === "new"
    return (
      <>
        {newChat && classData?.learn_mode_enabled && (isMobile ?
            <Tooltip label="Learn">
              <ActionIcon
                onClick={() => setActiveChat((prev) => ({
                  ...prev,
                  chatType: prev.chatType === 'concept' ? 'general-student' : 'concept'
                }))}
                size="lg"
                color={"green"}
                variant={activeChat.chatType === 'concept' ? "light" : "subtle"}
              >
                <IconBook size={20} />
              </ActionIcon>
            </Tooltip> : <Button color={"green"} variant={activeChat.chatType === 'concept' ? "light" : "subtle"} size="sm" leftSection={<IconBook size={16} />} radius="xl" onClick={() => setActiveChat((prev) => ({
              ...prev,
              chatType: prev.chatType === 'concept' ? 'general-student' : 'concept'
            }))}>Learn</Button>)
        }

        {
          newChat && classData?.homework_mode_enabled && (isMobile ?
            <Tooltip label="Homework">
              <ActionIcon
                onClick={() => setActiveChat((prev) => ({
                  ...prev,
                  chatType: prev.chatType === 'homework-student' ? 'general-student' : 'homework-student'
                }))}
                size="lg"
                color={"indigo"}
                variant={activeChat.chatType === 'homework-student' ? "light" : "subtle"}
              >
                <IconFile size={20} />
              </ActionIcon>
            </Tooltip> : <Button color={"indigo"} variant={activeChat.chatType === 'homework-student' ? "light" : "subtle"} size="sm" leftSection={<IconFile size={16} />} radius="xl" onClick={() => setActiveChat((prev) => ({
              ...prev,
              chatType: prev.chatType === 'homework-student' ? 'general-student' : 'homework-student'
            }))}>Homework</Button>)
        }

        {
          newChat && classData?.test_prep_mode_enabled && (isMobile ?
            <Tooltip label="Test-Prep">
              <ActionIcon
                onClick={() => setActiveChat((prev) => ({
                  ...prev,
                  chatType: prev.chatType === 'review' ? 'general-student' : 'review'
                }))}
                size="lg"
                color={"cyan"}
                variant={activeChat.chatType === 'review' ? "light" : "subtle"}
              >
                <IconPencil size={20} />
              </ActionIcon>
            </Tooltip> : <Button color={"cyan"} variant={activeChat.chatType === 'review' ? "light" : "subtle"} size="sm" leftSection={<IconPencil size={16} />} radius="xl" onClick={() => setActiveChat((prev) => ({
              ...prev,
              chatType: prev.chatType === 'review' ? 'general-student' : 'review'
            }))}>Test-Prep</Button>)
        }

        {/* {
          newChat && classData?.present_mode_enabled && (isMobile ?
            <Tooltip label="Present">
              <ActionIcon
                onClick={() => setActiveChat((prev) => ({
                  ...prev,
                  chatType: prev.chatType === 'present' ? 'general-student' : 'present'
                }))}
                size="lg"
                color={"orange"}
                variant={activeChat.chatType === 'present' ? "light" : "subtle"}
              >
                <IconPresentation size={20} />
              </ActionIcon>
            </Tooltip> : <Button
              color={"orange"}
              variant={activeChat.chatType === 'present' ? "light" : "subtle"}
              size="sm"
              leftSection={<IconPresentation size={16} />}
              radius="xl"
              onClick={() => setActiveChat((prev) => ({
                ...prev,
                chatType: prev.chatType === 'present' ? 'general-student' : 'present'
              }))}
            >Present</Button>)
        } */}
      </>
    )
  }

  const renderRightChatIcons = () => {
    return (
      <>
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
      if (waveSurferVideoRef.current) {
        waveSurferVideoRef.current.destroy();
      }
    };
  }, []);

  // Modify the useEffect to ensure WaveSurfer is initialized properly
  useEffect(() => {
    // Initialize wavesurfer when the component mounts and waveformRef is available
    if (waveformRef.current) {
      initWaveSurfer();
      initWaveSurferVideo();
    }

    return () => {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
      }
      if (waveSurferVideoRef.current) {
        waveSurferVideoRef.current.destroy();
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
        if (!loading && !transcribing && (activeChat.prompt.trim() || recordedVideos.length > 0)) {
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
  }, [activeChat.prompt, loading, onSend, recordedVideos.length, isRecording, transcribing]);

  // Add useEffect to send message after transcription completes if Enter was pressed
  useEffect(() => {
    if (enterPressedDuringRecording && !transcribing && !isRecording && !recordingMode) {
      if (!loading && (activeChat.prompt.trim() || recordedVideos.length > 0)) {
        onSend();
      }
      setEnterPressedDuringRecording(false);
    }
  }, [enterPressedDuringRecording, transcribing, isRecording, recordingMode, loading, activeChat.prompt, recordedVideos.length, onSend]);
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
          onRemoveContext={onRemoveContext}
          onScrollToSection={onScrollToSection}
          setViewerMode={setViewerMode}
          expandedSections={expandedSections}
          toggleSection={toggleSection}
          recordedVideos={recordedVideos}
          setRecordedVideos={setRecordedVideos}
        />
      </Box>}

      <Box className={isRecording ? classes.inputContainer : ''}>
        {(videoStream || (videoRef.current && (videoRef.current.srcObject || (videoRef.current.src && videoRef.current.src !== '')) || recordedVideos.length > 0)) && (
          <Box
            style={{
              position: 'absolute',
              top: '-310px',
              left: '0',
              right: '0',
              height: '300px',
              zIndex: 100,
              display: 'flex',
              justifyContent: 'center'
            }}
          >
            <ScrollArea scrollbarSize={6} type="auto" style={{ height: '100%', width: '100%' }}>
              <Group gap="sm" style={{ height: '100%', justifyContent: 'center' }}>
                {/* Current recording preview */}
                {(videoStream || (videoRef.current && ((videoRef.current.srcObject || (videoRef.current.src && videoRef.current.src !== '')) && isRecording))) && (
                  <Box
                    style={{
                      position: 'relative',
                      alignSelf: 'center',
                      width: '480px',
                      height: '300px',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      backgroundColor: '#f0f0f0',
                      border: '2px solid #ddd',
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
                  </Box>
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
              placeholder={"Type your message here..."}
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
                  {videoStream ? (
                    <div ref={waveformVideoRef} style={{ width: '100%', height: '60px' }} />
                  ) : (
                    <div ref={waveformRef} style={{ width: '100%', height: '60px' }} />
                  )}
                </>
              ) : transcribing && !videoStream ? (
                <Text size="lg" fw={500}>Transcribing...</Text>
              ) : (
                <>
                  <Text size="lg" fw={500}>Initializing...</Text>
                  {videoStream ? (
                    <div ref={waveformVideoRef} style={{ width: '100%', height: '60px' }} />
                  ) : (
                    <div ref={waveformRef} style={{ width: '100%', height: '60px' }} />
                  )}
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
                    {renderFileUpload()}
                    {renderLeftChatIcons()}
                  </Group>
                  <Group gap={4}>
                    {renderRightChatIcons()}
                  </Group>
                </>
              ) : (
                <>
                  <Group gap={"xs"}>
                    {renderFileUpload()}
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
