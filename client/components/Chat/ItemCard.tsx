import { useDrop } from "react-dnd";
import { Card, Group, Stack, Text, Skeleton, ActionIcon, Tooltip, RingProgress, Loader, Image, Box } from "@mantine/core"; // Added Box
import { IconX, IconPlus, IconLoader, IconCircleX } from "@tabler/icons-react"; // Changed IconEye to IconPlus, added IconCircleX
import { useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Document, ViewerMode } from "@/types";
import { ContentType } from "@/types";
import DraggableWrapper from "../DragDrop/DraggableWrapper";
import { handleDocumentClick } from "@/utils/chat/chat-helpers";
import classes from '../Chat/Canvas/ChatCanvas.module.css'; // Import animation CSS

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
    onReorder,
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
    onReorder?: (draggedId: string, targetId: string) => void,
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
                return item.extraction_progress ? item.extraction_progress : 0;
            case 'processing':
                return item.processing_progress ? item.processing_progress : 0;
            case 'uploading':
                // For uploading, we rely on the tus progress updates
                return item.upload_progress ? item.upload_progress : 0;
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
            case 'processing':
                return `Processing: ${progress}%`;
            case 'uploading':
                return `Uploading: ${progress}%`;
            default:
                return `${progress}%`;
        }
    };

    // Add the useDrop hook to handle drag-and-drop functionality
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
            isOver: !!monitor.isOver(), // Collect the isOver state
        }),
    }), [item.id, onReorder]);

    // Create the card content with animation support
    const originalCard = (
        <Card
            ref={(el) => {
                // Use the drop function which returns a ref function
                drop(el);

                // Update container ref without directly assigning to .current
                if (containerRef) {
                    containerRef.current = el;
                }
            }}
            shadow="xs"
            p="xs"
            radius="md"
            withBorder
            style={{
                display: "inline-flex", // Ensure the card behaves like an inline element
                cursor: makeDraggable ? 'grab' : 'pointer',
                transition: 'all 0.2s ease',
                borderLeft: `3px solid var(--mantine-color-${color}-filled)`,
                backgroundColor: isOver ? 'var(--mantine-color-blue-light)' : undefined,
                boxSizing: 'border-box',
                width: "100%", // Keep full width of parent container
                maxWidth: "100%", // Prevent overflow
            }}
            onClick={(e) => { // Changed onClick handler
                e.stopPropagation();
                // Only allow clicking if the file is complete or in processing stages
                if ((item.parse_status === 'complete' || item.parse_status === 'extracting' || item.parse_status === 'processing') && setViewerMode) {
                    const document = fileDocuments?.find(d => d.file === item.id);
                    if (document) {
                        handleDocumentClick(item.id, document.id, setViewerMode, false); // Open viewer on card click
                    }
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
                        backgroundColor: '#f0f0f0',
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
                <Stack style={{ flex: 1, minWidth: 0 }}> {/* Added minWidth: 0 */}
                    <Group justify="space-between" wrap="nowrap">
                        <Text
                            size="sm"
                            lineClamp={1} // Ensure the title is truncated to one line
                            title={item.newName}
                            style={{
                                wordBreak: 'break-word',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap', // Prevent wrapping
                            }}
                        >
                            {item.newName}
                        </Text>
                        <>
                            {/* Status indicators based on parse_status */}
                            {onFileDelete ? (
                                // Render red "X" for context in the chat area
                                <Tooltip label="Remove from Chat" openDelay={500}>
                                    <div
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onFileDelete();
                                        }}
                                        style={{
                                            color: "red",
                                            cursor: "pointer",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                        }}
                                    >
                                        <IconX size={16} />
                                    </div>
                                </Tooltip>
                            ) : (
                                // Render status indicators or plus icon based on parse_status
                                <>
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
                                        item.parse_status === 'extracting' ||
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
                                        // Render plus icon for complete files
                                        <Tooltip label="Add to Chat">
                                            <Box>
                                                <ActionIcon variant="subtle" size="md" onClick={(e) => {
                                                    e.stopPropagation();
                                                    addFileToChat(item.id);
                                                }}>
                                                    <IconPlus size={20} />
                                                </ActionIcon>
                                            </Box>
                                        </Tooltip>
                                    )}
                                </>
                            )}
                        </>
                    </Group>
                </Stack>
            </Group>
        </Card>
    );

    // Wrap in draggable component if needed
    return makeDraggable && item.parse_status === 'complete' ? (
        <DraggableWrapper item={item} type={'file'} makeDraggable={makeDraggable}>
            {originalCard}
        </DraggableWrapper>
    ) : originalCard;
};