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

export const getQuestionTextUrl = (questionId: string) => {
    return `${process.env.NEXT_PUBLIC_STORAGE_URL}/questions/${questionId}.txt`
}

export const getQuestionPDFUrl = (questionId: string) => {
    return `${process.env.NEXT_PUBLIC_STORAGE_URL}/questions/${questionId}.pdf`
}

export const getQuestionTeXUrl = (questionId: string) => {
    return `${process.env.NEXT_PUBLIC_STORAGE_URL}/questions/${questionId}.tex`
}

export const getSummaryTextUrl = (summaryId: string) => {
    return `${process.env.NEXT_PUBLIC_STORAGE_URL}/summaries/${summaryId}.txt`
}

export const getSummaryPDFUrl = (summaryId: string) => {
    return `${process.env.NEXT_PUBLIC_STORAGE_URL}/summaries/${summaryId}.pdf`
}

export const getSummaryTeXUrl = (summaryId: string) => {
    return `${process.env.NEXT_PUBLIC_STORAGE_URL}/summaries/${summaryId}.tex`
}







