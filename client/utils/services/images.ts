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

export const getFigureUrl = (classId: string, figureId: string, format: 'svg' | 'png' = 'svg') => {
    return `${process.env.NEXT_PUBLIC_STORAGE_URL}/figures/${classId}/${figureId}.${format}`
}

export const getSummaryDownloadUrl = (chatId: string, summaryIds: string[], format: 'pdf' | 'latex' | 'text') => {
    const baseUrl = `${process.env.NEXT_PUBLIC_API_URL}/download/summary`;
    const url = new URL(baseUrl, window.location.origin);
    url.searchParams.append('chat_id', chatId);
    summaryIds.forEach(id => {
        url.searchParams.append('summary_ids', id);
    });
    url.searchParams.append('format', format);
    return url.toString();
}

export const getGradeDownloadUrl = (chatId: string, gradeId: string, format: 'pdf' | 'latex' | 'text') => {
    const baseUrl = `${process.env.NEXT_PUBLIC_API_URL}/download/grade`;
    const url = new URL(baseUrl, window.location.origin);
    url.searchParams.append('chat_id', chatId);
    url.searchParams.append('grade_id', gradeId);
    url.searchParams.append('format', format);
    return url.toString();
}

export const getQuestionDownloadUrl = (chatId: string, questionIds: string[], format: 'pdf' | 'latex' | 'text') => {
    
    const baseUrl = `${process.env.NEXT_PUBLIC_API_URL}/download/questions`;
    // Create URL with properly formatted query parameters for multiple IDs
    const url = new URL(baseUrl, window.location.origin);
    
    // Add each question ID as a separate query parameter with the same name
    questionIds.forEach(id => {
        url.searchParams.append('question_ids', id);
    });

    url.searchParams.append('chat_id', chatId);
    
    // Add format parameter
    url.searchParams.append('format', format);
    
    return url.toString();
};

export const getFigureDownloadUrl = (chatId: string, figureIds: string[], format: 'png' | 'pdf' | 'latex') => {
    const baseUrl = `${process.env.NEXT_PUBLIC_API_URL}/download/figure`;
    const url = new URL(baseUrl, window.location.origin);
    url.searchParams.append('chat_id', chatId);
    figureIds.forEach(id => {
        url.searchParams.append('figure_ids', id);
    });
    url.searchParams.append('format', format);
    return url.toString();
}







