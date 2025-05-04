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

export const getReportDownloadUrl = (chatId: string, reportIds: string[], format: 'pdf' | 'latex' | 'text') => {
    const baseUrl = `${process.env.NEXT_PUBLIC_API_URL}/download/report`;
    const url = new URL(baseUrl, window.location.origin);
    url.searchParams.append('chat_id', chatId);
    reportIds.forEach(id => {
        url.searchParams.append('report_ids', id);
    });
    url.searchParams.append('format', format);
    return url.toString();
}

/**
 * Build /download/summary URL
 */
export const getSummaryDownloadUrl = (
    chatId: string,
    summaryIds: string[],
    format: 'pdf' | 'latex',
    zip = false,
  ): string => {
    const url = new URL(
      `${process.env.NEXT_PUBLIC_API_URL}/download/summary`,
      window.location.origin,
    );
  
    url.searchParams.append('chat_id', chatId);
    summaryIds.forEach(id => url.searchParams.append('summary_ids', id));
    url.searchParams.append('format', format);
    if (zip) url.searchParams.append('zip', 'true');
  
    return url.toString();
  };
  
  /**
   * Build /download/questions URL
   */
  export const getQuestionDownloadUrl = (
    chatId: string,
    questionIds: string[],
    format: 'pdf' | 'latex',
    zip = false,
  ): string => {
    const url = new URL(
      `${process.env.NEXT_PUBLIC_API_URL}/download/questions`,
      window.location.origin,
    );
  
    url.searchParams.append('chat_id', chatId);
    questionIds.forEach(id => url.searchParams.append('question_ids', id));
    url.searchParams.append('format', format);
    if (zip) url.searchParams.append('zip', 'true');
  
    return url.toString();
  };
  
  /**
   * Build /download/figure URL
   */
  export const getFigureDownloadUrl = (
    chatId: string,
    figureIds: string[],
    format: 'png' | 'pdf' | 'latex',
    zip = false,
  ): string => {
    const url = new URL(
      `${process.env.NEXT_PUBLIC_API_URL}/download/figure`,
      window.location.origin,
    );
  
    url.searchParams.append('chat_id', chatId);
    figureIds.forEach(id => url.searchParams.append('figure_ids', id));
    url.searchParams.append('format', format);
    if (zip) url.searchParams.append('zip', 'true');
  
    return url.toString();
  };





