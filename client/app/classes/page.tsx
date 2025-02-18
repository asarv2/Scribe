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
import { Container, Stack, Text, SimpleGrid, Card, Group, Button } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { getClasses } from "@/utils/queries/get-classes";
import { getUser } from "@/utils/queries/get-user";
import Image from "next/image";
import Link from "next/link";

export default function ClassesPage() {
    const supabase = useSupabaseBrowser();

    const { data: user } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase),
    });

    const { data: classes } = useQuery({
        queryKey: ["classes"],
        queryFn: () => getClasses(supabase),
        enabled: !!user
    });

    return (
        <GeneralLayout>
            <Container fluid style={{ marginTop: "30px" }}>
                <Stack>
                    <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
                        {classes?.map((classItem) => (
                            <Card key={classItem.id} shadow="sm" padding="lg" radius="md" withBorder>
                                <Card.Section>
                                    <Image
                                        src="/images/lecture.jpeg"
                                        height={160}
                                        width={600}
                                        alt={classItem.title ?? "Class Image"}
                                        style={{
                                            objectFit: 'cover',
                                            width: '100%'
                                        }}
                                    />
                                </Card.Section>

                                <Group justify="space-between" mt="md" mb="xs" >
                                    <Text fw={500} lineClamp={2}>{classItem.class_code} - {classItem.title}</Text>
                                </Group>

                                <Text size="sm" c="dimmed" mb="md" lineClamp={2}>
                                    {classItem.course_description || 'No description available'}
                                </Text>

                                <Button 
                                    component={Link} 
                                    href={`/classes/c/${classItem.id}`} 
                                    color="blue" 
                                    fullWidth 
                                    radius="md"
                                >
                                    View Class
                                </Button>
                            </Card>
                        ))}
                    </SimpleGrid>
                </Stack>
            </Container>
        </GeneralLayout>
    );
}