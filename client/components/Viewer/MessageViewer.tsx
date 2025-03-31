/**
 * MessageViewer.tsx
 * This component is used to display a message in the viewer.
 * @AshokSaravanan222
 * 03-25-2025
 */

import { Figure, ViewerMode } from "@/types";
import { Card } from "@mantine/core";
import Latex from "../Latex";
import styles from "./MessageViewer.module.css";

interface MessageViewerProps {
    text: string;
    classId: string;
    handleEnhancedDocumentClick: (contextType: 'lectures' | 'chapters' | 'homeworks' | 'files', contextId: string, documentId?: string, textbookId?: string, exerciseId?: string) => void;
}

export default function MessageViewer({ text, classId, handleEnhancedDocumentClick }: MessageViewerProps) {
    return (
        <>
            <Card
                padding="sm"
                radius="md"
                className={styles.messageCard}
            >
                <Latex handleEnhancedDocumentClick={handleEnhancedDocumentClick} classId={classId}>{text}</Latex>
            </Card>
        </>
    )
}