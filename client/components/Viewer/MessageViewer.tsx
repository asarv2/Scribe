/**
 * MessageViewer.tsx
 * This component is used to display a message in the viewer.
 * @AshokSaravanan222
 * 03-25-2025
 */

import { Figure, ViewerMode } from "@/types";
import { Card } from "@mantine/core";
import Latex from "../Latex";

interface MessageViewerProps {
    text: string;
    colorScheme: string;
}

export default function MessageViewer({ text, colorScheme }: MessageViewerProps) {
    return (
        <>
            <Card
                padding="sm"
                radius="md"
                style={{
                    backgroundColor: colorScheme === "dark" ? "#25262b" : "#f1f3f5",
                    minWidth: "200px",
                    maxWidth: "100%",
                    border: colorScheme === "dark" ? "1px solid #373A40" : "1px solid #e9ecef"
                }}
            >
                {/* If the viewerMode.immersive is true, use some logic to split the text into chunks and display multiple cards */}
                <Latex>{text}</Latex>
            </Card>
        </>
    )
}