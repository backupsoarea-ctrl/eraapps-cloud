import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, errorMessage, jsonResponse } from '../_shared/http.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method tidak diizinkan.' }, 405);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  try {
    const body = await request.json();
    const code = String(body.code || '').trim().toUpperCase();
    const name = String(body.name || '').trim();
    if (!code || !name) return jsonResponse({ error: 'Kode dan nama karyawan wajib diisi.' }, 400);
    const { data: person } = await admin.from('staff').select('code,name').eq('code', code).maybeSingle();
    if (!person || person.name.trim().toLowerCase() !== name.toLowerCase()) return jsonResponse({ error: 'Kode barcode dan nama tidak cocok.' }, 404);
    const { data: access } = await admin.from('staff_access').select('user_id').eq('staff_code', code).maybeSingle();
    if (!access) return jsonResponse({ error: 'Akun user untuk karyawan ini tidak ditemukan.' }, 404);
    const { data: profile } = await admin.from('profiles').select('username').eq('id', access.user_id).single();
    const { data: pending } = await admin.from('password_reset_requests').select('id').eq('staff_code', code).eq('status', 'pending').maybeSingle();
    if (pending) return jsonResponse({ error: 'Permintaan reset untuk karyawan ini masih menunggu admin.' }, 409);
    const { error } = await admin.from('password_reset_requests').insert({ staff_code: code, employee_name: person.name, username: profile.username });
    if (error) throw error;
    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ error: errorMessage(error) }, 400);
  }
});
