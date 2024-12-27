/**
 * NodeImages.tsx
 * Will be used to show images of the individual topic
 * @AshokSaravanan222
 * 11-14-2024
 */

import { Card, Paper, Stack, ActionIcon } from '@mantine/core'
import Image from 'next/image'
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import { useState } from 'react'

export type NodeImagesProps = {
    visuals: string[]
}

export const NodeImages: React.FC<NodeImagesProps> = ({ visuals }) => {
    const [currentIndex, setCurrentIndex] = useState(0)

    // Calculate prev and next indices
    const prevIndex = (currentIndex - 1 + visuals.length) % visuals.length
    const nextIndex = (currentIndex + 1) % visuals.length

    const nextImage = () => {
        setCurrentIndex((prev) => (prev + 1) % visuals.length)
    }

    const prevImage = () => {
        setCurrentIndex((prev) => (prev - 1 + visuals.length) % visuals.length)
    }

    return (
        visuals.length > 0 && (
            <Card style={{ alignSelf: 'center', width: '100%', padding: '0 40px' }}>
                <div style={{ position: 'relative', height: '200px' }}>
                    <Image 
                        src={visuals[currentIndex]} 
                        alt="Topic Image" 
                        fill
                        style={{ objectFit: 'contain' }}
                        priority
                    />
                    
                    {visuals.length > 1 && (
                        <>
                            <link rel="preload" as="image" href={visuals[prevIndex]} />
                            <link rel="preload" as="image" href={visuals[nextIndex]} />

                            <ActionIcon
                                variant="filled"
                                style={{
                                    position: 'absolute',
                                    left: -40,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                                }}
                                onClick={prevImage}
                            >
                                <IconChevronLeft size={20} />
                            </ActionIcon>

                            <ActionIcon
                                variant="filled"
                                style={{
                                    position: 'absolute',
                                    right: -40,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                                }}
                                onClick={nextImage}
                            >
                                <IconChevronRight size={20} />
                            </ActionIcon>

                            <div style={{
                                position: 'absolute',
                                bottom: 10,
                                left: '50%',
                                transform: 'translateX(-50%)',
                                display: 'flex',
                                gap: '10px'
                            }}>
                                {visuals.map((_, index) => (
                                    <div
                                        key={index}
                                        style={{
                                            width: '10px',
                                            height: '10px',
                                            borderRadius: '50%',
                                            backgroundColor: index === currentIndex ? '#228BE6' : '#E9ECEF',
                                            border: `2px solid ${index === currentIndex ? '#228BE6' : '#CED4DA'}`,
                                        }}
                                    />
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </Card>
        )
    )
}