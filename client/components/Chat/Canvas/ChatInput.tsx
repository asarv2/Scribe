import React, { memo, useRef, useState, useEffect, KeyboardEvent } from 'react';
import {
  Textarea, Tooltip, ActionIcon, Box, Text, Stack,
  Skeleton, Group,
} from '@mantine/core';
import { useMediaQuery, useOs } from '@mantine/hooks';
import { IconSend, IconMicrophone, IconPlayerStop } from '@tabler/icons-react';
import WaveSurfer from 'wavesurfer.js';
import RecordPlugin from 'wavesurfer.js/dist/plugins/record.esm.js';
import { ChatMessage, ViewerMode } from '@/types';
import { ContextBadges } from './ContextBadges';
import classes from './ChatInput.module.css';

interface ChatInputProps {
  activeChat: ChatMessage;
  viewerMode: ViewerMode;
  loading: boolean;
  isInitializing?: boolean;
  chatId: string;
  classId: string;
  onSend: () => void;
  onRemoveFile: (id: string) => void;
  onRemoveDocument: (id: string) => void;
  setViewerMode?: React.Dispatch<React.SetStateAction<ViewerMode>>;
  setActiveChat: React.Dispatch<React.SetStateAction<ChatMessage>>;
}

export const ChatInput = memo((props: ChatInputProps) => {
  const {
    activeChat, viewerMode, loading, isInitializing = false,
    classId, onSend, onRemoveFile, onRemoveDocument,
    setViewerMode, setActiveChat,
  } = props;

  /* ---------- refs & state ---------- */
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
  const isMobile = useMediaQuery('(max-width: 768px)');

  const shortcut = os === 'macos' ? '⌘M' : 'Ctrl+M';
  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

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
      setActiveChat(p => ({ ...p, prompt: p.prompt + text }));
    } catch (e) { console.error(e); }
    finally {
      setTranscribing(false);
      setRecordingMode(false);
    }
  };

  /* ---------- key handling ---------- */
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!loading && activeChat.prompt.trim()) onSend();
    }
  };

  useEffect(() => () => wavesurferRef.current?.destroy(), []);

  /* ---------- icons ---------- */
  const rightIcons = (
    <>
      {!activeChat.prompt.trim() ? <Tooltip label={isRecording ? 'Stop Audio' : 'Start Audio'} withArrow>
        <ActionIcon
          size="lg"
          variant="subtle"
          color={isRecording ? 'red' : 'blue'}
          onClick={toggleRecording}>
          {isRecording ? <IconPlayerStop size={20} /> : <IconMicrophone size={20} />}
        </ActionIcon>
      </Tooltip> : null}

      {activeChat.prompt.trim() ? <Tooltip label="Send" withArrow>
        <ActionIcon
          size="lg"
          variant="subtle"
          color="blue"
          loading={loading}
          disabled={!activeChat.prompt.trim()}
          onClick={onSend}
        >
          <IconSend size={20} />
        </ActionIcon>
      </Tooltip> : null}
    </>
  );

  /* ---------- UI ---------- */
  return (
    <Stack gap="md">
      {!isRecording && (
        <Box pos="absolute" left={25} right={25} style={{ transform: 'translateY(-100%)', zIndex: 10 }}>
          <ContextBadges
            activeChat={activeChat}
            classId={classId}
            onRemoveFile={onRemoveFile}
            onRemoveDocument={onRemoveDocument}
            setViewerMode={setViewerMode} />
        </Box>
      )}

      <Box>
        {isInitializing ? (
          <Box p="xs"><Skeleton height={60} /></Box>
        ) : !recordingMode ? (
          /* -------- normal input -------- */
          <Box pos="relative">
            <Textarea
              ref={textareaRef}
              value={activeChat.prompt}
              onChange={(e) => setActiveChat(p => ({ ...p, prompt: e.target.value }))}
              onKeyDown={onKeyDown}
              autosize minRows={2} maxRows={4} size="md"
              placeholder=" "
              rightSectionWidth={42}
              rightSection={rightIcons} />

            {activeChat.prompt.trim() === '' && (
              <Text pos="absolute" top={8} left={14}
                c="var(--mantine-color-gray-6)" style={{ pointerEvents: 'none' }}>
                {activeChat.teacher ? 'Start creating and ' : 'Start learning and '}
                <Tooltip
                  label={viewerMode.open ? `Close menu (${shortcut})` : `Open menu (${shortcut})`}
                  withArrow openDelay={500} position="top"
                  transitionProps={{ transition: 'slide-up', duration: 300 }}
                  styles={{
                    tooltip: {
                      background: 'linear-gradient(45deg,#4DABF7 0%,#228BE6 100%)',
                      animation: 'gradient 3s ease infinite', backgroundSize: '200% 200%'
                    }
                  }}>
                  <Text span c="blue" style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                    onClick={(e) => { e.stopPropagation(); setViewerMode?.(v => ({ ...v, open: !v.open })); }}>
                    add context
                  </Text>
                </Tooltip>
              </Text>
            )}
          </Box>
        ) : (
          /* -------- recorder view -------- */
          <Box className={classes.recorderContainer}>
            {!transcribing && <div ref={waveformRef} className={classes.waveform} />}

            {/* tiny MM:SS timer while recording */}
            {isRecording && (
              <Text className={classes.timer}>{fmt(recordTime)}</Text>
            )}

            {/* subtle “…transcribing” overlay in place of waveform */}
            {transcribing && (
              <Text className={classes.transcribing}>Transcribing…</Text>
            )}

            {/* stop button (works for both recording + transcribing states) */}
            <Tooltip label="Stop recording" withArrow>
              <ActionIcon
                size="lg"
                variant="subtle"
                color="red"
                loading={transcribing}
                onClick={toggleRecording}
                className={classes.stopBtn}
              >
                <IconPlayerStop size={20} />
              </ActionIcon>
            </Tooltip>
          </Box>
        )}
      </Box>
    </Stack>
  );
});
ChatInput.displayName = 'ChatInput';
