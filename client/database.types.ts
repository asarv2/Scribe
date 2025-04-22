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
      chats: {
        Row: {
          chat_type: Database["prod"]["Enums"]["chat_type_2"]
          class: string
          created_at: string
          deleted: boolean
          id: string
          name: string
          profile: string | null
          rating: number | null
          response_url: string
          teacher: boolean
          trace: string | null
          type: Database["prod"]["Enums"]["chat_type"]
        }
        Insert: {
          chat_type?: Database["prod"]["Enums"]["chat_type_2"]
          class: string
          created_at?: string
          deleted?: boolean
          id?: string
          name?: string
          profile?: string | null
          rating?: number | null
          response_url?: string
          teacher?: boolean
          trace?: string | null
          type?: Database["prod"]["Enums"]["chat_type"]
        }
        Update: {
          chat_type?: Database["prod"]["Enums"]["chat_type_2"]
          class?: string
          created_at?: string
          deleted?: boolean
          id?: string
          name?: string
          profile?: string | null
          rating?: number | null
          response_url?: string
          teacher?: boolean
          trace?: string | null
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
          files_enabled: boolean
          homework_enabled: boolean
          homework_mode_enabled: boolean
          homework_prompt: string
          id: string
          learn_mode_enabled: boolean
          lecture_enabled: boolean
          lecture_prompt: string
          present_mode_enabled: boolean
          privacy: boolean
          professors: string[]
          root_folder: string | null
          saved: boolean
          students: string[]
          syllabus: string | null
          test_prep_mode_enabled: boolean
          textbook_enabled: boolean
          textbook_prompt: string
          title: string | null
          updated_at: string
          video_enabled: boolean
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
          files_enabled?: boolean
          homework_enabled?: boolean
          homework_mode_enabled?: boolean
          homework_prompt?: string
          id?: string
          learn_mode_enabled?: boolean
          lecture_enabled?: boolean
          lecture_prompt?: string
          present_mode_enabled?: boolean
          privacy?: boolean
          professors?: string[]
          root_folder?: string | null
          saved?: boolean
          students?: string[]
          syllabus?: string | null
          test_prep_mode_enabled?: boolean
          textbook_enabled?: boolean
          textbook_prompt?: string
          title?: string | null
          updated_at?: string
          video_enabled?: boolean
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
          files_enabled?: boolean
          homework_enabled?: boolean
          homework_mode_enabled?: boolean
          homework_prompt?: string
          id?: string
          learn_mode_enabled?: boolean
          lecture_enabled?: boolean
          lecture_prompt?: string
          present_mode_enabled?: boolean
          privacy?: boolean
          professors?: string[]
          root_folder?: string | null
          saved?: boolean
          students?: string[]
          syllabus?: string | null
          test_prep_mode_enabled?: boolean
          textbook_enabled?: boolean
          textbook_prompt?: string
          title?: string | null
          updated_at?: string
          video_enabled?: boolean
        }
        Relationships: []
      }
      codes: {
        Row: {
          class: string
          code: string
          created_at: string
          deleted: boolean
          id: string
        }
        Insert: {
          class: string
          code: string
          created_at?: string
          deleted?: boolean
          id?: string
        }
        Update: {
          class?: string
          code?: string
          created_at?: string
          deleted?: boolean
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "codes_class_fkey"
            columns: ["class"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
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
          chapter_number: number | null
          class: string
          created_at: string
          description: string
          end_time: number | null
          exercise_number: number | null
          extension: string
          file: string | null
          id: string
          page: number
          problem_number: number | null
          problem_part_number: number | null
          processed: boolean
          size: Json
          start_time: number | null
          text: string
        }
        Insert: {
          chapter_number?: number | null
          class?: string
          created_at?: string
          description?: string
          end_time?: number | null
          exercise_number?: number | null
          extension?: string
          file?: string | null
          id?: string
          page: number
          problem_number?: number | null
          problem_part_number?: number | null
          processed?: boolean
          size?: Json
          start_time?: number | null
          text?: string
        }
        Update: {
          chapter_number?: number | null
          class?: string
          created_at?: string
          description?: string
          end_time?: number | null
          exercise_number?: number | null
          extension?: string
          file?: string | null
          id?: string
          page?: number
          problem_number?: number | null
          problem_part_number?: number | null
          processed?: boolean
          size?: Json
          start_time?: number | null
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_class_fkey"
            columns: ["class"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_file_fkey"
            columns: ["file"]
            isOneToOne: false
            referencedRelation: "files"
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
          chapter_exercise_references: string[]
          chapter_references: string[]
          code: string
          created_at: string
          file_references: string[]
          generation_error: string
          generation_status: Database["prod"]["Enums"]["generation_status"]
          homework_exercise_references: string[]
          id: string
          last_generation_attempt: string | null
          lecture_references: string[]
          message: string | null
          prompt: string
          question: string | null
          references: string[]
          response_url: string
          summary: string | null
          title: string
        }
        Insert: {
          chapter_exercise_references?: string[]
          chapter_references?: string[]
          code?: string
          created_at?: string
          file_references?: string[]
          generation_error?: string
          generation_status?: Database["prod"]["Enums"]["generation_status"]
          homework_exercise_references?: string[]
          id?: string
          last_generation_attempt?: string | null
          lecture_references?: string[]
          message?: string | null
          prompt?: string
          question?: string | null
          references?: string[]
          response_url?: string
          summary?: string | null
          title?: string
        }
        Update: {
          chapter_exercise_references?: string[]
          chapter_references?: string[]
          code?: string
          created_at?: string
          file_references?: string[]
          generation_error?: string
          generation_status?: Database["prod"]["Enums"]["generation_status"]
          homework_exercise_references?: string[]
          id?: string
          last_generation_attempt?: string | null
          lecture_references?: string[]
          message?: string | null
          prompt?: string
          question?: string | null
          references?: string[]
          response_url?: string
          summary?: string | null
          title?: string
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
      files: {
        Row: {
          active: boolean
          additional_info: string
          class: string
          compression_progress: number
          content_type: Database["prod"]["Enums"]["content_type"]
          created_at: string
          deleted: boolean
          expires: string | null
          extension: string
          file_date: string | null
          file_names: string[]
          file_number: number
          file_size: number
          id: string
          last_parse_attempt: string | null
          length: number
          parse_error: string
          parse_status: Database["prod"]["Enums"]["parse_status"]
          profile: string | null
          response_url: string
          title: string
          type: Database["prod"]["Enums"]["file_type"]
          upload_progress: number
        }
        Insert: {
          active?: boolean
          additional_info?: string
          class?: string
          compression_progress?: number
          content_type?: Database["prod"]["Enums"]["content_type"]
          created_at?: string
          deleted?: boolean
          expires?: string | null
          extension?: string
          file_date?: string | null
          file_names?: string[]
          file_number?: number
          file_size?: number
          id?: string
          last_parse_attempt?: string | null
          length?: number
          parse_error?: string
          parse_status?: Database["prod"]["Enums"]["parse_status"]
          profile?: string | null
          response_url?: string
          title?: string
          type: Database["prod"]["Enums"]["file_type"]
          upload_progress?: number
        }
        Update: {
          active?: boolean
          additional_info?: string
          class?: string
          compression_progress?: number
          content_type?: Database["prod"]["Enums"]["content_type"]
          created_at?: string
          deleted?: boolean
          expires?: string | null
          extension?: string
          file_date?: string | null
          file_names?: string[]
          file_number?: number
          file_size?: number
          id?: string
          last_parse_attempt?: string | null
          length?: number
          parse_error?: string
          parse_status?: Database["prod"]["Enums"]["parse_status"]
          profile?: string | null
          response_url?: string
          title?: string
          type?: Database["prod"]["Enums"]["file_type"]
          upload_progress?: number
        }
        Relationships: [
          {
            foreignKeyName: "files_class_fkey"
            columns: ["class"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_profile_fkey"
            columns: ["profile"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      google: {
        Row: {
          created_at: string
          deleted: boolean
          document: string | null
          expires_at: string
          file: string | null
          google_id: string
          id: string
        }
        Insert: {
          created_at?: string
          deleted?: boolean
          document?: string | null
          expires_at: string
          file?: string | null
          google_id: string
          id?: string
        }
        Update: {
          created_at?: string
          deleted?: boolean
          document?: string | null
          expires_at?: string
          file?: string | null
          google_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_document_fkey"
            columns: ["document"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "google_file_fkey"
            columns: ["file"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
      }
      grades: {
        Row: {
          created_at: string
          feedback: string[]
          figures: string[]
          file: string | null
          generation_error: string
          generation_status: Database["prod"]["Enums"]["generation_status"]
          id: string
          last_generation_attempt: string | null
          message: string
          references: Json[]
          results: string[]
          rubric: string | null
          title: string
        }
        Insert: {
          created_at?: string
          feedback?: string[]
          figures?: string[]
          file?: string | null
          generation_error?: string
          generation_status?: Database["prod"]["Enums"]["generation_status"]
          id?: string
          last_generation_attempt?: string | null
          message: string
          references?: Json[]
          results?: string[]
          rubric?: string | null
          title?: string
        }
        Update: {
          created_at?: string
          feedback?: string[]
          figures?: string[]
          file?: string | null
          generation_error?: string
          generation_status?: Database["prod"]["Enums"]["generation_status"]
          id?: string
          last_generation_attempt?: string | null
          message?: string
          references?: Json[]
          results?: string[]
          rubric?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "grades_file_fkey"
            columns: ["file"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_message_fkey"
            columns: ["message"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_rubric_fkey"
            columns: ["rubric"]
            isOneToOne: false
            referencedRelation: "files"
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
          class: string
          created_at: string
          documents: string[]
          file_references: string[]
          files: string[]
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
          rating: boolean | null
          references: string[]
          response: string
          response_url: string
          status_text: string
        }
        Insert: {
          bare_question?: string
          bare_response?: string
          chapter_exercise_references?: string[]
          chapter_references?: string[]
          chapters?: string[]
          chat?: string | null
          class?: string
          created_at?: string
          documents?: string[]
          file_references?: string[]
          files?: string[]
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
          rating?: boolean | null
          references?: string[]
          response?: string
          response_url?: string
          status_text?: string
        }
        Update: {
          bare_question?: string
          bare_response?: string
          chapter_exercise_references?: string[]
          chapter_references?: string[]
          chapters?: string[]
          chat?: string | null
          class?: string
          created_at?: string
          documents?: string[]
          file_references?: string[]
          files?: string[]
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
          rating?: boolean | null
          references?: string[]
          response?: string
          response_url?: string
          status_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_chat_fkey"
            columns: ["chat"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_class_fkey"
            columns: ["class"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      objectives: {
        Row: {
          class: string
          created_at: string
          description: string | null
          files: string[]
          id: string
          outcome_id: string | null
          position_x: number | null
          position_y: number | null
          title: string | null
        }
        Insert: {
          class?: string
          created_at?: string
          description?: string | null
          files?: string[]
          id?: string
          outcome_id?: string | null
          position_x?: number | null
          position_y?: number | null
          title?: string | null
        }
        Update: {
          class?: string
          created_at?: string
          description?: string | null
          files?: string[]
          id?: string
          outcome_id?: string | null
          position_x?: number | null
          position_y?: number | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objectives_class_fkey"
            columns: ["class"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "objectives_outcome_id_fkey"
            columns: ["outcome_id"]
            isOneToOne: false
            referencedRelation: "outcomes"
            referencedColumns: ["id"]
          },
        ]
      }
      onedrive: {
        Row: {
          active: boolean
          created_at: string
          expires_at: string | null
          id: string
          profile: string
          provider_token: string
          refresh_token: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          expires_at?: string | null
          id?: string
          profile: string
          provider_token?: string
          refresh_token?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          expires_at?: string | null
          id?: string
          profile?: string
          provider_token?: string
          refresh_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "onedrive_profile_fkey"
            columns: ["profile"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      outcomes: {
        Row: {
          class: string | null
          created_at: string
          deleted: boolean
          description: string | null
          id: string
          position_x: number | null
          position_y: number | null
          title: string | null
        }
        Insert: {
          class?: string | null
          created_at?: string
          deleted?: boolean
          description?: string | null
          id?: string
          position_x?: number | null
          position_y?: number | null
          title?: string | null
        }
        Update: {
          class?: string | null
          created_at?: string
          deleted?: boolean
          description?: string | null
          id?: string
          position_x?: number | null
          position_y?: number | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outcomes_class_fkey"
            columns: ["class"]
            isOneToOne: false
            referencedRelation: "classes"
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
      questions: {
        Row: {
          answers: string[]
          chapter_exercise_references: string[]
          chapter_references: string[]
          computational: boolean
          created_at: string
          explanations: string[]
          figures: string[]
          file_references: string[]
          frq: boolean
          generation_error: string
          generation_status: Database["prod"]["Enums"]["generation_status"]
          homework_exercise_references: string[]
          id: string
          last_generation_attempt: string | null
          lecture_references: string[]
          message: string | null
          multi: string | null
          options: string[]
          problem: string
          prompt: string
          references: string[]
          response_url: string
          solution: string
          title: string
        }
        Insert: {
          answers?: string[]
          chapter_exercise_references?: string[]
          chapter_references?: string[]
          computational?: boolean
          created_at?: string
          explanations?: string[]
          figures?: string[]
          file_references?: string[]
          frq?: boolean
          generation_error?: string
          generation_status?: Database["prod"]["Enums"]["generation_status"]
          homework_exercise_references?: string[]
          id?: string
          last_generation_attempt?: string | null
          lecture_references?: string[]
          message?: string | null
          multi?: string | null
          options?: string[]
          problem?: string
          prompt?: string
          references?: string[]
          response_url?: string
          solution?: string
          title?: string
        }
        Update: {
          answers?: string[]
          chapter_exercise_references?: string[]
          chapter_references?: string[]
          computational?: boolean
          created_at?: string
          explanations?: string[]
          figures?: string[]
          file_references?: string[]
          frq?: boolean
          generation_error?: string
          generation_status?: Database["prod"]["Enums"]["generation_status"]
          homework_exercise_references?: string[]
          id?: string
          last_generation_attempt?: string | null
          lecture_references?: string[]
          message?: string | null
          multi?: string | null
          options?: string[]
          problem?: string
          prompt?: string
          references?: string[]
          response_url?: string
          solution?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_message_fkey"
            columns: ["message"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      summaries: {
        Row: {
          body: string
          chapter_exercise_references: string[]
          chapter_references: string[]
          conclusion: string
          created_at: string
          figures: string[]
          file_references: string[]
          generation_error: string
          generation_status: Database["prod"]["Enums"]["generation_status"]
          homework_exercise_references: string[]
          id: string
          last_generation_attempt: string | null
          lecture_references: string[]
          message: string | null
          preamble: string
          prompt: string
          references: string[]
          response_url: string
          title: string
        }
        Insert: {
          body?: string
          chapter_exercise_references?: string[]
          chapter_references?: string[]
          conclusion?: string
          created_at?: string
          figures?: string[]
          file_references?: string[]
          generation_error?: string
          generation_status?: Database["prod"]["Enums"]["generation_status"]
          homework_exercise_references?: string[]
          id?: string
          last_generation_attempt?: string | null
          lecture_references?: string[]
          message?: string | null
          preamble?: string
          prompt?: string
          references?: string[]
          response_url?: string
          title?: string
        }
        Update: {
          body?: string
          chapter_exercise_references?: string[]
          chapter_references?: string[]
          conclusion?: string
          created_at?: string
          figures?: string[]
          file_references?: string[]
          generation_error?: string
          generation_status?: Database["prod"]["Enums"]["generation_status"]
          homework_exercise_references?: string[]
          id?: string
          last_generation_attempt?: string | null
          lecture_references?: string[]
          message?: string | null
          preamble?: string
          prompt?: string
          references?: string[]
          response_url?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "summaries_message_fkey"
            columns: ["message"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      usage: {
        Row: {
          chat: string | null
          created_at: string
          file: string | null
          id: string
          input_tokens: number
          output_tokens: number
          profile: string | null
        }
        Insert: {
          chat?: string | null
          created_at?: string
          file?: string | null
          id?: string
          input_tokens?: number
          output_tokens?: number
          profile?: string | null
        }
        Update: {
          chat?: string | null
          created_at?: string
          file?: string | null
          id?: string
          input_tokens?: number
          output_tokens?: number
          profile?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_chat_fkey"
            columns: ["chat"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_file_fkey"
            columns: ["file"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_profile_fkey"
            columns: ["profile"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        | "present"
      chat_type_2:
        | "student"
        | "professor"
        | "learn"
        | "homework"
        | "test"
        | "grade"
        | "figure"
        | "summary"
        | "question"
      content_type: "lecture" | "textbook" | "homework" | "rubric" | "other"
      file_type: "audio" | "video" | "other" | "image" | "pdf"
      generation_status: "idle" | "error" | "complete" | "generating"
      generation_type: "problem" | "summary" | "chat"
      parse_status:
        | "extracting"
        | "uploading"
        | "compressing"
        | "processing"
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

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  prod: {
    Enums: {
      chat_type: [
        "homework-student",
        "homework-professor",
        "method",
        "generate",
        "general-student",
        "general-teacher",
        "concept",
        "review",
        "other",
        "present",
      ],
      chat_type_2: [
        "student",
        "professor",
        "learn",
        "homework",
        "test",
        "grade",
        "figure",
        "summary",
        "question",
      ],
      content_type: ["lecture", "textbook", "homework", "rubric", "other"],
      file_type: ["audio", "video", "other", "image", "pdf"],
      generation_status: ["idle", "error", "complete", "generating"],
      generation_type: ["problem", "summary", "chat"],
      parse_status: [
        "extracting",
        "uploading",
        "compressing",
        "processing",
        "parsing",
        "complete",
        "idle",
        "error",
      ],
      topic_type: ["group", "term", "problem", "algorithm"],
    },
  },
} as const
