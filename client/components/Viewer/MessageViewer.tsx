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
}

export default function MessageViewer({ text }: MessageViewerProps) {
    return (
        <>
            <Card
                padding="sm"
                radius="md"
                className={styles.messageCard}
            >
                <Latex>{text}</Latex>
            </Card>
        </>
    )
}