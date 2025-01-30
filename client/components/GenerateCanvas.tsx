/**
 * client/app/classes/[classId]/generate/canvas/page.tsx
 * This component is for generating a canvas for a class.
 * @AshokSaravanan222
 * 01.30.2025
 */

import { Text, Card, TextInput, Button, Stack, Group, ScrollArea, em, Grid, AspectRatio, Badge, Switch, CloseButton, Textarea, Modal, Divider } from "@mantine/core";
import { useRouter } from "next/navigation";
import { HeaderSimple } from "@/components/HeaderSimple";
import { Container, Flex } from "@mantine/core";
import { IconArrowLeft, IconPlus, IconChevronDown, IconChevronRight, IconSearch, IconX, IconMinimize, IconTrash, IconCopy } from "@tabler/icons-react";
import Link from "next/link";
import { useState } from "react";
import { getUser } from "@/utils/queries/get-user";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getTopics } from "@/utils/queries/get-topics";
import { getMap } from "@/utils/queries/get-map";
import { getLectures } from "@/utils/queries/get-lectures";
import { getClass } from "@/utils/queries/get-class";
import { useMediaQuery } from "@mantine/hooks";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { MapNode } from "@/utils/map/map-tree";
import Latex from "@/components/Latex";
import { Checkbox, ActionIcon } from "@mantine/core";
import { createGeneration } from "@/utils/services/generation";
import { createQuestions } from "@/utils/services/questions";
import { v4 as uuidv4 } from 'uuid';

type GenerateCanvasProps = {
    classId: string;
}

interface ProblemCard {
    id: number;
    title: string;
    prompt: string;
    isMCQ: boolean;
    isMultiPart: boolean;
    isComputational: boolean;
    context: {
        lectures: string[];  // lecture IDs
        topics: string[];    // topic IDs
    };
}

export default function GenerateCanvas({ classId }: GenerateCanvasProps) {
    const [generationName, setGenerationName] = useState("");
    const [problems, setProblems] = useState<ProblemCard[]>([{
        id: 1,
        title: "Problem 1",
        prompt: "",
        isMCQ: false,
        isMultiPart: false,
        isComputational: false,
        context: {
            lectures: [],
            topics: []
        }
    }]);
    const [problemToDelete, setProblemToDelete] = useState<number | null>(null);

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

    // New state for search and topics
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const [selectedContext, setSelectedContext] = useState<string[]>([]);
    const [expandedProblemId, setExpandedProblemId] = useState<number>(1);
    const [selectedProblemIds, setSelectedProblemIds] = useState<Set<number>>(new Set([1]));

    // Add state for section expansion
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['lectures', 'topics']));

    const [loading, setLoading] = useState(false);

    const handleGenerate = async () => {
        try {
            setLoading(true);
            // creating generation
            const generation = await createGeneration(classId, generationName, 'problem', `${process.env.NEXT_PUBLIC_API_URL}`);
            console.log(generation);

            const multipartQuestions = problems.filter(problem => problem.isMultiPart).map(problem => {
                const multipart_uuid = uuidv4();
                // 3 questions
                return [{
                    generation: generation.id,
                    mcq: problem.isMCQ,
                    conceptual: problem.isComputational,
                    multipart: multipart_uuid,
                    additional_info: problem.prompt,
                    topics: problem.context.topics,
                    lectures: problem.context.lectures
                }, {
                    generation: generation.id,
                    mcq: problem.isMCQ,
                    conceptual: problem.isComputational,
                    multipart: multipart_uuid,
                    additional_info: problem.prompt,
                    topics: problem.context.topics,
                    lectures: problem.context.lectures
                }, {
                    generation: generation.id,
                    mcq: problem.isMCQ,
                    conceptual: problem.isComputational,
                    multipart: multipart_uuid,
                    additional_info: problem.prompt,
                    topics: problem.context.topics,
                    lectures: problem.context.lectures
                }]
            }).flat();
            
            const singleQuestions = problems.filter(problem => !problem.isMultiPart).map(problem => ({
                generation: generation.id,
                mcq: problem.isMCQ,
                conceptual: problem.isComputational,
                additional_info: problem.prompt,
                topics: problem.context.topics,
                lectures: problem.context.lectures
            }));

            // creating problems
            const {success, error} = await createQuestions([...singleQuestions, ...multipartQuestions]);
            if (!success) {
                throw new Error(error);
            }

            // invoke the generate/problems endpoint, do not wait for response
            fetch(`${process.env.NEXT_PUBLIC_API_URL}/generate/problems`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    class_id: classId,
                    generation_id: generation.id,
                })
            });
            queryClient.invalidateQueries({ queryKey: ["problemGenerations", classId] });
            // do not wait for response
            router.push(`/classes/${classId}/generate/problems`);
        } catch (error) {
            console.error("Error generating summary:", error);
        } finally {
            setLoading(false);
        }
    };

    const toggleNode = (nodeId: string) => {
        const newExpanded = new Set(expandedNodes);
        if (newExpanded.has(nodeId)) {
            newExpanded.delete(nodeId);
        } else {
            newExpanded.add(nodeId);
        }
        setExpandedNodes(newExpanded);
    };

    const toggleExpanded = (id: number) => {
        if (expandedProblemId === id){
            setExpandedProblemId(0);
        } else {
            setExpandedProblemId(id);
        }
    };

    const toggleSection = (section: string) => {
        const newExpanded = new Set(expandedSections);
        if (newExpanded.has(section)) {
            newExpanded.delete(section);
        } else {
            newExpanded.add(section);
        }
        setExpandedSections(newExpanded);
    };

    // Helper function to check if node or any children match search
    const nodeMatchesSearch = (node: MapNode, query: string): boolean => {
        if (node.keyword.toLowerCase().includes(query.toLowerCase())) return true;
        return node.children?.some(child => nodeMatchesSearch(child, query)) ?? false;
    };


    const renderLectureItem = (lecture: any) => (
        isContextAvailable('lectures', lecture.id) && (
            <Card
                key={lecture.id}
                shadow="xs"
                p="xs"
                radius="md"
                withBorder
                style={{
                    marginBottom: '8px',
                    width: 'fit-content'  // Make card width fit content
                }}
            >
                <Group>
                    <ActionIcon
                        variant="light"
                        color="blue"
                        onClick={() => {
                            selectedProblemIds.forEach(problemId => {
                                addContextToProblem(problemId, 'lectures', lecture.id);
                            });
                        }}
                        disabled={selectedProblemIds.size === 0}
                        title={selectedProblemIds.size === 0 ? "Select a problem first" : "Add lecture"}
                    >
                        <IconPlus size={16} />
                    </ActionIcon>
                    <Text size="sm">{lecture.name}</Text>
                </Group>
            </Card>
        )
    );

    const renderTopicTree = (node: MapNode, depth = 0) => {
        if (!node) return null;

        const matchesSearch = !searchQuery || nodeMatchesSearch(node, searchQuery);
        if (!matchesSearch || !isContextAvailable('topics', node.id)) return null;

        const isExpanded = expandedNodes.has(node.id) || (searchQuery && matchesSearch);

        return (
            <div style={{ display: 'contents' }}>
                <Card
                    shadow="xs"
                    p="xs"
                    radius="md"
                    withBorder
                    style={{
                        marginLeft: depth * 20,
                        width: 'auto',
                        display: 'inline-flex'
                    }}
                >
                    <Group>
                        {node.children && node.children.length > 0 && (
                            <ActionIcon
                                size="sm"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleNode(node.id);
                                }}
                                variant="outline"
                            >
                                {isExpanded ? (
                                    <IconChevronDown size={16} />
                                ) : (
                                    <IconChevronRight size={16} />
                                )}
                            </ActionIcon>
                        )}
                        <ActionIcon
                            variant="light"
                            color="blue"
                            onClick={() => {
                                selectedProblemIds.forEach(problemId => {
                                    addContextToProblem(problemId, 'topics', node.id);
                                });
                            }}
                            disabled={selectedProblemIds.size === 0}
                            title={selectedProblemIds.size === 0 ? "Select a problem first" : "Add topic and subtopics"}
                        >
                            <IconPlus size={16} />
                        </ActionIcon>
                        <Text size="sm" style={{ whiteSpace: 'nowrap' }}><Latex>{node.keyword}</Latex></Text>
                    </Group>
                </Card>
                {isExpanded && node.children?.map(child => renderTopicTree(child, depth + 1))}
            </div>
        );
    };

    const renderTopicCheckboxes = (node: MapNode, depth = 0) => {
        if (!node) return null;

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
                        checked={selectedContext.includes(node.id)}
                        onChange={(event) => {
                            if (event.currentTarget.checked) {
                                setSelectedContext([...selectedContext, node.id]);
                            } else {
                                setSelectedContext(selectedContext.filter(id => id !== node.id));
                            }
                        }}
                    />
                </Group>
                {isExpanded && node.children?.map((child: any) => renderTopicCheckboxes(child, depth + 1))}
            </Stack>
        );
    };

    // Filter lectures based on search query
    const filteredLectures = lectures?.filter(lecture =>
        lecture.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleAddProblem = () => {
        const newProblemNumber = getNextProblemNumber();
        const newProblem = {
            id: problems.length + 1,
            title: `Problem ${newProblemNumber}`,
            prompt: "",
            isMCQ: false,
            isMultiPart: false,
            isComputational: false,
            context: {
                lectures: [],
                topics: []
            }
        };
        setProblems([...problems, newProblem]);
        setExpandedProblemId(newProblem.id);
        setSelectedProblemIds(new Set([newProblem.id]));
    };

    const getNextProblemNumber = () => {
        const numbers = problems.map(p => {
            const match = p.title.match(/Problem (\d+)/);
            return match ? parseInt(match[1]) : 0;
        });
        return Math.max(...numbers) + 1;
    };

    const handleRemoveProblem = (id: number) => {
        setProblemToDelete(id);
    };

    const confirmRemoveProblem = () => {
        if (problemToDelete) {
            const updatedProblems = problems
                .filter(p => p.id !== problemToDelete)
                .map((p, idx) => ({
                    ...p,
                    title: `Problem ${idx + 1}`
                }));

            setProblems(updatedProblems);

            if (problemToDelete === expandedProblemId) {
                const nextProblem = updatedProblems[0];
                if (nextProblem) {
                    setExpandedProblemId(nextProblem.id);
                    setSelectedProblemIds(new Set([nextProblem.id]));
                } else {
                    setExpandedProblemId(0);
                    setSelectedProblemIds(new Set());
                }
            }

            setProblemToDelete(null);
        }
    };

    const updateProblem = (id: number, updates: Partial<ProblemCard>) => {
        setProblems(problems.map(p =>
            p.id === id ? { ...p, ...updates } : p
        ));
    };

    const addContextToProblem = (problemId: number, contextType: 'lectures' | 'topics', contextId: string) => {
        setProblems(problems.map(problem => {
            if (problem.id === problemId) {
                const currentContext = [...problem.context[contextType]];
                if (!currentContext.includes(contextId)) {
                    return {
                        ...problem,
                        context: {
                            ...problem.context,
                            [contextType]: [...currentContext, contextId]
                        }
                    };
                }
            }
            return problem;
        }));
    };

    const removeContextFromProblem = (problemId: number, contextType: 'lectures' | 'topics', contextId: string) => {
        setProblems(problems.map(problem => {
            if (problem.id === problemId) {
                return {
                    ...problem,
                    context: {
                        ...problem.context,
                        [contextType]: problem.context[contextType].filter(id => id !== contextId)
                    }
                };
            }
            return problem;
        }));
    };

    const duplicateProblem = (problem: ProblemCard) => {
        const newProblemNumber = getNextProblemNumber();
        const newProblem = {
            ...problem,
            id: problems.length + 1,
            title: `Problem ${newProblemNumber}`
        };
        setProblems([...problems, newProblem]);
        setExpandedProblemId(newProblem.id);
        setSelectedProblemIds(new Set([newProblem.id]));
    };

    const renderContextSummary = (problem: ProblemCard) => {
        const lectureCount = problem.context.lectures.length;
        const topicCount = problem.context.topics.length;

        return (
            <Group>
                {lectureCount > 0 && (
                    <Badge color="blue">{lectureCount} lecture{lectureCount !== 1 ? 's' : ''}</Badge>
                )}
                {topicCount > 0 && (
                    <Badge color="green">{topicCount} topic{topicCount !== 1 ? 's' : ''}</Badge>
                )}
            </Group>
        );
    };

    const renderContextBadges = (problem: ProblemCard) => {
        return (
            <Group>
                {problem.context.lectures.map(lectureId => {
                    const lecture = lectures?.find(l => l.id === lectureId);
                    return lecture && (
                        <Badge
                            key={lectureId}
                            color="blue"
                            rightSection={
                                <IconX
                                    size={14}
                                    style={{ cursor: 'pointer' }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeContextFromProblem(problem.id, 'lectures', lectureId);
                                    }}
                                />
                            }
                        >
                            {lecture.name}
                        </Badge>
                    );
                })}
                {problem.context.topics.map(topicId => {
                    const topic = topics?.find(t => t.map_id === topicId);
                    return topic && (
                        <Badge
                            key={topicId}
                            color="green"
                            rightSection={
                                <IconX
                                    size={14}
                                    style={{ cursor: 'pointer' }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeContextFromProblem(problem.id, 'topics', topicId);
                                    }}
                                />
                            }
                        >
                            <Latex>{topic.title}</Latex>
                        </Badge>
                    );
                })}
            </Group>
        );
    };

    const isContextAvailable = (type: 'lectures' | 'topics', id: string) => {
        return !problems.some(problem => problem.context[type].includes(id));
    };

    const sortProblems = (problems: ProblemCard[]) => {
        return [...problems].sort((a, b) => {
            if (a.id === expandedProblemId) return -1;
            if (b.id === expandedProblemId) return 1;
            return 0;
        });
    };

    const renderProblemTypeBadges = (problem: ProblemCard) => {
        const badges = [];

        if (problem.isMCQ) {
            badges.push(
                <Badge key="mcq" color="violet">MCQ</Badge>
            );
        }

        if (problem.isMultiPart) {
            badges.push(
                <Badge key="multipart" color="orange">Multi-part</Badge>
            );
        }

        if (problem.isComputational) {
            badges.push(
                <Badge key="computational" color="cyan">Computational</Badge>
            );
        }

        return badges.length > 0 ? (
            <Group>
                {badges}
            </Group>
        ) : null;
    };

    const renderProblemCard = (problem: ProblemCard) => {
        const isExpanded = expandedProblemId === problem.id;
        const isSelected = selectedProblemIds.has(problem.id);
        const colSpan = isExpanded ? 12 : 4;

        return (
            <Grid.Col key={problem.id} span={colSpan}>
                <Card
                    shadow="sm"
                    padding="lg"
                    radius="md"
                    withBorder
                    style={{
                        cursor: isExpanded ? 'default' : 'pointer',
                    }}
                    onClick={(e) => {
                        if (!isExpanded) {
                            toggleExpanded(problem.id);
                            setSelectedProblemIds(new Set([problem.id]));
                        }
                    }}
                >
                    {!isExpanded ? (
                        <AspectRatio ratio={1}>
                            <Stack justify="center" align="center">
                                <Text fw={500}>{problem.title}</Text>
                                {renderContextSummary(problem)}
                                {renderProblemTypeBadges(problem)}
                            </Stack>
                        </AspectRatio>
                    ) : (
                        <>
                            <Card.Section p="md" withBorder style={{ cursor: "pointer" }} onClick={() => toggleExpanded(problem.id)}>
                                <Group justify="space-between">
                                    <Text fw={500}>{problem.title}</Text>
                                    <Group>
                                        <ActionIcon
                                            variant="subtle"
                                            color="blue"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                duplicateProblem(problem);
                                            }}
                                            title="Duplicate Problem"
                                        >
                                            <IconCopy size={16} />
                                        </ActionIcon>
                                        <ActionIcon
                                            color="red"
                                            variant="subtle"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleRemoveProblem(problem.id);
                                            }}
                                            title="Delete Problem"
                                        >
                                            <IconTrash size={16} />
                                        </ActionIcon>
                                    </Group>
                                </Group>
                            </Card.Section>

                            <Grid mt="md" onClick={e => e.stopPropagation()}>
                                <Grid.Col span={8}>
                                    <Stack>
                                        <Text fw={500}>Context</Text>
                                        <Group style={{ flexWrap: 'wrap' }}>
                                            {renderContextBadges(problem)}
                                        </Group>
                                    </Stack>
                                </Grid.Col>
                                <Grid.Col span={4}>
                                    <Stack>
                                        <Switch
                                            label="MCQ"
                                            checked={problem.isMCQ}
                                            onChange={(e) => updateProblem(problem.id, {
                                                isMCQ: e.currentTarget.checked
                                            })}
                                        />
                                        <Switch
                                            label="Multi-Part"
                                            checked={problem.isMultiPart}
                                            onChange={(e) => updateProblem(problem.id, {
                                                isMultiPart: e.currentTarget.checked
                                            })}
                                        />
                                        <Switch
                                            label="Computational"
                                            checked={problem.isComputational}
                                            onChange={(e) => updateProblem(problem.id, {
                                                isComputational: e.currentTarget.checked
                                            })}
                                        />
                                    </Stack>
                                </Grid.Col>
                            </Grid>

                            <Textarea
                                placeholder="Enter problem prompt..."
                                label="Problem Prompt"
                                value={problem.prompt}
                                onChange={(e) => updateProblem(problem.id, {
                                    prompt: e.currentTarget.value
                                })}
                                minRows={3}
                                mt="md"
                                onClick={e => e.stopPropagation()}
                            />
                        </>
                    )}
                </Card>
            </Grid.Col>
        );
    };

    const renderAddCard = () => (
        <Grid.Col span={4}>
            <Card
                shadow="sm"
                padding="lg"
                radius="md"
                withBorder
                onClick={handleAddProblem}
                style={{
                    cursor: "pointer",
                    backgroundColor: '#f8f9fa'  // Light background to distinguish
                }}
            >
                <AspectRatio ratio={1}>
                    <Stack justify="center" align="center">
                        <IconPlus size={32} color="gray" />
                        <Text c="dimmed">Add New Problem</Text>
                    </Stack>
                </AspectRatio>
            </Card>
        </Grid.Col>
    );

    const renderContextPanel = () => (
        <Grid.Col span={isMobile ? 12 : 6}>
            <Stack>
                {/* Sticky search bar */}
                <Card
                    shadow="sm"
                    p="md"
                    style={{
                        position: 'sticky',
                        top: 0,
                        zIndex: 2,
                        backgroundColor: 'white'
                    }}
                >
                    <TextInput
                        placeholder="Search context..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        leftSection={<IconSearch size={16} />}
                    />
                </Card>

                <ScrollArea.Autosize mah={isMobile ? 400 : "calc(100vh - 250px)"}>
                    <Stack>
                        {filteredLectures && filteredLectures.length > 0 && (
                            <Card p="md">
                                <Group mb={expandedSections.has('lectures') ? "md" : 0}>
                                    <ActionIcon
                                        variant="subtle"
                                        onClick={() => toggleSection('lectures')}
                                    >
                                        {expandedSections.has('lectures') ? (
                                            <IconChevronDown size={16} />
                                        ) : (
                                            <IconChevronRight size={16} />
                                        )}
                                    </ActionIcon>
                                    <Text fw={700}>Lectures</Text>
                                </Group>
                                {expandedSections.has('lectures') && (
                                    <Group align="flex-start" style={{ flexWrap: 'wrap' }}>
                                        {filteredLectures.map(renderLectureItem)}
                                    </Group>
                                )}
                            </Card>
                        )}

                        {map && hasMatchingTopics(map) && (
                            <Card shadow="sm" p="md">
                                <Group mb={expandedSections.has('topics') ? "md" : 0}>
                                    <ActionIcon
                                        variant="subtle"
                                        onClick={() => toggleSection('topics')}
                                    >
                                        {expandedSections.has('topics') ? (
                                            <IconChevronDown size={16} />
                                        ) : (
                                            <IconChevronRight size={16} />
                                        )}
                                    </ActionIcon>
                                    <Text fw={700}>Topics</Text>
                                </Group>
                                {expandedSections.has('topics') && (
                                    <Stack align="flex-start">
                                        {renderTopicTree(map)}
                                    </Stack>
                                )}
                            </Card>
                        )}
                    </Stack>
                </ScrollArea.Autosize>
            </Stack>
        </Grid.Col>
    );

    // Helper function to check if there are any matching topics
    const hasMatchingTopics = (node: MapNode): boolean => {
        if (!node) return false;

        const matchesSearch = !searchQuery || nodeMatchesSearch(node, searchQuery);
        if (matchesSearch && isContextAvailable('topics', node.id)) return true;

        return node.children?.some(child => hasMatchingTopics(child)) ?? false;
    };

    return <>
        <HeaderSimple />
        <Container fluid style={{ marginTop: "30px" }}>
            <Stack>
                <Flex justify="space-between" align="center">
                    <Group>
                        <Link href={`/classes/${classId}/generate/problems`}>
                            <IconArrowLeft size={24} color="black" style={{ cursor: "pointer" }} />
                        </Link>
                        <TextInput
                            placeholder="Enter generation name"
                            value={generationName}
                            onChange={(e) => setGenerationName(e.target.value)}
                            style={{ flex: 1 }}
                            fw={600}
                            size="md"
                            mb={6}
                        />
                        {/* <Text size="xl" fw={700} mb={6}>Generate Problems</Text> */}
                    </Group>
                    <Group>
                        <Button onClick={handleGenerate} loading={loading}>Generate Problems</Button>
                    </Group>
                </Flex>

                {/* <Group>
                    <TextInput
                        placeholder="Enter generation name"
                        value={generationName}
                        onChange={(e) => setGenerationName(e.target.value)}
                        style={{ flex: 1 }}
                    />
                    <Button>Generate</Button>
                </Group> */}

                <Grid>
                    <Grid.Col span={isMobile ? 12 : 6}>
                        <Grid>
                            {sortProblems(problems).map(renderProblemCard)}
                            {renderAddCard()}
                        </Grid>
                    </Grid.Col>

                    {renderContextPanel()}
                </Grid>
            </Stack>
        </Container>

        {/* Delete Confirmation Modal */}
        <Modal
            opened={problemToDelete !== null}
            onClose={() => setProblemToDelete(null)}
            title="Delete Problem"
        >
            <Stack>
                <Text>Are you sure you want to delete this problem?</Text>
                <Group justify="flex-end">
                    <Button variant="outline" onClick={() => setProblemToDelete(null)}>
                        Cancel
                    </Button>
                    <Button color="red" onClick={confirmRemoveProblem}>
                        Delete
                    </Button>
                </Group>
            </Stack>
        </Modal>
    </>
}