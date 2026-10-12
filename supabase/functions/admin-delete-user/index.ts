import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, errorMessage, jsonResponse } from '../_shared/http.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method tidak diizinkan.' }, 405);
  const url = Deno.env.get('SUPABASE_URL')!;
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return jsonResponse({ error: 'Sesi admin diperlukan.' }, 401);
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: authData } = await admin.auth.getUser(token);
  if (!authData.user) return jsonResponse({ error: 'Sesi tidak valid.' }, 401);
  const { data: caller } = await admin.from('profiles').select('role').eq('id', authData.user.id).maybeSingle();
  if (caller?.role !== 'admin') return jsonResponse({ error: 'Hanya admin yang dapat menghapus akun.' }, 403);
  try {
    const { username } = await request.json();
    const { data: target } = await admin.from('profiles').select('id,role').eq('username', String(username || '').trim().toLowerCase()).maybeSingle();
    if (!target || target.role !== 'user') return jsonResponse({ error: 'Akun user tidak ditemukan.' }, 404);
    const { error } = await admin.auth.admin.deleteUser(target.id);
    if (error) throw error;
    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ error: errorMessage(error) }, 400);
  }
});
