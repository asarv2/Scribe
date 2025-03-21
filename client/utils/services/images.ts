/**
 * utils/services/images.ts
 * Used to get images from the database
 * @AshokSaravanan222
 * 02/18/2025
 */

export const getAvatarUrl = (profileId: string) => {
    return `${process.env.NEXT_PUBLIC_STORAGE_URL}/profiles/${profileId}.png`
}

export const getCourseImageUrl = (classId: string) => {
    return `${process.env.NEXT_PUBLIC_STORAGE_URL}/classes/home/${classId}.jpg`
}

export const getFigureUrl = (figureId: string) => {
    return `${process.env.NEXT_PUBLIC_STORAGE_URL}/figures/${figureId}.png`
}

export const getQuestionTextUrl = (messageId: string): string => {
    return `${process.env.NEXT_PUBLIC_API_URL}/download/questions?message_id=${messageId}&format=text`;
}

export const getQuestionPDFUrl = (messageId: string): string => {
    return `${process.env.NEXT_PUBLIC_API_URL}/download/questions?message_id=${messageId}&format=pdf`;
}

export const getQuestionTeXUrl = (messageId: string): string => {
    return `${process.env.NEXT_PUBLIC_API_URL}/download/questions?message_id=${messageId}&format=latex`;
}

export const getSummaryTextUrl = (summaryId: string): string => {
    return `${process.env.NEXT_PUBLIC_API_URL}/download/summary?summary_id=${summaryId}&format=text`;
}

export const getSummaryPDFUrl = (summaryId: string): string => {
    return `${process.env.NEXT_PUBLIC_API_URL}/download/summary?summary_id=${summaryId}&format=pdf`;
}

export const getSummaryTeXUrl = (summaryId: string): string => {
    return `${process.env.NEXT_PUBLIC_API_URL}/download/summary?summary_id=${summaryId}&format=latex`;
}







