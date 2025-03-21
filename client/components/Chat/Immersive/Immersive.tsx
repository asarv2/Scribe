/**
 * Immersive.tsx
 * This component is for immersive mode with real-time camera and audio visualization. 
 * NOTE: This is not being used, just for demo to test some things out.
 */

import { useEffect, useRef, useState } from "react";
import { Stack, Text, Box, Grid, Paper, ScrollArea, Button, Group, ActionIcon } from "@mantine/core";
import WavesurferPlayer from '@wavesurfer/react';
import RecordPlugin from 'wavesurfer.js/dist/plugins/record.js';
import WaveSurfer from "wavesurfer.js";
import { IconMicrophone, IconMicrophoneOff, IconCamera, IconCameraOff, IconSend } from '@tabler/icons-react';

export default function Immersive() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const chatScrollRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [permissionError, setPermissionError] = useState<string | null>(null);
    const [wavesurfer, setWavesurfer] = useState<WaveSurfer | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordPlugin, setRecordPlugin] = useState<RecordPlugin | null>(null);
    const [cameraEnabled, setCameraEnabled] = useState(true);
    const [microphoneEnabled, setMicrophoneEnabled] = useState(true);
    const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
    const [userInput, setUserInput] = useState("");
    
    // Chat messages state
    const [chatMessages, setChatMessages] = useState([
        { id: 1, sender: "AI", message: "Welcome to the immersive learning experience! How can I help you today?" },
    ]);

    const contextItems = [
        { id: 1, title: "Quantum Computing Basics", content: "Quantum computing uses quantum bits or qubits which can exist in multiple states simultaneously." },
        { id: 2, title: "Quantum Superposition", content: "Unlike classical bits, qubits can be in a state of superposition, representing both 0 and 1 at the same time." },
        { id: 3, title: "Quantum Entanglement", content: "When qubits become entangled, the state of one qubit instantly affects the state of another, regardless of distance." },
    ];

    useEffect(() => {
        // Request camera access
        setupCamera();
        
        // Cleanup function
        return () => {
            if (videoStream) {
                videoStream.getTracks().forEach(track => track.stop());
            }
            if (recordPlugin) {
                recordPlugin.stopRecording();
            }
            if (wavesurfer) {
                wavesurfer.destroy();
            }
        };
    }, []);

    // Scroll to bottom of chat when messages change
    useEffect(() => {
        if (chatScrollRef.current) {
            chatScrollRef.current.scrollTo({
                top: chatScrollRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    }, [chatMessages]);

    // Setup keyboard shortcuts
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            // Only trigger if focus is not already on an input or contenteditable element
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
                return;
            }

            // Check if the key is a single character and not a modifier key
            if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                textareaRef.current?.focus();
                setUserInput(prev => prev + e.key);
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, []);

    const setupCamera = async () => {
        try {
            if (!cameraEnabled) return;
            
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true
            });

            setVideoStream(stream);

            // Set up video
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            console.error("Error accessing camera:", err);
            setPermissionError("Please allow camera access for the immersive experience.");
        }
    };

    const onReady = (ws: WaveSurfer) => {
        setWavesurfer(ws);

        // Initialize and register the record plugin
        const record = ws.registerPlugin(RecordPlugin.create());
        
        setRecordPlugin(record);
        
        if (microphoneEnabled) {
            startMicrophone(record);
        }
    };

    const startMicrophone = (record: RecordPlugin) => {
        if (!record) return;
        
        record.startRecording()
            .then(() => {
                setIsRecording(true);
            })
            .catch((err: any) => {
                console.error("Error starting microphone recording:", err);
                setPermissionError("Please allow microphone access for the immersive experience.");
            });
    };

    const stopMicrophone = () => {
        if (recordPlugin && isRecording) {
            recordPlugin.stopRecording();
            setIsRecording(false);
        }
    };

    const toggleCamera = async () => {
        if (cameraEnabled) {
            // Turn off camera
            if (videoStream) {
                videoStream.getVideoTracks().forEach(track => track.stop());
            }
            if (videoRef.current) {
                videoRef.current.srcObject = null;
            }
        } else {
            // Turn on camera
            await setupCamera();
        }
        setCameraEnabled(!cameraEnabled);
    };

    const toggleMicrophone = () => {
        if (microphoneEnabled) {
            // Turn off microphone
            stopMicrophone();
        } else {
            // Turn on microphone
            if (recordPlugin) {
                startMicrophone(recordPlugin);
            }
        }
        setMicrophoneEnabled(!microphoneEnabled);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (userInput.trim()) {
                sendMessage();
            }
        }
    };

    const sendMessage = () => {
        if (!userInput.trim()) return;
        
        // Add user message
        const newUserMessage = {
            id: chatMessages.length + 1,
            sender: "User",
            message: userInput.trim()
        };
        
        setChatMessages(prev => [...prev, newUserMessage]);
        
        // Clear input
        setUserInput("");
        
        // Simulate AI response (in a real app, you'd call your API here)
        setTimeout(() => {
            const aiResponse = {
                id: chatMessages.length + 2,
                sender: "AI",
                message: `I understand you're interested in "${userInput.trim()}". How can I help you learn more about this topic?`
            };
            setChatMessages(prev => [...prev, aiResponse]);
        }, 1000);
    };

    return (
        <Grid style={{ height: '100vh', padding: '20px' }} gutter="md">
            {/* Left section: Video and Audio */}
            <Grid.Col span={4} style={{ height: 'calc(100% - 80px)' }}>
                <Stack gap="md">
                    {permissionError ? (
                        <Text c="red" size="lg" fw={500}>{permissionError}</Text>
                    ) : (
                        <>
                            <Group justify="space-between">
                                <Text size="xl" fw={700}>Immersive Learning</Text>
                                <Group>
                                    <ActionIcon 
                                        variant="light" 
                                        color={cameraEnabled ? "blue" : "gray"} 
                                        onClick={toggleCamera}
                                        size="lg"
                                    >
                                        {cameraEnabled ? <IconCamera size={20} /> : <IconCameraOff size={20} />}
                                    </ActionIcon>
                                    <ActionIcon 
                                        variant="light" 
                                        color={microphoneEnabled ? "blue" : "gray"} 
                                        onClick={toggleMicrophone}
                                        size="lg"
                                    >
                                        {microphoneEnabled ? <IconMicrophone size={20} /> : <IconMicrophoneOff size={20} />}
                                    </ActionIcon>
                                </Group>
                            </Group>
                            <Box 
                                style={{ 
                                    width: '100%',
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                    backgroundColor: '#f0f0f0',
                                    height: cameraEnabled ? 'auto' : '240px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                {cameraEnabled ? (
                                    <video 
                                        ref={videoRef} 
                                        autoPlay 
                                        playsInline 
                                        muted 
                                        style={{ width: '100%', borderRadius: '8px' }}
                                    />
                                ) : (
                                    <Text c="dimmed">Camera is disabled</Text>
                                )}
                            </Box>
                            <Box 
                                style={{ 
                                    width: '100%',
                                    height: '120px',
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                    backgroundColor: 'rgb(20, 20, 20)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                {microphoneEnabled ? (
                                    <WavesurferPlayer
                                        height={120}
                                        waveColor="#4aec4a"
                                        progressColor="#1eea1e"
                                        barWidth={2}
                                        barGap={1}
                                        barRadius={2}
                                        url="/dummy-url-for-microphone"
                                        onReady={onReady}
                                    />
                                ) : (
                                    <Text c="dimmed" style={{ color: '#4aec4a' }}>Microphone is disabled</Text>
                                )}
                            </Box>
                            <Text size="sm" c="dimmed" ta="center">
                                {microphoneEnabled ? (isRecording ? "Microphone active - Audio visualization in progress" : "Initializing microphone...") : "Microphone inactive"}
                            </Text>
                        </>
                    )}
                </Stack>
            </Grid.Col>

            {/* Middle section: Chat Messages */}
            <Grid.Col span={4} style={{ height: 'calc(100% - 80px)' }}>
                <Paper shadow="sm" p="md" style={{ height: '100%', backgroundColor: '#f8f9fa' }}>
                    <Text size="xl" fw={700} mb="md">Conversation</Text>
                    <ScrollArea style={{ height: 'calc(100% - 40px)' }} viewportRef={chatScrollRef}>
                        <Stack gap="md">
                            {chatMessages.map((msg) => (
                                <Paper 
                                    key={msg.id} 
                                    p="sm" 
                                    style={{ 
                                        backgroundColor: msg.sender === "AI" ? '#e3f2fd' : '#e8f5e9',
                                        borderRadius: '8px'
                                    }}
                                >
                                    <Text fw={600}>{msg.sender}</Text>
                                    <Text>{msg.message}</Text>
                                </Paper>
                            ))}
                        </Stack>
                    </ScrollArea>
                </Paper>
            </Grid.Col>

            {/* Right section: Context */}
            <Grid.Col span={4} style={{ height: 'calc(100% - 80px)' }}>
                <Paper shadow="sm" p="md" style={{ height: '100%', backgroundColor: '#f8f9fa' }}>
                    <Text size="xl" fw={700} mb="md">Learning Context</Text>
                    <ScrollArea style={{ height: 'calc(100% - 40px)' }}>
                        <Stack gap="md">
                            {contextItems.map((item) => (
                                <Paper 
                                    key={item.id} 
                                    p="sm" 
                                    style={{ 
                                        backgroundColor: '#fff3e0',
                                        borderRadius: '8px'
                                    }}
                                >
                                    <Text fw={600}>{item.title}</Text>
                                    <Text>{item.content}</Text>
                                </Paper>
                            ))}
                        </Stack>
                    </ScrollArea>
                </Paper>
            </Grid.Col>

            {/* Chat Input at the bottom */}
            <Grid.Col span={12} style={{ height: '80px' }}>
                <Paper shadow="sm" p="md" style={{ height: '100%', backgroundColor: '#f8f9fa' }}>
                    <Group justify="space-between" style={{ height: '100%' }}>
                        <textarea
                            ref={textareaRef}
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Type your message here or press any key to start typing..."
                            style={{
                                width: 'calc(100% - 60px)',
                                height: '100%',
                                border: 'none',
                                outline: 'none',
                                resize: 'none',
                                backgroundColor: 'transparent',
                                fontSize: '16px',
                                padding: '8px'
                            }}
                        />
                        <ActionIcon 
                            size="lg" 
                            color="blue" 
                            variant="filled" 
                            onClick={sendMessage}
                            disabled={!userInput.trim()}
                        >
                            <IconSend size={20} />
                        </ActionIcon>
                    </Group>
                </Paper>
            </Grid.Col>
        </Grid>
    );
}