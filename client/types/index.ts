export type UserMode = 'student' | 'teacher';
// Only include actual types from the database enum
export type ChatType = 'general' | 'homework' | 'conceptual' | 'summary' | 'review';

export interface ChatMessage {
    id: number;
    title: string
    prompt: string;
    context: {
        lectures: string[];     // lecture IDs
        chapters: string[];    // chapter IDs
        exercises: string[];   // exercise IDs
        homeworks: string[];   // homework IDs
    };
    chatType: ChatType;
    metadata?: {
        teacherOption?: string;
        [key: string]: any;
    };
}
