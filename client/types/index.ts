export interface ViewerMode {
    active: boolean;
    open: boolean;
    showPageDetails?: boolean;
    fileId?: string;
    documentId?: string;
    pageNumber?: number;
    viewPage?: number;
    isLecture?: boolean;
}