/**
 * ForStudents.tsx
 * Used to show the benefits of using the platform for students.
 * @AshokSaravanan
 * 03/26/2025
 */

import { Avatar } from "@mantine/core";
import { Card, Center } from "@mantine/core";
import { Grid, Text, Title } from "@mantine/core";
import { Container } from "@mantine/core";
import { Box } from "@mantine/core";
import { IconChartBar, IconDeviceLaptop, IconEye } from "@tabler/icons-react";
import styles from './ForStudents.module.css';
import { useMediaQuery } from "@mantine/hooks";
import { useRef, useState, useEffect } from 'react';

export default function ForStudents() {
    const isMobile = useMediaQuery("(max-width: 768px)");
    const [activeCard, setActiveCard] = useState<number | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);
    
    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect();
                }
            },
            { threshold: 0.1 }
        );
        
        if (containerRef.current) {
            observer.observe(containerRef.current);
        }
        
        return () => observer.disconnect();
    }, []);
    
    // Calculate card positions for animation
    const handleCardHover = (index: number | null) => {
        setActiveCard(index);
    };
    
    return (
        <Box style={{
            padding: isMobile ? "40px 20px" : "80px 40px",
            position: "relative",
            overflow: "hidden"
        }} className={styles.container}>
            <div className={styles.backgroundStripes}></div>
            <div className={styles.topFade}></div>
            
            <Container size="lg" style={{ position: "relative", zIndex: 1 }}>
                <Box mb={50}>
                    <Title order={1} ta="left" mb={20} className={`${styles.sectionTitle} ${isVisible ? styles.visible : ''}`}>Students</Title>
                </Box>

                <div className={styles.cardsContainer} ref={containerRef}>
                    <div 
                        className={`${styles.cardWrapper} ${activeCard === 0 ? styles.activeCardWrapper : ''} ${activeCard !== null && activeCard !== 0 ? styles.inactiveCardWrapper : ''}`}
                        onMouseEnter={() => handleCardHover(0)}
                        onMouseLeave={() => handleCardHover(null)}
                        style={{ 
                            zIndex: activeCard === 0 ? 3 : 1,
                            transform: activeCard === 1 ? 'translateX(-10%)' : activeCard === 2 ? 'translateX(-20%)' : 'translateX(0)'
                        }}
                    >
                        <Card 
                            shadow="sm" 
                            p="xl" 
                            radius="md" 
                            className={`${styles.card} ${activeCard === 0 ? styles.activeCard : ''}`}
                        >
                            <div className={styles.cardBorder}></div>
                            <div className={styles.cardContent}>
                                <div className={styles.videoContainer}>
                                    <video 
                                        className={styles.video}
                                        autoPlay 
                                        muted 
                                        loop 
                                        playsInline
                                    >
                                        <source src="/videos/ready-content.mp4" type="video/mp4" />
                                        Your browser does not support the video tag.
                                    </video>
                                </div>
                                <Title order={3} ta="center" mb="md" mt="lg">24/7 Office Hours</Title>
                                <Text ta="center">
                                    Talk to an AI assistant equipped with your course materials. Anytime, anywhere.
                                </Text>
                            </div>
                        </Card>
                    </div>

                    <div 
                        className={`${styles.cardWrapper} ${activeCard === 1 ? styles.activeCardWrapper : ''} ${activeCard !== null && activeCard !== 1 ? styles.inactiveCardWrapper : ''}`}
                        onMouseEnter={() => handleCardHover(1)}
                        onMouseLeave={() => handleCardHover(null)}
                        style={{ 
                            zIndex: activeCard === 1 ? 3 : 2,
                            transform: activeCard === 0 ? 'translateX(10%)' : activeCard === 2 ? 'translateX(-10%)' : 'translateX(0)'
                        }}
                    >
                        <Card 
                            shadow="sm" 
                            p="xl" 
                            radius="md" 
                            className={`${styles.card} ${activeCard === 1 ? styles.activeCard : ''}`}
                        >
                            <div className={styles.cardBorder}></div>
                            <div className={styles.cardContent}>
                                <div className={styles.videoContainer}>
                                    <video 
                                        className={styles.video}
                                        autoPlay 
                                        muted 
                                        loop 
                                        playsInline
                                    >
                                        <source src="/videos/interactive-viz.mp4" type="video/mp4" />
                                        Your browser does not support the video tag.
                                    </video>
                                </div>
                                <Title order={3} ta="center" mb="md" mt="lg">Visualizations</Title>
                                <Text ta="center">
                                    Understand complex concepts through dynamic visualizations, graphs, and interactive models that bring learning to life.
                                </Text>
                            </div>
                        </Card>
                    </div>

                    <div 
                        className={`${styles.cardWrapper} ${activeCard === 2 ? styles.activeCardWrapper : ''} ${activeCard !== null && activeCard !== 2 ? styles.inactiveCardWrapper : ''}`}
                        onMouseEnter={() => handleCardHover(2)}
                        onMouseLeave={() => handleCardHover(null)}
                        style={{ 
                            zIndex: activeCard === 2 ? 3 : 1,
                            transform: activeCard === 0 ? 'translateX(20%)' : activeCard === 1 ? 'translateX(10%)' : 'translateX(0)'
                        }}
                    >
                        <Card 
                            shadow="sm" 
                            p="xl" 
                            radius="md" 
                            className={`${styles.card} ${activeCard === 2 ? styles.activeCard : ''}`}
                        >
                            <div className={styles.cardBorder}></div>
                            <div className={styles.cardContent}>
                                <div className={styles.videoContainer}>
                                    <video 
                                        className={styles.video}
                                        autoPlay 
                                        muted 
                                        loop 
                                        playsInline
                                    >
                                        <source src="/videos/exam-prep.mp4" type="video/mp4" />
                                        Your browser does not support the video tag.
                                    </video>
                                </div>
                                <Title order={3} ta="center" mb="md" mt="lg">Exam Preparation</Title>
                                <Text ta="center">
                                    Generate practice problems or summaries of your course materials to prepare for exams.
                                </Text>
                            </div>
                        </Card>
                    </div>
                </div>
            </Container>
        </Box>
    );
}