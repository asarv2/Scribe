/**
 * Viewer.tsx
 * 
 * This component is used to display the viewer for the given document.
 * @AshokSaravanan222
 * 03-10-2025
 */

import { ActionIcon, Box, Card, Container, Flex, Grid, Group, Modal, Skeleton, Stack, Text, useMantineColorScheme } from "@mantine/core";
import { IconArrowLeft, IconArrowRight } from "@tabler/icons-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ClassLayout } from "../Class/ClassLayout";
import Latex from "@/components/Latex";

interface ViewerProps {
    // Core props
    images: Array<{
        id: string;
        src: string;
        alt: string;
        label?: string | number;
    }>;
    initialImageId?: string;
    embedded?: boolean;
    
    // Optional components/content
    title?: string;
    description?: string | React.ReactNode;
    DeleteComponent?: React.ReactNode;
    
    // Layout
    classId?: string;
    showNavigation?: boolean;
    
    // Loading states
    loading?: boolean;
    loadingTitle?: boolean;
    
    // New prop for side component
    SideComponent?: React.ReactNode;
}

export default function Viewer({
    images,
    initialImageId,
    embedded = false,
    title,
    description,
    DeleteComponent,
    classId,
    showNavigation = true,
    loading = false,
    loadingTitle = false,
    SideComponent,
}: ViewerProps) {
    const { colorScheme } = useMantineColorScheme();
    const [activeImageId, setActiveImageId] = useState<string>(initialImageId || images[0]?.id);
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);
    const [touchStartX, setTouchStartX] = useState(0);
    const previewScrollRef = useRef<HTMLDivElement>(null);
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

    // Handle keyboard navigation
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const currentIndex = images.findIndex(img => img.id === activeImageId);
            if (event.key === 'ArrowLeft' && currentIndex > 0) {
                setActiveImageId(images[currentIndex - 1].id);
            } else if (event.key === 'ArrowRight' && currentIndex < images.length - 1) {
                setActiveImageId(images[currentIndex + 1].id);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeImageId, images]);

    // Handle touch swipe
    const handleSwipe = (touchEndX: number) => {
        const swipeDistance = touchEndX - touchStartX;
        const currentIndex = images.findIndex(img => img.id === activeImageId);
        
        if (Math.abs(swipeDistance) > 50) { // Minimum swipe distance
            if (swipeDistance > 0 && currentIndex > 0) {
                setActiveImageId(images[currentIndex - 1].id);
            } else if (swipeDistance < 0 && currentIndex < images.length - 1) {
                setActiveImageId(images[currentIndex + 1].id);
            }
        }
    };

    // Scroll active thumbnail into view
    useEffect(() => {
        if (previewScrollRef.current) {
            const activeThumb = previewScrollRef.current.querySelector(`[data-image="${activeImageId}"]`);
            activeThumb?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }, [activeImageId]);

    const MainViewer = () => {
        const currentImage = images.find(img => img.id === activeImageId);
        const [isImageLoading, setIsImageLoading] = useState(false);

        return (
            <Card padding="md" pos="relative" withBorder>
                <Box style={{
                    position: 'relative',
                    width: '100%',
                    aspectRatio: '16/9',
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colorScheme === "dark" ? "#25262b" : "#f8f9fa",
                    borderRadius: "10px",
                    flexShrink: 0
                }}
                onTouchStart={(e) => setTouchStartX(e.changedTouches[0].clientX)}
                onTouchEnd={(e) => handleSwipe(e.changedTouches[0].clientX)}
                >
                    {isImageLoading && (
                        <Skeleton height="100%" width="100%" radius="md" />
                    )}
                    <Image
                        src={currentImage?.src || "/placeholder_image.svg"}
                        alt={currentImage?.alt || ""}
                        width={500}
                        height={500}
                        style={{
                            maxWidth: '100%',
                            maxHeight: '100%',
                            objectFit: "contain",
                            cursor: "zoom-in",
                            opacity: isImageLoading ? 0 : 1,
                            transition: 'opacity 0.2s ease-in-out'
                        }}
                        sizes="100vw"
                        placeholder="blur"
                        blurDataURL="/placeholder_image.svg"
                        onClick={() => setIsImageModalOpen(true)}
                        onLoadingComplete={() => setIsImageLoading(false)}
                        onLoadStart={() => setIsImageLoading(true)}
                        priority
                    />
                    
                    {showNavigation && (
                        <>
                            <ActionIcon
                                size="lg"
                                variant="filled"
                                color={colorScheme === "dark" ? "gray" : "dark"}
                                style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: 5,
                                    transform: 'translateY(-50%)',
                                    zIndex: 100,
                                }}
                                onClick={() => {
                                    const currentIndex = images.findIndex(img => img.id === activeImageId);
                                    if (currentIndex > 0) {
                                        setActiveImageId(images[currentIndex - 1].id);
                                    }
                                }}
                                disabled={images.findIndex(img => img.id === activeImageId) === 0}
                            >
                                <IconArrowLeft size={24} />
                            </ActionIcon>
                            <ActionIcon
                                size="lg"
                                variant="filled"
                                color={colorScheme === "dark" ? "gray" : "dark"}
                                style={{
                                    position: 'absolute',
                                    top: '50%',
                                    right: 5,
                                    transform: 'translateY(-50%)',
                                    zIndex: 100,
                                }}
                                onClick={() => {
                                    const currentIndex = images.findIndex(img => img.id === activeImageId);
                                    if (currentIndex < images.length - 1) {
                                        setActiveImageId(images[currentIndex + 1].id);
                                    }
                                }}
                                disabled={images.findIndex(img => img.id === activeImageId) === images.length - 1}
                            >
                                <IconArrowRight size={24} />
                            </ActionIcon>
                        </>
                    )}

                    {/* Image label overlay */}
                    <Box
                        pos="absolute"
                        bottom={embedded ? 5 : 10}
                        right={embedded ? 5 : 10}
                        p={embedded ? 4 : 8}
                        style={{
                            zIndex: 100,
                            backgroundColor: colorScheme === "dark" ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.7)",
                            borderRadius: "4px",
                        }}
                    >
                        <Text
                            size={embedded ? "xs" : "sm"}
                            fw={500}
                            style={{
                                color: colorScheme === "dark" ? "white" : "black",
                                textShadow: colorScheme === "dark" ?
                                    "0px 0px 4px rgba(0,0,0,0.5)" :
                                    "0px 0px 4px rgba(255,255,255,0.5)"
                            }}
                        >
                            {currentImage?.label || ""}
                        </Text>
                    </Box>
                </Box>
            </Card>
        );
    };

    const PreviewStrip = () => (
        <Flex
            ref={previewScrollRef}
            gap={4}
            style={{
                overflowX: 'auto',
                padding: '2px',
                height: '100%',
                width: '100%'
            }}
        >
            {images.map((img) => (
                <Box
                    key={img.id}
                    data-image={img.id}
                    style={{
                        cursor: 'pointer',
                        width: 35,
                        height: 35,
                        position: 'relative',
                        flexShrink: 0,
                        borderRadius: '4px',
                        overflow: 'hidden',
                    }}
                    onClick={() => setActiveImageId(img.id)}
                >
                    <Image
                        src={img.src}
                        alt={img.alt}
                        width={35}
                        height={35}
                        style={{
                            objectFit: 'cover',
                            outline: img.id === activeImageId ? '2px solid skyblue' : 'none',
                            outlineOffset: '-2px',
                        }}
                        sizes="100vw"
                    />
                </Box>
            ))}
        </Flex>
    );

    const Content = () => (
        <Stack gap="xs" style={{ height: '100%' }}>
            {/* Title section - only show if not embedded */}
            {!embedded && title && (
                <Flex justify="space-between" align="center">
                    <Group>
                        <Skeleton visible={loadingTitle} height={32} width={500}>
                            <Text size="xl" fw={700} mb={6}>{title}</Text>
                        </Skeleton>
                    </Group>
                    {DeleteComponent && <Group>{DeleteComponent}</Group>}
                </Flex>
            )}

            <Grid>
                {/* Main content column */}
                <Grid.Col span={!embedded ? (isMobile ? 12 : 6) : 12}>
                    <Stack>
                        {loading ? (
                            <>
                                <Skeleton height={300} radius="md" />
                                <Skeleton height={40} radius="sm" />
                            </>
                        ) : (
                            <>
                                <MainViewer />
                                <Box style={{ flexShrink: 0, height: '40px', marginBottom: '4px' }}>
                                    <PreviewStrip />
                                </Box>
                                {/* Description always appears below images */}
                                {description && (
                                    <Box mt="sm">
                                        {loading ? (
                                            <Stack>
                                                <Skeleton height={16} width="90%" />
                                                <Skeleton height={16} width="85%" />
                                                <Skeleton height={16} width="70%" />
                                            </Stack>
                                        ) : (
                                            <Box style={{ overflow: 'auto', paddingInline: '2px' }}>
                                                {typeof description === 'string' ? (
                                                    <Text fw={500} size="sm">
                                                        <Latex>{description}</Latex>
                                                    </Text>
                                                ) : (
                                                    description
                                                )}
                                            </Box>
                                        )}
                                    </Box>
                                )}
                            </>
                        )}
                    </Stack>
                </Grid.Col>
                
                {/* Side component - only show if not embedded */}
                {!embedded && SideComponent && (
                    <Grid.Col span={isMobile ? 12 : 6}>
                        {SideComponent}
                    </Grid.Col>
                )}
            </Grid>

            {/* Full-size image modal */}
            <Modal
                opened={isImageModalOpen}
                onClose={() => setIsImageModalOpen(false)}
                size="xl"
                padding="md"
                centered
                title={images.find(img => img.id === activeImageId)?.label || ""}
            >
                <Box style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '80vh'
                }}>
                    <Image
                        src={images.find(img => img.id === activeImageId)?.src || "/placeholder_image.svg"}
                        alt={images.find(img => img.id === activeImageId)?.alt || ""}
                        width={1200}
                        height={1200}
                        style={{
                            maxWidth: '100%',
                            maxHeight: '100%',
                            objectFit: "contain"
                        }}
                        sizes="100vw"
                    />
                </Box>
            </Modal>
        </Stack>
    );

    if (embedded) {
        return <Content />;
    }

    return (
        <ClassLayout classId={classId || null}>
            <Container fluid style={{ marginTop: "30px" }}>
                <Content />
            </Container>
        </ClassLayout>
    );
}

