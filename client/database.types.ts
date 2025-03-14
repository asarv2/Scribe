export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  prod: {
    Tables: {
      chapters: {
        Row: {
          additional_info: string
          chapter_number: number
          created_at: string
          end_page: number
          id: string
          start_page: number
          textbook: string
          title: string
        }
        Insert: {
          additional_info?: string
          chapter_number?: number
          created_at?: string
          end_page?: number
          id?: string
          start_page?: number
          textbook: string
          title?: string
        }
        Update: {
          additional_info?: string
          chapter_number?: number
          created_at?: string
          end_page?: number
          id?: string
          start_page?: number
          textbook?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapters_textbook_fkey"
            columns: ["textbook"]
            isOneToOne: false
            referencedRelation: "textbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      chats: {
        Row: {
          class: string
          created_at: string
          deleted: boolean
          id: string
          name: string
          profile: string | null
          rating: number | null
          response_url: string
          teacher: boolean
          type: Database["prod"]["Enums"]["chat_type"]
        }
        Insert: {
          class: string
          created_at?: string
          deleted?: boolean
          id?: string
          name?: string
          profile?: string | null
          rating?: number | null
          response_url?: string
          teacher?: boolean
          type?: Database["prod"]["Enums"]["chat_type"]
        }
        Update: {
          class?: string
          created_at?: string
          deleted?: boolean
          id?: string
          name?: string
          profile?: string | null
          rating?: number | null
          response_url?: string
          teacher?: boolean
          type?: Database["prod"]["Enums"]["chat_type"]
        }
        Relationships: [
          {
            foreignKeyName: "chats_class_fkey"
            columns: ["class"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chats_profile_fkey"
            columns: ["profile"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          active: boolean
          brightspace_course_descriptor: string | null
          brightspace_course_id: number | null
          class_code: string | null
          course_description: string | null
          course_link: string | null
          created_at: string | null
          deleted: boolean
          download: boolean
          download_time: string
          homework_prompt: string
          id: string
          lecture_prompt: string
          privacy: boolean
          textbook_prompt: string
          title: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          brightspace_course_descriptor?: string | null
          brightspace_course_id?: number | null
          class_code?: string | null
          course_description?: string | null
          course_link?: string | null
          created_at?: string | null
          deleted?: boolean
          download?: boolean
          download_time?: string
          homework_prompt?: string
          id?: string
          lecture_prompt?: string
          privacy?: boolean
          textbook_prompt?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          brightspace_course_descriptor?: string | null
          brightspace_course_id?: number | null
          class_code?: string | null
          course_description?: string | null
          course_link?: string | null
          created_at?: string | null
          deleted?: boolean
          download?: boolean
          download_time?: string
          homework_prompt?: string
          id?: string
          lecture_prompt?: string
          privacy?: boolean
          textbook_prompt?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      codes: {
        Row: {
          classes: string[]
          code: string
          created_at: string
          deleted: boolean
          id: string
        }
        Insert: {
          classes?: string[]
          code: string
          created_at?: string
          deleted?: boolean
          id?: string
        }
        Update: {
          classes?: string[]
          code?: string
          created_at?: string
          deleted?: boolean
          id?: string
        }
        Relationships: []
      }
      contact: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
        }
        Insert: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          chapter: string | null
          created_at: string
          description: string
          exercise: string | null
          exercises: string[]
          homework: string | null
          homeworks: string[]
          id: string
          lecture: string | null
          page: number
          processed: boolean
          subchapter: string | null
          text: string
          textbook: string | null
        }
        Insert: {
          chapter?: string | null
          created_at?: string
          description?: string
          exercise?: string | null
          exercises?: string[]
          homework?: string | null
          homeworks?: string[]
          id?: string
          lecture?: string | null
          page: number
          processed?: boolean
          subchapter?: string | null
          text?: string
          textbook?: string | null
        }
        Update: {
          chapter?: string | null
          created_at?: string
          description?: string
          exercise?: string | null
          exercises?: string[]
          homework?: string | null
          homeworks?: string[]
          id?: string
          lecture?: string | null
          page?: number
          processed?: boolean
          subchapter?: string | null
          text?: string
          textbook?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_chapter_fkey"
            columns: ["chapter"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_exercise_fkey"
            columns: ["exercise"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_homework_fkey"
            columns: ["homework"]
            isOneToOne: false
            referencedRelation: "homeworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_lecture_fkey"
            columns: ["lecture"]
            isOneToOne: false
            referencedRelation: "lectures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_subchapter_fkey"
            columns: ["subchapter"]
            isOneToOne: false
            referencedRelation: "subchapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_textbook_fkey"
            columns: ["textbook"]
            isOneToOne: false
            referencedRelation: "textbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      downloads: {
        Row: {
          class: string
          created_at: string
          download_time: string
          error_message: string
          file_list: string[]
          id: string
          processed_files: number
          refreshed_at: string
          response_url: string
          status: string
          toc_content: string
          total_files: number
          updated_at: string
        }
        Insert: {
          class: string
          created_at?: string
          download_time?: string
          error_message?: string
          file_list?: string[]
          id?: string
          processed_files?: number
          refreshed_at?: string
          response_url?: string
          status?: string
          toc_content?: string
          total_files?: number
          updated_at?: string
        }
        Update: {
          class?: string
          created_at?: string
          download_time?: string
          error_message?: string
          file_list?: string[]
          id?: string
          processed_files?: number
          refreshed_at?: string
          response_url?: string
          status?: string
          toc_content?: string
          total_files?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "downloads_class_fkey"
            columns: ["class"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      evals_homework: {
        Row: {
          created_at: string
          homework: string
          id: string
          latency: number
        }
        Insert: {
          created_at?: string
          homework: string
          id?: string
          latency: number
        }
        Update: {
          created_at?: string
          homework?: string
          id?: string
          latency?: number
        }
        Relationships: [
          {
            foreignKeyName: "evals_homework_homework_fkey"
            columns: ["homework"]
            isOneToOne: false
            referencedRelation: "homeworks"
            referencedColumns: ["id"]
          },
        ]
      }
      evals_lecture: {
        Row: {
          created_at: string
          id: string
          latency: number
          lecture: string
        }
        Insert: {
          created_at?: string
          id?: string
          latency: number
          lecture: string
        }
        Update: {
          created_at?: string
          id?: string
          latency?: number
          lecture?: string
        }
        Relationships: [
          {
            foreignKeyName: "evals_lecture_lecture_fkey"
            columns: ["lecture"]
            isOneToOne: false
            referencedRelation: "lectures"
            referencedColumns: ["id"]
          },
        ]
      }
      evals_message: {
        Row: {
          created_at: string
          id: string
          latency: number
          message: string
        }
        Insert: {
          created_at?: string
          id?: string
          latency: number
          message: string
        }
        Update: {
          created_at?: string
          id?: string
          latency?: number
          message?: string
        }
        Relationships: [
          {
            foreignKeyName: "evals_message_message_fkey"
            columns: ["message"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      evals_textbook: {
        Row: {
          created_at: string
          id: string
          latency: number
          textbook: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          latency: number
          textbook?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          latency?: number
          textbook?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evals_textbook_textbook_fkey"
            columns: ["textbook"]
            isOneToOne: false
            referencedRelation: "textbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          answer_enabled: boolean
          chapter: string | null
          created_at: string
          description: string
          end_page: number
          exercise_number: number
          given: string
          homework: string | null
          id: string
          info: string
          problem_number: number
          problem_part_number: number
          start_page: number
          text: string
          title: string
          type: string
        }
        Insert: {
          answer_enabled?: boolean
          chapter?: string | null
          created_at?: string
          description?: string
          end_page?: number
          exercise_number?: number
          given?: string
          homework?: string | null
          id?: string
          info?: string
          problem_number?: number
          problem_part_number?: number
          start_page?: number
          text?: string
          title?: string
          type?: string
        }
        Update: {
          answer_enabled?: boolean
          chapter?: string | null
          created_at?: string
          description?: string
          end_page?: number
          exercise_number?: number
          given?: string
          homework?: string | null
          id?: string
          info?: string
          problem_number?: number
          problem_part_number?: number
          start_page?: number
          text?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercises_chapter_fkey"
            columns: ["chapter"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercises_homework_fkey"
            columns: ["homework"]
            isOneToOne: false
            referencedRelation: "homeworks"
            referencedColumns: ["id"]
          },
        ]
      }
      faqs: {
        Row: {
          chapters: string[]
          class: string
          count: number
          created_at: string
          homeworks: string[]
          id: string
          lectures: string[]
          messages: string[]
          topic: string
        }
        Insert: {
          chapters?: string[]
          class: string
          count?: number
          created_at?: string
          homeworks?: string[]
          id?: string
          lectures?: string[]
          messages?: string[]
          topic?: string
        }
        Update: {
          chapters?: string[]
          class?: string
          count?: number
          created_at?: string
          homeworks?: string[]
          id?: string
          lectures?: string[]
          messages?: string[]
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "faq_class_fkey"
            columns: ["class"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          created_at: string
          feature: string
          id: string
          negative: string
          positive: string
        }
        Insert: {
          created_at?: string
          feature?: string
          id?: string
          negative?: string
          positive?: string
        }
        Update: {
          created_at?: string
          feature?: string
          id?: string
          negative?: string
          positive?: string
        }
        Relationships: []
      }
      figures: {
        Row: {
          code: string
          created_at: string
          id: string
          message: string | null
        }
        Insert: {
          code?: string
          created_at?: string
          id?: string
          message?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "figures_message_fkey"
            columns: ["message"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      homeworks: {
        Row: {
          additional_info: string
          class: string | null
          created_at: string
          deleted: boolean
          due: string | null
          homework_number: number
          id: string
          last_parse_attempt: string | null
          parse_error: string
          parse_status: Database["prod"]["Enums"]["parse_status"]
          response_url: string
          title: string
        }
        Insert: {
          additional_info?: string
          class?: string | null
          created_at?: string
          deleted?: boolean
          due?: string | null
          homework_number?: number
          id?: string
          last_parse_attempt?: string | null
          parse_error?: string
          parse_status?: Database["prod"]["Enums"]["parse_status"]
          response_url?: string
          title?: string
        }
        Update: {
          additional_info?: string
          class?: string | null
          created_at?: string
          deleted?: boolean
          due?: string | null
          homework_number?: number
          id?: string
          last_parse_attempt?: string | null
          parse_error?: string
          parse_status?: Database["prod"]["Enums"]["parse_status"]
          response_url?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_class_fkey"
            columns: ["class"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      lectures: {
        Row: {
          additional_info: string
          class: string
          created_at: string
          deleted: boolean
          has_audio: boolean
          id: string
          last_parse_attempt: string | null
          last_upload_attempt: string | null
          lecture_date: string
          name: string | null
          note_number: number | null
          pages: number
          parse_error: string | null
          parse_status: Database["prod"]["Enums"]["parse_status"]
          response_url: string
          upload_error: string | null
          upload_progress: number
        }
        Insert: {
          additional_info?: string
          class: string
          created_at?: string
          deleted?: boolean
          has_audio?: boolean
          id?: string
          last_parse_attempt?: string | null
          last_upload_attempt?: string | null
          lecture_date?: string
          name?: string | null
          note_number?: number | null
          pages?: number
          parse_error?: string | null
          parse_status?: Database["prod"]["Enums"]["parse_status"]
          response_url?: string
          upload_error?: string | null
          upload_progress?: number
        }
        Update: {
          additional_info?: string
          class?: string
          created_at?: string
          deleted?: boolean
          has_audio?: boolean
          id?: string
          last_parse_attempt?: string | null
          last_upload_attempt?: string | null
          lecture_date?: string
          name?: string | null
          note_number?: number | null
          pages?: number
          parse_error?: string | null
          parse_status?: Database["prod"]["Enums"]["parse_status"]
          response_url?: string
          upload_error?: string | null
          upload_progress?: number
        }
        Relationships: [
          {
            foreignKeyName: "lectures_class_fkey"
            columns: ["class"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          bare_question: string
          bare_response: string
          chapter_exercise_references: string[]
          chapter_references: string[]
          chapters: string[]
          chat: string | null
          created_at: string
          documents: string[]
          generation_error: string
          generation_status: Database["prod"]["Enums"]["generation_status"]
          homework_exercise_references: string[]
          homeworks: string[]
          id: string
          last_generation_attempt: string | null
          lecture_references: string[]
          lectures: string[]
          profile: string | null
          question: string
          references: string[]
          response: string
          response_url: string
        }
        Insert: {
          bare_question?: string
          bare_response?: string
          chapter_exercise_references?: string[]
          chapter_references?: string[]
          chapters?: string[]
          chat?: string | null
          created_at?: string
          documents?: string[]
          generation_error?: string
          generation_status?: Database["prod"]["Enums"]["generation_status"]
          homework_exercise_references?: string[]
          homeworks?: string[]
          id?: string
          last_generation_attempt?: string | null
          lecture_references?: string[]
          lectures?: string[]
          profile?: string | null
          question?: string
          references?: string[]
          response?: string
          response_url?: string
        }
        Update: {
          bare_question?: string
          bare_response?: string
          chapter_exercise_references?: string[]
          chapter_references?: string[]
          chapters?: string[]
          chat?: string | null
          created_at?: string
          documents?: string[]
          generation_error?: string
          generation_status?: Database["prod"]["Enums"]["generation_status"]
          homework_exercise_references?: string[]
          homeworks?: string[]
          id?: string
          last_generation_attempt?: string | null
          lecture_references?: string[]
          lectures?: string[]
          profile?: string | null
          question?: string
          references?: string[]
          response?: string
          response_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_chat_fkey"
            columns: ["chat"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      problems: {
        Row: {
          additional_info: string
          answer_enabled: boolean
          created_at: string
          exercise: string | null
          homework: string
          id: string
          problem_number: number
        }
        Insert: {
          additional_info?: string
          answer_enabled?: boolean
          created_at?: string
          exercise?: string | null
          homework: string
          id?: string
          problem_number?: number
        }
        Update: {
          additional_info?: string
          answer_enabled?: boolean
          created_at?: string
          exercise?: string | null
          homework?: string
          id?: string
          problem_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "problems_exercise_fkey"
            columns: ["exercise"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "problems_homework_fkey"
            columns: ["homework"]
            isOneToOne: false
            referencedRelation: "homeworks"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          admin: boolean
          classes: string[]
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          professor: boolean
        }
        Insert: {
          admin?: boolean
          classes?: string[]
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          professor?: boolean
        }
        Update: {
          admin?: boolean
          classes?: string[]
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          professor?: boolean
        }
        Relationships: []
      }
      rules: {
        Row: {
          chapters: string[]
          class: string
          count: number
          created_at: string
          enabled: boolean
          homeworks: string[]
          id: string
          lectures: string[]
          messages: string[]
          rule: string
        }
        Insert: {
          chapters?: string[]
          class: string
          count?: number
          created_at?: string
          enabled?: boolean
          homeworks?: string[]
          id?: string
          lectures?: string[]
          messages?: string[]
          rule?: string
        }
        Update: {
          chapters?: string[]
          class?: string
          count?: number
          created_at?: string
          enabled?: boolean
          homeworks?: string[]
          id?: string
          lectures?: string[]
          messages?: string[]
          rule?: string
        }
        Relationships: [
          {
            foreignKeyName: "rules_class_fkey"
            columns: ["class"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      subchapters: {
        Row: {
          chapter: string
          created_at: string
          end_page: number
          id: string
          start_page: number
          subchapter_number: number
          title: string
        }
        Insert: {
          chapter: string
          created_at?: string
          end_page?: number
          id?: string
          start_page?: number
          subchapter_number?: number
          title?: string
        }
        Update: {
          chapter?: string
          created_at?: string
          end_page?: number
          id?: string
          start_page?: number
          subchapter_number?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "subchapters_chapter_fkey"
            columns: ["chapter"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      textbooks: {
        Row: {
          additional_info: string
          class: string
          created_at: string
          deleted: boolean
          id: string
          last_parse_attempt: string | null
          pages: number
          parse_error: string | null
          parse_status: Database["prod"]["Enums"]["parse_status"]
          response_url: string
          textbook_number: number
          title: string
        }
        Insert: {
          additional_info?: string
          class: string
          created_at?: string
          deleted?: boolean
          id?: string
          last_parse_attempt?: string | null
          pages?: number
          parse_error?: string | null
          parse_status?: Database["prod"]["Enums"]["parse_status"]
          response_url?: string
          textbook_number?: number
          title?: string
        }
        Update: {
          additional_info?: string
          class?: string
          created_at?: string
          deleted?: boolean
          id?: string
          last_parse_attempt?: string | null
          pages?: number
          parse_error?: string | null
          parse_status?: Database["prod"]["Enums"]["parse_status"]
          response_url?: string
          textbook_number?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "textbooks_class_fkey1"
            columns: ["class"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist: {
        Row: {
          created_at: string | null
          email: string
        }
        Insert: {
          created_at?: string | null
          email: string
        }
        Update: {
          created_at?: string | null
          email?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      chat_type:
        | "homework-student"
        | "homework-professor"
        | "method"
        | "generate"
        | "general-student"
        | "general-teacher"
        | "concept"
        | "review"
        | "other"
      generation_status: "idle" | "error" | "complete" | "generating"
      generation_type: "problem" | "summary" | "chat"
      parse_status:
        | "extracting"
        | "uploading"
        | "parsing"
        | "complete"
        | "idle"
        | "error"
      topic_type: "group" | "term" | "problem" | "algorithm"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
