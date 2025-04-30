import { useDrop } from "react-dnd";
import { Card, Group, Stack, Text, Skeleton, ActionIcon, Tooltip, RingProgress, Loader, Image, Box } from "@mantine/core"; // Added Box
import { IconX, IconPlus, IconLoader } from "@tabler/icons-react"; // Changed IconEye to IconPlus
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
                padding: "8px", // Slightly reduce padding
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
                                <div
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onFileDelete();
                                    }}
                                    style={{
                                        color: "red", // Red color for the "X"
                                        cursor: "pointer", // Pointer cursor
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    <IconX size={16} /> {/* Use IconX for a plain red "X" */}
                                </div>
                            ) : (
                                // Render plus icon for context in the panel
                                <Tooltip label="Add to Chat">
                                    {/* Wrap ActionIcon in a Box */}
                                    <Box>
                                        <ActionIcon variant="subtle" size="md" onClick={(e) => {
                                            e.stopPropagation();
                                            // Only allow adding if the file is complete or in processing stages
                                            if (item.parse_status === 'complete' || item.parse_status === 'extracting' || item.parse_status === 'processing') {
                                                addFileToChat(item.id); // Add to chat on icon click
                                            }
                                        }}>
                                            <IconPlus size={20} />
                                        </ActionIcon>
                                    </Box>
                                </Tooltip>
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