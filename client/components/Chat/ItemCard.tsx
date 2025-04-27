import { useDrop } from "react-dnd";
import { Card, Group, Stack, Text, Skeleton, ActionIcon, Tooltip, RingProgress, Loader, Image } from "@mantine/core";
import { IconX, IconEye, IconLoader } from "@tabler/icons-react";
import { useRef, useState, useEffect } from "react";
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
    isAnimating = false,
    animationId = '',
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
    isAnimating?: boolean, // New prop for animation
    animationId?: string, // For tracking which item is animating
}) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [flyPosition, setFlyPosition] = useState<{x: number, y: number} | null>(null);
    const [isFlying, setIsFlying] = useState(false);

    // Animation effect
    useEffect(() => {
        if (isAnimating && animationId === item.id) {
            // 1. Capture initial position
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                
                // 2. Calculate target position (input area) - ADJUSTED TO MOVE MORE LEFT, LESS DOWN
                // Calculate a point that's mostly to the left with minimal downward movement
                const targetX = window.innerWidth / 2 - rect.left - 200; // Move further left by subtracting more
                const targetY = window.innerHeight - rect.bottom - 300; // Less downward movement by subtracting more
                
                // 3. Store position for CSS variables
                setFlyPosition({ x: targetX, y: targetY });
                
                // 4. Trigger animation
                setIsFlying(true);
                
                // 5. Before animation starts, apply crucial DOM changes
                if (containerRef.current) {
                    // Move element to document body for maximum z-index effect
                    const element = containerRef.current;
                    const originalParent = element.parentElement;
                    const originalNextSibling = element.nextSibling;
                    
                    // Copy the element's position data for absolute positioning
                    const originalRect = element.getBoundingClientRect();
                    
                    // Apply absolute positioning to match original position
                    element.style.position = 'fixed';
                    element.style.top = `${originalRect.top}px`;
                    element.style.left = `${originalRect.left}px`;
                    element.style.width = `${originalRect.width}px`;
                    element.style.height = `${originalRect.height}px`;
                    element.style.zIndex = '99999';
                    element.style.pointerEvents = 'none';
                    
                    // Move to body temporarily
                    document.body.appendChild(element);
                    
                    // Reset after animation completes
                    const animationDuration = 1200; // 1.2s to match our CSS animation
                    setTimeout(() => {
                        if (originalParent && element.parentElement === document.body) {
                            // Only move back if still attached to body
                            if (originalNextSibling) {
                                originalParent.insertBefore(element, originalNextSibling);
                            } else {
                                originalParent.appendChild(element);
                            }
                            // Reset styles
                            element.style.position = '';
                            element.style.top = '';
                            element.style.left = '';
                            element.style.width = '';
                            element.style.height = '';
                            element.style.zIndex = '';
                            element.style.pointerEvents = '';
                        }
                        setIsFlying(false);
                    }, animationDuration);
                }
            }
        }
    }, [isAnimating, animationId, item.id]);

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
                width: "100%", // Default width behavior
                maxWidth: "100%", // Prevent overflow
                ...(isFlying && flyPosition ? {
                    '--fly-x': `${flyPosition.x}px`,
                    '--fly-y': `${flyPosition.y}px`,
                } as React.CSSProperties : {}),
            }}
            className={isFlying ? classes.flyingItemCard : undefined}
            onClick={(e) => {
                e.stopPropagation();
                // Only allow clicking if the file is complete or in processing stages
                if (item.parse_status === 'complete' || item.parse_status === 'extracting' || item.parse_status === 'processing') {
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
                <Stack style={{ flex: 1 }}>
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
                                flex: 1,
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
                                // Render eye icon for context in the panel
                                <Tooltip label="Open in viewer">
                                    <ActionIcon variant="subtle" size="md" onClick={(e) => {
                                        e.stopPropagation();
                                        if (setViewerMode) {
                                            const document = fileDocuments?.find(d => d.file === item.id);
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