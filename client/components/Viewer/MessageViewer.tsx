/**
 * MessageViewer.tsx
 * This component is used to display a message in the viewer.
 * @AshokSaravanan222
 * 03-25-2025
 */

import { Text, Card, useMantineColorScheme } from "@mantine/core";
import styles from "./MessageViewer.module.css";
import Latex from "../Latex";

interface MessageViewerProps {
  text: string;
  handleEnhancedDocumentClick?: (
    contextType: 'lectures' | 'chapters' | 'homeworks' | 'files',
    contextId: string,
    documentId?: string,
    textbookId?: string,
    exerciseId?: string
  ) => void;
  classId?: string;
}

export default function MessageViewer({ text, handleEnhancedDocumentClick, classId }: MessageViewerProps) {

  return (
    <Card
      className={styles.messageCard}
      padding="sm"
      radius="md"
    >
      <Latex classId={classId} handleEnhancedDocumentClick={handleEnhancedDocumentClick}>
        {text}
      </Latex>
    </Card>
  );
}