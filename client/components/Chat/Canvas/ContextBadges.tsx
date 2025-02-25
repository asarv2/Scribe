/**
 * ContextBadges.tsx
 * Used to show the context badges in the chat.
 */

import { Badge, Group } from "@mantine/core";
import { IconPlus, IconX } from "@tabler/icons-react";
import { memo } from "react";
import { useQuery } from "@tanstack/react-query";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { getLectures } from "@/utils/queries/get-lectures";
import { getTextbooks } from "@/utils/queries/get-textbooks";
import { getChapters } from "@/utils/queries/get-chapters";
import { getSubchapters } from "@/utils/queries/get-subchapters";
import { getHomeworks } from "@/utils/queries/get-homeworks";
import { getProblems } from "@/utils/queries/get-problems";
import { getExercises } from "@/utils/queries/get-exercises";
import { Chapter, Subchapter, ChatMessage, Document, ViewerMode } from "@/types";
import { handleDocumentClick } from "@/utils/chat/chat-helpers";
import { getLectureDocuments } from "@/utils/queries/get-lecture-docs";
import { getTextbookDocuments } from "@/utils/queries/get-textbook-docs";

interface ContextBadgesProps {
    activeChat: ChatMessage;
    classId: string;
    onRemoveContext?: (contextType: keyof ChatMessage['context'], contextId: string) => void;
    onScrollToSection?: (sectionId: string) => void;
    setViewerMode?: React.Dispatch<React.SetStateAction<ViewerMode>>;
}

export const ContextBadges = memo(({
    activeChat,
    classId,
    onRemoveContext,
    onScrollToSection,
    setViewerMode
}: ContextBadgesProps) => {
    const supabase = useSupabaseBrowser();

    // Queries for data
    const { data: lectures } = useQuery({
        queryKey: ["lectures", classId],
        queryFn: () => getLectures(supabase, classId)
    });

    const { data: lectureDocuments } = useQuery({
        queryKey: ["lectureDocuments", classId],
        queryFn: () => getLectureDocuments(supabase, lectures!.map(l => l.id)),
        enabled: !!lectures
    });

    const { data: textbooks } = useQuery({
        queryKey: ["textbooks", classId],
        queryFn: () => getTextbooks(supabase, classId),
    });

    const { data: textbookDocuments } = useQuery({
        queryKey: ["textbookDocuments", classId],
        queryFn: () => getTextbookDocuments(supabase, textbooks!.map(t => t.id)),
        enabled: !!textbooks
    });

    const { data: chapters } = useQuery({
        queryKey: ["chapters", classId],
        queryFn: () => getChapters(supabase, textbooks!.map(t => t.id)),
        enabled: !!textbooks
    });

    const { data: subchapters } = useQuery({
        queryKey: ["subchapters", classId],
        queryFn: () => getSubchapters(supabase, chapters!.map(c => c.id)),
        enabled: !!chapters
    });

    const { data: homeworkData } = useQuery({
        queryKey: ["homeworks", classId],
        queryFn: () => getHomeworks(supabase, classId),
    });

    const { data: problems } = useQuery({
        queryKey: ["problems", classId],
        queryFn: () => getProblems(supabase, homeworkData!.map(h => h.id)),
        enabled: !!homeworkData
    });

    const { data: exercises } = useQuery({
        queryKey: ["exercises", classId],
        queryFn: () => getExercises(supabase, chapters?.map(c => c.id) ?? [], homeworkData?.map(h => h.id) ?? []),
        enabled: !!chapters && !!homeworkData
    });

    // Render active badges
    const renderActiveBadges = () => (
        <>
            {activeChat.context.lectures.map(lectureId => {
                const lecture = lectures?.find(l => l.id === lectureId);
                return lecture && (
                    <Badge
                        key={lectureId}
                        color="blue"
                        style={{ cursor: 'pointer' }}
                        rightSection={onRemoveContext && (
                            <IconX
                                size={14}
                                style={{ cursor: 'pointer' }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRemoveContext('lectures', lectureId);
                                }}
                            />
                        )}
                        onClick={(e) => {
                            if (setViewerMode) {
                                const document = lectureDocuments?.find(d => d.lecture === lectureId)
                                if (document) {
                                    handleDocumentClick(document, chapters ?? [], setViewerMode);
                                }
                            }
                        }}
                    >
                        {lecture.name}
                    </Badge>
                );
            })}

            {activeChat.context.textbooks.map(textbookId => {
                const textbook = textbooks?.find(t => t.id === textbookId);
                return textbook && (
                    <Badge
                        key={textbookId}
                        color="green"
                        style={{ cursor: 'pointer' }}
                        rightSection={onRemoveContext && (
                            <IconX
                                size={14}
                                style={{ cursor: 'pointer' }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRemoveContext('textbooks', textbookId);
                                }}
                            />
                        )}
                        onClick={(e) => {
                            if (setViewerMode) {
                                const document = textbookDocuments?.find(d => d.textbook === textbookId)
                                if (document) {
                                    handleDocumentClick(document, chapters ?? [], setViewerMode);
                                }
                            }
                        }}
                    >
                        {textbook.title}
                    </Badge>
                );
            })}

            {activeChat.context.chapters.map(chapterId => {
                const chapter = chapters?.find(c => c.id === chapterId);
                return chapter && (
                    <Badge
                        key={chapterId}
                        color="orange"
                        style={{ cursor: 'pointer' }}
                        rightSection={onRemoveContext && (
                            <IconX
                                size={14}
                                style={{ cursor: 'pointer' }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRemoveContext('chapters', chapterId);
                                }}
                            />
                        )}
                        onClick={(e) => {
                            if (setViewerMode) {
                                const document = textbookDocuments?.find(d => d.textbook === chapter.textbook)
                                if (document) {
                                    handleDocumentClick(document, chapters ?? [], setViewerMode);
                                }
                            }
                        }}
                    >
                        {`Chapter ${chapter.chapter_number}: ${chapter.title}`}
                    </Badge>
                );
            })}

            {activeChat.context.exercises.map(exerciseId => {
                const exercise = exercises?.find(e => e.id === exerciseId);
                const chapter = exercise ? chapters?.find(c => c.id === exercise.chapter) : null;
                return exercise && chapter && (
                    <Badge
                        key={exerciseId}
                        color="cyan"
                        style={{ cursor: 'pointer' }}
                        rightSection={onRemoveContext && (
                            <IconX
                                size={14}
                                style={{ cursor: 'pointer' }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRemoveContext('exercises', exerciseId);
                                }}
                            />
                        )}
                        onClick={(e) => {
                            if (setViewerMode) {
                                const document = textbookDocuments?.find(d => d.textbook === chapter?.textbook)
                                if (document) {
                                    handleDocumentClick(document, chapters ?? [], setViewerMode);
                                }
                            }
                        }}
                    >
                        {exercise.title !== "" ? exercise.title : `Exercise ${chapter.chapter_number}.${exercise.exercise_number}`}
                    </Badge>
                );
            })}

            {activeChat.context.subchapters.map(subchapterId => {
                const subchapter = subchapters?.find(s => s.id === subchapterId);
                const chapter = subchapter ? chapters?.find(c => c.id === subchapter.chapter) : null;
                return subchapter && chapter && (
                    <Badge
                        key={subchapterId}
                        color="purple"
                        style={{ cursor: 'pointer' }}
                        rightSection={onRemoveContext && (
                            <IconX
                                size={14}
                                style={{ cursor: 'pointer' }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRemoveContext('subchapters', subchapterId);
                                }}
                            />
                        )}
                        onClick={(e) => {
                            if (setViewerMode) {
                                const document = textbookDocuments?.find(d => d.textbook === chapter?.textbook)
                                if (document) {
                                    handleDocumentClick(document, chapters ?? [], setViewerMode);
                                }
                            }
                        }}
                    >
                        {`Subchapter ${subchapter.subchapter_number}: ${subchapter.title}`}
                    </Badge>
                );
            })}

            {activeChat.context.homeworks.map(homeworkId => {
                const homework = homeworkData?.find(h => h.id === homeworkId);
                const homeworkProblems = problems?.filter(p => p.homework === homeworkId);
                const homeworkExercises = homeworkProblems?.map(p => exercises?.find(e => e.id === p.exercise));
                return homework && (
                    <Badge
                        key={homeworkId}
                        color="orange"
                        style={{ cursor: 'pointer' }}
                        rightSection={onRemoveContext && (
                            <IconX
                                size={14}
                                style={{ cursor: 'pointer' }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRemoveContext('homeworks', homeworkId);
                                }}
                            />
                        )}
                        onClick={(e) => {
                            if (setViewerMode) {
                                const document = textbookDocuments?.find(d => homeworkExercises?.some(e => e?.start_page && e?.end_page && e.start_page <= d.page && e.end_page >= d.page))
                                if (document) {
                                    handleDocumentClick(document, chapters ?? [], setViewerMode);
                                }
                            }
                        }}
                    >
                        {homework.title}
                    </Badge>
                );
            })}

            {activeChat.context.problems.map(problemId => {
                const problem = problems?.find(p => p.id === problemId);
                const exercise = exercises?.find(e => e.id === problem?.exercise);
                const homework = homeworkData?.find(h => h.id === problem?.homework);
                return problem && homework && (
                    <Badge
                        key={problemId}
                        color="cyan"
                        style={{ cursor: 'pointer' }}
                        rightSection={onRemoveContext && (
                            <IconX
                                size={14}
                                style={{ cursor: 'pointer' }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRemoveContext('problems', problemId);
                                }}
                            />
                        )}
                        onClick={(e) => {
                            if (setViewerMode) {
                                const document = textbookDocuments?.find(d => exercise?.start_page && exercise?.end_page && exercise.start_page <= d.page && exercise.end_page >= d.page)
                                if (document) {
                                    handleDocumentClick(document, chapters ?? [], setViewerMode);
                                }
                            }
                        }}
                    >
                        {`${homework.title}: Problem ${problem.problem_number}`}
                    </Badge>
                );
            })}
        </>
    );

    // Render "Add X" badges
    const renderAddBadges = () => (
        <>
            {activeChat.context.lectures.length === 0 && lectures && lectures.length !== 0 && (
                <Badge
                    color="gray"
                    leftSection={<IconPlus size={12} />}
                    onClick={() => {
                        onScrollToSection?.("lectures-section")
                        if (setViewerMode) {
                            setViewerMode({
                                active: false,
                            });
                        }
                    }}
                    style={{ cursor: "pointer" }}
                >
                    Add Lectures
                </Badge>
            )}

            {activeChat.context.textbooks.length === 0 && textbooks && textbooks.length !== 0 && (
                <Badge
                    color="gray"
                    leftSection={<IconPlus size={12} />}
                    onClick={() => {
                        onScrollToSection?.("textbooks-section")
                        if (setViewerMode) {
                            setViewerMode({
                                active: false,
                            });
                        }
                    }}
                    style={{ cursor: "pointer" }}
                >
                    Add Textbooks
                </Badge>
            )}

            {activeChat.context.homeworks.length === 0 && homeworkData && homeworkData.length !== 0 && (
                <Badge
                    color="gray"
                    leftSection={<IconPlus size={12} />}
                    onClick={() => onScrollToSection?.("homeworks-section")}
                    style={{ cursor: "pointer" }}
                >
                    Add Homework
                </Badge>
            )}
        </>
    );

    return (
        <Group>
            {renderActiveBadges()}
            {renderAddBadges()}
        </Group>
    );
});

ContextBadges.displayName = 'ContextBadges';

