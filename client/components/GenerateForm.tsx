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
import { ActionIcon, Box, Button, em, Group, Stack, Textarea, TextInput } from "@mantine/core";
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
import { createGeneration } from "@/utils/services/generation";
import Latex from "@/components/Latex";

export default function GenerateForm({ classId, type }: { classId: string, type: 'problems' | 'summary' }) {
    const queryClient = useQueryClient();
    const supabase = useSupabaseBrowser();
    const router = useRouter();

    const isMobile = useMediaQuery(`(max-width: ${em(750)})`);

    const { data: classData, isLoading: loadingClassData } = useQuery({
        queryKey: ["class", classId],
        queryFn: () => getClass(supabase, classId)
    })

    const { data: lectures, isLoading: loadingLectures } = useQuery({
        queryKey: ["lectures", classId],
        queryFn: () => getLectures(supabase, classId)
    })

    const { data: map, isLoading: loadingMap } = useQuery({
        queryKey: ["map", classId],
        queryFn: () => getMap(supabase, classId, classData!.map),
        enabled: !!classData
    })

    const { data: topics, isLoading: loadingTopics } = useQuery({
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

    const [loading, setLoading] = useState<boolean>(false);

    const [generationTitle, setGenerationTitle] = useState<string>("");
    const [contentType, setContentType] = useState<'summary' | 'problem'>(type === 'summary' ? 'summary' : 'problem');
    const [sourceType, setSourceType] = useState<string | null>(topicFromUrl ? 'topics' : 'lectures');
    const [selectedItems, setSelectedItems] = useState<string[]>(topicFromUrl ? [topicFromUrl] : []);
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

    // Add new state for problem options
    const [problemType, setProblemType] = useState<'mcq' | 'frq'>('mcq');
    const [problemStyle, setProblemStyle] = useState<'conceptual' | 'computational'>('conceptual');
    const [problemParts, setProblemParts] = useState<'single' | 'multi'>('single');
    const [numQuestions, setNumQuestions] = useState<number | undefined>(3);
    const [additionalInstructions, setAdditionalInstructions] = useState<string>("");

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

    const handleGenerate = async () => {
        console.log({
            generationTitle,
            contentType,
            sourceType,
            selectedItems,
            ...(contentType === 'problem' && {
                numQuestions,
                problemType,
                problemStyle,
                problemParts
            })
        });

        try {
            setLoading(true);
            // create generation
            const generationLectures = sourceType === 'lectures' ? selectedItems : [];
            const generationTopics = sourceType === 'topics' ? selectedItems.map((topicMapId) => topics?.find((topic) => topic.map_id === topicMapId)).map((topic) => topic?.id).filter((id) => id !== undefined) : [];
            const questions = contentType === 'problem' ? numQuestions ?? 0 : 0;
            const generation = await createGeneration(classId, generationTitle, contentType, generationLectures, generationTopics, questions, problemType === 'mcq', problemStyle === 'conceptual', problemParts === 'single');
            console.log(generation);

            if (contentType === 'summary') {
                supabase.functions.invoke('generate-summary', {
                    body: {
                        class_id: classId,
                        generation_id: generation.id,
                    }
                });
                queryClient.invalidateQueries({ queryKey: ["summariesGenerations", classId] });
                // do not wait for response
                router.push(`/classes/${classId}/generate/summary`);
            } else if (contentType === 'problem') {
                supabase.functions.invoke('generate-problems', {
                    body: {
                        class_id: classId,
                        generation_id: generation.id,
                        additional_instructions: additionalInstructions,
                    }
                });
                queryClient.invalidateQueries({ queryKey: ["problemGenerations", classId] });
                // do not wait for response
                router.push(`/classes/${classId}/generate/problems`);
            } else {
                throw new Error("Invalid content type");
            }
        } catch (error) {
            console.error("Error generating summary:", error);
        } finally {
            setLoading(false);
        }
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
                        label={<Latex>{node.keyword}</Latex>}
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
            <Container fluid style={{ marginTop: "30px" }}>
                <Stack>
                    <Flex justify="space-between" align="center">
                        <Group>
                            <Link href={`/classes/${classId}/generate/${type === 'summary' ? 'summary' : 'problems'}`}>
                                <IconArrowLeft size={24} color="black" style={{ cursor: "pointer" }} />
                            </Link>
                            <Text size="xl" fw={700} mb={6}>Generate {type === 'summary' ? 'Summary' : 'Problems'}</Text>
                        </Group>
                    </Flex>

                    <Paper shadow="xs" p="md" withBorder>
                        <Stack>
                            <TextInput
                                label="Generation Title"
                                placeholder="Enter a title for the generation"
                                value={generationTitle}
                                onChange={(event) => setGenerationTitle(event.target.value)}
                            />
                            {/* <Radio.Group
                                value={contentType}
                                onChange={(value) => setContentType(value as 'summary' | 'problem')}
                                label="What would you like to generate?"
                                required
                            >
                                <Group mt="xs">
                                    <Radio value="problem" label="Problems" />
                                    <Radio value="summary" label="Summary" />
                                </Group>
                            </Radio.Group> */}

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
                            {contentType === 'problem' && (
                                <>
                                    <NumberInput
                                        label="Number of questions"
                                        description="How many questions would you like to generate?"
                                        value={numQuestions}
                                        onChange={(val) => {
                                            if (val) {
                                                setNumQuestions(Number(val));
                                            } else {
                                                setNumQuestions(undefined);
                                            }
                                        }}
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

                                    <Textarea
                                        label="Additional Instructions"
                                        placeholder="Enter any additional instructions for the AI"
                                        value={additionalInstructions}
                                        onChange={(event) => setAdditionalInstructions(event.target.value)}
                                    />
                                </>
                            )}

                            <Button
                                onClick={() => handleGenerate()}
                                disabled={!sourceType || selectedItems.length === 0 || numQuestions === undefined || generationTitle === ""}
                                loading={loading}
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