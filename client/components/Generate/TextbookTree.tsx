/**
 * TextbookTree.tsx
 * 
 * This component is used to display the textbook tree for the generate page.
 * @AshokSaravanan222
 * 02.05.2025
 */

import { Card, Group, Text, ActionIcon, Stack } from "@mantine/core";
import { IconChevronDown, IconChevronRight, IconPlus, IconMinus } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { getTextbooks } from "@/utils/queries/get-textbooks";
import { getChapters } from "@/utils/queries/get-chapters";
import { getExercises } from "@/utils/queries/get-exercises";
import { ProblemCard } from "./GenerateCanvas";

interface TextbookTreeProps {
    classId: string;
    searchQuery: string;
    expandedSections: Set<string>;
    toggleSection: (section: string) => void;
    selectedProblemIds: Set<number>;
    addContextToProblem: (problemId: number, contextType: keyof ProblemCard['context'], contextId: string) => void;
    expandedNodes: Set<string>;
    toggleNode: (nodeId: string) => void;
    problems: ProblemCard[];
}

export function TextbookTree({
    classId,
    searchQuery,
    expandedSections,
    toggleSection,
    selectedProblemIds,
    addContextToProblem,
    expandedNodes,
    toggleNode,
    problems
}: TextbookTreeProps) {
    const supabase = useSupabaseBrowser();

    const { data: textbooks } = useQuery({
        queryKey: ["textbooks", classId],
        queryFn: () => getTextbooks(supabase, classId)
    });

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

    // Enhanced search function
    const matchesSearch = (node: any): boolean => {
        if (!searchQuery) return true;

        const searchLower = searchQuery.toLowerCase();
        const titleMatches = node.title?.toLowerCase().includes(searchLower);

        // For chapters, also search by chapter number
        if (node.chapter_number) {
            const chapterSearch = `chapter ${node.chapter_number}`.toLowerCase();
            if (chapterSearch.includes(searchLower)) return true;
        }

        // For exercises, search by exercise number
        if (node.exercise_number) {
            const exerciseSearch = `exercise ${node.exercise_number}`.toLowerCase();
            if (exerciseSearch.includes(searchLower)) return true;
        }

        return titleMatches;
    };

    // Check if any child nodes match the search
    const hasMatchingChildren = (node: any): boolean => {
        if (node.chapter_number) {
            // For chapters, check exercises
            return exercises?.some(exercise =>
                exercise.chapter === node.id && matchesSearch(exercise)
            ) ?? false;
        } else if (!node.exercise_number) {
            // For textbooks, check chapters
            return chapters?.some(chapter =>
                chapter.textbook === node.id &&
                (matchesSearch(chapter) || hasMatchingChildren(chapter))
            ) ?? false;
        }
        return false;
    };

    const renderNode = (node: any, depth = 0) => {
        if (!node) return null;

        const isTextbook = !node.chapter_number && !node.exercise_number;
        const isChapter = !!node.chapter_number;
        const isExercise = !!node.exercise_number;

        // Check if this node is already selected in any of the selected problems
        const isSelectedInAnyProblem = selectedProblemIds.size > 0 && Array.from(selectedProblemIds).some(problemId => {
            const problem = problems.find(p => p.id === problemId);
            if (!problem) return false;

            const contextType = isTextbook ? 'textbooks' : 
                              isChapter ? 'chapters' : 
                              'exercises';
            return problem.context[contextType].includes(node.id);
        });

        // If the node is already selected in any of the current problems, don't render it
        if (isSelectedInAnyProblem) return null;

        // Check if this node or any of its children match the search
        if (!matchesSearch(node) && !hasMatchingChildren(node)) return null;

        const isExpanded = expandedNodes.has(node.id);

        // Get parent chapter number for exercises
        const getExerciseLabel = (exercise: any) => {
            const parentChapter = chapters?.find(c => c.id === exercise.chapter);
            return parentChapter ? 
                `Exercise ${parentChapter.chapter_number}.${exercise.exercise_number}` : 
                `Exercise ${exercise.exercise_number}`;
        };

        return (
            <div key={node.id} style={{ display: 'contents' }}>
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
                        {(isTextbook || isChapter) && (
                            <ActionIcon
                                size="sm"
                                onClick={() => toggleNode(node.id)}
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
                                    const contextType = isTextbook ? 'textbooks' : 
                                                      isChapter ? 'chapters' : 
                                                      'exercises';
                                    addContextToProblem(problemId, contextType, node.id);
                                });
                            }}
                            disabled={selectedProblemIds.size === 0}
                            title={selectedProblemIds.size === 0 ? "Select a problem first" : "Add to problem"}
                        >
                            <IconPlus size={16} />
                        </ActionIcon>
                        <Text size="sm">
                            {isChapter ? 
                                `Chapter ${node.chapter_number}: ${node.title}` :
                                isTextbook ? 
                                    node.title :
                                    getExerciseLabel(node)
                            }
                        </Text>
                    </Group>
                </Card>
                {isExpanded && !isExercise && (
                    isTextbook ? 
                        chapters?.filter(chapter => chapter.textbook === node.id)
                            .map(chapter => renderNode(chapter, depth + 1)) :
                        isChapter ?
                            exercises?.filter(exercise => exercise.chapter === node.id)
                                .map(exercise => renderNode(exercise, depth + 1)) :
                            null
                )}
            </div>
        );
    };

    if (!textbooks?.length) return null;

    return (
        <Card shadow="sm" p="md">
            <Group mb={expandedSections.has('textbooks') ? "md" : 0}>
                <ActionIcon
                    variant="subtle"
                    onClick={() => toggleSection('textbooks')}
                >
                    {expandedSections.has('textbooks') ? (
                        <IconChevronDown size={16} />
                    ) : (
                        <IconChevronRight size={16} />
                    )}
                </ActionIcon>
                <Text fw={700}>Textbooks</Text>
            </Group>
            {expandedSections.has('textbooks') && (
                <Stack align="flex-start">
                    {textbooks.map(textbook => renderNode(textbook))}
                </Stack>
            )}
        </Card>
    );
}

