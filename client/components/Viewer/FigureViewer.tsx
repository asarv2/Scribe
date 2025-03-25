/**
 * FigureViewer.tsx
 * This component is used to display a figure in the viewer.
 * @AshokSaravanan222
 * 03-25-2025
 */

import { getFigureUrl } from "@/utils/services/images";
import { Skeleton } from "@mantine/core";

import { Box } from "@mantine/core";
import Image from "next/image";

export default function FigureViewer({ figureId }: { figureId: string }) {
    return (
        <Box
            pos="relative"
            style={{
                maxWidth: '100%',
                display: 'flex',
                justifyContent: 'center',
                margin: 0,
                padding: 0
            }}
        >
            <Box style={{ width: '100%', position: 'relative' }}>
                {figureId === 'code-placeholder' ? (
                    // Code placeholder - show a skeleton without trying to load an image
                    <Skeleton
                        visible={true}
                        height={"100%"}
                        radius="md"
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            maxWidth: '60%',
                            display: 'block',
                            margin: 0
                        }}
                    />
                ) : (
                    // Regular figure - show the image with loading skeleton
                    <>
                        <Skeleton
                            visible={true}
                            height={"100%"}
                            radius="md"
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                maxWidth: '60%',
                                display: 'block',
                                margin: 0
                            }}
                        />
                        <Image
                            src={getFigureUrl(figureId)}
                            alt="Figure"
                            width={800}
                            height={600}
                            style={{
                                maxWidth: '60%',
                                height: 'auto',
                                borderRadius: '24px',
                                objectFit: 'contain',
                                opacity: 0,
                                transition: 'opacity 0.2s',
                                padding: '1rem'
                            }}
                            onLoad={(e) => {
                                const img = e.target as HTMLImageElement;
                                const aspectRatio = img.naturalWidth / img.naturalHeight;
                                if (aspectRatio > 1.5) {
                                    img.style.padding = '0.5rem';
                                }
                                img.style.opacity = '1';
                                const skeleton = img.parentElement?.querySelector('.mantine-Skeleton-root');
                                if (skeleton) {
                                    (skeleton as HTMLElement).style.display = 'none';
                                }
                            }}
                            priority={false}
                        />
                    </>
                )}
            </Box>
        </Box>
    )
}


