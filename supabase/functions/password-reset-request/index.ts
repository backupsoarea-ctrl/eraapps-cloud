import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/http.ts';

const genericResponse = () => jsonResponse({
  ok: true,
  message: 'Jika data akun cocok, tautan pemulihan akan dikirim melalui email.',
});

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method tidak diizinkan.' }, 405);

  let body: { email?: unknown; fullName?: unknown; nik?: unknown; redirectTo?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Format permintaan pemulihan tidak valid.' }, 400);
  }

  const email = String(body.email || '').trim().toLowerCase();
  const fullName = String(body.fullName || '').trim().toLocaleLowerCase();
  const nik = String(body.nik || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return genericResponse();

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id,email,role,full_name,nik,account_status')
      .eq('email', email)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile || profile.account_status === 'rejected' || email.endsWith('@eraapps.invalid')) return genericResponse();
    if (profile.role !== 'admin'
      && (!fullName || !nik || profile.full_name.trim().toLocaleLowerCase() !== fullName || profile.nik.trim() !== nik)) {
      return genericResponse();
    }
    if (profile.role === 'admin' && profile.full_name.trim() && fullName && profile.full_name.trim().toLocaleLowerCase() !== fullName) {
      return genericResponse();
    }

    const requestedRedirect = String(body.redirectTo || '');
    let redirectTo = 'https://backupsoarea-ctrl.github.io/eraapps-cloud/';
    try {
      const candidate = new URL(requestedRedirect);
      const isProduction = candidate.origin === 'https://backupsoarea-ctrl.github.io'
        && candidate.pathname.startsWith('/eraapps-cloud/');
      const isLocal = candidate.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(candidate.hostname);
      if (isProduction || isLocal) redirectTo = candidate.toString();
    } catch {
      redirectTo = 'https://backupsoarea-ctrl.github.io/eraapps-cloud/';
    }

    const sender = createClient(url, anonKey, { auth: { persistSession: false } });
    const { error: resetError } = await sender.auth.resetPasswordForEmail(email, { redirectTo });
    if (resetError) {
      console.error('password-reset-request email delivery failed', resetError);
      return jsonResponse({ error: 'Tautan reset belum dapat dikirim. Periksa konfigurasi email Supabase.' }, 503);
    }
    return genericResponse();
  } catch (error) {
    console.error('password-reset-request failed', error);
    return jsonResponse({ error: 'Layanan pemulihan sementara tidak tersedia.' }, 500);
  }
});
