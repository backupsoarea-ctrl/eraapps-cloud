import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, errorMessage, jsonResponse } from '../_shared/http.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method tidak diizinkan.' }, 405);
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return jsonResponse({ error: 'Sesi admin diperlukan.' }, 401);
  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: authData } = await admin.auth.getUser(token);
  if (!authData.user) return jsonResponse({ error: 'Sesi tidak valid.' }, 401);
  const { data: profile } = await admin.from('profiles').select('role').eq('id', authData.user.id).maybeSingle();
  if (profile?.role !== 'admin') return jsonResponse({ error: 'Hanya admin yang dapat menyetujui reset.' }, 403);
  try {
    const { id, approve } = await request.json();
    const { data: reset } = await admin.from('password_reset_requests').select('*').eq('id', id).eq('status', 'pending').single();
    if (!reset) return jsonResponse({ error: 'Permintaan reset tidak ditemukan atau sudah diproses.' }, 404);
    if (approve) {
      const { data: access } = await admin.from('staff_access').select('user_id').eq('staff_code', reset.staff_code).maybeSingle();
      if (!access) throw new Error('Akun karyawan tidak ditemukan.');
      const { error: authError } = await admin.auth.admin.updateUserById(access.user_id, { password: reset.staff_code });
      if (authError) throw authError;
      const { error: profileError } = await admin.from('profiles').update({ must_change_password: true }).eq('id', access.user_id);
      if (profileError) throw profileError;
    }
    const { error } = await admin.from('password_reset_requests').update({ status: approve ? 'approved' : 'rejected', resolved_at: new Date().toISOString(), resolved_by: authData.user.id }).eq('id', reset.id);
    if (error) throw error;
    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ error: errorMessage(error) }, 400);
  }
});
