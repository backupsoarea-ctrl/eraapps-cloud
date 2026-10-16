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
  let insertedStaffCodes: string[] = [];
  try {
    const body = await request.json();
    const username = String(body.username || '').trim().toLowerCase();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const userType = String(body.userType || 'ERO');
    const fullName = String(body.fullName || '');
    const nik = String(body.nik || '').trim();
    const employees = Array.isArray(body.employees) ? body.employees : [];
    const allowedUserTypes = ['LOB', 'TSH', 'Store Leader', 'ERO', 'Promotor'];
    const needsEmployeeCodes = ['ERO', 'Promotor'].includes(userType);
    if (!/^[a-z0-9._-]{3,40}$/.test(username) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.endsWith('@eraapps.invalid') || password.length < 6 || !/^\d{16}$/.test(nik) || !fullName.trim() || (needsEmployeeCodes && !employees.length) || (!needsEmployeeCodes && employees.length > 0) || !allowedUserTypes.includes(userType)) {
      return jsonResponse({ error: 'Username, email aktif, nama, NIK, password, role pengguna, atau data karyawan tidak valid.' }, 400);
    }
    const { data: existingProfile, error: existingProfileError } = await admin
      .from('profiles').select('id').eq('nik', nik).limit(1).maybeSingle();
    if (existingProfileError) throw existingProfileError;
    if (existingProfile) return jsonResponse({ error: 'NIK akun sudah terdaftar.' }, 409);
    const employeeCodes = employees.map((employee: { code?: string }) => String(employee.code || '').trim().toUpperCase());
    const employeeNiks = employees.map((employee: { nik?: string }) => String(employee.nik || '').trim());
    if (new Set(employeeCodes).size !== employeeCodes.length
      || new Set(employeeNiks).size !== employeeNiks.length
      || employees.some((employee: { code?: string; name?: string; nik?: string }) =>
        !/^[A-Z0-9_-]{1,32}$/.test(String(employee.code || '').trim().toUpperCase())
        || !/^\d{16}$/.test(String(employee.nik || '').trim())
        || !String(employee.name || '').trim())) {
      return jsonResponse({ error: 'Kode internal harus unik; setiap NIK karyawan wajib 16 digit dan unik; nama karyawan wajib diisi.' }, 400);
    }
    if (employeeCodes.length) {
      const [{ data: existingStaff, error: existingStaffError }, { data: existingNiks, error: existingNiksError }] = await Promise.all([
        admin.from('staff').select('code').in('code', employeeCodes),
        admin.from('staff').select('nik').in('nik', employeeNiks),
      ]);
      if (existingStaffError) throw existingStaffError;
      if (existingNiksError) throw existingNiksError;
      if (existingStaff?.length) return jsonResponse({ error: `Kode internal sudah digunakan: ${existingStaff.map((item) => item.code).join(', ')}.` }, 409);
      if (existingNiks?.length) return jsonResponse({ error: 'NIK karyawan sudah digunakan.' }, 409);
    }
    const profileMetadata = {
      username, full_name: fullName || employees.map((employee: { name: string }) => employee.name).join(', '),
      user_type: userType, nik, organization: String(body.organization || ''), lob: String(body.lob || ''),
      tsh: String(body.tsh || ''), store_code: String(body.storeCode || '').toUpperCase(),
      store_name: String(body.storeName || body.store || ''),
    };
    if ([profileMetadata.lob, profileMetadata.tsh, profileMetadata.store_code].some((value) => value.includes('|'))) {
      return jsonResponse({ error: 'Nama LOB, TSH, dan kode toko tidak boleh berisi karakter |.' }, 400);
    }
    if (!profileMetadata.organization
      || (userType === 'LOB' && !profileMetadata.lob)
      || (userType === 'TSH' && (!profileMetadata.lob || !profileMetadata.tsh))
      || (userType === 'Store Leader' && (!profileMetadata.lob || !profileMetadata.tsh || !profileMetadata.store_code || !profileMetadata.store_name))
      || (needsEmployeeCodes && (!profileMetadata.lob || !profileMetadata.tsh || !profileMetadata.store_code || !profileMetadata.store_name))) {
      return jsonResponse({ error: 'Lengkapi data LOB, TSH, dan toko sesuai role akun.' }, 400);
    }
    profileMetadata.full_name ||= username;
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: profileMetadata,
    });
    if (createError) throw createError;
    createdUserId = created.user.id;

    const profileRow = {
      id: createdUserId, username, email, full_name: profileMetadata.full_name, role: 'user',
      user_type: userType, nik: profileMetadata.nik, organization: profileMetadata.organization, lob: profileMetadata.lob,
      tsh: profileMetadata.tsh, store_code: profileMetadata.store_code, store_name: profileMetadata.store_name,
      must_change_password: true, password_changed_at: new Date().toISOString(),
      account_status: 'approved', approved_by: authData.user.id, approved_at: new Date().toISOString(),
    };
    const { error: profileError } = await admin.from('profiles').upsert(profileRow, { onConflict: 'id' });
    if (profileError) throw profileError;
    const staffRows = employees.map((employee: { code: string; nik: string; name: string }) => ({
      code: employee.code.trim().toUpperCase(), nik: employee.nik.trim(), name: employee.name.trim(), lob: profileRow.lob,
      tsh: profileRow.tsh, store_code: profileRow.store_code, store_name: profileRow.store_name,
    }));
    if (staffRows.length) {
      const { error: staffError } = await admin.from('staff').insert(staffRows);
      if (staffError) throw staffError;
      insertedStaffCodes = employeeCodes;
      const { error: accessError } = await admin.from('staff_access').insert(employeeCodes.map((staff_code: string) => ({ user_id: createdUserId, staff_code })));
      if (accessError) throw accessError;
    }
    return jsonResponse({ ok: true });
  } catch (error) {
    let rollbackFailure = '';
    if (createdUserId) {
      if (insertedStaffCodes.length) {
        const { error: staffCleanupError } = await admin.from('staff').delete().in('code', insertedStaffCodes);
        if (staffCleanupError) rollbackFailure = staffCleanupError.message;
      }
      const { error: userCleanupError } = await admin.auth.admin.deleteUser(createdUserId);
      if (userCleanupError) rollbackFailure = [rollbackFailure, userCleanupError.message].filter(Boolean).join('; ');
    }
    const message = errorMessage(error);
    return jsonResponse({ error: rollbackFailure ? `${message} Rollback tidak tuntas: ${rollbackFailure}` : message }, 400);
  }
});
