import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hvaehuttdngpoqfcowmm.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_DIi4DT6FngGn0Fa-cWyKug_KvY9hFGc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export interface Profile {
  id: string;
  display_name: string;
  theme: 'light' | 'dark' | 'system';
  default_difficulty: 'easy' | 'medium' | 'hard';
  default_explain_level: 'beginner' | 'simple' | 'detailed' | 'exam';
  created_at: string;
}

export interface Material {
  id: string;
  user_id: string;
  title: string;
  subject?: string;
  topic?: string;
  content: string;
  source_file_path?: string;
  created_at: string;
}

export interface QuizAttempt {
  id: string;
  user_id: string;
  material_id?: string | null;
  topic: string;
  type: 'quiz' | 'mock';
  difficulty: 'easy' | 'medium' | 'hard';
  score: number;
  total: number;
  time_taken_sec: number;
  questions: any[];
  answers: Record<string, number>;
  created_at: string;
}

export interface FlashcardDeck {
  id: string;
  user_id: string;
  material_id?: string | null;
  topic: string;
  cards: { front: string; back: string }[];
  difficult_indexes: number[];
  created_at: string;
}

export interface PresentationRecord {
  id: string;
  user_id: string;
  material_id?: string | null;
  topic: string;
  slides: any;
  created_at: string;
}

export interface ChatThread {
  id: string;
  user_id: string;
  material_id?: string | null;
  title: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  thread_id: string;
  user_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

