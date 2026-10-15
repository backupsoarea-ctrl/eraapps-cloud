import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, errorMessage, jsonResponse } from '../_shared/http.ts';

const sameScope = (left: string, right: string) => left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase();

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method tidak diizinkan.' }, 405);

  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return jsonResponse({ error: 'Sesi pengguna diperlukan.' }, 401);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  try {
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return jsonResponse({ error: 'Sesi tidak valid.' }, 401);

    const { data: actor, error: actorError } = await admin
      .from('profiles')
      .select('id,role,account_status,user_type,lob,tsh,store_code')
      .eq('id', authData.user.id)
      .single();
    if (actorError) throw actorError;
    if (actor.role !== 'admin' && actor.account_status !== 'approved') {
      return jsonResponse({ error: 'Akun Anda belum disetujui.' }, 403);
    }

    const body = await request.json();
    const targetId = String(body.userId || '');
    if (!/^[0-9a-f-]{36}$/i.test(targetId)) return jsonResponse({ error: 'ID akun tidak valid.' }, 400);

    const { data: target, error: targetError } = await admin
      .from('profiles')
      .select('id,role,account_status,user_type,lob,tsh,store_code')
      .eq('id', targetId)
      .single();
    if (targetError) throw targetError;
    if (target.role !== 'user' || target.account_status !== 'pending') {
      return jsonResponse({ error: 'Akun tidak ditemukan atau sudah diproses.' }, 409);
    }

    let authorized = actor.role === 'admin';
    if (!authorized && target.user_type === 'TSH') {
      authorized = actor.user_type === 'LOB' && sameScope(actor.lob, target.lob);
    } else if (!authorized && target.user_type === 'Store Leader') {
      authorized = actor.user_type === 'TSH'
        && sameScope(actor.lob, target.lob)
        && sameScope(actor.tsh, target.tsh);
    } else if (!authorized && ['ERO', 'Promotor'].includes(target.user_type)) {
      authorized = actor.user_type === 'Store Leader'
        && sameScope(actor.lob, target.lob)
        && sameScope(actor.tsh, target.tsh)
        && actor.store_code.trim() !== ''
        && actor.store_code.trim().toUpperCase() === target.store_code.trim().toUpperCase();
    }

    if (!authorized) return jsonResponse({ error: 'Anda tidak berwenang menyetujui akun di luar lingkup Anda.' }, 403);
    if ((target.user_type === 'LOB' && actor.role !== 'admin')
      || (target.user_type === 'LOB' && !target.lob.trim())
      || (target.user_type === 'TSH' && !target.lob.trim())
      || (target.user_type === 'Store Leader' && (!target.lob.trim() || !target.tsh.trim() || !target.store_code.trim()))
      || (['ERO', 'Promotor'].includes(target.user_type) && (!target.lob.trim() || !target.tsh.trim() || !target.store_code.trim()))) {
      return jsonResponse({ error: 'Data organisasi/area/toko akun belum lengkap.' }, 400);
    }

    if (['ERO', 'Promotor'].includes(target.user_type)) {
      let requestedCodes = Array.isArray(body.staffCodes)
        ? [...new Set(body.staffCodes.map((code: unknown) => String(code).trim().toUpperCase()))]
        : [];
      if (actor.user_type === 'Store Leader' && !requestedCodes.length) {
        return jsonResponse({ error: 'Pilih minimal satu karyawan yang boleh diakses akun ini.' }, 400);
      }
      if (actor.role === 'admin' && !requestedCodes.length) {
        const { data: matchingStaff, error: matchingStaffError } = await admin
          .from('staff')
          .select('code')
          .eq('lob', target.lob)
          .eq('tsh', target.tsh)
          .eq('store_code', target.store_code);
        if (matchingStaffError) throw matchingStaffError;
        requestedCodes = (matchingStaff || []).map((staff) => staff.code);
      }
      if (requestedCodes.length) {
        const { data: staffRows, error: staffError } = await admin
          .from('staff')
          .select('code')
          .eq('lob', target.lob)
          .eq('tsh', target.tsh)
          .eq('store_code', target.store_code)
          .in('code', requestedCodes);
        if (staffError) throw staffError;
        if (staffRows?.length !== requestedCodes.length) {
          return jsonResponse({ error: 'Sebagian karyawan yang dipilih berada di luar area/toko akun ini.' }, 403);
        }
        const { error: accessError } = await admin.from('staff_access').upsert(
          staffRows.map((staff) => ({ user_id: target.id, staff_code: staff.code })),
          { onConflict: 'user_id,staff_code', ignoreDuplicates: true },
        );
        if (accessError) throw accessError;
      }
    }

    const { data: updated, error: updateError } = await admin
      .from('profiles')
      .update({
        account_status: 'approved',
        approved_by: actor.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', target.id)
      .eq('account_status', 'pending')
      .select('id')
      .maybeSingle();
    if (updateError) throw updateError;
    if (!updated) return jsonResponse({ error: 'Akun sudah disetujui oleh pengguna lain.' }, 409);

    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ error: errorMessage(error) }, 400);
  }
});
