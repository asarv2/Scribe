/**
 * app/classes/page.tsx
 * 
 * This page is the main page for the classes.
 * 
 * @AshokSaravanan222
 * 18.02.2025
 */
"use client";

import { GeneralLayout } from "@/components/General/GeneralLayout";
import { Container, Stack, Text, SimpleGrid, Card, Group, Button, Skeleton } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { getClasses } from "@/utils/queries/get-classes";
import { getUser } from "@/utils/queries/get-user";
import Image from "next/image";
import Link from "next/link";
import { getProfile } from "@/utils/queries/get-profile";
import { getCourseImageUrl } from "@/utils/services/images";
import { ClassLayout } from "@/components/Class/ClassLayout";

export default function ClassesPage() {
    const supabase = useSupabaseBrowser();

    const { data: user, isLoading: loadingUser } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase),
    });

    const { data: profile, isLoading: loadingProfile } = useQuery({
        queryKey: ["profile", user?.id],
        queryFn: () => getProfile(supabase, user!.id),
        enabled: !!user
    })

    const { data: classes, isLoading: loadingClasses } = useQuery({
        queryKey: ["classes"],
        queryFn: () => getClasses(supabase),
    });

    const getFilteredClasses = () => {
        if (!profile || !classes) return [];
        return profile.admin ? classes : classes?.filter(classItem => profile.classes?.includes(classItem.id));
    }

    // Add skeleton components
    function ClassCardSkeleton() {
        return (
            <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Card.Section>
                    <Skeleton height={160} radius={0} />
                </Card.Section>

                <Group justify="space-between" mt="md" mb="xs">
                    <Skeleton height={20} width="70%" />
                </Group>

                <Skeleton height={36} mt="sm" width="90%" />
                <Skeleton height={36} mt="sm" />
            </Card>
        );
    }

    return (
        <ClassLayout classId={null}>
            <Container fluid style={{ marginTop: "30px" }}>
                <Stack>
                    {(loadingUser || loadingProfile || !classes) ? (
                        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
                            {[...Array(6)].map((_, index) => (
                                <ClassCardSkeleton key={index} />
                            ))}
                        </SimpleGrid>
                    ) : (
                        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
                            {getFilteredClasses()?.map((classItem) => (
                                <Card 
                                    key={classItem.id} 
                                    shadow="sm" 
                                    padding="lg" 
                                    radius="md" 
                                    withBorder
                                    style={{ display: 'flex', flexDirection: 'column' }}
                                >
                                    <Card.Section>
                                        <Image
                                            src={getCourseImageUrl(classItem.id)}
                                            height={160}
                                            width={600}
                                            alt={classItem.title ?? "Class Image"}
                                            style={{
                                                objectFit: 'cover',
                                                width: '100%'
                                            }}
                                        />
                                    </Card.Section>

                                    <Stack justify="space-between" h="100%" mt="md">
                                        <div>
                                            <Text 
                                                fw={500} 
                                                lineClamp={2}
                                                style={{ 
                                                    minHeight: '48px',
                                                    marginBottom: '8px'
                                                }}
                                            >
                                                {classItem.class_code} - {classItem.title}
                                            </Text>

                                            <Text 
                                                size="sm" 
                                                c="dimmed" 
                                                lineClamp={2}
                                                style={{ 
                                                    minHeight: '40px',
                                                }}
                                            >
                                                {classItem.course_description || 'No description available'}
                                            </Text>
                                        </div>

                                        <Button 
                                            component={Link} 
                                            href={`/classes/c/${classItem.id}`} 
                                            color="blue" 
                                            fullWidth 
                                            radius="md"
                                        >
                                            View Class
                                        </Button>
                                    </Stack>
                                </Card>
                            ))}
                        </SimpleGrid>
                    )}
                </Stack>
            </Container>
        </ClassLayout>
    );
}