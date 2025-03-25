/**
 * MessageViewer.tsx
 * This component is used to display a message in the viewer.
 * @AshokSaravanan222
 * 03-25-2025
 */

import { ViewerMode } from "@/types";
import { Card } from "@mantine/core";
import Latex from "../Latex";
import FigureViewer from "./FigureViewer";

interface MessageViewerProps {
    text: string;
    figureId: string | null;
    viewerMode: ViewerMode;
    colorScheme: string;
}

export default function MessageViewer({ text, figureId, viewerMode, colorScheme }: MessageViewerProps) {
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
                {figureId && <FigureViewer figureId={figureId} />}
            </Card>
        </>
    )
}