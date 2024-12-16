/**
 * NodeDetail.tsx
 * Will be used to show details about the individual topic
 * @AshokSaravanan222
 * 11-14-2024
 */

import { getTopicLectures } from '@/utils/queries/get-topic-lectures'
import useSupabaseBrowser from '@/utils/supabase/supabase-browser'
import { Button, Card, Paper, Skeleton, Stack, Text } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'

export type NodeDetailProps = {
    lectureIds: string[]
}

export const NodeDetail: React.FC<NodeDetailProps> = ({ lectureIds }) => {
    const supabase = useSupabaseBrowser();


    const { data: lectures, isLoading: loadingLectures } = useQuery({
        queryKey: ["lectures", ...lectureIds],
        queryFn: () => getTopicLectures(supabase, lectureIds),
    })

    return (
        <Paper>
            <Stack>
                <Card withBorder>
                    <Skeleton visible={loadingLectures}>
                        <Stack>
                            {lectures && lectures.length > 0 ? lectures.map(lecture => (
                                <Link href={`${window.location.origin}/classes/${lecture.class}/slide/${lecture.id}`} key={lecture.id}>
                                    <Button
                                        color='teal'
                                    >
                                        L{lecture.note_number} - {lecture.name}
                                    </Button>
                                </Link>
                            )) : <Text>No lectures found.</Text>}
                        </Stack>
                    </Skeleton>
                </Card>
            </Stack>
        </Paper>
    )
}