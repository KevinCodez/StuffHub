export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      container_items: {
        Row: {
          container_id: string
          created_at: string
          home_id: string
          item_id: string
        }
        Insert: {
          container_id: string
          created_at?: string
          home_id: string
          item_id: string
        }
        Update: {
          container_id?: string
          created_at?: string
          home_id?: string
          item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "container_items_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "containers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "container_items_home_container_fkey"
            columns: ["home_id", "container_id"]
            isOneToOne: false
            referencedRelation: "containers"
            referencedColumns: ["home_id", "id"]
          },
          {
            foreignKeyName: "container_items_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "container_items_home_item_fkey"
            columns: ["home_id", "item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["home_id", "id"]
          },
          {
            foreignKeyName: "container_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      containers: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          home_id: string
          id: string
          label_created_at: string | null
          label_payload: string | null
          name: string
          owner_name: string | null
          room_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string
          home_id: string
          id?: string
          label_created_at?: string | null
          label_payload?: string | null
          name: string
          owner_name?: string | null
          room_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          home_id?: string
          id?: string
          label_created_at?: string | null
          label_payload?: string | null
          name?: string
          owner_name?: string | null
          room_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "containers_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "containers_home_room_fkey"
            columns: ["home_id", "room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["home_id", "id"]
          },
          {
            foreignKeyName: "containers_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      home_members: {
        Row: {
          created_at: string
          home_id: string
          role: Database["public"]["Enums"]["home_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          home_id: string
          role?: Database["public"]["Enums"]["home_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          home_id?: string
          role?: Database["public"]["Enums"]["home_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "home_members_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
        ]
      }
      homes: {
        Row: {
          created_at: string
          created_by: string | null
          currency_code: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency_code?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency_code?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          home_id: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["home_role"]
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at: string
          home_id: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["home_role"]
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          home_id?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["home_role"]
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
        ]
      }
      item_media: {
        Row: {
          home_id: string
          item_id: string
          media_id: string
          sort_order: number
        }
        Insert: {
          home_id: string
          item_id: string
          media_id: string
          sort_order?: number
        }
        Update: {
          home_id?: string
          item_id?: string
          media_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "item_media_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_media_home_item_fkey"
            columns: ["home_id", "item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["home_id", "id"]
          },
          {
            foreignKeyName: "item_media_home_media_fkey"
            columns: ["home_id", "media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["home_id", "id"]
          },
          {
            foreignKeyName: "item_media_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_media_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          category: string
          confidence: number
          created_at: string
          created_by: string | null
          description: string
          estimated_replacement_value_cents: number
          home_id: string
          id: string
          model_number: string | null
          name: string
          owner_name: string | null
          purchase_year: number | null
          room_id: string
          search_document: unknown
          serial_number: string | null
          updated_at: string
        }
        Insert: {
          category?: string
          confidence?: number
          created_at?: string
          created_by?: string | null
          description?: string
          estimated_replacement_value_cents?: number
          home_id: string
          id?: string
          model_number?: string | null
          name: string
          owner_name?: string | null
          purchase_year?: number | null
          room_id: string
          search_document?: unknown
          serial_number?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          confidence?: number
          created_at?: string
          created_by?: string | null
          description?: string
          estimated_replacement_value_cents?: number
          home_id?: string
          id?: string
          model_number?: string | null
          name?: string
          owner_name?: string | null
          purchase_year?: number | null
          room_id?: string
          search_document?: unknown
          serial_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "items_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_home_room_fkey"
            columns: ["home_id", "room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["home_id", "id"]
          },
          {
            foreignKeyName: "items_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_items: {
        Row: {
          home_id: string
          item_id: string
          reminder_id: string
        }
        Insert: {
          home_id: string
          item_id: string
          reminder_id: string
        }
        Update: {
          home_id?: string
          item_id?: string
          reminder_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_items_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_items_home_item_fkey"
            columns: ["home_id", "item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["home_id", "id"]
          },
          {
            foreignKeyName: "maintenance_items_home_reminder_fkey"
            columns: ["home_id", "reminder_id"]
            isOneToOne: false
            referencedRelation: "maintenance_reminders"
            referencedColumns: ["home_id", "id"]
          },
          {
            foreignKeyName: "maintenance_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_items_reminder_id_fkey"
            columns: ["reminder_id"]
            isOneToOne: false
            referencedRelation: "maintenance_reminders"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_reminders: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          frequency: Database["public"]["Enums"]["reminder_frequency"]
          home_id: string
          id: string
          start_date: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string
          frequency: Database["public"]["Enums"]["reminder_frequency"]
          home_id: string
          id?: string
          start_date: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          frequency?: Database["public"]["Enums"]["reminder_frequency"]
          home_id?: string
          id?: string
          start_date?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_reminders_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
        ]
      }
      media_assets: {
        Row: {
          bucket_id: string
          byte_size: number | null
          captured_at: string | null
          created_at: string
          created_by: string | null
          height: number | null
          home_id: string
          id: string
          kind: Database["public"]["Enums"]["media_kind"]
          mime_type: string
          object_path: string
          original_filename: string | null
          sha256: string | null
          width: number | null
        }
        Insert: {
          bucket_id: string
          byte_size?: number | null
          captured_at?: string | null
          created_at?: string
          created_by?: string | null
          height?: number | null
          home_id: string
          id?: string
          kind?: Database["public"]["Enums"]["media_kind"]
          mime_type: string
          object_path: string
          original_filename?: string | null
          sha256?: string | null
          width?: number | null
        }
        Update: {
          bucket_id?: string
          byte_size?: number | null
          captured_at?: string | null
          created_at?: string
          created_by?: string | null
          height?: number | null
          home_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["media_kind"]
          mime_type?: string
          object_path?: string
          original_filename?: string | null
          sha256?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
        ]
      }
      processing_jobs: {
        Row: {
          attempts: number
          available_at: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          entity_id: string | null
          error_message: string | null
          home_id: string
          id: string
          job_type: string
          payload: Json
          result: Json | null
          started_at: string | null
          status: Database["public"]["Enums"]["processing_status"]
          updated_at: string
        }
        Insert: {
          attempts?: number
          available_at?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          entity_id?: string | null
          error_message?: string | null
          home_id: string
          id?: string
          job_type: string
          payload?: Json
          result?: Json | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["processing_status"]
          updated_at?: string
        }
        Update: {
          attempts?: number
          available_at?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          entity_id?: string | null
          error_message?: string | null
          home_id?: string
          id?: string
          job_type?: string
          payload?: Json
          result?: Json | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["processing_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "processing_jobs_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      qr_codes: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          container_id: string | null
          created_at: string
          created_by: string | null
          home_id: string
          id: string
          status: Database["public"]["Enums"]["qr_code_status"]
          token: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          container_id?: string | null
          created_at?: string
          created_by?: string | null
          home_id: string
          id?: string
          status?: Database["public"]["Enums"]["qr_code_status"]
          token: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          container_id?: string | null
          created_at?: string
          created_by?: string | null
          home_id?: string
          id?: string
          status?: Database["public"]["Enums"]["qr_code_status"]
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qr_codes_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "containers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_codes_home_container_fkey"
            columns: ["home_id", "container_id"]
            isOneToOne: false
            referencedRelation: "containers"
            referencedColumns: ["home_id", "id"]
          },
          {
            foreignKeyName: "qr_codes_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_items: {
        Row: {
          created_at: string
          home_id: string
          item_id: string
          receipt_id: string
        }
        Insert: {
          created_at?: string
          home_id: string
          item_id: string
          receipt_id: string
        }
        Update: {
          created_at?: string
          home_id?: string
          item_id?: string
          receipt_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipt_items_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_items_home_item_fkey"
            columns: ["home_id", "item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["home_id", "id"]
          },
          {
            foreignKeyName: "receipt_items_home_receipt_fkey"
            columns: ["home_id", "receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["home_id", "id"]
          },
          {
            foreignKeyName: "receipt_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_items_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_ocr_results: {
        Row: {
          confidence: number | null
          created_at: string
          engine: string
          engine_version: string | null
          home_id: string
          id: string
          page_id: string | null
          raw_text: string
          receipt_id: string
          structured_data: Json
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          engine: string
          engine_version?: string | null
          home_id: string
          id?: string
          page_id?: string | null
          raw_text?: string
          receipt_id: string
          structured_data?: Json
        }
        Update: {
          confidence?: number | null
          created_at?: string
          engine?: string
          engine_version?: string | null
          home_id?: string
          id?: string
          page_id?: string | null
          raw_text?: string
          receipt_id?: string
          structured_data?: Json
        }
        Relationships: [
          {
            foreignKeyName: "receipt_ocr_home_page_fkey"
            columns: ["home_id", "page_id"]
            isOneToOne: false
            referencedRelation: "receipt_pages"
            referencedColumns: ["home_id", "id"]
          },
          {
            foreignKeyName: "receipt_ocr_home_receipt_fkey"
            columns: ["home_id", "receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["home_id", "id"]
          },
          {
            foreignKeyName: "receipt_ocr_results_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_ocr_results_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "receipt_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_ocr_results_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_pages: {
        Row: {
          created_at: string
          crop_corners: Json | null
          home_id: string
          id: string
          original_media_id: string
          page_number: number
          processed_media_id: string | null
          receipt_id: string
        }
        Insert: {
          created_at?: string
          crop_corners?: Json | null
          home_id: string
          id?: string
          original_media_id: string
          page_number: number
          processed_media_id?: string | null
          receipt_id: string
        }
        Update: {
          created_at?: string
          crop_corners?: Json | null
          home_id?: string
          id?: string
          original_media_id?: string
          page_number?: number
          processed_media_id?: string | null
          receipt_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipt_pages_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_pages_home_original_media_fkey"
            columns: ["home_id", "original_media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["home_id", "id"]
          },
          {
            foreignKeyName: "receipt_pages_home_processed_media_fkey"
            columns: ["home_id", "processed_media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["home_id", "id"]
          },
          {
            foreignKeyName: "receipt_pages_home_receipt_fkey"
            columns: ["home_id", "receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["home_id", "id"]
          },
          {
            foreignKeyName: "receipt_pages_original_media_id_fkey"
            columns: ["original_media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_pages_processed_media_id_fkey"
            columns: ["processed_media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_pages_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          home_id: string
          id: string
          merchant: string
          purchase_date: string | null
          total_cents: number
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string
          home_id: string
          id?: string
          merchant?: string
          purchase_date?: string | null
          total_cents?: number
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          home_id?: string
          id?: string
          merchant?: string
          purchase_date?: string | null
          total_cents?: number
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipts_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
        ]
      }
      report_exports: {
        Row: {
          created_at: string
          created_by: string | null
          generated_at: string | null
          home_id: string
          id: string
          media_id: string | null
          options: Json
          status: Database["public"]["Enums"]["processing_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          generated_at?: string | null
          home_id: string
          id?: string
          media_id?: string | null
          options?: Json
          status?: Database["public"]["Enums"]["processing_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          generated_at?: string | null
          home_id?: string
          id?: string
          media_id?: string | null
          options?: Json
          status?: Database["public"]["Enums"]["processing_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_exports_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_exports_home_media_fkey"
            columns: ["home_id", "media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["home_id", "id"]
          },
          {
            foreignKeyName: "report_exports_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      room_media: {
        Row: {
          home_id: string
          media_id: string
          room_id: string
          sort_order: number
        }
        Insert: {
          home_id: string
          media_id: string
          room_id: string
          sort_order?: number
        }
        Update: {
          home_id?: string
          media_id?: string
          room_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "room_media_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_media_home_media_fkey"
            columns: ["home_id", "media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["home_id", "id"]
          },
          {
            foreignKeyName: "room_media_home_room_fkey"
            columns: ["home_id", "room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["home_id", "id"]
          },
          {
            foreignKeyName: "room_media_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_media_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          created_at: string
          created_by: string | null
          home_id: string
          id: string
          name: string
          scan_status: Database["public"]["Enums"]["scan_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          home_id: string
          id?: string
          name: string
          scan_status?: Database["public"]["Enums"]["scan_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          home_id?: string
          id?: string
          name?: string
          scan_status?: Database["public"]["Enums"]["scan_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
        ]
      }
      warranties: {
        Row: {
          claim_contact: string
          created_at: string
          created_by: string | null
          description: string
          duration_months: number
          home_id: string
          id: string
          policy_number: string
          provider: string
          purchase_date: string | null
          receipt_id: string | null
          updated_at: string
        }
        Insert: {
          claim_contact?: string
          created_at?: string
          created_by?: string | null
          description?: string
          duration_months?: number
          home_id: string
          id?: string
          policy_number?: string
          provider: string
          purchase_date?: string | null
          receipt_id?: string | null
          updated_at?: string
        }
        Update: {
          claim_contact?: string
          created_at?: string
          created_by?: string | null
          description?: string
          duration_months?: number
          home_id?: string
          id?: string
          policy_number?: string
          provider?: string
          purchase_date?: string | null
          receipt_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "warranties_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranties_home_receipt_fkey"
            columns: ["home_id", "receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["home_id", "id"]
          },
          {
            foreignKeyName: "warranties_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      warranty_items: {
        Row: {
          home_id: string
          item_id: string
          warranty_id: string
        }
        Insert: {
          home_id: string
          item_id: string
          warranty_id: string
        }
        Update: {
          home_id?: string
          item_id?: string
          warranty_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warranty_items_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_items_home_item_fkey"
            columns: ["home_id", "item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["home_id", "id"]
          },
          {
            foreignKeyName: "warranty_items_home_warranty_fkey"
            columns: ["home_id", "warranty_id"]
            isOneToOne: false
            referencedRelation: "warranties"
            referencedColumns: ["home_id", "id"]
          },
          {
            foreignKeyName: "warranty_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_items_warranty_id_fkey"
            columns: ["warranty_id"]
            isOneToOne: false
            referencedRelation: "warranties"
            referencedColumns: ["id"]
          },
        ]
      }
      warranty_media: {
        Row: {
          home_id: string
          media_id: string
          warranty_id: string
        }
        Insert: {
          home_id: string
          media_id: string
          warranty_id: string
        }
        Update: {
          home_id?: string
          media_id?: string
          warranty_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warranty_media_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_media_home_media_fkey"
            columns: ["home_id", "media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["home_id", "id"]
          },
          {
            foreignKeyName: "warranty_media_home_warranty_fkey"
            columns: ["home_id", "warranty_id"]
            isOneToOne: false
            referencedRelation: "warranties"
            referencedColumns: ["home_id", "id"]
          },
          {
            foreignKeyName: "warranty_media_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_media_warranty_id_fkey"
            columns: ["warranty_id"]
            isOneToOne: false
            referencedRelation: "warranties"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_home: {
        Args: { currency?: string; home_name: string }
        Returns: {
          created_at: string
          created_by: string | null
          currency_code: string
          id: string
          name: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "homes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_home_role: {
        Args: {
          allowed_roles: Database["public"]["Enums"]["home_role"][]
          target_home_id: string
        }
        Returns: boolean
      }
      is_home_member: { Args: { target_home_id: string }; Returns: boolean }
      search_inventory: {
        Args: { search_query: string; target_home_id: string }
        Returns: {
          rank: number
          record_id: string
          record_type: string
          subtitle: string
          title: string
        }[]
      }
    }
    Enums: {
      home_role: "owner" | "editor" | "viewer"
      media_kind: "original" | "cropped" | "thumbnail" | "document" | "report"
      processing_status: "pending" | "processing" | "completed" | "failed"
      qr_code_status: "active" | "disabled" | "retired"
      reminder_frequency:
        | "one_time"
        | "monthly"
        | "quarterly"
        | "semiannual"
        | "annual"
      scan_status: "not_started" | "ready" | "review_needed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      home_role: ["owner", "editor", "viewer"],
      media_kind: ["original", "cropped", "thumbnail", "document", "report"],
      processing_status: ["pending", "processing", "completed", "failed"],
      qr_code_status: ["active", "disabled", "retired"],
      reminder_frequency: [
        "one_time",
        "monthly",
        "quarterly",
        "semiannual",
        "annual",
      ],
      scan_status: ["not_started", "ready", "review_needed"],
    },
  },
} as const

