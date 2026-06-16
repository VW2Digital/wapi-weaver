import { ServerSupabaseMySQLClient } from '@/lib/supabase-mysql';

// Server-side MySQL client acting as Supabase Admin (bypasses RLS filters)
export const supabaseAdmin = new ServerSupabaseMySQLClient('admin-system', 'admin') as any;
