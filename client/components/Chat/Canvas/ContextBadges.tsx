/**
 * ContextBadges.tsx
 * Used to show the context badges in the chat.
 */

import { Badge, Group } from "@mantine/core";
import { IconPlus, IconWand, IconX } from "@tabler/icons-react";
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
    expandedSections: Set<string>;
    toggleSection: (section: string) => void;
}

export const ContextBadges = memo(({
    activeChat,
    classId,
    onRemoveContext,
    onScrollToSection,
    setViewerMode,
    expandedSections,
    toggleSection
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
                                const document = lectureDocuments?.find(d => d.lecture === lectureId) // first page of the lecture
                                if (document) {
                                    handleDocumentClick('lectures', lectureId, setViewerMode, document.id);
                                }
                            }
                        }}
                    >
                        {lecture.name}
                    </Badge>
                );
            })}

            {activeChat.context.chapters.map(chapterId => {
                const chapter = chapters?.find(c => c.id === chapterId);
                return chapter && (
                    <Badge
                        key={chapterId}
                        color="green"
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
                                const textbook = textbooks?.find(t => t.id === chapter.textbook)
                                if (textbook) {
                                    const document = textbookDocuments?.find(d => d.page >= chapter.start_page && d.page <= chapter.end_page && d.textbook === textbook.id) // first page of the chapter
                                    if (document) {
                                        handleDocumentClick('chapters', chapterId, setViewerMode, document.id, textbook.id);
                                    }
                                }
                            }
                        }}
                    >
                        {`Chapter ${chapter.chapter_number}: ${chapter.title}`}
                    </Badge>
                );
            })}

            {activeChat.context.homeworks.map(homeworkId => {
                const homework = homeworkData?.find(h => h.id === homeworkId);
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
                                const exercise = exercises?.find(e => e.homework === homeworkId) // find first exercise of the homework
                                if (exercise) {
                                    handleDocumentClick('homeworks', homeworkId, setViewerMode, undefined, undefined, exercise.id);
                                }
                            }
                        }}
                    >
                        {homework.title}
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
                    color="blue"
                    variant="light"
                    leftSection={<IconPlus size={12} />}
                    onClick={() => {
                        if (setViewerMode) {
                            setViewerMode({
                                active: false,
                            });
                        }
                        if (!expandedSections.has("lectures")) {
                            toggleSection("lectures");
                            // delay for 100ms to ensure the section is expanded
                            setTimeout(() => {
                                onScrollToSection?.("lectures-section")
                            }, 100);
                        } else {
                            onScrollToSection?.("lectures-section")
                        }
                    }}
                    style={{ cursor: "pointer" }}
                >
                    Add Lectures
                </Badge>
            )}

            {activeChat.context.chapters.length === 0 && chapters && chapters.length !== 0 && (
                <Badge
                    color="green"
                    variant="light"
                    leftSection={<IconPlus size={12} />}
                    onClick={() => {
                        if (setViewerMode) {
                            setViewerMode({
                                active: false,
                            });
                        }
                        if (!expandedSections.has("chapters")) {
                            toggleSection("chapters");
                            // delay for 100ms to ensure the section is expanded
                            setTimeout(() => {
                                onScrollToSection?.("chapters-section")
                            }, 100);
                        } else {
                            onScrollToSection?.("chapters-section")
                        }
                    }}
                    style={{ cursor: "pointer" }}
                >
                    Add Readings
                </Badge>
            )}
            {activeChat.context.homeworks.length === 0 && homeworkData && homeworkData.length !== 0 && (
                <Badge
                    color="orange"
                    variant="light"
                    leftSection={<IconPlus size={12} />}
                    onClick={() => {
                        if (setViewerMode) {
                            setViewerMode({
                                active: false,
                            });
                        }
                        if (!expandedSections.has("homeworks")) {
                            toggleSection("homeworks");
                            // delay for 100ms to ensure the section is expanded
                            setTimeout(() => {
                                onScrollToSection?.("homeworks-section")
                            }, 100);
                        } else {
                            onScrollToSection?.("homeworks-section")
                        }
                    }}
                    style={{ cursor: "pointer" }}
                >
                    Add Homeworks
                </Badge>
            )}
            {/* {activeChat.context.exercises.length === 0 && exercises && exercises.length !== 0 && (
                <Badge
                    color="gray"
                    leftSection={<IconPlus size={12} />}
                    onClick={() => {
                        if (setViewerMode) {
                            setViewerMode({
                                active: false,
                            });
                        }
                        if (!expandedSections.has("exercises")) {
                            toggleSection("exercises");
                            // delay for 100ms to ensure the section is expanded
                            setTimeout(() => {
                                onScrollToSection?.("exercises-section")
                            }, 100);
                        } else {
                            onScrollToSection?.("exercises-section")
                        }
                    }}
                    style={{ cursor: "pointer" }}
                >
                    Add Exercises
                </Badge>
            )} */}
        </>
    );

    return (
        <Group>
            {renderActiveBadges()}
            {renderAddBadges()}
            {/* <Badge color="purple" leftSection={<IconWand size={12} />} style={{ cursor: "pointer" }}>
                Find Context
            </Badge> */}
        </Group>
    );
});

ContextBadges.displayName = 'ContextBadges';

