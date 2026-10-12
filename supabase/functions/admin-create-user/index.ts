import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, errorMessage, jsonResponse } from '../_shared/http.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method tidak diizinkan.' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return jsonResponse({ error: 'Sesi admin diperlukan.' }, 401);

  const caller = createClient(url, anonKey);
  const { data: authData } = await caller.auth.getUser(token);
  if (!authData.user) return jsonResponse({ error: 'Sesi tidak valid.' }, 401);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: profile } = await admin.from('profiles').select('role').eq('id', authData.user.id).maybeSingle();
  if (profile?.role !== 'admin') return jsonResponse({ error: 'Hanya admin yang dapat membuat akun.' }, 403);

  let createdUserId: string | undefined;
  try {
    const body = await request.json();
    const username = String(body.username || '').trim().toLowerCase();
    const password = String(body.password || '');
    const employees = Array.isArray(body.employees) ? body.employees : [];
    if (!/^[a-z0-9._-]{3,40}$/.test(username) || password.length < 6 || !employees.length) {
      return jsonResponse({ error: 'Username, password minimal 6 karakter, dan karyawan wajib diisi.' }, 400);
    }
    const employeeCodes = employees.map((employee: { code?: string }) => String(employee.code || '').trim().toUpperCase());
    if (new Set(employeeCodes).size !== employeeCodes.length || employees.some((employee: { code?: string; name?: string }) => !/^[A-Z0-9_-]{1,32}$/.test(String(employee.code || '').trim().toUpperCase()) || !String(employee.name || '').trim())) {
      return jsonResponse({ error: 'Kode karyawan duplikat atau data karyawan tidak lengkap.' }, 400);
    }
    const { count, error: countError } = await admin.from('staff').select('code', { count: 'exact', head: true });
    if (countError) throw countError;
    if ((count || 0) + employees.length > 30) return jsonResponse({ error: 'Maksimal 30 karyawan.' }, 400);
    const email = `${username}@eraapps.invalid`;
    const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (createError) throw createError;
    createdUserId = created.user.id;

    const profileRow = {
      id: createdUserId, username, full_name: employees.map((employee: { name: string }) => employee.name).join(', '),
      role: 'user', lob: String(body.lob || ''), tsh: String(body.tsh || ''),
      store_code: String(body.storeCode || ''), store_name: String(body.storeName || ''), must_change_password: true,
    };
    const { error: profileError } = await admin.from('profiles').insert(profileRow);
    if (profileError) throw profileError;
    const staffRows = employees.map((employee: { code: string; name: string }) => ({
      code: employee.code.trim().toUpperCase(), name: employee.name.trim(), lob: profileRow.lob,
      tsh: profileRow.tsh, store_code: profileRow.store_code, store_name: profileRow.store_name,
    }));
    const { error: staffError } = await admin.from('staff').insert(staffRows);
    if (staffError) throw staffError;
    const { error: accessError } = await admin.from('staff_access').insert(employeeCodes.map((staff_code: string) => ({ user_id: createdUserId, staff_code })));
    if (accessError) throw accessError;
    return jsonResponse({ ok: true });
  } catch (error) {
    if (createdUserId) await admin.auth.admin.deleteUser(createdUserId);
    return jsonResponse({ error: errorMessage(error) }, 400);
  }
});
