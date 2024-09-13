/**
 * VideoPlayer.tsx
 * The video player component for the app, which can interactively select the timestamp.
 * @AshokSaravanan222
 * 09.07.2024
 */
import { useRef, useState } from 'react';
import { Button, Text, Container, Stack, AspectRatio } from '@mantine/core';

const VideoPlayer: React.FC = () => {
    // Ref to access the video element
    const videoRef = useRef<HTMLVideoElement>(null);

    // State to store the selected timestamp
    const [selectedTime, setSelectedTime] = useState<number | null>(null);

    // Function to handle capturing the timestamp
    const handleCaptureTimestamp = () => {
        if (videoRef.current) {
            const currentTime = videoRef.current.currentTime; // Get current playback time
            setSelectedTime(currentTime); // Update the state with the selected time
        }
    };

    return (
        <Stack>
            <AspectRatio ratio={16 / 9}>
                <video ref={videoRef} width="600" controls>
                    <source src="/videos/real-analysis.mp4" type="video/mp4" />
                </video>
            </AspectRatio>
            {/* Mantine Button to capture the current timestamp */}
            <Button onClick={handleCaptureTimestamp} mt="md">
                Capture Timestamp
            </Button>
            {/* Display the selected timestamp using Mantine Text */}
            {selectedTime !== null && (
                <Text mt="md">
                    Selected Timestamp: {selectedTime.toFixed(2)} seconds
                </Text>
            )}
            {/* <iframe
                width="640"
                height="480"
                src={`https://www.youtube.com/embed/tZhifZ6UQuE?start=${selectedTime}&controls=0&showinfo=0&modestbranding=1`}
                allow="autoplay">
            </iframe> */}
        </Stack>
    );
};

export default VideoPlayer;

