/**
 * RecordingPanel.tsx
 * 
 * This component handles audio recording functionality with react-audio-visualize visualization.
 */

import { useState, useEffect, useRef } from "react";
import { Card, Text, Group, Button, TextInput, Box, Progress, Stack, Switch } from "@mantine/core";
import { IconPlayerPlay, IconPlayerStop, IconDeviceFloppy, IconTrash, IconMicrophone, IconVideo } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { LiveAudioVisualizer, AudioVisualizer } from "react-audio-visualize";
import { ViewerMode } from "@/types";

interface RecordingPanelProps {
    viewerMode: ViewerMode;
    mediaBlob: Blob | null;
    videoPreviewRef: React.RefObject<HTMLVideoElement>;
    mediaRecorderRef: React.RefObject<MediaRecorder>;
    recordingDuration: number;
}

export default function RecordingPanel({ viewerMode, mediaBlob, videoPreviewRef, mediaRecorderRef, recordingDuration }: RecordingPanelProps) {
    return (
        <Card
            p="md"
            radius="md"
            style={{
                height: viewerMode.immersive ? "90vh" : "80vh",
                overflowY: "auto",
                position: "relative"
            }}
        >
            {viewerMode.inputActive && <Stack gap="md">
                {!mediaBlob ? (
                    <>
                        {viewerMode.video && (
                            <Box style={{ width: '100%', textAlign: 'center' }}>
                                <video
                                    ref={videoPreviewRef}
                                    autoPlay
                                    muted
                                    style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '8px' }}
                                />
                            </Box>
                        )}

                        {viewerMode.audio && mediaRecorderRef.current && (
                            <Box h={80} style={{ width: '100%' }}>
                                <LiveAudioVisualizer
                                    mediaRecorder={mediaRecorderRef.current}
                                    width={500}
                                    height={75}
                                    barWidth={2}
                                    gap={1}
                                    barColor={viewerMode.paused ? 'gray' : 'violet'}
                                    backgroundColor={'transparent'}
                                />
                            </Box>
                        )}

                        {viewerMode.recording && (
                            <>
                                <Group justify="center">
                                    <Text size="xl" fw={700} c={viewerMode.paused ? "gray" : "red"}>
                                        {Math.floor(recordingDuration / 60)}:{String(recordingDuration % 60).padStart(2, '0')}
                                    </Text>
                                </Group>
                            </>
                        )}
                    </>
                ) : (
                    <>
                        {viewerMode.video ? (
                            <Box style={{ width: '100%', textAlign: 'center' }}>
                                <video
                                    ref={videoPreviewRef}
                                    controls
                                    style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '8px' }}
                                />
                            </Box>
                        ) : (
                            mediaBlob && (
                                <Box h={80} style={{ width: '100%' }}>
                                    <AudioVisualizer
                                        blob={mediaBlob}
                                        width={500}
                                        height={75}
                                        barWidth={2}
                                        gap={1}
                                        barColor={'violet'}
                                        backgroundColor={'transparent'}
                                    />
                                </Box>
                            )
                        )}
                    </>
                )}
            </Stack>}
        </Card>
    );
}