/**
 * client/app/classes/[classId]/generate/canvas/page.tsx
 * This component is for generating a canvas for a class.
 * @AshokSaravanan222
 * 01.30.2025
 */

import { Text, Card, TextInput, Button, Stack, Group, Grid, AspectRatio, Badge, Switch, Modal, Textarea, ActionIcon, useMantineColorScheme } from "@mantine/core";
import { useRouter } from "next/navigation";
import { HeaderSimple } from "@/components/HeaderSimple";
import { Container, Flex } from "@mantine/core";
import { IconArrowLeft, IconPlus, IconCopy, IconTrash, IconX } from "@tabler/icons-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMediaQuery } from "@mantine/hooks";
import { em } from "@mantine/core";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { v4 as uuidv4 } from 'uuid';
import { ContextPanel } from "./ContextPanel";
import { createGeneration } from "@/utils/services/generation";
import { createQuestions } from "@/utils/services/questions";
import Latex from "../Latex";
import { getLectures } from "@/utils/queries/get-lectures";
import { getTextbooks } from "@/utils/queries/get-textbooks";
import { getChapters } from "@/utils/queries/get-chapters";
import { getExercises } from "@/utils/queries/get-exercises";
import { getDocumentsTextbook } from "@/utils/queries/get-documents-textbook";
import { getLectureDocuments } from "@/utils/queries/get-lecture-docs";
import { getUser } from "@/utils/queries/get-user";
import { getProfile } from "@/utils/queries/get-profile";

export interface ProblemCard {
    id: number;
    title: string;
    prompt: string;
    isMCQ: boolean;
    isMultiPart: boolean;
    isComputational: boolean;
    context: {
        lectures: string[];     // lecture IDs
        textbooks: string[];   // textbook IDs
        chapters: string[];    // chapter IDs
        exercises: string[];   // exercise IDs
    };
}

export default function GenerateCanvas({ classId }: { classId: string }) {
    const supabase = useSupabaseBrowser();
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
            textbooks: [],
            chapters: [],
            exercises: [],
        }
    }]);
    const [problemToDelete, setProblemToDelete] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);

    // Search and expansion states
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['lectures', 'textbooks']));
    const [expandedProblemId, setExpandedProblemId] = useState<number>(1);
    const [selectedProblemIds, setSelectedProblemIds] = useState<Set<number>>(new Set([1]));

    const queryClient = useQueryClient();
    const router = useRouter();
    const isMobile = useMediaQuery(`(max-width: ${em(750)})`);

    const { colorScheme } = useMantineColorScheme();

    const { data: user, isLoading: loadingUser } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase),
    })

    const { data: profile, isLoading: loadingProfile } = useQuery({
        queryKey: ["profile", user!.id],
        queryFn: () => getProfile(supabase, user!.id),
        enabled: !!user
    })

    const { data: lectures } = useQuery({
        queryKey: ["lectures", classId],
        queryFn: () => getLectures(supabase, classId)
    });

    const { data: lectureDocuments, isLoading: loadingLectureDocuments } = useQuery({
        queryKey: ["lectureDocuments", classId],
        queryFn: () => getLectureDocuments(supabase, lectures?.map(lecture => lecture.id) ?? []),
        enabled: !!lectures
    })

    const { data: textbooks } = useQuery({
        queryKey: ["textbooks", classId],
        queryFn: () => getTextbooks(supabase, classId),
    });

    const { data: textbookDocuments, isLoading: loadingTextbookDocuments } = useQuery({
        queryKey: ["textbookDocuments", classId],
        queryFn: () => getDocumentsTextbook(supabase, textbooks?.map(textbook => textbook.id) ?? []),
        enabled: !!textbooks
    })

    const { data: chapters } = useQuery({
        queryKey: ["chapters", classId],
        queryFn: () => getChapters(supabase, textbooks!.map(t => t.id)),
        enabled: !!textbooks
    });

    const { data: exercises } = useQuery({
        queryKey: ["exercises", classId],
        queryFn: () => getExercises(supabase, chapters!.map(c => c.id)),
        enabled: !!chapters
    });

    useEffect(() => {
        if (textbooks) {
            setExpandedNodes(new Set(textbooks.map(t => t.id)));
        }
    }, [textbooks]);

    const getReferences = (problem: ProblemCard) => {
        const lectureReferences = lectureDocuments?.filter(document => problem.context.lectures.includes(document.lecture ?? "")) ?? [];
        const textbookReferences = textbookDocuments?.filter(document => problem.context.textbooks.includes(document.textbook ?? "")) ?? [];
        const chapterReferences = textbookDocuments?.filter(document => {
            const chapter = chapters?.find(c => c.id === document.textbook);
            return chapter && problem.context.chapters.includes(chapter.id);
        }) ?? [];
        const exerciseReferences = textbookDocuments?.filter(document => {
            const chapter = chapters?.find(c => c.id === document.textbook);
            const exercise = exercises?.find(e => e.chapter === chapter?.id && problem.context.exercises.includes(e.id));
            return exercise && chapter;
        }) ?? [];
        return [...lectureReferences, ...textbookReferences, ...chapterReferences, ...exerciseReferences];
    }





    const handleGenerate = async () => {
        try {
            setLoading(true);

            let profileId = profile?.admin ? null : profile?.id;

            // creating generation
            const generation = await createGeneration(classId, generationName, 'problem', `${process.env.NEXT_PUBLIC_API_URL}`, null, null, profileId);

            const multipartQuestions = problems.filter(problem => problem.isMultiPart).map(problem => {
                const references = getReferences(problem);
                const multipart_uuid = uuidv4();
                return Array(3).fill({
                    generation: generation.id,
                    mcq: problem.isMCQ,
                    conceptual: problem.isComputational,
                    multipart: multipart_uuid,
                    additional_info: problem.prompt,
                    references: references.map(reference => reference.id),
                });
            }).flat();

            const singleQuestions = problems.filter(problem => !problem.isMultiPart).map(problem => {
                const references = getReferences(problem);
                return {
                    generation: generation.id,
                    mcq: problem.isMCQ,
                    conceptual: problem.isComputational,
                    additional_info: problem.prompt,
                    references: references.map(reference => reference.id),
                };
            });

            const { success, error } = await createQuestions([...singleQuestions, ...multipartQuestions]);
            if (!success) {
                throw new Error(error);
            }
            // dont wait for response
            fetch(`${process.env.NEXT_PUBLIC_API_URL}/generate/problems`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    class_id: classId,
                    generation_id: generation.id,
                })
            });

            queryClient.invalidateQueries({ queryKey: ["problemGenerations", classId] });
            router.push(`/classes/${classId}/generate/`);
        } catch (error) {
            console.error("Error generating problems:", error);
        } finally {
            setLoading(false);
        }
    };

    const getNextProblemNumber = () => {
        const numbers = problems.map(p => {
            const match = p.title.match(/Problem (\d+)/);
            return match ? parseInt(match[1]) : 0;
        });
        return Math.max(...numbers) + 1;
    };

    const toggleExpanded = (id: number) => {
        if (expandedProblemId === id) {
            setExpandedProblemId(0);
        } else {
            setExpandedProblemId(id);
        }
    };

    const toggleNode = (nodeId: string) => {
        setExpandedNodes(prev => {
            const next = new Set(prev);
            if (next.has(nodeId)) {
                next.delete(nodeId);
            } else {
                next.add(nodeId);
            }
            return next;
        });
    };

    const toggleSection = (section: string) => {
        setExpandedSections(prev => {
            const next = new Set(prev);
            if (next.has(section)) {
                next.delete(section);
            } else {
                next.add(section);
            }
            return next;
        });
    };

    const addContextToProblem = (problemId: number, contextType: keyof ProblemCard['context'], contextId: string) => {
        setProblems(problems.map(problem => {
            if (problem.id === problemId) {
                return {
                    ...problem,
                    context: {
                        ...problem.context,
                        [contextType]: [...problem.context[contextType], contextId]
                    }
                };
            }
            return problem;
        }));
    };

    const removeContextFromProblem = (problemId: number, contextType: keyof ProblemCard['context'], contextId: string) => {
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

    const handleAddProblem = () => {
        const newProblem: ProblemCard = {
            id: Math.max(0, ...problems.map(p => p.id)) + 1,
            title: `Problem ${problems.length + 1}`,
            prompt: "",
            isMCQ: false,
            isMultiPart: false,
            isComputational: false,
            context: {
                lectures: [],
                textbooks: [],
                chapters: [],
                exercises: []
            }
        };
        setProblems([...problems, newProblem]);
    };

    const confirmRemoveProblem = () => {
        if (problemToDelete === null) return;

        const updatedProblems = problems.filter(p => p.id !== problemToDelete);
        const reorderedProblems = updateProblemTitles(updatedProblems);

        const newSelectedProblemIds = new Set(selectedProblemIds);
        newSelectedProblemIds.delete(problemToDelete);

        if (expandedProblemId === problemToDelete) {
            const firstProblem = reorderedProblems[0];
            if (firstProblem) {
                setExpandedProblemId(firstProblem.id);
                newSelectedProblemIds.add(firstProblem.id);
            }
        }

        setProblems(reorderedProblems);
        setSelectedProblemIds(newSelectedProblemIds);
        setProblemToDelete(null);
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
        const textbookCount = problem.context.textbooks.length;
        const chapterCount = problem.context.chapters.length;
        const exerciseCount = problem.context.exercises.length;

        return (
            <Group>
                {lectureCount > 0 && (
                    <Badge color="blue">{lectureCount} lecture{lectureCount !== 1 ? 's' : ''}</Badge>
                )}
                {textbookCount > 0 && (
                    <Badge color="green">{textbookCount} textbook{textbookCount !== 1 ? 's' : ''}</Badge>
                )}
                {chapterCount > 0 && (
                    <Badge color="orange">{chapterCount} chapter{chapterCount !== 1 ? 's' : ''}</Badge>
                )}
                {exerciseCount > 0 && (
                    <Badge color="cyan">{exerciseCount} exercise{exerciseCount !== 1 ? 's' : ''}</Badge>
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
                {problem.context.textbooks.map(textbookId => {
                    const textbook = textbooks?.find(t => t.id === textbookId);
                    return textbook && (
                        <Badge
                            key={textbookId}
                            color="green"
                            rightSection={
                                <IconX
                                    size={14}
                                    style={{ cursor: 'pointer' }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeContextFromProblem(problem.id, 'textbooks', textbookId);
                                    }}
                                />
                            }
                        >
                            {textbook.title}
                        </Badge>
                    );
                })}
                {problem.context.chapters.map(chapterId => {
                    const chapter = chapters?.find(c => c.id === chapterId);
                    return chapter && (
                        <Badge
                            key={chapterId}
                            color="orange"
                            rightSection={
                                <IconX
                                    size={14}
                                    style={{ cursor: 'pointer' }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeContextFromProblem(problem.id, 'chapters', chapterId);
                                    }}
                                />
                            }
                        >
                            {`Chapter ${chapter.chapter_number}: ${chapter.title}`}
                        </Badge>
                    );
                })}
                {problem.context.exercises.map(exerciseId => {
                    const exercise = exercises?.find(e => e.id === exerciseId);
                    const chapter = exercise ? chapters?.find(c => c.id === exercise.chapter) : null;
                    return exercise && chapter && (
                        <Badge
                            key={exerciseId}
                            color="cyan"
                            rightSection={
                                <IconX
                                    size={14}
                                    style={{ cursor: 'pointer' }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeContextFromProblem(problem.id, 'exercises', exerciseId);
                                    }}
                                />
                            }
                        >
                            {`Exercise ${chapter.chapter_number}.${exercise.exercise_number}`}
                        </Badge>
                    );
                })}
            </Group>
        );
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

        return badges;
    };

    const updateProblem = (id: number, updates: Partial<ProblemCard>) => {
        setProblems(problems.map(p =>
            p.id === id ? { ...p, ...updates } : p
        ));
    };

    const handleRemoveProblem = (id: number) => {
        setProblemToDelete(id);
    };

    const renderProblemCard = (problem: ProblemCard) => {
        const isExpanded = expandedProblemId === problem.id;
        const colSpan = isExpanded ? 12 : 4;

        return (
            <Grid.Col key={problem.id} span={colSpan}>
                <Card
                    shadow="sm"
                    padding="lg"
                    radius="md"
                    withBorder
                    onClick={() => {
                        if (!isExpanded) {
                            setExpandedProblemId(problem.id);
                            setSelectedProblemIds(new Set([problem.id]));
                        }
                    }}
                    style={{ cursor: isExpanded ? 'default' : 'pointer' }}
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
                                    {/* <Stack>
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
                                    </Stack> */}
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
                    backgroundColor: '#f8f9fa'
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

    const sortProblems = (problems: ProblemCard[]) => {
        return [...problems].sort((a, b) => {
            if (a.id === expandedProblemId) return -1;
            if (b.id === expandedProblemId) return 1;
            return a.id - b.id;
        });
    };

    const updateProblemTitles = (problems: ProblemCard[]) => {
        return problems.map((problem, index) => ({
            ...problem,
            title: `Problem ${index + 1}`
        }));
    };

    return (
        <>
            <HeaderSimple />
            <Container fluid style={{ marginTop: "30px" }}>
                <Stack>
                    <Flex justify="space-between" align="center">
                        <Group>
                            <Link href={`/classes/${classId}/generate`}>
                                <IconArrowLeft size={24} color={colorScheme === "dark" ? "white" : "black"} style={{ cursor: "pointer" }} />
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
                        </Group>
                        <Button onClick={handleGenerate} loading={loading}>
                            Generate
                        </Button>
                    </Flex>

                    <Grid>
                        <Grid.Col span={isMobile ? 12 : 6}>
                            <Grid>
                                {sortProblems(problems).map(renderProblemCard)}
                                {renderAddCard()}
                            </Grid>
                        </Grid.Col>

                        <Grid.Col span={isMobile ? 12 : 6}>
                            <ContextPanel
                                classId={classId}
                                isMobile={isMobile ?? false}
                                searchQuery={searchQuery}
                                setSearchQuery={setSearchQuery}
                                expandedSections={expandedSections}
                                toggleSection={toggleSection}
                                selectedProblemIds={selectedProblemIds}
                                addContextToProblem={addContextToProblem}
                                expandedNodes={expandedNodes}
                                toggleNode={toggleNode}
                                problems={problems}
                            />
                        </Grid.Col>
                    </Grid>
                </Stack>
            </Container>

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
    );
}