import ReactMarkdown from 'react-markdown';
import RemarkMathPlugin from 'remark-math';
import RehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import remarkDirective from 'remark-directive';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css';
import { Avatar, Badge, Flex } from '@mantine/core';
import { visit } from 'unist-util-visit';
import { Document, Exercise } from '@/types';
import { IconChevronRight } from '@tabler/icons-react';
import { getFiles } from '@/utils/queries/get-files';
import { useQuery } from '@tanstack/react-query';
import useSupabaseBrowser from '@/utils/supabase/supabase-browser';
import { getFileDocuments } from '@/utils/queries/get-file-docs';
import { getExercises } from '@/utils/queries/get-exercises';
import { getChapterDocuments } from '@/utils/queries/get-chapter-docs';
import { getTextbookDocuments } from '@/utils/queries/get-textbook-docs';
import { getHomeworks } from '@/utils/queries/get-homeworks';
import { getChapters } from '@/utils/queries/get-chapters';
import { getLectures } from '@/utils/queries/get-lectures';
import { getLectureDocuments } from '@/utils/queries/get-lecture-docs';
import { getTextbooks } from '@/utils/queries/get-textbooks';
import { getProfile } from '@/utils/queries/get-profile';
import { getUser } from '@/utils/queries/get-user';
interface LatexProps {
    children: string;
    classId?: string;
    handleEnhancedDocumentClick?: (contextType: 'lectures' | 'chapters' | 'homeworks' | 'files', contextId: string, documentId?: string, textbookId?: string, exerciseId?: string) => void;
}

export default function Latex({ children, classId, handleEnhancedDocumentClick }: LatexProps) {
    const supabase = useSupabaseBrowser();

    const { data: user } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase),
    });

    const { data: profile } = useQuery({
        queryKey: ["profile", user?.id],
        queryFn: () => getProfile(supabase, user!.id),
        enabled: !!user?.id
    });


    const { data: lectures } = useQuery({
        queryKey: ["lectures", classId],
        queryFn: () => getLectures(supabase, classId ? [classId] : []),
        enabled: !!classId
    });

    const { data: lectureDocuments } = useQuery({
        queryKey: ["lectureDocuments", classId],
        queryFn: () => getLectureDocuments(supabase, lectures!.map(l => l.id)),
        enabled: !!lectures && !!classId
    });

    const { data: textbooks } = useQuery({
        queryKey: ["textbooks", classId],
        queryFn: () => getTextbooks(supabase, classId ? [classId] : []),
        enabled: !!classId
    });

    const { data: chapters } = useQuery({
        queryKey: ["chapters", classId],
        queryFn: () => getChapters(supabase, textbooks!.map(t => t.id)),
        enabled: !!textbooks && !!classId
    });

    const { data: chapterDocuments } = useQuery({
        queryKey: ["chapterDocuments", classId],
        queryFn: () => getChapterDocuments(supabase, chapters!.map(c => c.id)),
        enabled: !!chapters && !!classId
    });

    const { data: textbookDocuments } = useQuery({
        queryKey: ["textbookDocuments", classId],
        queryFn: () => getTextbookDocuments(supabase, textbooks!.map(t => t.id)),
        enabled: !!textbooks && !!classId
    });

    const { data: homeworks } = useQuery({
        queryKey: ["homeworks", classId],
        queryFn: () => getHomeworks(supabase, classId ? [classId] : []),
        enabled: !!classId
    });

    const { data: chapterExercises } = useQuery({
        queryKey: ["chapterExercises", classId],
        queryFn: () => getExercises(supabase, chapters!.map(c => c.id), []),
        enabled: !!chapters && !!classId
    });

    const { data: homeworkExercises } = useQuery({
        queryKey: ["homeworkExercises", classId],
        queryFn: () => getExercises(supabase, [], homeworks!.map(h => h.id)),
        enabled: !!homeworks && !!classId
    });

    const { data: files, isLoading: loadingFiles } = useQuery({
        queryKey: ["files", profile?.id, classId],
        queryFn: () => getFiles(supabase, profile!.id, classId ? [classId] : []),
        enabled: !!profile && !!classId
    });


    const { data: fileDocuments } = useQuery({
        queryKey: ["fileDocuments", classId],
        queryFn: () => getFileDocuments(supabase, files!.map(f => f.id)),
        enabled: !!files && !!classId
    });

    const getPageRanges = (documents: Document[], exercises: Exercise[]): { startDocument: Document | null, startExercise: Exercise | null, range: string }[] => {
        if (!documents.length && !exercises.length) return [];

        const pageRanges: { startDocument: Document | null, startExercise: Exercise | null, range: string }[] = [];


        if (documents.length > 0) {
            // Remove duplicates and sort
            const uniquePages = Array.from(new Set(documents.map(doc => doc.page))).sort((a, b) => a - b);
            let start = uniquePages[0];
            let prev = uniquePages[0];

            for (let i = 1; i <= uniquePages.length; i++) {
                if (i === uniquePages.length || uniquePages[i] !== prev + 1) {
                    const document = documents.find(doc => doc.page === start);
                    if (document) {
                        pageRanges.push({ startDocument: document, startExercise: null, range: start === prev ? `${start}` : `${start}-${prev}` });
                    }
                    if (i < uniquePages.length) {
                        start = uniquePages[i];
                        prev = uniquePages[i];
                    }
                } else {
                    prev = uniquePages[i];
                }
            }
        } else {
            // Remove duplicates and sort
            const uniqueChapterPages = Array.from(new Set(exercises.map(e => e.exercise_number))).sort((a, b) => a - b);
            let chapterStart = uniqueChapterPages[0];
            let chapterPrev = uniqueChapterPages[0];

            for (let i = 1; i <= uniqueChapterPages.length; i++) {
                if (i === uniqueChapterPages.length || uniqueChapterPages[i] !== chapterPrev + 1) {
                    const exercise = exercises.find(e => e.exercise_number === chapterStart);
                    if (exercise) {
                        pageRanges.push({ startDocument: null, startExercise: exercise, range: chapterStart === chapterPrev ? `${chapterStart}` : `${chapterStart}-${chapterPrev}` });
                    }
                    if (i < uniqueChapterPages.length) {
                        chapterStart = uniqueChapterPages[i];
                        chapterPrev = uniqueChapterPages[i];
                    }
                } else {
                    chapterPrev = uniqueChapterPages[i];
                }
            }

            const uniqueHomeworkPages = Array.from(new Set(exercises.map(e => e.problem_number))).sort((a, b) => a - b);
            let homeworkStart = uniqueHomeworkPages[0];
            let homeworkPrev = uniqueHomeworkPages[0];

            for (let i = 1; i <= uniqueHomeworkPages.length; i++) {
                if (i === uniqueHomeworkPages.length || uniqueHomeworkPages[i] !== homeworkPrev + 1) {
                    const exercise = exercises.find(e => e.problem_number === homeworkStart);
                    if (exercise) {
                        pageRanges.push({ startDocument: null, startExercise: exercise, range: homeworkStart === homeworkPrev ? `${homeworkStart}` : `${homeworkStart}-${homeworkPrev}` });
                    }
                    if (i < uniqueHomeworkPages.length) {
                        homeworkStart = uniqueHomeworkPages[i];
                        homeworkPrev = uniqueHomeworkPages[i];
                    }
                } else {
                    homeworkPrev = uniqueHomeworkPages[i];
                }
            }

        }

        return pageRanges;
    };


    const getDocumentLabel = (
        type: 'lecture' | 'chapter' | 'homework-problem' | 'chapter-exercise' | 'files',
        doc?: Document,
        exercise?: Exercise,
        range?: string
    ): string => {
        if (type === 'lecture' && doc) {
            const lecture = lectures?.find(l => l.id === doc.lecture);
            return `${lecture?.name ?? 'Lecture'} ${range ? `p.${range}` : `p.${doc.page}`}`;
        } else if (type === 'chapter' && doc) {
            const textbook = textbooks?.find(t => t.id === doc.textbook);
            return `${textbook?.title ?? 'Textbook'} ${range ? `p.${range}` : `p.${doc.page}`}`;
        } else if (type === 'chapter-exercise' && exercise) {
            const chapter = chapters?.find(c => c.id === exercise.chapter);
            return `Ch.${chapter?.chapter_number ?? '?'} Ex.${exercise.exercise_number} ${range ? `p.${range}` : ''}`;
        } else if (type === 'homework-problem' && exercise) {
            const homework = homeworks?.find(h => h.id === exercise.homework);
            return `HW ${homework?.homework_number ?? '?'} Problem ${exercise.problem_number} ${range ? `p.${range}` : ''}`;
        } else if (type === 'files' && doc) {
            const file = files?.find(f => f.id === doc.file);
            return `${file?.title ?? 'File'} ${range ? `p.${range}` : `p.${doc.page}`}`;
        }
        return 'Document Reference';
    };

    const getTextbookForChapter = (chapterId: string) => {
        const chapter = chapters?.find(c => c.id === chapterId);
        return chapter?.textbook || null;
    };

    const renderBadges = (documents: Document[], exercises: Exercise[]) => {
        // find all of the distinct lectures and chapters in the group
        const groupLectures = Array.from(new Set(documents.filter(doc => doc ? doc.lecture !== null : false).map(doc => doc.lecture).filter((lectureId) => lectureId !== null)))
        const groupChapters = Array.from(new Set(documents.filter(doc => doc ? doc.textbook !== null && doc.chapter !== null : false).map(doc => doc.chapter).filter((chapterId) => chapterId !== null)))
        const groupFiles = Array.from(new Set(documents.filter(doc => doc ? doc.file !== null : false).map(doc => doc.file).filter((fileId) => fileId !== null)))
        // get the page ranges for each lecture and chapter
        const lecturePageRanges = groupLectures.map(lecture => getPageRanges(documents.filter(doc => doc ? doc.lecture === lecture : false), [])).flat()
        const chapterPageRanges = groupChapters.map(chapter => getPageRanges(documents.filter(doc => doc ? doc.chapter === chapter : false), [])).flat()
        const filePageRanges = groupFiles.map(file => getPageRanges(documents.filter(doc => doc ? doc.file === file : false), [])).flat()
        // combine the page ranges for each lecture and chapter
        const allDocumentPageRanges = [...lecturePageRanges, ...chapterPageRanges, ...filePageRanges]

        // find all of the distinct exercises and chapters in the group
        const groupExercises = Array.from(new Set(exercises
            .filter(exercise => exercise && exercise.homework !== null)
            .map(exercise => exercise.homework)))

        // get the page ranges for each lecture and chapter
        const exercisePageRanges = groupExercises.map(homework => 
            getPageRanges([], exercises.filter(exercise => exercise && exercise.homework === homework))
        ).flat()

        return (
            <>
                {handleEnhancedDocumentClick && allDocumentPageRanges.length > 0 && allDocumentPageRanges.map((pageRange, pageRangeIndex) => {
                    const lectureDocument: boolean = pageRange.startDocument?.lecture !== null;
                    const chapterDocument: boolean = pageRange.startDocument?.textbook !== null && pageRange.startDocument?.chapter !== null;
                    const fileDocument: boolean = pageRange.startDocument?.file !== null;
                    if (lectureDocument) {
                        return (
                            <Badge
                                key={pageRangeIndex}
                                color="blue"
                                style={{ display: 'inline-block', margin: '0 0.25rem', cursor: 'pointer' }}
                                onClick={() => {
                                    if (pageRange.startDocument?.lecture) {
                                        handleEnhancedDocumentClick('lectures', pageRange.startDocument.lecture, pageRange.startDocument.id);
                                    }
                                }}
                                leftSection={
                                    <Avatar
                                        src={`${process.env.NEXT_PUBLIC_STORAGE_URL}/lectures/${classId}/${pageRange.startDocument?.lecture}/${pageRange.startDocument?.id}.png`}
                                        size="xs"
                                        radius="sm"
                                    />
                                }
                                rightSection={
                                    <IconChevronRight size={16} />
                                }
                            >
                                {getDocumentLabel(
                                    'lecture',
                                    pageRange.startDocument ?? undefined,
                                    undefined,
                                    pageRange.range
                                )}
                            </Badge>
                        );
                    } else if (chapterDocument) {
                        return (
                            <Badge
                                key={pageRangeIndex}
                                color="green"
                                style={{ display: 'inline-block', margin: '0 0.25rem', cursor: 'pointer' }}
                                onClick={() => {
                                    if (pageRange.startDocument?.chapter) {
                                        handleEnhancedDocumentClick('chapters', pageRange.startDocument.chapter, pageRange.startDocument.id, pageRange.startDocument.textbook || undefined);
                                    }
                                }}
                                leftSection={
                                    <Avatar
                                        src={`${process.env.NEXT_PUBLIC_STORAGE_URL}/textbooks/${classId}/${pageRange.startDocument?.textbook}/${pageRange.startDocument?.id}.png`}
                                        size="xs"
                                        radius="sm"
                                    />
                                }
                                rightSection={
                                    <IconChevronRight size={16} />
                                }
                            >
                                {getDocumentLabel(
                                    'chapter',
                                    pageRange.startDocument ?? undefined,
                                    undefined,
                                    pageRange.range
                                )}
                            </Badge>
                        );
                    } else if (fileDocument) {
                        return (
                            <Badge
                                key={pageRangeIndex}
                                color="purple"
                                style={{ display: 'inline-block', margin: '0 0.25rem', cursor: 'pointer' }}
                                onClick={() => {
                                    if (pageRange.startDocument?.file) {
                                        handleEnhancedDocumentClick('files', pageRange.startDocument.file, pageRange.startDocument.id);
                                    }
                                }}
                                leftSection={
                                    <Avatar
                                        src={`${process.env.NEXT_PUBLIC_STORAGE_URL}/files/${classId}/${pageRange.startDocument?.file}/${pageRange.startDocument?.id}.png`}
                                        size="xs"
                                        radius="sm"
                                    />
                                }
                                rightSection={
                                    <IconChevronRight size={16} />
                                }
                            >
                                {getDocumentLabel(
                                    'files',
                                    pageRange.startDocument ?? undefined,
                                    undefined,
                                    pageRange.range
                                )}
                            </Badge>
                        );
                    } else {
                        return null;
                    }
                })}
                {handleEnhancedDocumentClick && exercisePageRanges.length > 0 && exercisePageRanges.map((pageRange, pageRangeIndex) => {
                    const chapterExercise: boolean = pageRange.startExercise?.chapter !== null;
                    const homeworkExercise: boolean = pageRange.startExercise?.homework !== null;

                    if (homeworkExercise) {
                        return (
                            <Badge
                                key={pageRangeIndex}
                                color="orange"
                                style={{ display: 'inline-block', margin: '0 0.25rem', cursor: 'pointer' }}
                                onClick={() => {
                                    if (pageRange.startExercise?.homework) {
                                        handleEnhancedDocumentClick('homeworks', pageRange.startExercise.homework, undefined, undefined, pageRange.startExercise.id);
                                    }
                                }}
                                leftSection={
                                    <Avatar
                                        src={`${process.env.NEXT_PUBLIC_STORAGE_URL}/exercises/${classId}/${pageRange.startExercise?.homework}/${pageRange.startExercise?.id}.png`}
                                        size="xs"
                                        radius="sm"
                                    />
                                }
                                rightSection={
                                    <IconChevronRight size={16} />
                                }
                            >
                                {getDocumentLabel(
                                    'homework-problem',
                                    undefined,
                                    pageRange.startExercise ?? undefined
                                )}
                            </Badge>
                        );
                    } if (chapterExercise) {
                        return (
                            <Badge
                                key={pageRangeIndex}
                                color="teal"
                                style={{ display: 'inline-block', margin: '0 0.25rem', cursor: 'pointer' }}
                                onClick={() => {
                                    if (pageRange.startExercise?.chapter) {
                                        // Get the textbook ID for this chapter
                                        const textbookId = getTextbookForChapter(pageRange.startExercise.chapter);
                                        handleEnhancedDocumentClick('chapters', pageRange.startExercise.chapter, undefined, textbookId || undefined, pageRange.startExercise.id);
                                    }
                                }}
                                leftSection={
                                    <Avatar
                                        src={pageRange.startExercise?.chapter ?
                                            `${process.env.NEXT_PUBLIC_STORAGE_URL}/exercises/${classId}/${getTextbookForChapter(pageRange.startExercise.chapter)}/${pageRange.startExercise.id}.png` :
                                            '/placeholder_image.svg'}
                                        size="xs"
                                        radius="sm"
                                    />
                                }
                                rightSection={
                                    <IconChevronRight size={16} />
                                }
                            >
                                {getDocumentLabel(
                                    'chapter-exercise',
                                    undefined,
                                    pageRange.startExercise ?? undefined
                                )}
                            </Badge>
                        );
                    } else {
                        return null;
                    }
                })}
            </>
        )
    }



    // Preprocess the text to replace all tag types with custom HTML
    const processedText = children
        .replace(/::lecture{id=([a-zA-Z0-9,-]+)}/g, '<span class="tag-badge" data-tag-type="lecture" data-tag-id="$1"></span>')
        .replace(/::chapter{id=([a-zA-Z0-9,-]+)}/g, '<span class="tag-badge" data-tag-type="chapter" data-tag-id="$1"></span>')
        .replace(/::file{id=([a-zA-Z0-9,-]+)}/g, '<span class="tag-badge" data-tag-type="file" data-tag-id="$1"></span>')
        .replace(/::exercise{id=([a-zA-Z0-9,-]+)}/g, '<span class="tag-badge" data-tag-type="exercise" data-tag-id="$1"></span>')
        .replace(/::problem{id=([a-zA-Z0-9,-]+)}/g, '<span class="tag-badge" data-tag-type="problem" data-tag-id="$1"></span>')
        .replace(/\n/g, '  \n');

    return (
        <div className="latex-container">
            <ReactMarkdown
                remarkPlugins={[
                    RemarkMathPlugin,
                    remarkGfm,
                    remarkDirective,
                ]}
                rehypePlugins={[
                    RehypeKatex,
                    rehypeRaw, // This is important to parse our custom HTML
                    rehypeSlug,
                    rehypeAutolinkHeadings,
                    [rehypeHighlight, { ignoreMissing: true }]
                ]}
                components={{
                    p: ({ children }) => <p className="prose-p">{children}</p>,
                    h1: ({ children }) => <h1 className="prose-h1">{children}</h1>,
                    h2: ({ children }) => <h2 className="prose-h2">{children}</h2>,
                    ul: ({ children }) => <ul className="prose-ul">{children}</ul>,
                    ol: ({ children }) => <ol className="prose-ol">{children}</ol>,
                    li: ({ children }) => <li className="prose-li">{children}</li>,
                    table: ({ children }) => <table className="prose-table">{children}</table>,
                    th: ({ children }) => <th className="prose-th">{children}</th>,
                    td: ({ children }) => <td className="prose-td">{children}</td>,
                    span: (props: any) => {
                        if (props.className === 'tag-badge' && props['data-tag-id'] && classId) {
                            const tagType = props['data-tag-type'] || 'lecture';
                            const tagIds = props['data-tag-id'].split(',');

                            // find documents and exercises for each tag id
                            const documents = tagIds.map((id: string) => {
                                if (tagType === 'lecture') {
                                    return lectureDocuments?.find((lectureDocument: Document) => lectureDocument.id === id);
                                } else if (tagType === 'chapter') {
                                    return chapterDocuments?.find((chapterDocument: Document) => chapterDocument.id === id);
                                } else if (tagType === 'file') {
                                    return fileDocuments?.find((fileDocument: Document) => fileDocument.id === id);
                                }
                            });

                            const exercises = tagIds.map((id: string) => {
                                if (tagType === 'exercise') {
                                    return chapterExercises?.find((chapterExercise: Exercise) => chapterExercise.id === id);
                                } else if (tagType === 'problem') {
                                    return homeworkExercises?.find((homeworkExercise: Exercise) => homeworkExercise.id === id);
                                }
                            });
                            
                            return renderBadges(documents, exercises);
                        }
                        return <span {...props} />;
                    }
                }}
            >
                {processedText}
            </ReactMarkdown>
            <style jsx global>{`
                .latex-container {
                    font-size: 1rem;
                    line-height: 1.75;
                }
                
                .prose-p {
                    margin: 1.25em 0;
                }

                .latex-container > :first-child {
                    margin-top: 0;
                }

                .latex-container > :last-child {
                    margin-bottom: 0;
                }

                .prose-h1 {
                    margin: 2em 0 1em;
                    font-size: 2em;
                }

                .prose-h2 {
                    margin: 1.5em 0 0.75em;
                    font-size: 1.5em;
                }

                .prose-ul, .prose-ol {
                    margin: 1.25em 0;
                    padding-left: 1.625em;
                }

                .prose-li {
                    margin: 0.5em 0;
                    padding-left: 0.375em;
                }

                .katex-display {
                    margin: 1em 0 !important;
                    overflow-x: auto;
                    overflow-y: hidden;
                }

                .katex {
                    text-rendering: auto;
                }
                
                /* Table styles */
                .prose-table {
                    width: 100%;
                    margin: 1.5em auto; /* old for left aligned tables: margin: 1.5em 0; */
                    border-collapse: collapse;
                    overflow-x: auto;
                    display: block;
                    max-width: fit-content; /* remove for left aligned tables */
                }
                
                .prose-table table {
                    border-collapse: collapse;
                    width: 100%;
                    margin: 0 auto; /* remove for left aligned tables */
                }
                
                .prose-th {
                    padding: 0.75em 1em;
                    border: 1px solid;
                    font-weight: 600;
                    text-align: left;
                    
                    @mixin light {
                        background-color: #f8f9fa;
                        border-color: #e5e7eb;
                    }
                    
                    @mixin dark {
                        background-color: #2c2e33;
                        border-color: #373a40;
                    }
                }
                
                .prose-td {
                    padding: 0.75em 1em;
                    border: 1px solid;
                    vertical-align: top;
                    
                    @mixin light {
                        border-color: #e5e7eb;
                    }
                    
                    @mixin dark {
                        border-color: #373a40;
                    }
                }
                
                .prose-table tr:nth-child(even) {
                    @mixin light {
                        background-color: #f9fafb;
                    }
                    
                    @mixin dark {
                        background-color: #25262b;
                    }
                }
                
                .prose-table tr:nth-child(odd) {
                    @mixin dark {
                        background-color: #2c2e33;
                    }
                }

                /* Badge alignment styles */
                .mantine-Badge-root {
                    display: inline-flex !important;
                    align-items: center !important;
                    justify-content: space-between !important;
                }
                
                .mantine-Badge-inner {
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    width: 100% !important;
                }
                
                .mantine-Badge-section {
                    display: flex !important;
                    align-items: center !important;
                }
                
                .mantine-Badge-label {
                    flex: 1 !important;
                    text-align: center !important;
                }
            `}</style>
        </div>
    );
}