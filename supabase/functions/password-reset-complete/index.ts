import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, errorMessage, jsonResponse } from '../_shared/http.ts';

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method tidak diizinkan.' }, 405);

  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return jsonResponse({ error: 'Sesi pemulihan password diperlukan.' }, 401);

  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  try {
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return jsonResponse({ error: 'Sesi pemulihan tidak valid.' }, 401);

    const { data: profile, error: profileError } = await admin.from('profiles')
      .select('id,username,role').eq('id', authData.user.id).single();
    if (profileError) throw profileError;

    const requiresApproval = profile.role !== 'admin';
    const { error: updateError } = await admin.from('profiles').update({
      must_change_password: false,
      password_changed_at: new Date().toISOString(),
      ...(requiresApproval ? { account_status: 'pending', account_status_reason: 'password_reset' } : {}),
    }).eq('id', profile.id);
    if (updateError) throw updateError;

    const { error: clearError } = await admin.rpc('clear_login_failures', { target_username: profile.username });
    if (clearError) throw clearError;

    return jsonResponse({ ok: true, requiresApproval });
  } catch (error) {
    console.error('password-reset-complete failed', error);
    return jsonResponse({ error: errorMessage(error) }, 500);
  }
});
