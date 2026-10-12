import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, errorMessage, jsonResponse } from '../_shared/http.ts';

const toHex = (value: ArrayBuffer) => [...new Uint8Array(value)].map(byte => byte.toString(16).padStart(2, '0')).join('');
const hash = async (value: string) => toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
const equalConstantTime = (left: string, right: string) => {
  let difference = left.length ^ right.length;
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
};

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method tidak diizinkan.' }, 405);

  const recoveryToken = Deno.env.get('ADMIN_RECOVERY_TOKEN');
  const adminUserId = Deno.env.get('ADMIN_RECOVERY_USER_ID');
  if (!recoveryToken || !adminUserId) return jsonResponse({ error: 'Pemulihan admin belum dikonfigurasi oleh pemilik proyek.' }, 503);

  try {
    const body = await request.json();
    const suppliedToken = String(body.token || '');
    const password = String(body.password || '');
    if (password.length < 12) return jsonResponse({ error: 'Password baru minimal 12 karakter.' }, 400);
    if (!equalConstantTime(await hash(suppliedToken), await hash(recoveryToken))) {
      return jsonResponse({ error: 'Kode pemulihan salah atau sudah digunakan.' }, 401);
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const { data: profile, error: profileError } = await supabase.from('profiles').select('id,role,username').eq('id', adminUserId).maybeSingle();
    if (profileError) throw profileError;
    if (!profile || profile.role !== 'admin') return jsonResponse({ error: 'User admin pemulihan tidak ditemukan.' }, 404);

    const tokenHash = await hash(recoveryToken);
    const { error: claimError } = await supabase.from('admin_recovery_uses').insert({ token_hash: tokenHash, user_id: adminUserId });
    if (claimError?.code === '23505') return jsonResponse({ error: 'Kode pemulihan sudah digunakan. Buat kode baru.' }, 409);
    if (claimError) throw claimError;

    const { error: updateError } = await supabase.auth.admin.updateUserById(adminUserId, { password });
    if (updateError) throw updateError;
    return jsonResponse({ ok: true, message: 'Password admin berhasil diubah. Kode pemulihan sudah tidak dapat digunakan lagi.' });
  } catch (error) {
    return jsonResponse({ error: errorMessage(error) }, 400);
  }
});
