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
      classes: {
        Row: {
          brightspace_course_descriptor: string | null
          brightspace_course_id: number | null
          class_code: string | null
          course_description: string | null
          course_link: string | null
          created_at: string | null
          id: string
          map: string | null
          title: string | null
        }
        Insert: {
          brightspace_course_descriptor?: string | null
          brightspace_course_id?: number | null
          class_code?: string | null
          course_description?: string | null
          course_link?: string | null
          created_at?: string | null
          id?: string
          map?: string | null
          title?: string | null
        }
        Update: {
          brightspace_course_descriptor?: string | null
          brightspace_course_id?: number | null
          class_code?: string | null
          course_description?: string | null
          course_link?: string | null
          created_at?: string | null
          id?: string
          map?: string | null
          title?: string | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string
          description: string
          figures: Json[]
          id: string
          latex: string
          lecture: string | null
          page: number
          processed: boolean
          text: string
          textbook: string | null
        }
        Insert: {
          created_at?: string
          description?: string
          figures?: Json[]
          id?: string
          latex?: string
          lecture?: string | null
          page: number
          processed?: boolean
          text?: string
          textbook?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          figures?: Json[]
          id?: string
          latex?: string
          lecture?: string | null
          page?: number
          processed?: boolean
          text?: string
          textbook?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_lecture_fkey"
            columns: ["lecture"]
            isOneToOne: false
            referencedRelation: "lectures"
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
      evaluations: {
        Row: {
          accuracy: number
          accuracy_explanation: string
          adherence: number
          adherence_explanation: string
          certainty: number
          certainty_explanation: string
          clarity: number
          clarity_explanation: string
          complexity: number
          complexity_explanation: string
          created_at: string
          generation: string | null
          id: string
          latency: number
          latex_compiles: boolean
          lecture: string | null
          novelty: number
          novelty_explanation: string
        }
        Insert: {
          accuracy?: number
          accuracy_explanation?: string
          adherence?: number
          adherence_explanation?: string
          certainty?: number
          certainty_explanation?: string
          clarity?: number
          clarity_explanation?: string
          complexity?: number
          complexity_explanation?: string
          created_at?: string
          generation?: string | null
          id?: string
          latency?: number
          latex_compiles?: boolean
          lecture?: string | null
          novelty?: number
          novelty_explanation?: string
        }
        Update: {
          accuracy?: number
          accuracy_explanation?: string
          adherence?: number
          adherence_explanation?: string
          certainty?: number
          certainty_explanation?: string
          clarity?: number
          clarity_explanation?: string
          complexity?: number
          complexity_explanation?: string
          created_at?: string
          generation?: string | null
          id?: string
          latency?: number
          latex_compiles?: boolean
          lecture?: string | null
          novelty?: number
          novelty_explanation?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_generation_fkey"
            columns: ["generation"]
            isOneToOne: false
            referencedRelation: "generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_lecture_fkey"
            columns: ["lecture"]
            isOneToOne: false
            referencedRelation: "lectures"
            referencedColumns: ["id"]
          },
        ]
      }
      examples: {
        Row: {
          created_at: string
          id: string
          input: string
          output: string
        }
        Insert: {
          created_at?: string
          id?: string
          input: string
          output: string
        }
        Update: {
          created_at?: string
          id?: string
          input?: string
          output?: string
        }
        Relationships: []
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
          created_at: string
          description: string
          document: string
          id: string
          x_max: number
          x_min: number
          y_max: number
          y_min: number
        }
        Insert: {
          created_at?: string
          description?: string
          document?: string
          id?: string
          x_max?: number
          x_min?: number
          y_max?: number
          y_min?: number
        }
        Update: {
          created_at?: string
          description?: string
          document?: string
          id?: string
          x_max?: number
          x_min?: number
          y_max?: number
          y_min?: number
        }
        Relationships: [
          {
            foreignKeyName: "figures_document_fkey"
            columns: ["document"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      generations: {
        Row: {
          additional_info: string
          class: string
          conceptual: boolean
          created_at: string
          deleted: boolean
          generation_error: string | null
          generation_status: Database["prod"]["Enums"]["generation_status"]
          id: string
          last_generation_attempt: string | null
          lectures: string[]
          mcq: boolean
          name: string
          num_questions: number
          progress: number
          response_url: string
          single: boolean
          topics: string[]
          type: Database["prod"]["Enums"]["generation_type"]
        }
        Insert: {
          additional_info?: string
          class: string
          conceptual?: boolean
          created_at?: string
          deleted?: boolean
          generation_error?: string | null
          generation_status?: Database["prod"]["Enums"]["generation_status"]
          id?: string
          last_generation_attempt?: string | null
          lectures?: string[]
          mcq?: boolean
          name?: string
          num_questions?: number
          progress?: number
          response_url?: string
          single?: boolean
          topics?: string[]
          type?: Database["prod"]["Enums"]["generation_type"]
        }
        Update: {
          additional_info?: string
          class?: string
          conceptual?: boolean
          created_at?: string
          deleted?: boolean
          generation_error?: string | null
          generation_status?: Database["prod"]["Enums"]["generation_status"]
          id?: string
          last_generation_attempt?: string | null
          lectures?: string[]
          mcq?: boolean
          name?: string
          num_questions?: number
          progress?: number
          response_url?: string
          single?: boolean
          topics?: string[]
          type?: Database["prod"]["Enums"]["generation_type"]
        }
        Relationships: [
          {
            foreignKeyName: "generations_class_fkey"
            columns: ["class"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      lectures: {
        Row: {
          class: string
          created_at: string
          deleted: boolean
          id: string
          last_parse_attempt: string | null
          last_upload_attempt: string | null
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
          class: string
          created_at?: string
          deleted?: boolean
          id?: string
          last_parse_attempt?: string | null
          last_upload_attempt?: string | null
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
          class?: string
          created_at?: string
          deleted?: boolean
          id?: string
          last_parse_attempt?: string | null
          last_upload_attempt?: string | null
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
      questions: {
        Row: {
          approved: boolean | null
          conceptual: boolean
          documents: string[]
          explanation_a: string | null
          explanation_b: string | null
          explanation_c: string | null
          explanation_d: string | null
          explanation_e: string | null
          generation: string | null
          id: string
          lecture: string | null
          mcq: boolean
          multipart: string | null
          option_a: string | null
          option_b: string | null
          option_c: string | null
          option_d: string | null
          option_e: string | null
          question: string
          reason: string
          solution: string
          topic: string | null
          updated_at: string
        }
        Insert: {
          approved?: boolean | null
          conceptual?: boolean
          documents?: string[]
          explanation_a?: string | null
          explanation_b?: string | null
          explanation_c?: string | null
          explanation_d?: string | null
          explanation_e?: string | null
          generation?: string | null
          id?: string
          lecture?: string | null
          mcq?: boolean
          multipart?: string | null
          option_a?: string | null
          option_b?: string | null
          option_c?: string | null
          option_d?: string | null
          option_e?: string | null
          question: string
          reason?: string
          solution: string
          topic?: string | null
          updated_at?: string
        }
        Update: {
          approved?: boolean | null
          conceptual?: boolean
          documents?: string[]
          explanation_a?: string | null
          explanation_b?: string | null
          explanation_c?: string | null
          explanation_d?: string | null
          explanation_e?: string | null
          generation?: string | null
          id?: string
          lecture?: string | null
          mcq?: boolean
          multipart?: string | null
          option_a?: string | null
          option_b?: string | null
          option_c?: string | null
          option_d?: string | null
          option_e?: string | null
          question?: string
          reason?: string
          solution?: string
          topic?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_generation_fkey"
            columns: ["generation"]
            isOneToOne: false
            referencedRelation: "generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_lecture_fkey"
            columns: ["lecture"]
            isOneToOne: false
            referencedRelation: "lectures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_topic_fkey1"
            columns: ["topic"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      rubrics: {
        Row: {
          content: string
          created_at: string
          id: string
          points: number
          question: string
          standard: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          points?: number
          question: string
          standard?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          points?: number
          question?: string
          standard?: string
        }
        Relationships: [
          {
            foreignKeyName: "rubrics_question_fkey"
            columns: ["question"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      summaries: {
        Row: {
          conclusion: string
          content: string
          created_at: string | null
          documents: string[]
          generation: string | null
          id: string
          lecture: string | null
          preamble: string
          topic: string | null
        }
        Insert: {
          conclusion?: string
          content: string
          created_at?: string | null
          documents?: string[]
          generation?: string | null
          id?: string
          lecture?: string | null
          preamble?: string
          topic?: string | null
        }
        Update: {
          conclusion?: string
          content?: string
          created_at?: string | null
          documents?: string[]
          generation?: string | null
          id?: string
          lecture?: string | null
          preamble?: string
          topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "summaries_generation_fkey"
            columns: ["generation"]
            isOneToOne: false
            referencedRelation: "generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "summaries_lecture_fkey"
            columns: ["lecture"]
            isOneToOne: false
            referencedRelation: "lectures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "summaries_topic_fkey"
            columns: ["topic"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      textbooks: {
        Row: {
          class: string
          created_at: string
          deleted: boolean
          id: string
          last_parse_attempt: string | null
          pages: number
          parse_error: string | null
          parse_status: Database["prod"]["Enums"]["parse_status"]
          title: string
        }
        Insert: {
          class: string
          created_at?: string
          deleted?: boolean
          id?: string
          last_parse_attempt?: string | null
          pages?: number
          parse_error?: string | null
          parse_status?: Database["prod"]["Enums"]["parse_status"]
          title?: string
        }
        Update: {
          class?: string
          created_at?: string
          deleted?: boolean
          id?: string
          last_parse_attempt?: string | null
          pages?: number
          parse_error?: string | null
          parse_status?: Database["prod"]["Enums"]["parse_status"]
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
      topics: {
        Row: {
          class: string | null
          content: string
          created_at: string | null
          figures: string[]
          id: string
          lectures: string[] | null
          map: string | null
          map_id: string
          map_parent: string | null
          title: string
          type: "group" | "term" | "problem" | "algorithm"
          visuals: string[]
          x: number | null
          y: number | null
        }
        Insert: {
          class?: string | null
          content?: string
          created_at?: string | null
          figures?: string[]
          id?: string
          lectures?: string[] | null
          map?: string | null
          map_id: string
          map_parent?: string | null
          title?: string
          type?: "group" | "term" | "problem" | "algorithm"
          visuals?: string[]
          x?: number | null
          y?: number | null
        }
        Update: {
          class?: string | null
          content?: string
          created_at?: string | null
          figures?: string[]
          id?: string
          lectures?: string[] | null
          map?: string | null
          map_id?: string
          map_parent?: string | null
          title?: string
          type?: "group" | "term" | "problem" | "algorithm"
          visuals?: string[]
          x?: number | null
          y?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "topics_class_fkey"
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
      generation_status: "idle" | "error" | "complete" | "generating"
      generation_type: "problem" | "summary"
      parse_status: "parsing" | "batching" | "complete" | "idle" | "error"
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
