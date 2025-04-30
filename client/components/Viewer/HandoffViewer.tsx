/**
 * HandoffViewer.tsx
 * This is a component that displays a handoff message, to inform the user about what is going on.
 * @AshokSaravanan222
 * 2025-04-29
 */

import { Box, Text } from "@mantine/core";

interface HandoffViewerProps {
    text: string;
    handleEnhancedDocumentClick?: (
      fileId: string,
      documentId?: string
    ) => void;
    classId?: string;
  }

export const HandoffViewer = ({ text, handleEnhancedDocumentClick, classId }: HandoffViewerProps) => {
    return <Box>{text}</Box>;
};