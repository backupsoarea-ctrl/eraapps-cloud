import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/http.ts';

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method tidak diizinkan.' }, 405);

  let body: { identifier?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Format login tidak valid.' }, 400);
  }
  const identifier = String(body.identifier || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!identifier || !password) {
    return jsonResponse({ error: 'Username atau password tidak sesuai.' }, 401);
  }

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const profileQuery = admin.from('profiles').select('id,username,email,role,account_status,account_status_reason,user_type,must_change_password,password_changed_at,created_at');
    const { data: profile, error: profileError } = await (identifier.includes('@')
      ? profileQuery.eq('email', identifier)
      : profileQuery.eq('username', identifier)).maybeSingle();
    if (profileError) throw profileError;
    if (!profile?.email) return jsonResponse({ error: 'Username atau password tidak sesuai.' }, 401);

    if (profile.role !== 'admin') {
      const { data: attempts, error: attemptsError } = await admin.from('login_attempts')
        .select('locked_at').eq('username', profile.username).maybeSingle();
      if (attemptsError) throw attemptsError;
      if (attempts?.locked_at) {
        return jsonResponse({ error: 'Akun terkunci setelah lebih dari tiga percobaan. Gunakan Lupa password untuk memulihkan akun melalui email.' }, 423);
      }
    }

    const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client.auth.signInWithPassword({ email: profile.email, password });
    if (error || !data.session) {
      if (profile.role !== 'admin') {
        const { data: failedAttempts, error: failureError } = await admin.rpc('record_login_failure', { target_username: profile.username });
        if (failureError) throw failureError;
        if (failedAttempts > 3) {
          return jsonResponse({ error: 'Akun terkunci setelah lebih dari tiga percobaan. Gunakan Lupa password untuk memulihkan akun melalui email.' }, 423);
        }
      }
      return jsonResponse({ error: 'Username atau password tidak sesuai.' }, 401);
    }
    if (profile.role !== 'admin') {
      const { error: clearError } = await admin.rpc('clear_login_failures', { target_username: profile.username });
      if (clearError) throw clearError;
    }
    if (profile.account_status === 'rejected') {
      const contact = profile.user_type === 'TSH' ? 'hubungi LOB area'
        : profile.user_type === 'Store Leader' ? 'hubungi TSH Anda'
          : ['ERO', 'Promotor'].includes(profile.user_type) ? 'hubungi Store Leader Anda'
            : 'hubungi administrator';
      const reason = profile.account_status_reason === 'resign' ? ' (resign)'
        : profile.account_status_reason === 'pindah_toko' ? ' (pindah toko)' : '';
      return jsonResponse({ error: `Akun ditolak${reason}; silakan ${contact}.` }, 403);
    }
    if (profile.role !== 'admin' && profile.account_status !== 'approved') {
      return jsonResponse({ error: 'Akun Anda masih menunggu persetujuan sesuai hierarki organisasi.' }, 403);
    }

    const passwordBaseline = profile.password_changed_at || profile.created_at;
    const passwordBaselineTime = passwordBaseline ? new Date(passwordBaseline).getTime() : 0;
    const passwordExpired = passwordBaselineTime > 0 && Date.now() - passwordBaselineTime >= 90 * 24 * 60 * 60 * 1000;
    return jsonResponse({
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      },
      must_change_password: profile.must_change_password || passwordExpired,
    });
  } catch (error) {
    console.error('username-login failed', error);
    return jsonResponse({ error: 'Login sementara tidak tersedia. Coba kembali beberapa saat lagi.' }, 500);
  }
});
