/**
 * HowItWorks.tsx
 * Used to show the benefits of using the platform for students.
 * @AshokSaravanan
 * 03/26/2025
 */

import { Carousel } from '@mantine/carousel';
import { Avatar, Box, Card, Container, Grid, Group, Text, Title } from "@mantine/core";
import Image from "next/image";
import styles from './HowItWorks.module.css';
import { useMediaQuery } from "@mantine/hooks";
import { useState, useEffect, useRef } from 'react';

export default function HowItWorks() {
    const isMobile = useMediaQuery("(max-width: 768px)");
    const [activeStep, setActiveStep] = useState(0);
    const carouselRef = useRef<HTMLDivElement>(null);
    
    const steps = [
        {
            number: 1,
            title: "1. Sign Up with Microsoft",
            description: "Create your account using your institutional Microsoft credentials for secure and seamless access to Scribe's teaching tools.",
            image: "/images/scribe1.png",
            alt: "Microsoft Login"
        },
        {
            number: 2,
            title: "2. Import Your Course",
            description: "Connect to Brightspace and import your course materials, syllabus, assignments, and lecture notes with just a few clicks.",
            image: "/images/scribe2.png",
            alt: "Brightspace Import"
        },
        {
            number: 3,
            title: "3. AI Processes Your Content",
            description: "Our AI analyzes and organizes your course materials, creating a knowledge base that understands your specific teaching approach and curriculum.",
            image: "/images/scribe3.png",
            alt: "AI Processing"
        },
        {
            number: 4,
            title: "4. Configure & Customize",
            description: "Set instructions for how the AI should assist students, generate practice problems, and customize the learning experience to match your teaching goals.",
            image: "/images/scribe4.png",
            alt: "Customize Settings"
        }
    ];

    const slides = steps.map((step) => (
        <Carousel.Slide key={step.number} className={styles.carouselSlide}>
            <Card shadow="sm" radius="md" withBorder className={styles.imageCard} p={0}>
                <Card.Section>
                    <div className={styles.imageWrapper}>
                        <Image
                            src={step.image}
                            alt={step.alt}
                            fill
                            style={{ objectFit: 'cover' }}
                            className={styles.stepImage}
                            priority
                        />
                    </div>
                </Card.Section>
            </Card>
        </Carousel.Slide>
    ));

    // Handle carousel change
    const handleSlideChange = (index: number) => {
        setActiveStep(index);
    };

    // Update content when activeStep changes
    useEffect(() => {
        const stepContents = document.querySelectorAll(`.${styles.stepContent}`);
        stepContents.forEach((content, index) => {
            if (index === activeStep) {
                content.classList.add(styles.activeStep);
            } else {
                content.classList.remove(styles.activeStep);
            }
        });
    }, [activeStep]);

    return (
        <Box style={{
            padding: isMobile ? "40px 20px" : "80px 40px",
            position: "relative",
            overflow: "hidden"
        }} className={styles.container}>
            <div className={styles.backgroundGradient}></div>
            
            <Container size="lg" style={{ position: "relative", zIndex: 1 }}>
                <Title order={2} ta="center" mb={20} className={styles.sectionTitle}>How It Works</Title>
                <Text ta="center" size="lg" c="dimmed" mb={50} maw={800} mx="auto" style={{ position: "relative", zIndex: 1 }}>
                    Get your course AI-ready in just a few simple steps.
                </Text>

                <Grid gutter={40}>
                    <Grid.Col span={{ base: 12, md: 8 }}>
                        <Carousel
                            withIndicators
                            loop
                            classNames={{
                                root: styles.carousel,
                                controls: styles.carouselControls,
                                indicator: styles.carouselIndicator,
                            }}
                            onSlideChange={handleSlideChange}
                            ref={carouselRef}
                            style={{ width: "100%" }}
                        >
                            {slides}
                        </Carousel>
                    </Grid.Col>
                    
                    <Grid.Col span={{ base: 12, md: 4 }} className={styles.contentCol}>
                        <div className={styles.stepsContent}>
                            {steps.map((step, index) => (
                                <div key={step.number} className={`${styles.stepContent} ${index === activeStep ? styles.activeStep : ''}`} data-step={step.number}>
                                    <Title order={3} mb="md" className={styles.stepTitle}>{step.title}</Title>
                                    <Text className={styles.stepDescription}>{step.description}</Text>
                                </div>
                            ))}
                        </div>
                    </Grid.Col>
                </Grid>
            </Container>
        </Box>
    );
}