/**
 * GenerateForm.tsx
 * This component is for generating problems or summaries for a class. It will show all the topics/lectures of the class, and the option to generate summaries or problems for a topic/lecture.
 * @AshokSaravanan222
 * 01.03.2025
 */

import { useEffect, useState } from "react";
import { notifications } from '@mantine/notifications';
import { useMediaQuery } from "@mantine/hooks";
import Markdown from 'markdown-to-jsx'
import Image from "next/image";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { HeaderSimple } from "@/components/HeaderSimple";
import Link from "next/link";
import { getClass } from "@/utils/queries/get-class";;
import { usePathname, useSearchParams } from "next/navigation";
import { IconArrowLeft, IconArrowRight, IconUpload, IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import { getUser } from "@/utils/queries/get-user";
import { ActionIcon, Box, Button, em, Group, Stack } from "@mantine/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getLecture } from "@/utils/queries/get-lecture";
import { Grid } from "@mantine/core";
import { Flex } from "@mantine/core";
import { Container } from "@mantine/core";
import { getLectures } from "@/utils/queries/get-lectures";
import { Text, Card, Image as MantineImage } from "@mantine/core";
import { useRouter } from "next/navigation";
import { Radio, Select, Checkbox, Paper, NumberInput } from '@mantine/core';
import { getMap } from "@/utils/queries/get-map";
import { MapNode } from "@/utils/map/map-tree";
import { getTopics } from "@/utils/queries/get-topics";

export default function GenerateForm({classId}: {classId: string}) {
    const supabase = useSupabaseBrowser();

    const isMobile = useMediaQuery(`(max-width: ${em(750)})`);

    const { data: classData, isLoading: loadingClassData } = useQuery({
        queryKey: ["class", classId],
        queryFn: () => getClass(supabase, classId)
    })

    const { data: lectures, isLoading: loadingLectures } = useQuery({
        queryKey: ["lectures", classId],
        queryFn: () => getLectures(supabase, classId)
    })

    const {data: map, isLoading: loadingMap} = useQuery({
        queryKey: ["map", classId],
        queryFn: () => getMap(supabase, classId, classData!.map),
        enabled: !!classData
    })

    const {data: topics, isLoading: loadingTopics} = useQuery({
        queryKey: ["topics", classId],
        queryFn: () => getTopics(supabase, classId, classData!.map),
        enabled: !!classData
    })

    const { data: user, isLoading: loadingUser } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase),
    })

    const searchParams = useSearchParams();
    const topicFromUrl = searchParams.get('topic');

    const [contentType, setContentType] = useState<'summary' | 'problems'>(topicFromUrl ? 'problems' : 'summary');
    const [sourceType, setSourceType] = useState<string | null>(topicFromUrl ? 'topics' : null);
    const [selectedItems, setSelectedItems] = useState<string[]>(topicFromUrl ? [topicFromUrl] : []);
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

    // Add new state for problem options
    const [problemType, setProblemType] = useState<'mcq' | 'frq'>('mcq');
    const [problemStyle, setProblemStyle] = useState<'conceptual' | 'computational'>('conceptual');
    const [problemParts, setProblemParts] = useState<'single' | 'multi'>('single');
    const [numQuestions, setNumQuestions] = useState<number>(3);

    useEffect(() => {
        if (topicFromUrl && map) {
            const findNode = (node: MapNode): MapNode | null => {
                if (node.id === topicFromUrl) return node;
                if (!node.children) return null;
                for (const child of node.children) {
                    const found = findNode(child);
                    if (found) return found;
                }
                return null;
            };

            const node = findNode(map);
            if (node) {
                const parentIds = getAllParentIds(map, topicFromUrl);
                setExpandedNodes(new Set([...parentIds, topicFromUrl]));
                const childrenIds = getAllChildrenIds(node);
                setSelectedItems([...childrenIds]);
            }
        }
    }, [topicFromUrl, map]);

    const toggleNode = (nodeId: string) => {
        const newExpanded = new Set(expandedNodes);
        if (newExpanded.has(nodeId)) {
            newExpanded.delete(nodeId);
        } else {
            newExpanded.add(nodeId);
        }
        setExpandedNodes(newExpanded);
    };

    const handleGenerate = () => {
        console.log({
            contentType,
            sourceType,
            selectedItems,
            ...(contentType === 'problems' && {
                numQuestions,
                problemType,
                problemStyle,
                problemParts
            })
        });
    };

    const getAllChildrenIds = (node: MapNode): string[] => {
        let ids: string[] = [node.id];
        if (node.children) {
            node.children.forEach(child => {
                ids = [...ids, ...getAllChildrenIds(child)];
            });
        }
        return ids;
    };

    const getAllParentIds = (node: MapNode, targetId: string): string[] => {
        let parents: string[] = [];
        
        const findParent = (currentNode: MapNode, targetId: string): boolean => {
            if (!currentNode.children) return false;
            
            if (currentNode.children.some(child => child.id === targetId || findParent(child, targetId))) {
                parents.push(currentNode.id);
                return true;
            }
            return false;
        };

        findParent(node, targetId);
        return parents;
    };

    const handleTopicChange = (topicId: string, checked: boolean) => {
        if (!map) return;

        let newSelectedItems = [...selectedItems];

        if (checked) {
            const findNode = (node: MapNode): MapNode | null => {
                if (node.id === topicId) return node;
                if (!node.children) return null;
                for (const child of node.children) {
                    const found = findNode(child);
                    if (found) return found;
                }
                return null;
            };

            const node = findNode(map);
            if (node) {
                const childrenIds = getAllChildrenIds(node);
                newSelectedItems = Array.from(new Set([...newSelectedItems, ...childrenIds]));
            }
        } else {
            const findNode = (node: MapNode): MapNode | null => {
                if (node.id === topicId) return node;
                if (!node.children) return null;
                for (const child of node.children) {
                    const found = findNode(child);
                    if (found) return found;
                }
                return null;
            };

            const node = findNode(map);
            if (node) {
                const childrenIds = getAllChildrenIds(node);
                newSelectedItems = newSelectedItems.filter(id => !childrenIds.includes(id));
            }
        }

        setSelectedItems(newSelectedItems);
    };

    const renderTopicCheckboxes = (node: MapNode, depth = 0) => {
        if (!node) return null;
        
        const childrenIds = node.children ? getAllChildrenIds(node) : [node.id];
        const allChildrenSelected = childrenIds.every(id => selectedItems.includes(id));
        const someChildrenSelected = !allChildrenSelected && childrenIds.some(id => selectedItems.includes(id));
        const isExpanded = expandedNodes.has(node.id);
        
        return (
            <Stack key={node.id} ml={depth * 20}>
                <Group style={{ cursor: 'pointer' }}>
                    {node.children && node.children.length > 0 && (
                        <ActionIcon 
                            size="sm" 
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleNode(node.id);
                            }}
                            variant="outline"
                        >
                            {isExpanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                        </ActionIcon>
                    )}
                    <Checkbox 
                        value={node.id} 
                        label={node.keyword}
                        styles={{
                            label: {
                                cursor: 'pointer',
                            },
                            input: {
                                cursor: 'pointer',
                            }
                        }}
                        checked={allChildrenSelected}
                        indeterminate={someChildrenSelected}
                        onChange={(event) => handleTopicChange(node.id, event.currentTarget.checked)}
                    />
                </Group>
                {isExpanded && node.children?.map((child: any) => renderTopicCheckboxes(child, depth + 1))}
            </Stack>
        );
    };

    return (
        <>
            <HeaderSimple />
            <Container fluid>
                <Stack>
                    <Flex justify="space-between" align="center">
                        <Group>
                            <Link href={`/classes/${classId}/generate`}>
                                <IconArrowLeft size={24} color="black" style={{ cursor: "pointer" }} />
                            </Link>
                            <Text size="xl" fw={700} mb={6}>Generate</Text>
                        </Group>
                    </Flex>

                    <Paper shadow="xs" p="md" withBorder>
                        <Stack>
                            <Radio.Group
                                value={contentType}
                                onChange={(value) => setContentType(value as 'summary' | 'problems')}
                                label="What would you like to generate?"
                                required
                            >
                                <Group mt="xs">
                                    <Radio value="problems" label="Problems" />
                                    <Radio value="summary" label="Summary" />
                                </Group>
                            </Radio.Group>

                            <Select
                                label="Select source"
                                placeholder="Choose topics or lectures"
                                value={sourceType}
                                onChange={(value) => {
                                    setSourceType(value);
                                    setSelectedItems([]);
                                }}
                                data={[
                                    { value: 'topics', label: 'Topics' },
                                    { value: 'lectures', label: 'Lectures' },
                                ]}
                            />

                            {sourceType && (
                                <Checkbox.Group
                                    value={selectedItems}
                                    onChange={setSelectedItems}
                                    label={`Select ${sourceType}`}
                                >
                                    <Box style={{ maxHeight: '300px', overflowY: 'auto' }} p="xs">
                                        {sourceType === 'topics' && map && (
                                            renderTopicCheckboxes(map)
                                        )}
                                        {sourceType === 'lectures' && (
                                            <Stack>
                                                {lectures?.map((lecture) => (
                                                    <Checkbox 
                                                        key={lecture.id} 
                                                        value={lecture.id} 
                                                        label={lecture.name}
                                                        styles={{
                                                            label: {
                                                                cursor: 'pointer',
                                                            }
                                                        }}
                                                    />
                                                ))}
                                            </Stack>
                                        )}
                                    </Box>
                                </Checkbox.Group>
                            )}

                            {/* Add new problem options when contentType is 'problems' */}
                            {contentType === 'problems' && (
                                <>
                                    <NumberInput
                                        label="Number of questions"
                                        description="How many questions would you like to generate?"
                                        value={numQuestions}
                                        onChange={(val) => setNumQuestions(Number(val))}
                                        min={1}
                                        max={10}
                                        required
                                    />

                                    <Radio.Group
                                        value={problemType}
                                        onChange={(value) => setProblemType(value as 'mcq' | 'frq')}
                                        label="Question Type"
                                        description="Choose between multiple choice or free response"
                                        required
                                    >
                                        <Group mt="xs">
                                            <Radio value="mcq" label="Multiple Choice (MCQ)" />
                                            <Radio value="frq" label="Free Response (FRQ)" />
                                        </Group>
                                    </Radio.Group>

                                    <Radio.Group
                                        value={problemStyle}
                                        onChange={(value) => setProblemStyle(value as 'conceptual' | 'computational')}
                                        label="Problem Style"
                                        description="Choose between conceptual or computational problems"
                                        required
                                    >
                                        <Group mt="xs">
                                            <Radio value="conceptual" label="Conceptual" />
                                            <Radio value="computational" label="Computational" />
                                        </Group>
                                    </Radio.Group>

                                    <Radio.Group
                                        value={problemParts}
                                        onChange={(value) => setProblemParts(value as 'single' | 'multi')}
                                        label="Problem Structure"
                                        description="Choose between single-part or multi-part problems"
                                        required
                                    >
                                        <Group mt="xs">
                                            <Radio value="single" label="Single-Part" />
                                            <Radio value="multi" label="Multi-Part" />
                                        </Group>
                                    </Radio.Group>
                                </>
                            )}

                            <Button 
                                onClick={() => handleGenerate()}
                                disabled={!sourceType || selectedItems.length === 0}
                            >
                                Generate
                            </Button>
                        </Stack>
                    </Paper>
                </Stack>
            </Container>
        </>
    );
}