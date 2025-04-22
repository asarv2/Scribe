import { useDrop } from "react-dnd";
import { Card, Group, Stack, Text, Skeleton, ActionIcon, Tooltip, RingProgress, Loader, Image } from "@mantine/core";
import { IconCircleX, IconEye, IconLoader } from "@tabler/icons-react";
import { useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Document, ViewerMode } from "@/types";
import { ContentType } from "@/types";
import DraggableWrapper from "../DragDrop/DraggableWrapper";
import { handleDocumentClick } from "@/utils/chat/chat-helpers";

export default function ItemCard({
    item,
    classId,
    profileId,
    color,
    contextType,
    addFileToChat,
    isVisible,
    makeDraggable = false,
    setViewerMode,
    fileDocuments,
    onFileDelete,
    onReorder
}: {
    item: any,
    classId: string,
    profileId: string,
    color: string,
    contextType: ContentType,
    addFileToChat: (fileId: string) => void,
    isVisible: boolean,
    makeDraggable?: boolean,
    setViewerMode?: React.Dispatch<React.SetStateAction<ViewerMode>>;
    fileDocuments?: Document[],
    onFileDelete?: () => void,
    onReorder?: (draggedId: string, targetId: string) => void
}) {
    const containerRef = useRef<HTMLDivElement | null>(null);

    // Get color based on parse status
    const getStatusColor = () => {
        switch (item.parse_status) {
            case 'uploading':
                return 'blue';
            case 'compressing':
                return 'yellow';
            case 'extracting':
                return 'violet';
            case 'parsing':
                return 'indigo';
            case 'processing':
                return 'green';
            case 'error':
                return 'red';
            case 'complete':
                return 'teal';
            default:
                return 'gray';
        }
    };

    // Centralized file progress calculation based on parse_status
    const getFileProgress = (fileId: string) => {
        // If no file documents, return 0
        if (!fileDocuments) return 0;

        // Handle different states with appropriate progress calculations
        switch (item.parse_status) {
            case 'compressing':
                // Use compression_progress (0-100) for compressing state
                return item.compression_progress ? item.compression_progress : 0;

            case 'extracting':
            case 'parsing':
                // Get documents associated with this file
                const fileRelatedDocs = fileDocuments.filter(doc => doc.file === fileId);

                // If no documents or file has no length property, return 0
                if (fileRelatedDocs.length === 0 || !item.length) return 0;

                // Calculate percentage based on document count vs expected length
                return (fileRelatedDocs.length / item.length) * 100;

            case 'processing':
                // Use file size and time-based heuristic for processing
                if (!item.file_size || !item.last_parse_attempt) return 50; // Default to 50% if missing data

                // Calculate time elapsed since processing started
                const startTime = new Date(item.last_parse_attempt).getTime();
                const currentTime = new Date().getTime();
                const elapsedSeconds = (currentTime - startTime) / 1000;

                // Estimate total processing time based on file size (KB)
                // Assuming ~1MB per 10 seconds processing time as a rough heuristic
                const fileSizeKB = item.file_size / 1024;
                const estimatedTotalSeconds = (fileSizeKB / 100) * 10;

                // Calculate progress percentage
                let progressPercentage = (elapsedSeconds / estimatedTotalSeconds) * 100;

                // Cap at 95% until complete
                return Math.min(progressPercentage, 95);

            case 'uploading':
                // For uploading, we rely on the tus progress updates
                // This is handled separately in the notifications
                return item.upload_progress ? item.upload_progress * 100 : 0;

            case 'complete':
                return 100;

            default:
                return 0;
        }
    };

    // Get progress label based on status
    const getProgressLabel = () => {
        const progress = Math.round(getFileProgress(item.id));

        switch (item.parse_status) {
            case 'compressing':
                return `Compressing: ${progress}%`;
            case 'extracting':
                return `Extracting: ${progress}%`;
            case 'parsing':
                return `Parsing: ${progress}%`;
            case 'processing':
                return `Processing: ${progress}%`;
            case 'uploading':
                return `Uploading: ${progress}%`;
            default:
                return `${progress}%`;
        }
    };

    // Add a drop handler for reordering
    const [{ isOver }, drop] = useDrop(() => ({
        accept: 'CONTEXT_ITEM',
        drop: (droppedItem: { id: string, type: string }) => {
            if (droppedItem.type === 'file' && onReorder) {
                onReorder(droppedItem.id, item.id);
                return { dropped: true };
            }
            return { dropped: false };
        },
        collect: (monitor) => ({
            isOver: !!monitor.isOver(),
        }),
    }), [item.id, onReorder]);

    const originalCard = (
        <Card
            ref={(el) => {
                // Use the drop function which returns a ref function
                drop(el);

                // Update container ref without directly assigning to .current
                if (containerRef) {
                    // Store the reference for scrolling functionality
                    containerRef.current = el;
                }
            }}
            shadow="xs"
            p="xs"
            radius="md"
            withBorder
            style={{
                marginBottom: '8px',
                cursor: makeDraggable ? 'grab' : 'pointer',
                transition: 'all 0.2s ease',
                borderLeft: `3px solid var(--mantine-color-${color}-filled)`,
                backgroundColor: isOver ? 'var(--mantine-color-blue-light)' : undefined,
            }}
            onClick={(e) => {
                e.stopPropagation();
                // Only allow clicking if the file is complete or in processing stages
                if (item.parse_status === 'complete' || item.parse_status === 'parsing' || item.parse_status === 'extracting' || item.parse_status === 'processing') {
                    addFileToChat(item.id);
                }
            }}
        >
            <Group>
                {isVisible ? (
                    <div style={{
                        width: 40,
                        height: 40,
                        borderRadius: '4px',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#f0f0f0'
                    }}>
                        <Image
                            src={item.imageUrl}
                            alt={item.newName}
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                            }}
                            loading="lazy"
                        />
                    </div>
                ) : (
                    <Skeleton width={40} height={40} radius={4} />
                )}
                <Stack style={{ flex: 1 }}>
                    <Group justify="space-between" wrap="nowrap">
                        <Text
                            size="sm"
                            lineClamp={2}
                            title={item.newName}
                            style={{
                                wordBreak: 'break-word',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                flex: 1
                            }}
                        >
                            {item.newName}
                        </Text>
                        <>
                            {/* Status indicators based on parse_status */}
                            {item.parse_status === 'idle' ? (
                                <Tooltip label="Loading...">
                                    <ActionIcon variant="transparent" color="blue" size="sm">
                                        <Loader size={"xs"} />
                                    </ActionIcon>
                                </Tooltip>
                            ) : item.parse_status === 'error' ? (
                                <Tooltip label="Error Processing">
                                    <ActionIcon variant="light" color="red" size="sm">
                                        <IconCircleX size={16} />
                                    </ActionIcon>
                                </Tooltip>
                            ) : (item.parse_status === 'uploading' || item.parse_status === 'compressing' ||
                                item.parse_status === 'parsing' || item.parse_status === 'extracting' ||
                                item.parse_status === 'processing') ? (
                                <Tooltip label={getProgressLabel()}>
                                    <RingProgress
                                        size={40}
                                        thickness={2}
                                        sections={[{
                                            value: getFileProgress(item.id),
                                            color: getStatusColor()
                                        }]}
                                        label={
                                            <Text size="xs" ta="center" fw={500} c={getStatusColor()}>
                                                {Math.round(getFileProgress(item.id))}%
                                            </Text>
                                        }
                                    />
                                </Tooltip>
                            ) : (
                                <Tooltip label="Open in viewer">
                                    <ActionIcon variant="subtle" size="md" onClick={(e) => {
                                        e.stopPropagation();
                                        if (setViewerMode) {
                                            const document = fileDocuments?.find(d => d.file === item.id)
                                            if (document) {
                                                handleDocumentClick(item.id, document.id, setViewerMode, false);
                                            }
                                        }
                                    }}>
                                        <IconEye size={20} />
                                    </ActionIcon>
                                </Tooltip>
                            )}
                        </>
                    </Group>
                </Stack>
            </Group >
        </Card >
    );

    // Wrap in draggable component if needed
    return makeDraggable && item.parse_status === 'complete' ? (
        <DraggableWrapper item={item} type={'file'} makeDraggable={makeDraggable}>
            {originalCard}
        </DraggableWrapper>
    ) : originalCard;
};