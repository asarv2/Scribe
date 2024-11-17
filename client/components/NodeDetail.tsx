/**
 * NodeDetail.tsx
 * Will be used to show details about the individual topic
 * @AshokSaravanan222
 * 11-14-2024
 */

import { Topic } from '@/types'
import { getTopic } from '@/utils/queries/get-topic'
import { getTopicLectures } from '@/utils/queries/get-topic-lectures'
import useSupabaseBrowser from '@/utils/supabase/supabase-browser'
import { ActionIcon, Button, Card, Flex, Group, Paper, Skeleton, Stack, Text } from '@mantine/core'
import { IconArrowNarrowRight, IconArrowRightToArc } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'

export type NodeDetailProps = {
    topicId: string
}

export const NodeDetail: React.FC<NodeDetailProps> = ({ topicId }) => {
    const supabase = useSupabaseBrowser();

    const { data: topic, isLoading: loadingTopic } = useQuery({
        queryKey: ["topic", topicId],
        queryFn: () => getTopic(supabase, topicId)
    })


    const { data: lectures, isLoading: loadingLectures } = useQuery({
        queryKey: ["lectures", ...(topic ? topic.lectures : [])],
        queryFn: () => getTopicLectures(supabase, (topic ? topic.lectures : [])),
        enabled: !!topic
    }) // need to rearrange the code as soon as the front end works.

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