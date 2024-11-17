export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      chapters: {
        Row: {
          chapter_number: number
          created_at: string
          id: string
          page_number: number
          textbook: string
          title: string
        }
        Insert: {
          chapter_number?: number
          created_at?: string
          id?: string
          page_number?: number
          textbook?: string
          title?: string
        }
        Update: {
          chapter_number?: number
          created_at?: string
          id?: string
          page_number?: number
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
      classes: {
        Row: {
          class_code: string
          created_at: string
          id: string
          title: string
        }
        Insert: {
          class_code?: string
          created_at?: string
          id?: string
          title?: string
        }
        Update: {
          class_code?: string
          created_at?: string
          id?: string
          title?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          content: string | null
          embedding: string | null
          id: string
          metadata: Json | null
        }
        Insert: {
          content?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
        }
        Update: {
          content?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      embeddings_lecture: {
        Row: {
          content: string
          created_at: string
          embedding: string
          id: string
          lecture: string
          timestamp: number
        }
        Insert: {
          content?: string
          created_at?: string
          embedding: string
          id?: string
          lecture?: string
          timestamp?: number
        }
        Update: {
          content?: string
          created_at?: string
          embedding?: string
          id?: string
          lecture?: string
          timestamp?: number
        }
        Relationships: [
          {
            foreignKeyName: "embeddings_lecture_fkey"
            columns: ["lecture"]
            isOneToOne: false
            referencedRelation: "lectures"
            referencedColumns: ["id"]
          },
        ]
      }
      embeddings_slide: {
        Row: {
          content: string
          created_at: string
          embedding: string
          id: string
          page: number
          slide: string
        }
        Insert: {
          content?: string
          created_at?: string
          embedding: string
          id?: string
          page?: number
          slide?: string
        }
        Update: {
          content?: string
          created_at?: string
          embedding?: string
          id?: string
          page?: number
          slide?: string
        }
        Relationships: [
          {
            foreignKeyName: "embeddings_slide_slide_fkey"
            columns: ["slide"]
            isOneToOne: false
            referencedRelation: "slides"
            referencedColumns: ["id"]
          },
        ]
      }
      embeddings_textbook: {
        Row: {
          content: string
          created_at: string
          embedding: string
          id: string
          page: number
          textbook: string
        }
        Insert: {
          content?: string
          created_at?: string
          embedding: string
          id?: string
          page?: number
          textbook?: string
        }
        Update: {
          content?: string
          created_at?: string
          embedding?: string
          id?: string
          page?: number
          textbook?: string
        }
        Relationships: [
          {
            foreignKeyName: "embeddings_textbook_textbook_fkey"
            columns: ["textbook"]
            isOneToOne: false
            referencedRelation: "textbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      lectures: {
        Row: {
          class: string
          created_at: string
          id: string
          lecture_number: number
          name: string
        }
        Insert: {
          class?: string
          created_at?: string
          id?: string
          lecture_number?: number
          name?: string
        }
        Update: {
          class?: string
          created_at?: string
          id?: string
          lecture_number?: number
          name?: string
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
      practice_exams: {
        Row: {
          class: string
          created_at: string
          deleted: boolean
          id: string
          name: string
          professor: boolean
          slides: string[]
        }
        Insert: {
          class: string
          created_at?: string
          deleted?: boolean
          id?: string
          name?: string
          professor?: boolean
          slides?: string[]
        }
        Update: {
          class?: string
          created_at?: string
          deleted?: boolean
          id?: string
          name?: string
          professor?: boolean
          slides?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "practice_exams_class_fkey"
            columns: ["class"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_questions: {
        Row: {
          created_at: string
          id: string
          practice_exam: string
          question: string
          solution: string
        }
        Insert: {
          created_at?: string
          id?: string
          practice_exam?: string
          question?: string
          solution?: string
        }
        Update: {
          created_at?: string
          id?: string
          practice_exam?: string
          question?: string
          solution?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_questions_practice_exam_fkey"
            columns: ["practice_exam"]
            isOneToOne: false
            referencedRelation: "practice_exams"
            referencedColumns: ["id"]
          },
        ]
      }
      queries: {
        Row: {
          answer: string | null
          class: string | null
          created_at: string
          id: number
          question: string | null
        }
        Insert: {
          answer?: string | null
          class?: string | null
          created_at?: string
          id?: number
          question?: string | null
        }
        Update: {
          answer?: string | null
          class?: string | null
          created_at?: string
          id?: number
          question?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "queries_class_fkey"
            columns: ["class"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          created_at: string
          id: string
          question: string
          slide: string
          solution: string
        }
        Insert: {
          created_at?: string
          id?: string
          question?: string
          slide?: string
          solution?: string
        }
        Update: {
          created_at?: string
          id?: string
          question?: string
          slide?: string
          solution?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_slide_fkey"
            columns: ["slide"]
            isOneToOne: false
            referencedRelation: "slides"
            referencedColumns: ["id"]
          },
        ]
      }
      slides: {
        Row: {
          class: string
          created_at: string
          deleted: boolean
          id: string
          name: string
          note_number: number
        }
        Insert: {
          class?: string
          created_at?: string
          deleted?: boolean
          id?: string
          name?: string
          note_number?: number
        }
        Update: {
          class?: string
          created_at?: string
          deleted?: boolean
          id?: string
          name?: string
          note_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "slides_class_fkey"
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
          id: string
          page_number: number
          section_number: number
          title: string
        }
        Insert: {
          chapter?: string
          created_at?: string
          id?: string
          page_number?: number
          section_number?: number
          title?: string
        }
        Update: {
          chapter?: string
          created_at?: string
          id?: string
          page_number?: number
          section_number?: number
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
      summaries: {
        Row: {
          content: string
          created_at: string
          id: string
          slide: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          slide?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          slide?: string
        }
        Relationships: [
          {
            foreignKeyName: "summaries_slide_fkey"
            columns: ["slide"]
            isOneToOne: false
            referencedRelation: "slides"
            referencedColumns: ["id"]
          },
        ]
      }
      textbooks: {
        Row: {
          author: string
          class: string | null
          created_at: string
          id: string
          pages: number
          title: string
        }
        Insert: {
          author: string
          class?: string | null
          created_at?: string
          id?: string
          pages: number
          title: string
        }
        Update: {
          author?: string
          class?: string | null
          created_at?: string
          id?: string
          pages?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "textbooks_class_fkey"
            columns: ["class"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          class: string
          content: string
          created_at: string
          id: string
          lectures: string[]
          map_id: string
          map_parent: string | null
          title: string
        }
        Insert: {
          class?: string
          content?: string
          created_at?: string
          id?: string
          lectures?: string[]
          map_id: string
          map_parent?: string | null
          title?: string
        }
        Update: {
          class?: string
          content?: string
          created_at?: string
          id?: string
          lectures?: string[]
          map_id?: string
          map_parent?: string | null
          title?: string
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
          created_at: string
          email: string
        }
        Insert: {
          created_at?: string
          email?: string
        }
        Update: {
          created_at?: string
          email?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      binary_quantize:
        | {
            Args: {
              "": string
            }
            Returns: unknown
          }
        | {
            Args: {
              "": unknown
            }
            Returns: unknown
          }
      halfvec_avg: {
        Args: {
          "": number[]
        }
        Returns: unknown
      }
      halfvec_out: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      halfvec_send: {
        Args: {
          "": unknown
        }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: {
          "": unknown[]
        }
        Returns: number
      }
      hnsw_bit_support: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      hnswhandler: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      ivfflat_bit_support: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      ivfflathandler: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      l2_norm:
        | {
            Args: {
              "": unknown
            }
            Returns: number
          }
        | {
            Args: {
              "": unknown
            }
            Returns: number
          }
      l2_normalize:
        | {
            Args: {
              "": string
            }
            Returns: string
          }
        | {
            Args: {
              "": unknown
            }
            Returns: unknown
          }
        | {
            Args: {
              "": unknown
            }
            Returns: unknown
          }
      match_documents: {
        Args: {
          query_embedding: string
          match_threshold: number
          match_count: number
        }
        Returns: {
          id: string
          content: string
          similarity: number
        }[]
      }
      match_embeddings_lecture: {
        Args: {
          query_embedding: string
          match_count?: number
          filter?: Json
        }
        Returns: {
          id: string
          content: string
          metadata: Json
          embedding: Json
          similarity: number
        }[]
      }
      match_embeddings_slide: {
        Args: {
          query_embedding: string
          match_count?: number
          filter?: Json
        }
        Returns: {
          id: string
          content: string
          metadata: Json
          embedding: Json
          similarity: number
        }[]
      }
      match_embeddings_textbook: {
        Args: {
          query_embedding: string
          match_count?: number
          filter?: Json
        }
        Returns: {
          id: string
          content: string
          metadata: Json
          embedding: Json
          similarity: number
        }[]
      }
      sparsevec_out: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      sparsevec_send: {
        Args: {
          "": unknown
        }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: {
          "": unknown[]
        }
        Returns: number
      }
      vector_avg: {
        Args: {
          "": number[]
        }
        Returns: string
      }
      vector_dims:
        | {
            Args: {
              "": string
            }
            Returns: number
          }
        | {
            Args: {
              "": unknown
            }
            Returns: number
          }
      vector_norm: {
        Args: {
          "": string
        }
        Returns: number
      }
      vector_out: {
        Args: {
          "": string
        }
        Returns: unknown
      }
      vector_send: {
        Args: {
          "": string
        }
        Returns: string
      }
      vector_typmod_in: {
        Args: {
          "": unknown[]
        }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
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
