export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json | null
          target_id: string | null
          target_type: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      ai_cache: {
        Row: {
          cache_key: string
          created_at: string
          feature: string
          hit_count: number
          last_hit_at: string
          model: string
          response: Json
        }
        Insert: {
          cache_key: string
          created_at?: string
          feature: string
          hit_count?: number
          last_hit_at?: string
          model: string
          response: Json
        }
        Update: {
          cache_key?: string
          created_at?: string
          feature?: string
          hit_count?: number
          last_hit_at?: string
          model?: string
          response?: Json
        }
        Relationships: []
      }
      ai_usage_log: {
        Row: {
          cached: boolean
          completion_tokens: number | null
          cost_cents: number
          created_at: string
          feature: string
          id: number
          metadata: Json | null
          model: string
          prompt_tokens: number | null
          user_id: string | null
        }
        Insert: {
          cached?: boolean
          completion_tokens?: number | null
          cost_cents?: number
          created_at?: string
          feature: string
          id?: number
          metadata?: Json | null
          model: string
          prompt_tokens?: number | null
          user_id?: string | null
        }
        Update: {
          cached?: boolean
          completion_tokens?: number | null
          cost_cents?: number
          created_at?: string
          feature?: string
          id?: number
          metadata?: Json | null
          model?: string
          prompt_tokens?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      basket_items: {
        Row: {
          added_at: string
          amount: number | null
          amount_initial: number | null
          checked: boolean
          id: string
          ingredient_id: string
          label: string
          price: number | null
          recipe_emoji: string | null
          recipe_id: string | null
          recipe_name: string | null
          recipe_servings: number | null
          recipe_servings_initial: number | null
          unit: string | null
          user_id: string
        }
        Insert: {
          added_at?: string
          amount?: number | null
          amount_initial?: number | null
          checked?: boolean
          id?: string
          ingredient_id: string
          label: string
          price?: number | null
          recipe_emoji?: string | null
          recipe_id?: string | null
          recipe_name?: string | null
          recipe_servings?: number | null
          recipe_servings_initial?: number | null
          unit?: string | null
          user_id: string
        }
        Update: {
          added_at?: string
          amount?: number | null
          amount_initial?: number | null
          checked?: boolean
          id?: string
          ingredient_id?: string
          label?: string
          price?: number | null
          recipe_emoji?: string | null
          recipe_id?: string | null
          recipe_name?: string | null
          recipe_servings?: number | null
          recipe_servings_initial?: number | null
          unit?: string | null
          user_id?: string
        }
        Relationships: []
      }
      community_blocks: {
        Row: {
          blocked_user_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          blocked_user_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          blocked_user_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      community_posts: {
        Row: {
          body: string
          category: string
          created_at: string
          deleted_at: string | null
          deleted_by_admin: boolean
          id: string
          likes_count: number
          photo_url: string | null
          recipe_id: string | null
          replies_count: number
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          body: string
          category: string
          created_at?: string
          deleted_at?: string | null
          deleted_by_admin?: boolean
          id?: string
          likes_count?: number
          photo_url?: string | null
          recipe_id?: string | null
          replies_count?: number
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by_admin?: boolean
          id?: string
          likes_count?: number
          photo_url?: string | null
          recipe_id?: string | null
          replies_count?: number
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "community_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_replies: {
        Row: {
          body: string
          created_at: string
          deleted_at: string | null
          deleted_by_admin: boolean
          id: string
          likes_count: number
          parent_reply_id: string | null
          post_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          deleted_at?: string | null
          deleted_by_admin?: boolean
          id?: string
          likes_count?: number
          parent_reply_id?: string | null
          post_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by_admin?: boolean
          id?: string
          likes_count?: number
          parent_reply_id?: string | null
          post_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "community_replies_parent_reply_id_fkey"
            columns: ["parent_reply_id"]
            isOneToOne: false
            referencedRelation: "community_replies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_replies_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_replies_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cooking_logs: {
        Row: {
          cooked_at: string
          id: string
          recipe_id: string
          recipe_source: string
          servings: number | null
          user_id: string
        }
        Insert: {
          cooked_at?: string
          id?: string
          recipe_id: string
          recipe_source: string
          servings?: number | null
          user_id: string
        }
        Update: {
          cooked_at?: string
          id?: string
          recipe_id?: string
          recipe_source?: string
          servings?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cooking_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      engagement: {
        Row: {
          body: string | null
          created_at: string
          deleted_at: string | null
          deleted_by_admin: boolean
          emoji: string | null
          id: string
          rating: number | null
          target_post_id: string | null
          target_recipe_id: string | null
          target_reply_id: string | null
          type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by_admin?: boolean
          emoji?: string | null
          id?: string
          rating?: number | null
          target_post_id?: string | null
          target_recipe_id?: string | null
          target_reply_id?: string | null
          type: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by_admin?: boolean
          emoji?: string | null
          id?: string
          rating?: number | null
          target_post_id?: string | null
          target_recipe_id?: string | null
          target_reply_id?: string | null
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "engagement_target_post_id_fkey"
            columns: ["target_post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_target_recipe_id_fkey"
            columns: ["target_recipe_id"]
            isOneToOne: false
            referencedRelation: "base_recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_target_recipe_id_fkey"
            columns: ["target_recipe_id"]
            isOneToOne: false
            referencedRelation: "custom_recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_target_recipe_id_fkey"
            columns: ["target_recipe_id"]
            isOneToOne: false
            referencedRelation: "recipe_health_check"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_target_recipe_id_fkey"
            columns: ["target_recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes_unified"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_target_reply_id_fkey"
            columns: ["target_reply_id"]
            isOneToOne: false
            referencedRelation: "community_replies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          description: string | null
          enabled: boolean
          key: string
          label: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          description?: string | null
          enabled?: boolean
          key: string
          label: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          description?: string | null
          enabled?: boolean
          key?: string
          label?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      fridge_layouts: {
        Row: {
          created_at: string | null
          language: string
          structure: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          language: string
          structure: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          language?: string
          structure?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      ingredients: {
        Row: {
          allergens: string[]
          breaks_diets: string[]
          created_at: string
          default_unit: string | null
          emoji: string
          group_id: string | null
          id: string
          image_url: string | null
          labels: Json
          nutrition: Json
          pack_size: Json
          price: Json
          seasonal_months: number[] | null
          sort_order: number
          storage: string
          subcategory: string
          updated_at: string
        }
        Insert: {
          allergens?: string[]
          breaks_diets?: string[]
          created_at?: string
          default_unit?: string | null
          emoji?: string
          group_id?: string | null
          id: string
          image_url?: string | null
          labels: Json
          nutrition?: Json
          pack_size?: Json
          price?: Json
          seasonal_months?: number[] | null
          sort_order?: number
          storage: string
          subcategory: string
          updated_at?: string
        }
        Update: {
          allergens?: string[]
          breaks_diets?: string[]
          created_at?: string
          default_unit?: string | null
          emoji?: string
          group_id?: string | null
          id?: string
          image_url?: string | null
          labels?: Json
          nutrition?: Json
          pack_size?: Json
          price?: Json
          seasonal_months?: number[] | null
          sort_order?: number
          storage?: string
          subcategory?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredients_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "ingredient_health_check"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredients_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          batch_id: string | null
          body: Json | null
          created_at: string
          expires_at: string
          id: string
          link: string | null
          metadata: Json | null
          read_at: string | null
          recipient_id: string | null
          recipient_role: string
          title: Json
          type: string
        }
        Insert: {
          batch_id?: string | null
          body?: Json | null
          created_at?: string
          expires_at?: string
          id?: string
          link?: string | null
          metadata?: Json | null
          read_at?: string | null
          recipient_id?: string | null
          recipient_role?: string
          title: Json
          type: string
        }
        Update: {
          batch_id?: string | null
          body?: Json | null
          created_at?: string
          expires_at?: string
          id?: string
          link?: string | null
          metadata?: Json | null
          read_at?: string | null
          recipient_id?: string | null
          recipient_role?: string
          title?: Json
          type?: string
        }
        Relationships: []
      }
      product_events: {
        Row: {
          anon_id: string | null
          event: string
          id: string
          occurred_at: string
          props: Json
          user_id: string | null
        }
        Insert: {
          anon_id?: string | null
          event: string
          id?: string
          occurred_at?: string
          props?: Json
          user_id?: string | null
        }
        Update: {
          anon_id?: string | null
          event?: string
          id?: string
          occurred_at?: string
          props?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          allergen_prefs: string[] | null
          avatar_id: string
          banned: boolean
          banner_id: string | null
          community_bio: string | null
          community_muted_until: string | null
          community_terms_accepted_at: string | null
          consent_privacy_accepted_at: string | null
          consent_terms_accepted_at: string | null
          country_code: string | null
          created_at: string
          deleted_at: string | null
          fridge_shape: string | null
          id: string
          inactive_warned_at: string | null
          language: string | null
          last_login_at: string | null
          monthly_budget: number | null
          password_changed_at: string | null
          per_trip_budget: number | null
          profiling_opted_out: boolean
          push_last_variant_index: number | null
          push_preferences: Json
          restore_token: string | null
          role: string
          special_role: string | null
          stripe_customer_id: string | null
          subscription_ends_at: string | null
          subscription_plan: string | null
          subscription_status: string
          trial_ends_at: string | null
          unlocked_banners: string[]
          updated_at: string
          username: string
          username_confirmed: boolean
        }
        Insert: {
          allergen_prefs?: string[] | null
          avatar_id?: string
          banned?: boolean
          banner_id?: string | null
          community_bio?: string | null
          community_muted_until?: string | null
          community_terms_accepted_at?: string | null
          consent_privacy_accepted_at?: string | null
          consent_terms_accepted_at?: string | null
          country_code?: string | null
          created_at?: string
          deleted_at?: string | null
          fridge_shape?: string | null
          id: string
          inactive_warned_at?: string | null
          language?: string | null
          last_login_at?: string | null
          monthly_budget?: number | null
          password_changed_at?: string | null
          per_trip_budget?: number | null
          profiling_opted_out?: boolean
          push_last_variant_index?: number | null
          push_preferences?: Json
          restore_token?: string | null
          role?: string
          special_role?: string | null
          stripe_customer_id?: string | null
          subscription_ends_at?: string | null
          subscription_plan?: string | null
          subscription_status?: string
          trial_ends_at?: string | null
          unlocked_banners?: string[]
          updated_at?: string
          username: string
          username_confirmed?: boolean
        }
        Update: {
          allergen_prefs?: string[] | null
          avatar_id?: string
          banned?: boolean
          banner_id?: string | null
          community_bio?: string | null
          community_muted_until?: string | null
          community_terms_accepted_at?: string | null
          consent_privacy_accepted_at?: string | null
          consent_terms_accepted_at?: string | null
          country_code?: string | null
          created_at?: string
          deleted_at?: string | null
          fridge_shape?: string | null
          id?: string
          inactive_warned_at?: string | null
          language?: string | null
          last_login_at?: string | null
          monthly_budget?: number | null
          password_changed_at?: string | null
          per_trip_budget?: number | null
          profiling_opted_out?: boolean
          push_last_variant_index?: number | null
          push_preferences?: Json
          restore_token?: string | null
          role?: string
          special_role?: string | null
          stripe_customer_id?: string | null
          subscription_ends_at?: string | null
          subscription_plan?: string | null
          subscription_status?: string
          trial_ends_at?: string | null
          unlocked_banners?: string[]
          updated_at?: string
          username?: string
          username_confirmed?: boolean
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          endpoint: string
          id: string
          last_seen_at: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string
          endpoint: string
          id?: string
          last_seen_at?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_seen_at?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_import_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          id: string
          payload: Json | null
          staging_id: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          payload?: Json | null
          staging_id?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json | null
          staging_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipe_import_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_import_events_staging_id_fkey"
            columns: ["staging_id"]
            isOneToOne: false
            referencedRelation: "recipe_imports_staging"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_imports_staging: {
        Row: {
          admin_notes: string | null
          backfill_audit: boolean
          batch_id: string
          created_at: string
          errors: Json
          existing_recipe_id: string | null
          external_key: string | null
          id: string
          parsed_data: Json
          published_recipe_id: string | null
          raw_payload: Json
          resolved_at: string | null
          resolved_by: string | null
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          backfill_audit?: boolean
          batch_id: string
          created_at?: string
          errors?: Json
          existing_recipe_id?: string | null
          external_key?: string | null
          id?: string
          parsed_data: Json
          published_recipe_id?: string | null
          raw_payload: Json
          resolved_at?: string | null
          resolved_by?: string | null
          source: string
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          backfill_audit?: boolean
          batch_id?: string
          created_at?: string
          errors?: Json
          existing_recipe_id?: string | null
          external_key?: string | null
          id?: string
          parsed_data?: Json
          published_recipe_id?: string | null
          raw_payload?: Json
          resolved_at?: string | null
          resolved_by?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_imports_staging_existing_recipe_id_fkey"
            columns: ["existing_recipe_id"]
            isOneToOne: false
            referencedRelation: "base_recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_imports_staging_existing_recipe_id_fkey"
            columns: ["existing_recipe_id"]
            isOneToOne: false
            referencedRelation: "custom_recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_imports_staging_existing_recipe_id_fkey"
            columns: ["existing_recipe_id"]
            isOneToOne: false
            referencedRelation: "recipe_health_check"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_imports_staging_existing_recipe_id_fkey"
            columns: ["existing_recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes_unified"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_imports_staging_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_relations: {
        Row: {
          created_at: string
          id: string
          metadata: Json | null
          recipe_a_id: string
          recipe_b_id: string
          relation_type: string
          weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json | null
          recipe_a_id: string
          recipe_b_id: string
          relation_type: string
          weight?: number
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json | null
          recipe_a_id?: string
          recipe_b_id?: string
          relation_type?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "recipe_relations_recipe_a_id_fkey"
            columns: ["recipe_a_id"]
            isOneToOne: false
            referencedRelation: "base_recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_relations_recipe_a_id_fkey"
            columns: ["recipe_a_id"]
            isOneToOne: false
            referencedRelation: "custom_recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_relations_recipe_a_id_fkey"
            columns: ["recipe_a_id"]
            isOneToOne: false
            referencedRelation: "recipe_health_check"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_relations_recipe_a_id_fkey"
            columns: ["recipe_a_id"]
            isOneToOne: false
            referencedRelation: "recipes_unified"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_relations_recipe_b_id_fkey"
            columns: ["recipe_b_id"]
            isOneToOne: false
            referencedRelation: "base_recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_relations_recipe_b_id_fkey"
            columns: ["recipe_b_id"]
            isOneToOne: false
            referencedRelation: "custom_recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_relations_recipe_b_id_fkey"
            columns: ["recipe_b_id"]
            isOneToOne: false
            referencedRelation: "recipe_health_check"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_relations_recipe_b_id_fkey"
            columns: ["recipe_b_id"]
            isOneToOne: false
            referencedRelation: "recipes_unified"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes_unified: {
        Row: {
          admin_modified: boolean | null
          ai_moderation_status: string | null
          allergens: string[]
          consent_to_promote: boolean | null
          cook_time_min: number | null
          country: string | null
          created_at: string
          deleted_at: string | null
          description: Json
          diet: Json
          difficulty: string
          emoji: string
          functional_tags: string[]
          id: string
          image_url: string | null
          ingredients: Json
          is_public: boolean | null
          moderation_reason: string | null
          moderation_status: string | null
          name: Json
          origin: string
          original_author_id: string | null
          original_author_name: string | null
          prep_time_min: number | null
          promoted_at: string | null
          promoted_from_id: string | null
          published_consent_at: string | null
          published_consent_version: string | null
          servings: number
          status: string
          steps: Json
          time_min: number
          title: string | null
          type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_modified?: boolean | null
          ai_moderation_status?: string | null
          allergens?: string[]
          consent_to_promote?: boolean | null
          cook_time_min?: number | null
          country?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: Json
          diet?: Json
          difficulty?: string
          emoji?: string
          functional_tags?: string[]
          id: string
          image_url?: string | null
          ingredients?: Json
          is_public?: boolean | null
          moderation_reason?: string | null
          moderation_status?: string | null
          name?: Json
          origin: string
          original_author_id?: string | null
          original_author_name?: string | null
          prep_time_min?: number | null
          promoted_at?: string | null
          promoted_from_id?: string | null
          published_consent_at?: string | null
          published_consent_version?: string | null
          servings?: number
          status?: string
          steps?: Json
          time_min?: number
          title?: string | null
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_modified?: boolean | null
          ai_moderation_status?: string | null
          allergens?: string[]
          consent_to_promote?: boolean | null
          cook_time_min?: number | null
          country?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: Json
          diet?: Json
          difficulty?: string
          emoji?: string
          functional_tags?: string[]
          id?: string
          image_url?: string | null
          ingredients?: Json
          is_public?: boolean | null
          moderation_reason?: string | null
          moderation_status?: string | null
          name?: Json
          origin?: string
          original_author_id?: string | null
          original_author_name?: string | null
          prep_time_min?: number | null
          promoted_at?: string | null
          promoted_from_id?: string | null
          published_consent_at?: string | null
          published_consent_version?: string | null
          servings?: number
          status?: string
          steps?: Json
          time_min?: number
          title?: string | null
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      shared_baskets: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          payload: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          payload?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          payload?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_baskets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shelf_life_days: {
        Row: {
          days: number
          subcategory: string
        }
        Insert: {
          days: number
          subcategory: string
        }
        Update: {
          days?: number
          subcategory?: string
        }
        Relationships: []
      }
      shopping_lists: {
        Row: {
          created_at: string
          id: string
          items: Json
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          items?: Json
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          items?: Json
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      special_access: {
        Row: {
          granted_at: string
          granted_by: string
          id: string
          note: string | null
          previous_ends_at: string | null
          previous_plan: string | null
          previous_status: string | null
          revoked_at: string | null
          revoked_by: string | null
          role: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by: string
          id?: string
          note?: string | null
          previous_ends_at?: string | null
          previous_plan?: string | null
          previous_status?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          role: string
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string
          id?: string
          note?: string | null
          previous_ends_at?: string | null
          previous_plan?: string | null
          previous_status?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "special_access_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "special_access_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "special_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      spending_events: {
        Row: {
          id: string
          items_count: number
          items_json: Json
          occurred_at: string
          total_eur: number
          user_id: string
        }
        Insert: {
          id?: string
          items_count: number
          items_json?: Json
          occurred_at?: string
          total_eur: number
          user_id: string
        }
        Update: {
          id?: string
          items_count?: number
          items_json?: Json
          occurred_at?: string
          total_eur?: number
          user_id?: string
        }
        Relationships: []
      }
      stock_events: {
        Row: {
          est_carbon_g: number | null
          est_price_eur: number | null
          id: string
          ingredient_id: string
          outcome: string
          removed_at: string
          user_id: string
        }
        Insert: {
          est_carbon_g?: number | null
          est_price_eur?: number | null
          id?: string
          ingredient_id: string
          outcome: string
          removed_at?: string
          user_id: string
        }
        Update: {
          est_carbon_g?: number | null
          est_price_eur?: number | null
          id?: string
          ingredient_id?: string
          outcome?: string
          removed_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscription_events: {
        Row: {
          event_type: string
          granted_by: string | null
          id: string
          new_status: string | null
          previous_status: string | null
          processed_at: string | null
          raw_payload: Json | null
          stripe_event_id: string | null
          user_id: string | null
        }
        Insert: {
          event_type: string
          granted_by?: string | null
          id?: string
          new_status?: string | null
          previous_status?: string | null
          processed_at?: string | null
          raw_payload?: Json | null
          stripe_event_id?: string | null
          user_id?: string | null
        }
        Update: {
          event_type?: string
          granted_by?: string | null
          id?: string
          new_status?: string | null
          previous_status?: string | null
          processed_at?: string | null
          raw_payload?: Json | null
          stripe_event_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_events_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_admin: boolean | null
          sender_id: string | null
          ticket_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_admin?: boolean | null
          sender_id?: string | null
          ticket_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_admin?: boolean | null
          sender_id?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          created_at: string | null
          has_unread_admin: boolean | null
          has_unread_user: boolean | null
          id: string
          reason_key: string | null
          status: string
          target_id: string | null
          target_type: string | null
          title: string
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          has_unread_admin?: boolean | null
          has_unread_user?: boolean | null
          id?: string
          reason_key?: string | null
          status?: string
          target_id?: string | null
          target_type?: string | null
          title: string
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          has_unread_admin?: boolean | null
          has_unread_user?: boolean | null
          id?: string
          reason_key?: string | null
          status?: string
          target_id?: string | null
          target_type?: string | null
          title?: string
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      taxonomies: {
        Row: {
          created_at: string
          domain: string
          id: number
          key: string
          labels: Json
          metadata: Json
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          domain: string
          id?: number
          key: string
          labels?: Json
          metadata?: Json
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          domain?: string
          id?: number
          key?: string
          labels?: Json
          metadata?: Json
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_favorites: {
        Row: {
          created_at: string
          id: string
          recipe_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          recipe_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          recipe_id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_leftovers: {
        Row: {
          created_at: string
          deleted_at: string | null
          dlc_days: number
          emoji: string
          expires_at: string
          expiry_notified_at: string | null
          id: string
          ingredient_id: string | null
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          dlc_days: number
          emoji?: string
          expires_at: string
          expiry_notified_at?: string | null
          id?: string
          ingredient_id?: string | null
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          dlc_days?: number
          emoji?: string
          expires_at?: string
          expiry_notified_at?: string | null
          id?: string
          ingredient_id?: string | null
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      user_stock: {
        Row: {
          added_at: string
          created_at: string
          expires_at: string | null
          expiry_alert_stage: number
          id: string
          ingredient_id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          created_at?: string
          expires_at?: string | null
          expiry_alert_stage?: number
          id?: string
          ingredient_id: string
          user_id: string
        }
        Update: {
          added_at?: string
          created_at?: string
          expires_at?: string | null
          expiry_alert_stage?: number
          id?: string
          ingredient_id?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      ai_usage_daily_summary: {
        Row: {
          cache_hit_rate: number | null
          cache_hits: number | null
          calls: number | null
          cost_cents: number | null
          day: string | null
          feature: string | null
          model: string | null
        }
        Relationships: []
      }
      base_recipes: {
        Row: {
          allergens: string[] | null
          cook_time_min: number | null
          country: string | null
          created_at: string | null
          description: Json | null
          diet: Json | null
          difficulty: string | null
          emoji: string | null
          id: string | null
          image_url: string | null
          ingredients: Json | null
          name: Json | null
          original_author_id: string | null
          original_author_name: string | null
          prep_time_min: number | null
          promoted_at: string | null
          promoted_from_id: string | null
          servings: number | null
          status: string | null
          steps: Json | null
          time_min: number | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          allergens?: string[] | null
          cook_time_min?: number | null
          country?: string | null
          created_at?: string | null
          description?: Json | null
          diet?: Json | null
          difficulty?: string | null
          emoji?: string | null
          id?: string | null
          image_url?: string | null
          ingredients?: Json | null
          name?: Json | null
          original_author_id?: string | null
          original_author_name?: string | null
          prep_time_min?: number | null
          promoted_at?: string | null
          promoted_from_id?: string | null
          servings?: number | null
          status?: string | null
          steps?: Json | null
          time_min?: number | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          allergens?: string[] | null
          cook_time_min?: number | null
          country?: string | null
          created_at?: string | null
          description?: Json | null
          diet?: Json | null
          difficulty?: string | null
          emoji?: string | null
          id?: string | null
          image_url?: string | null
          ingredients?: Json | null
          name?: Json | null
          original_author_id?: string | null
          original_author_name?: string | null
          prep_time_min?: number | null
          promoted_at?: string | null
          promoted_from_id?: string | null
          servings?: number | null
          status?: string | null
          steps?: Json | null
          time_min?: number | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      custom_recipes: {
        Row: {
          admin_modified: boolean | null
          consent_to_promote: boolean | null
          created_at: string | null
          data: Json | null
          deleted_at: string | null
          id: string | null
          is_public: boolean | null
          moderation_reason: string | null
          moderation_status: string | null
          published_consent_at: string | null
          published_consent_version: string | null
          title: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          admin_modified?: boolean | null
          consent_to_promote?: boolean | null
          created_at?: string | null
          data?: never
          deleted_at?: string | null
          id?: string | null
          is_public?: boolean | null
          moderation_reason?: string | null
          moderation_status?: string | null
          published_consent_at?: string | null
          published_consent_version?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          admin_modified?: boolean | null
          consent_to_promote?: boolean | null
          created_at?: string | null
          data?: never
          deleted_at?: string | null
          id?: string | null
          is_public?: boolean | null
          moderation_reason?: string | null
          moderation_status?: string | null
          published_consent_at?: string | null
          published_consent_version?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      ingredient_health_check: {
        Row: {
          eur_per_kg: number | null
          id: string | null
          issues: string[] | null
          label_fr: string | null
          storage: string | null
          subcategory: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      recipe_health_check: {
        Row: {
          bad_slot_count: number | null
          broken_diets: string[] | null
          country: string | null
          id: string | null
          issues: string[] | null
          name_fr: string | null
          origin: string | null
          orphan_count: number | null
          status: string | null
          updated_at: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _reschedule_cron: {
        Args: { p_command: string; p_jobname: string; p_schedule: string }
        Returns: undefined
      }
      admin_community_hard_delete_post: {
        Args: { p_post_id: string }
        Returns: undefined
      }
      admin_community_set_mute: {
        Args: { p_until: string; p_user_id: string }
        Returns: undefined
      }
      admin_community_soft_delete_post: {
        Args: { p_post_id: string }
        Returns: undefined
      }
      admin_community_soft_delete_reply: {
        Args: { p_reply_id: string }
        Returns: undefined
      }
      admin_delete_notification_batch: {
        Args: { p_notification_id: string }
        Returns: Json
      }
      admin_get_auth_users: {
        Args: never
        Returns: {
          email: string
          id: string
          last_sign_in_at: string
        }[]
      }
      admin_review_hard_delete: {
        Args: { p_review_id: string }
        Returns: undefined
      }
      admin_review_soft_delete: {
        Args: { p_review_id: string }
        Returns: undefined
      }
      admin_send_notification: {
        Args: {
          p_body?: Json
          p_expires_days?: number
          p_metadata?: Json
          p_recipient_id?: string
          p_title: Json
          p_type: string
        }
        Returns: string
      }
      anonymize_user: { Args: { target_user_id: string }; Returns: Json }
      clear_special_access_note: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      community_can_post: { Args: { uid: string }; Returns: boolean }
      community_can_reply: { Args: { uid: string }; Returns: boolean }
      count_recipe_references: { Args: { p_recipe_id: string }; Returns: Json }
      delete_custom_recipe_rgpd: {
        Args: { p_recipe_id: string }
        Returns: Json
      }
      find_similar_recipes: {
        Args: {
          p_exclude_id?: string
          p_ingredient_ids: string[]
          p_name: string
        }
        Returns: {
          id: string
          score: number
          title: string
        }[]
      }
      get_inactive_accounts_to_warn: {
        Args: never
        Returns: {
          email: string
          id: string
          language: string
          last_login_at: string
          username: string
        }[]
      }
      get_monthly_ai_cost_cents: { Args: never; Returns: number }
      get_weekly_metrics_digest: {
        Args: never
        Returns: {
          activated_pct: number
          cooked_pct: number
          favorited_pct: number
          retention_cohort_size: number
          retention_j7_pct: number
          signups_last_7d: number
        }[]
      }
      grant_comped_access: {
        Args: { p_action: string; p_target_user_id: string }
        Returns: undefined
      }
      grant_special_access: {
        Args: { p_note?: string; p_role: string; p_user_id: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_profiling_opted_out: { Args: { p_user_id: string }; Returns: boolean }
      notify_stock_expiry_run: { Args: never; Returns: number }
      promote_recipe_to_base: { Args: { p_custom_id: string }; Returns: Json }
      recipe_imports_recheck_orphans: {
        Args: never
        Returns: {
          errors_removed: number
          staging_id: string
        }[]
      }
      recipe_ingredient_items: { Args: { ing: Json }; Returns: Json }
      reset_inactive_warning: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      revoke_special_access: { Args: { p_user_id: string }; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      subscribe_to_push: {
        Args: { p_auth_key: string; p_endpoint: string; p_p256dh: string }
        Returns: undefined
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
  public: {
    Enums: {},
  },
} as const
