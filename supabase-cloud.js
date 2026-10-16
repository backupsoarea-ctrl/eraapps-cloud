(function () {
  const config = window.ERAAPPS_SUPABASE_CONFIG;
  let client;
  let refreshTimer;
  let realtimeChannel;
  let mediaSequence = 0;
  let recoveryFlow = false;
  let customContent = [];
  let pendingContentFile = null;
  const contentDraftKey = 'eraapps_admin_content_draft_v1';
  const aliasEmail = username => `${String(username).trim().toLowerCase()}@eraapps.invalid`;
  const fail = (error, fallback = 'Operasi online gagal.') => { throw new Error(error?.message || fallback); };
  const check = result => { if (result.error) fail(result.error); return result.data; };
  const isImageFile = (contentType, fileName) => String(contentType || '').toLowerCase().startsWith('image/') || /\.(jpe?g|png|gif|webp|bmp|avif)$/i.test(String(fileName || ''));
  const isHighlightPath = path => { const value = String(path || '').toLowerCase(); return value === 'highlight' || value.startsWith('highlight/'); };
  const passwordExpired = profile => {
    const baseline = profile.password_changed_at || profile.created_at;
    return baseline && Date.now() - new Date(baseline).getTime() >= 90 * 24 * 60 * 60 * 1000;
  };
  const setBusy = (button, busy, label) => { if (!button) return; button.disabled = busy; if (busy) { button.dataset.originalLabel = button.textContent; button.textContent = label || 'Menyimpan...'; } else if (button.dataset.originalLabel) { button.textContent = button.dataset.originalLabel; delete button.dataset.originalLabel; } };
  const showError = error => { const message = error?.message || 'Terjadi kesalahan saat menghubungi server.'; if ($('loginOverlay').style.display !== 'none') $('loginError').textContent = message; else notify(message, 'err'); };
  const fileFromDataUrl = async data => (await fetch(data)).blob();
  const upload = async (bucket, path, file, contentType) => {
    const options = { upsert: false, contentType: contentType || file.type || 'application/octet-stream' };
    check(await client.storage.from(bucket).upload(path, file, options));
    return path;
  };
  const signedFileUrl = async (bucket, path) => {
    if (!path) return '';
    const { data, error } = await client.storage.from(bucket).createSignedUrl(path, 3600);
    if (error) fail(error, `Gagal membuka file privat dari bucket ${bucket}.`);
    return data.signedUrl;
  };
  const openContentDraftDb = () => new Promise((resolve, reject) => {
    const request = indexedDB.open('eraapps-content-drafts', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('drafts');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const storeDraftFile = async file => {
    const db = await openContentDraftDb();
    try {
      await new Promise((resolve, reject) => {
        const transaction = db.transaction('drafts', 'readwrite');
        transaction.objectStore('drafts').put(file ? {
          blob: file, name: file.name, type: file.type, lastModified: file.lastModified,
        } : null, 'content-file');
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
    } finally { db.close(); }
  };
  const readDraftFile = async () => {
    const db = await openContentDraftDb();
    try {
      return await new Promise((resolve, reject) => {
        const request = db.transaction('drafts', 'readonly').objectStore('drafts').get('content-file');
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } finally { db.close(); }
  };
  const restoreContentDraft = async () => {
    const raw = localStorage.getItem(contentDraftKey);
    if (raw) {
      const draft = JSON.parse(raw);
      $('contentTitle').value = draft.title || '';
      $('contentParent').dataset.selectedDraft = draft.parentId || '';
      $('contentKind').value = draft.kind || 'folder';
      $('contentUrl').value = draft.url || '';
      $('contentDescription').value = draft.description || '';
      document.querySelectorAll('[name="contentRole"]').forEach(input => { input.checked = (draft.roles || []).includes(input.value); });
      updateContentKindFields();
    }
    const savedFile = await readDraftFile();
    pendingContentFile = savedFile?.blob
      ? new File([savedFile.blob], savedFile.name, { type: savedFile.type, lastModified: savedFile.lastModified })
      : null;
    if (raw || pendingContentFile) $('contentDraftStatus').textContent = `Draft dipulihkan${pendingContentFile ? ` · ${pendingContentFile.name}` : ''}.`;
  };
  const profileFor = async userId => {
    const result = await client.from('profiles').select('*').eq('id', userId).single();
    return check(result);
  };
  const userAccountFrom = (profile, codes) => ({
    id: profile.id, username: profile.username, email: profile.email, name: profile.full_name, userType: profile.user_type || 'ERO',
    accountStatus: profile.account_status || 'approved', accountStatusReason: profile.account_status_reason || '',
    nik: profile.nik || '', organization: profile.organization || '', lob: profile.lob, tsh: profile.tsh,
    storeCode: profile.store_code, storeName: profile.store_name, store: profile.store_name,
    storeLeaderId: profile.store_leader_id || '',
    staffCodes: codes, code: codes[0] || '', activeCode: codes[0] || '', mustChangePassword: profile.must_change_password,
  });
  const settingsForSave = source => {
    const result = { ...source };
    const background = result.bgImagePath || (result.bgImage && !result.bgImage.startsWith('http') ? result.bgImage : '');
    const logo = result.logoPath || (result.logo && !result.logo.startsWith('http') ? result.logo : '');
    delete result.bgImagePath; delete result.logoPath;
    if (background) result.bgImage = background; else delete result.bgImage;
    if (logo) result.logo = logo; else delete result.logo;
    return result;
  };
  const loadCloudData = async () => {
    const profile = currentUser.profile;
    const monitoringProfile = profile.role === 'user' && ['LOB', 'TSH', 'Store Leader'].includes(profile.user_type);
    const showAttendance = profile.role === 'admin' || profile.user_type !== 'LOB';
    const [staffResult, logResult, folderResult, promoResult, settingsResult, profileResult, accessResult, contentResult] = await Promise.all([
      client.from('staff').select('*').order('code'),
      showAttendance
        ? client.from('attendance_logs').select('*').order('occurred_at', { ascending: false }).limit(5000)
        : Promise.resolve({ data: [], error: null }),
      client.from('promo_folders').select('*').order('path'),
      client.from('promos').select('*').order('created_at', { ascending: false }),
      client.from('app_settings').select('value').eq('id', true).maybeSingle(),
      client.from('profiles').select('*').order('username'),
      client.from('staff_access').select('user_id,staff_code'),
      client.from('admin_content').select('*').order('sort_order').order('title'),
    ]);
    staff = check(staffResult).map(row => ({ code: row.code, nik: row.nik || '', name: row.name, lob: row.lob, tsh: row.tsh, storeCode: row.store_code, storeName: row.store_name, store: row.store_name }));
    const accessRows = check(accessResult);
    const profiles = check(profileResult);
    accounts = profiles
      .filter(item => item.role === 'user' && (profile.role === 'admin' || item.id !== profile.id))
      .map(item => userAccountFrom(item, accessRows.filter(access => access.user_id === item.id).map(access => access.staff_code)));
    updateStoreLeaderOptions();
    const ownCodes = accessRows.filter(access => access.user_id === profile.id).map(access => access.staff_code);
    currentUser.account = userAccountFrom(profile, ownCodes);
    if (!monitoringProfile && profile.role !== 'admin') accounts = [];
    const rawLogs = check(logResult);
    logs = await Promise.all(rawLogs.map(async row => {
      const person = staff.find(item => item.code === row.staff_code);
      const photo = profile.user_type === 'LOB' ? '' : await signedFileUrl('attendance-proofs', row.photo_path);
      return { id: row.id, ts: new Date(row.occurred_at).getTime(), date: row.local_date, time: row.local_time, code: row.staff_code, name: person?.name || row.staff_code, action: row.action, detail: row.detail, photo, photoPath: row.photo_path };
    }));
    promoFolders = check(folderResult).map(row => row.path);
    promos = await Promise.all(check(promoResult).map(async row => {
      const imageFile = isImageFile(row.content_type, row.file_name);
      return {
        id: row.id, title: row.title, text: row.body, folder: row.folder_path,
        image: row.file_path && imageFile ? await signedFileUrl(row.storage_bucket || 'app-media', row.file_path) : '',
        fileData: row.file_path && !imageFile ? await signedFileUrl(row.storage_bucket || 'app-media', row.file_path) : '',
        filePath: row.file_path, fileName: row.file_name, imageType: row.content_type,
        storageBucket: row.storage_bucket || 'app-media', scopeType: row.scope_type || 'global', scopeValue: row.scope_value || '',
        created: new Date(row.created_at).toLocaleString('id-ID'), isHighlight: row.is_highlight || isHighlightPath(row.folder_path),
      };
    }));
    const storedSettings = check(settingsResult)?.value || {};
    appSettings = {
      ...storedSettings,
      bgImagePath: storedSettings.bgImage || '', logoPath: storedSettings.logo || '',
      bgImage: await signedFileUrl('app-media', storedSettings.bgImage),
      logo: await signedFileUrl('app-media', storedSettings.logo),
    };
    customContent = await Promise.all(check(contentResult).map(async row => ({
      id: row.id, parentId: row.parent_id, title: row.title, kind: row.kind,
      targetRoles: row.target_roles || [], url: row.url, description: row.description,
      filePath: row.file_path, fileName: row.file_name, contentType: row.content_type,
      fileUrl: row.file_path ? await signedFileUrl('admin-content', row.file_path) : '',
    })));
    window.ERAAPPS_CUSTOM_CONTENT = customContent;
    if (profile.role === 'admin') {
      const resetResult = await client.from('password_reset_requests').select('*').order('requested_at', { ascending: false });
      passwordResetRequests = check(resetResult).map(row => ({ id: row.id, code: row.staff_code, name: row.employee_name, username: row.username, status: row.status, created: new Date(row.requested_at).toLocaleString('id-ID'), createdAt: new Date(row.requested_at).getTime() }));
    } else passwordResetRequests = [];
    applyAppearance();
    renderAccounts();
    renderPasswordResetRequests();
    renderPromos();
    renderRoleDashboard();
    renderCustomContent(customContent, profile.role === 'admin');
    render();
  };
  const refreshSoon = () => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => loadCloudData().catch(showError), 250);
  };
  const watchCloud = () => {
    if (realtimeChannel) client.removeChannel(realtimeChannel);
    realtimeChannel = client.channel('eraapps-shared-data')
      .on('postgres_changes', { event: '*', schema: 'public' }, refreshSoon)
      .subscribe();
  };
  const callFunction = async (name, body, publicCall = false) => {
    const result = await client.functions.invoke(name, { body });
    if (result.error) {
      const context = result.error.context;
      const detail = context?.json ? await context.json().catch(() => null) : null;
      if (context?.status === 404) throw new Error(`Fungsi Supabase "${name}" belum tersedia. Deploy Edge Function terbaru ke proyek Supabase.`);
      throw new Error(detail?.error || result.error.message || 'Permintaan server gagal.');
    }
    if (result.data?.error) throw new Error(result.data.error);
    return result.data;
  };
  const saveAttendance = async () => {
    if (!selected || !action || !photoData) throw new Error('Pilih karyawan, aktivitas, dan foto bukti terlebih dahulu.');
    const reason = $('reason').value.trim();
    if (!reason) throw new Error('Reason / alasan wajib diisi.');
    const validation = validate(selected.code, action);
    if (validation) throw new Error(validation);
    const button = $('record');
    setBusy(button, true, 'Mengirim...');
    let photoPath;
    try {
      const photoBlob = await fileFromDataUrl(photoData);
      photoPath = await upload('attendance-proofs', `${selected.code}/${crypto.randomUUID()}.jpg`, photoBlob, 'image/jpeg');
      const now = new Date();
      check(await client.from('attendance_logs').insert({
        staff_code: selected.code, occurred_at: now.toISOString(), local_date: today(), local_time: timeNow(),
        action, detail: reason, photo_path: photoPath, created_by: currentUser.profile.id,
      }));
      photoData = '';
      $('photoPreview').style.display = 'none'; $('photoPreview').src = ''; stopPhotoCamera();
      $('retakePhoto').hidden = true; $('reason').value = ''; $('record').disabled = true;
      document.querySelectorAll('[data-action]').forEach(item => item.classList.remove('active'));
      action = null; $('barcode').value = ''; notify('Absensi berhasil disimpan ke cloud.', 'ok');
      await loadCloudData(); $('barcode').focus();
    } catch (error) {
      if (photoPath) await client.storage.from('attendance-proofs').remove([photoPath]);
      throw error;
    } finally { setBusy(button, false); }
  };
  const saveAccount = async (account, button) => {
    setBusy(button, true, 'Membuat akun...');
    try { await callFunction('admin-create-user', account); await loadCloudData(); notifyUploadSaved('Akun user tersimpan online.'); }
    finally { setBusy(button, false); }
  };
  const ensureFolders = async paths => {
    const known = new Set(promoFolders.map(path => path.toLowerCase()));
    const scope = promoScope(currentUser.profile);
    for (const path of paths) {
      if (known.has(path.toLowerCase())) continue;
      const parent = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : null;
      check(await client.from('promo_folders').insert({
        path, parent_path: parent, scope_type: scope.type, scope_value: scope.value,
        created_by: currentUser.profile.id,
      }));
      known.add(path.toLowerCase());
    }
  };
  const promoScope = profile => {
    if (profile.role === 'admin') return { type: 'global', value: '', slug: 'global' };
    if (profile.user_type === 'LOB') return { type: 'lob', value: profile.lob, slug: `lob/${scopeSlug(profile.lob)}` };
    if (profile.user_type === 'TSH') return {
      type: 'tsh', value: `${profile.lob}|${profile.tsh}`,
      slug: `tsh/${scopeSlug(profile.lob)}/${scopeSlug(profile.tsh)}`,
    };
    if (profile.user_type === 'Store Leader') return {
      type: 'store', value: `${profile.lob}|${profile.tsh}|${profile.store_code}`,
      slug: `store/${scopeSlug(profile.lob)}/${scopeSlug(profile.tsh)}/${scopeSlug(profile.store_code)}`,
    };
    throw new Error('Role Anda tidak memiliki izin menerbitkan informasi.');
  };
  const scopeSlug = value => String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
  const promoStoragePath = (scope, fileName) => (
    `promos/${scope.slug}/${crypto.randomUUID()}-${String(fileName).replace(/[^a-zA-Z0-9._-]/g, '_')}`
  );
  const insertPromoFiles = async (folder, files, descriptions = {}, reload = true) => {
    await ensureFolders([folder]);
    const scope = promoScope(currentUser.profile);
    const addedPaths = [];
    try {
      for (const file of files) {
        const path = await upload('app-media', promoStoragePath(scope, file.name), file);
        addedPaths.push(path);
        const item = descriptions(file);
        check(await client.from('promos').insert({
          folder_path: folder, title: item.title || '', body: item.body || '', file_path: path,
          file_name: file.name, content_type: file.type || 'application/octet-stream',
          is_highlight: folder.toLowerCase() === 'highlight', scope_type: scope.type, scope_value: scope.value,
          storage_bucket: 'app-media', created_by: currentUser.profile.id,
        }));
      }
    } catch (error) {
      if (addedPaths.length) {
        const { error: cleanupError } = await client.storage.from('app-media').remove(addedPaths);
        if (cleanupError) throw new Error(`${error.message} File sementara tidak dapat dibersihkan: ${cleanupError.message}`);
      }
      throw error;
    }
    if (reload) await loadCloudData();
  };
  const accountPayload = (username, password, storeName, lob, tsh, storeCode, employees, userType = 'ERO', organization = '', fullName = '', nik = '', email = '', storeLeaderId = '') => ({ username, password, storeName, lob, tsh, storeCode, employees, userType, organization, fullName, nik, email, storeLeaderId });
  const updateStoreLeaderOptions = () => {
    document.querySelectorAll('.staff-account-form').forEach(form => {
      const value = name => String(form.elements.namedItem(name)?.value || '').trim();
      const select = form.elements.namedItem('storeLeaderId');
      if (!select) return;
      const selected = select.value;
      const leaders = accounts.filter(account => account.userType === 'Store Leader'
        && account.accountStatus === 'approved'
        && account.lob?.toLowerCase() === value('lob').toLowerCase()
        && account.tsh?.toLowerCase() === value('tsh').toLowerCase()
        && account.storeCode?.toUpperCase() === value('storeCode').toUpperCase());
      select.innerHTML = leaders.length
        ? '<option value="">Pilih Store Leader</option>' + leaders.map(account => `<option value="${esc(account.id)}">${esc(account.name || account.username)} · ${esc(account.username)}</option>`).join('')
        : '<option value="">Belum ada Store Leader aktif pada scope ini</option>';
      if (leaders.some(account => account.id === selected)) select.value = selected;
    });
  };
  const updateAccountEmployeeRequirements = () => {
    const userType = $('newUserType').value;
    $('newOrganization').required = true;
    $('newLob').required = true;
    $('newTsh').required = ['TSH', 'Store Leader'].includes(userType);
    $('newStoreCode').required = userType === 'Store Leader';
    $('newStore').required = userType === 'Store Leader';
    $('newStore').placeholder = userType === 'Store Leader' ? 'Nama toko' : 'Tidak wajib untuk role ini';
  };
  $('newUserType').addEventListener('change', updateAccountEmployeeRequirements);
  updateAccountEmployeeRequirements();
  document.querySelectorAll('.staff-account-form').forEach(form => {
    ['lob', 'tsh', 'storeCode'].forEach(name => form.elements.namedItem(name).addEventListener('input', updateStoreLeaderOptions));
  });
  updateStoreLeaderOptions();
  const stopEvent = event => { event.preventDefault(); event.stopImmediatePropagation(); };
  const enterCloudApp = (role, account = null) => {
    const profile = currentUser.profile;
    const activeAccount = role === 'user' ? (account || currentUser.account) : null;
    enterApp(role, activeAccount);
    const languageMenu = $('langMenu');
    if (languageMenu) document.body.appendChild(languageMenu);
    currentUser = { role, profile, account: activeAccount };
    const name = profile.full_name || profile.username || profile.email || 'Pengguna';
    const type = role === 'admin' ? 'Admin' : (profile.user_type || 'ERO');
    $('headerUserName').textContent = `${name} · ${type}`;
    $('headerUserName').hidden = false;
    if ($('rolePreviewButton')) $('rolePreviewButton').hidden = role !== 'admin';
    const accountInfo = $('accountInfo');
    if (accountInfo) {
      accountInfo.textContent = `${profile.username || profile.email || name} · ${type}`;
      accountInfo.title = [name, profile.email, profile.organization, profile.lob, profile.tsh, profile.store_name].filter(Boolean).join(' · ');
      accountInfo.hidden = false;
    }
    if (role === 'user') {
      $('attendancePanel').querySelector('h2').textContent = `${type} · Absensi Saya`;
      showUserPage(type === 'LOB' ? 'dashboard' : 'attendance');
    }
  };

  document.getElementById('loginForm').addEventListener('submit', async event => {
    stopEvent(event);
    if (!client) return showError(new Error('Cloud belum dikonfigurasi. Lengkapi URL dan anon key Supabase.'));
    const button = $('loginForm').querySelector('button[type="submit"]');
    setBusy(button, true, 'Memeriksa...');
    try {
      const loginIdentifier = $('loginUsername').value.trim().toLowerCase();
      const result = await client.functions.invoke('username-login', {
        body: { identifier: loginIdentifier, password: $('loginPassword').value },
      });
      if (result.error) {
        const context = result.error.context;
        const detail = context?.json ? await context.json().catch(() => null) : null;
        throw new Error(detail?.error || 'Username atau password tidak sesuai.');
      }
      if (result.data?.error) throw new Error(result.data.error);
      const session = result.data?.session;
      if (!session?.access_token || !session?.refresh_token) throw new Error('Sesi login tidak diterima dari server.');
      const sessionResult = await client.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
      if (sessionResult.error) fail(sessionResult.error);
      const data = sessionResult.data;
      const profile = await profileFor(data.user.id);
      if (profile.role !== 'admin' && profile.account_status !== 'approved') {
        await client.auth.signOut();
        $('loginError').textContent = 'Akun Anda masih menunggu persetujuan sesuai hierarki organisasi.';
        return;
      }
      const forcePasswordChange = profile.must_change_password || result.data?.must_change_password || passwordExpired(profile);
      currentUser = { role: profile.role, profile, account: null };
      if (!forcePasswordChange || profile.role === 'admin') await loadCloudData();
      $('logoutButton').hidden = false;
      enterCloudApp(profile.role, profile.role === 'user' ? currentUser.account : null);
      if (forcePasswordChange) $('forcePasswordOverlay').style.display = 'flex';
      else watchCloud();
    } catch (error) { showError(error); }
    finally { setBusy(button, false); }
  }, true);

  document.getElementById('passwordResetForm').addEventListener('submit', async event => {
    stopEvent(event);
    const email = $('resetEmail').value.trim().toLowerCase();
    if (!email) {
      $('passwordResetStatus').textContent = 'Masukkan email akun yang terdaftar.';
      return;
    }
    const button = event.target.querySelector('button[type="submit"]');
    setBusy(button, true, 'Mengirim...');
    $('passwordResetStatus').className = 'login-error';
    $('passwordResetStatus').textContent = '';
    try {
      await callFunction('password-reset-request', {
        email,
        fullName: $('resetFullName').value.trim(),
        nik: $('resetNik').value.trim(),
        redirectTo: `${window.location.origin}${window.location.pathname}`,
      });
      event.target.reset();
      $('passwordResetStatus').className = 'login-success';
      $('passwordResetStatus').textContent = 'Jika data akun cocok, tautan pemulihan akan dikirim. Periksa kotak masuk dan folder spam.';
    } catch (error) {
      $('passwordResetStatus').className = 'login-error';
      $('passwordResetStatus').textContent = error.message || 'Tautan pemulihan gagal dikirim.';
    } finally { setBusy(button, false); }
  }, true);

  document.getElementById('openAdminRecovery').addEventListener('click', () => {
    $('adminRecoveryForm').hidden = !$('adminRecoveryForm').hidden;
  });
  document.getElementById('submitAdminRecovery').addEventListener('click', async event => {
    const token = $('adminRecoveryToken').value, password = $('adminRecoveryPassword').value;
    if (!token || password.length < 12 || password !== $('adminRecoveryConfirm').value) {
      $('passwordResetStatus').textContent = 'Masukkan kode pemulihan dan password baru minimal 12 karakter yang sama.';
      return;
    }
    const button = event.currentTarget;
    setBusy(button, true, 'Memulihkan...');
    try {
      await callFunction('admin-recover-password', { token, password });
      $('adminRecoveryToken').value = '';
      $('adminRecoveryPassword').value = '';
      $('adminRecoveryConfirm').value = '';
      $('adminRecoveryForm').hidden = true;
      $('passwordResetStatus').className = 'login-success';
      $('passwordResetStatus').textContent = 'Password admin berhasil diperbarui. Silakan masuk kembali.';
    } catch (error) {
      $('passwordResetStatus').className = 'login-error';
      $('passwordResetStatus').textContent = error.message || 'Pemulihan admin gagal.';
      showError(error);
    } finally { setBusy(button, false); }
  });

  document.getElementById('recoveryPasswordForm').addEventListener('submit', async event => {
    stopEvent(event);
    const password = $('recoveryNewPassword').value;
    if (password.length < 6 || password !== $('recoveryConfirmPassword').value) {
      $('recoveryPasswordError').textContent = 'Password baru tidak cocok atau kurang dari 6 karakter.';
      return;
    }
    const button = event.target.querySelector('button[type="submit"]');
    setBusy(button, true, 'Menyimpan...');
    try {
      const { error } = await client.auth.updateUser({ password });
      if (error) fail(error);
      const completion = await client.functions.invoke('password-reset-complete', { body: {} });
      if (completion.error) {
        const detail = completion.error.context?.json ? await completion.error.context.json().catch(() => null) : null;
        throw new Error(detail?.error || completion.error.message || 'Status pemulihan akun gagal disimpan.');
      }
      if (completion.data?.error) throw new Error(completion.data.error);
      await client.auth.signOut();
      window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}`);
      event.target.reset();
      $('recoveryPasswordOverlay').style.display = 'none';
      $('loginOverlay').style.display = 'flex';
      $('loginError').textContent = completion.data?.requiresApproval
        ? 'Password berhasil diperbarui. Akun menunggu persetujuan kembali sesuai hierarki organisasi.'
        : 'Password berhasil diperbarui. Silakan masuk dengan password baru.';
    } catch (error) {
      $('recoveryPasswordError').textContent = error.message || 'Password gagal diperbarui.';
    } finally { setBusy(button, false); }
  }, true);

  document.getElementById('forcePasswordForm').addEventListener('submit', async event => {
    stopEvent(event);
    const nextPassword = $('forceNewPassword').value;
    if (nextPassword.length < 6 || nextPassword !== $('forceConfirmPassword').value) { $('forcePasswordError').textContent = 'Password baru tidak cocok atau kurang dari 6 karakter.'; return; }
    try {
      const { error } = await client.auth.updateUser({ password: nextPassword });
      if (error) fail(error);
      check(await client.rpc('mark_password_changed'));
      currentUser.profile.must_change_password = false;
      currentUser.profile.password_changed_at = new Date().toISOString();
      $('forcePasswordOverlay').style.display = 'none'; event.target.reset();
      const role = currentUser.profile.role;
      if (role === 'user') await loadCloudData();
      enterCloudApp(role, role === 'user' ? currentUser.account : null);
      watchCloud();
      notify('Password berhasil diperbarui.', 'ok');
    } catch (error) { $('forcePasswordError').textContent = error.message || 'Password gagal diperbarui.'; }
  }, true);

  document.getElementById('record').addEventListener('click', event => { stopEvent(event); saveAttendance().catch(showError); }, true);
  document.getElementById('staffForm').addEventListener('submit', async event => {
    stopEvent(event);
    const code = $('staffCode').value.trim().toUpperCase(), name = $('staffName').value.trim();
    const nik = $('staffNik').value.trim();
    if (!code || !name || !/^\d{16}$/.test(nik) || staff.length >= 30 || staff.some(person => person.code === code || person.nik === nik)) return showError(new Error('Kode harus unik, NIK harus 16 digit dan unik, serta maksimal 30 karyawan.'));
    try { check(await client.from('staff').insert({ code, nik, name })); $('staffForm').reset(); await loadCloudData(); }
    catch (error) { showError(error); }
  }, true);
  document.getElementById('accountForm').addEventListener('submit', async event => {
    stopEvent(event);
    const username = $('newUsername').value.trim().toLowerCase(), password = $('newPassword').value;
    const status = $('accountFormStatus');
    status.textContent = '';
    status.className = 'mini';
    const userType = $('newUserType').value;
    if (!/^[a-z0-9._-]{3,40}$/.test(username) || password.length < 6) {
      status.textContent = 'Periksa username (3-40 karakter) dan password (minimal 6 karakter).';
      status.className = 'login-error';
      return;
    }
    if (accounts.some(account => account.nik === $('newNik').value.trim())) {
      status.textContent = 'NIK akun sudah terdaftar.';
      status.className = 'login-error';
      return;
    }
    try {
      await saveAccount(accountPayload(username, password, $('newStore').value.trim(), $('newLob').value.trim(), $('newTsh').value.trim(), $('newStoreCode').value.trim().toUpperCase(), [], userType, $('newOrganization').value.trim(), $('newFullName').value.trim(), $('newNik').value.trim(), $('newEmail').value.trim().toLowerCase()), $('accountForm').querySelector('button[type="submit"]'));
      status.textContent = 'Akun aktif berhasil dibuat. Password awal wajib diganti saat login pertama.';
      status.className = 'login-success';
      event.target.reset();
      updateAccountEmployeeRequirements();
    } catch (error) { status.textContent = error.message || 'Akun gagal dibuat.'; status.className = 'login-error'; showError(error); }
  }, true);
  document.querySelectorAll('.staff-account-form').forEach(form => form.addEventListener('submit', async event => {
    stopEvent(event);
    const value = name => String(form.elements.namedItem(name)?.value || '').trim();
    const username = value('username').toLowerCase(), password = value('password');
    const nik = value('nik'), fullName = value('fullName'), email = value('email').toLowerCase();
    const lob = value('lob'), tsh = value('tsh'), storeCode = value('storeCode').toUpperCase();
    const storeName = value('storeName'), organization = value('organization') || lob;
    const storeLeaderId = value('storeLeaderId'), storeLeader = accounts.find(account => account.id === storeLeaderId);
    const status = form.querySelector('[role="status"]');
    status.textContent = '';
    status.className = 'mini';
    if (!/^[a-z0-9._-]{3,40}$/.test(username) || password.length < 6 || !/^\d{16}$/.test(nik)) {
      status.textContent = 'Username harus 3-40 karakter, password minimal 6 karakter, dan NIK harus 16 digit.';
      status.className = 'login-error';
      return;
    }
    if (accounts.some(account => account.username?.toLowerCase() === username || account.nik === nik)) {
      status.textContent = 'Username atau NIK sudah terdaftar.';
      status.className = 'login-error';
      return;
    }
    if (!storeLeader || storeLeader.userType !== 'Store Leader') {
      status.textContent = 'Pilih Store Leader aktif yang sesuai dengan LOB, TSH, dan toko.';
      status.className = 'login-error';
      return;
    }
    const button = form.querySelector('button[type="submit"]');
    try {
      await saveAccount(accountPayload(
        username, password, storeName, lob, tsh, storeCode, [], form.dataset.userType,
        organization, fullName, nik, email, storeLeader.id,
      ), button);
      status.textContent = 'Akun berhasil dibuat. NIK dan nama yang sama otomatis ditautkan sebagai staf; password awal wajib diganti saat login pertama.';
      status.className = 'login-success';
      form.reset();
      updateStoreLeaderOptions();
    } catch (error) {
      status.textContent = error.message || 'Akun gagal dibuat.';
      status.className = 'login-error';
      showError(error);
    }
  }, true));
  document.getElementById('roleInfoForm').addEventListener('submit', async event => {
    stopEvent(event);
    const profile = currentUser?.profile;
    if (!profile || profile.user_type !== 'LOB') {
      $('roleInfoStatus').textContent = 'Role Anda tidak diizinkan menerbitkan informasi.';
      return;
    }
    const body = sanitizeRichText($('roleInfoBody').innerHTML);
    if (!body.replace(/<[^>]*>/g, '').trim()) {
      $('roleInfoStatus').className = 'login-error';
      $('roleInfoStatus').textContent = 'Isi informasi sebelum diterbitkan.';
      return;
    }
    const button = event.target.querySelector('button[type="submit"]');
    setBusy(button, true, 'Menerbitkan...');
    $('roleInfoStatus').textContent = '';
    try {
      const scope = promoScope(profile);
      check(await client.from('promos').insert({
        folder_path: 'Umum',
        title: $('roleInfoTitle').value.trim(),
        body,
        is_highlight: false,
        scope_type: scope.type,
        scope_value: scope.value,
        created_by: profile.id,
      }));
      event.target.reset();
      $('roleInfoBody').innerHTML = '';
      $('roleInfoStatus').className = 'login-success';
      $('roleInfoStatus').textContent = 'Informasi diterbitkan untuk lingkup Anda.';
      await loadCloudData();
    } catch (error) {
      $('roleInfoStatus').className = 'login-error';
      $('roleInfoStatus').textContent = error.message || 'Informasi gagal diterbitkan.';
    } finally { setBusy(button, false); }
  }, true);
  document.getElementById('saveAccountImport').addEventListener('click', async event => {
    stopEvent(event);
    if (!pendingAccountImport.length) return;
    const button = $('saveAccountImport'); setBusy(button, true, 'Menyimpan...');
    const grouped = new Map();
    pendingAccountImport.forEach(item => { if (!grouped.has(item.username)) grouped.set(item.username, []); grouped.get(item.username).push(item); });
    const total = grouped.size;
    let imported = 0;
    try {
      for (const [username, employees] of grouped) {
        const first = employees[0];
        const storeLeader = accounts.find(account => account.username?.toLowerCase() === first.storeLeader && account.userType === 'Store Leader');
        if (['ERO', 'Promotor'].includes(first.userType) && !storeLeader) throw new Error(`Store Leader ${first.storeLeader} tidak ditemukan.`);
        await callFunction('admin-create-user', accountPayload(username, first.password, first.storeName, first.lob, first.tsh, first.storeCode, [], first.userType, first.organization, first.fullName, first.nik, first.email, storeLeader?.id || ''));
        pendingAccountImport = pendingAccountImport.filter(item => item.username !== username);
        imported++;
      }
      $('importAccountStatus').textContent = `Berhasil membuat ${imported} akun. Akun aktif di Supabase; password awal wajib diganti saat login pertama.`;
      $('accountExcelFile').value = ''; $('saveAccountImport').disabled = true;
      await loadCloudData(); notifyUploadSaved('Import akun tersimpan online.');
    } catch (error) {
      $('importAccountStatus').textContent = `Berhasil membuat ${imported} dari ${total} akun. Import tersisa tetap disiapkan agar dapat dicoba ulang. ${error.message}`;
      $('saveAccountImport').disabled = !pendingAccountImport.length;
      showError(error);
    }
    finally { setBusy(button, false); }
  }, true);

  const updateContentKindFields = () => {
    const kind = $('contentKind').value;
    $('contentUrlLabel').hidden = kind !== 'link';
    $('contentFileLabel').hidden = !['image', 'video', 'file'].includes(kind);
    $('contentUrl').required = kind === 'link';
    $('contentFile').required = ['image', 'video', 'file'].includes(kind) && !pendingContentFile;
  };
  const contentDraftSnapshot = () => ({
    title: $('contentTitle').value, parentId: $('contentParent').value, kind: $('contentKind').value,
    url: $('contentUrl').value, description: $('contentDescription').value,
    roles: [...document.querySelectorAll('[name="contentRole"]:checked')].map(input => input.value),
  });
  const saveContentDraft = async saveFile => {
    try {
      localStorage.setItem(contentDraftKey, JSON.stringify(contentDraftSnapshot()));
      if (saveFile) await storeDraftFile(pendingContentFile);
      $('contentDraftStatus').textContent = `Draft tersimpan di perangkat ini${pendingContentFile ? ` · ${pendingContentFile.name}` : ''}.`;
    } catch (error) {
      $('contentDraftStatus').textContent = 'Draft gagal disimpan di perangkat ini.';
      showError(error);
    }
  };
  const clearContentDraft = async () => {
    localStorage.removeItem(contentDraftKey);
    await storeDraftFile(null);
    pendingContentFile = null;
    $('adminContentForm').reset();
    updateContentKindFields();
    $('contentDraftStatus').textContent = 'Draft dihapus.';
  };
  $('contentKind').addEventListener('change', () => { updateContentKindFields(); saveContentDraft(false); });
  $('adminContentForm').addEventListener('input', () => saveContentDraft(false));
  $('adminContentForm').addEventListener('change', event => {
    if (event.target.id === 'contentFile') {
      pendingContentFile = event.target.files[0] || null;
      updateContentKindFields();
      saveContentDraft(true);
    } else saveContentDraft(false);
  });
  $('clearContentDraft').addEventListener('click', async () => {
    try { await clearContentDraft(); }
    catch (error) { showError(error); }
  });
  $('adminContentForm').addEventListener('submit', async event => {
    stopEvent(event);
    if (currentUser?.role !== 'admin') return showError(new Error('Hanya Admin yang dapat menambahkan menu.'));
    const kind = $('contentKind').value;
    const title = $('contentTitle').value.trim();
    const description = $('contentDescription').value.trim();
    const roles = [...document.querySelectorAll('[name="contentRole"]:checked')].map(input => input.value);
    const parentId = $('contentParent').value || null;
    if (!title || !roles.length) return showError(new Error('Isi nama menu dan pilih minimal satu role.'));
    if (parentId) {
      const parent = customContent.find(item => item.id === parentId);
      if (!parent || parent.kind !== 'folder' || roles.some(role => !parent.targetRoles.includes(role))) {
        return showError(new Error('Folder induk harus tersedia untuk semua role yang dipilih.'));
      }
    }
    const url = $('contentUrl').value.trim();
    if (kind === 'link') {
      try {
        const parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('URL harus menggunakan HTTP atau HTTPS.');
      } catch (error) { return showError(error.message ? error : new Error('Masukkan URL valid dengan HTTP atau HTTPS.')); }
    }
    const file = pendingContentFile || $('contentFile').files[0] || null;
    if (['image', 'video', 'file'].includes(kind) && !file) return showError(new Error('Pilih file yang akan disimpan.'));
    if (file && file.size > 5 * 1024 * 1024) return showError(new Error('Ukuran file maksimal 5 MB.'));
    if (kind === 'image' && !file?.type.startsWith('image/')) return showError(new Error('Pilih file gambar.'));
    if (kind === 'video' && !file?.type.startsWith('video/')) return showError(new Error('Pilih file video.'));
    if (kind === 'file' && !/\.(pdf|docx?|xlsx?|pptx?)$/i.test(file?.name || '')) {
      return showError(new Error('File harus PDF, Word, Excel, atau PowerPoint.'));
    }
    const button = event.target.querySelector('button[type="submit"]');
    const id = crypto.randomUUID();
    let uploadedPath = '';
    let recordInserted = false;
    setBusy(button, true, 'Menyimpan...');
    try {
      if (file) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        uploadedPath = `${id}/${safeName}`;
        await upload('admin-content', uploadedPath, file);
      }
      check(await client.from('admin_content').insert({
        id, parent_id: parentId, title, kind, target_roles: roles, url: kind === 'link' ? url : '',
        description, file_path: uploadedPath || null, file_name: file?.name || null,
        content_type: file?.type || null, created_by: currentUser.profile.id,
      }));
      recordInserted = true;
      await clearContentDraft();
      await loadCloudData();
      notifyUploadSaved('Menu tambahan tersimpan dan ditampilkan sesuai role.');
    } catch (error) {
      let reportedError = error;
      if (uploadedPath && !recordInserted) {
        const { error: cleanupError } = await client.storage.from('admin-content').remove([uploadedPath]);
        if (cleanupError) reportedError = new Error(`${error.message} File sementara tidak dapat dibersihkan: ${cleanupError.message}`);
      }
      showError(reportedError);
    } finally { setBusy(button, false); }
  }, true);

  document.getElementById('adminPasswordForm').addEventListener('submit', async event => {
    stopEvent(event);
    const next = $('adminNewPassword').value;
    if (next.length < 6 || next !== $('adminConfirmPassword').value) return showError(new Error('Password baru tidak cocok atau kurang dari 6 karakter.'));
    try {
      const { error } = await client.auth.updateUser({ password: next });
      if (error) fail(error);
      check(await client.rpc('mark_password_changed'));
      event.target.reset(); alert('Password admin berhasil diganti.');
    } catch (error) { showError(error); }
  }, true);
  document.getElementById('saveAppearance').addEventListener('click', async event => {
    stopEvent(event);
    const button = $('saveAppearance'); setBusy(button, true, 'Menyimpan...');
    try {
      const settings = { ...settingsForSave(appSettings), headerTitle: $('settingHeader').value.trim() || 'Sistem Absensi Barcode', headerColor: $('settingHeaderColor').value, bgColor: $('settingBgColor').value, storeName: $('newStore').value.trim() || 'EraApps' };
      for (const [inputId, key] of [['settingBgImage', 'bgImage'], ['settingLogo', 'logo']]) {
        const file = $(inputId).files[0];
        if (file) settings[key] = await upload('app-media', `branding/${key}-${crypto.randomUUID()}`, file);
      }
      check(await client.from('app_settings').upsert({ id: true, value: settings, updated_by: currentUser.profile.id }));
      appSettings = settings; await loadCloudData(); notifyUploadSaved('Tampilan disimpan online.');
    } catch (error) { showError(error); }
    finally { setBusy(button, false); }
  }, true);
  document.getElementById('clearBgImage').addEventListener('click', async event => {
    stopEvent(event);
    try { const settings = settingsForSave(appSettings); delete settings.bgImage; check(await client.from('app_settings').upsert({ id: true, value: settings, updated_by: currentUser.profile.id })); appSettings = settings; await loadCloudData(); }
    catch (error) { showError(error); }
  }, true);
  document.getElementById('promoFolderForm').addEventListener('submit', async event => {
    stopEvent(event);
    const path = $('promoFolderName').value.trim();
    try { await ensureFolders([path]); event.target.reset(); await loadCloudData(); }
    catch (error) { showError(error); }
  }, true);
  document.getElementById('promoForm').addEventListener('submit', async event => {
    stopEvent(event);
    const file = $('promoImage').files[0], folder = $('promoFolderSelect').value || 'Umum';
    const button = $('promoForm').querySelector('button[type="submit"]'); setBusy(button, true, 'Menerbitkan...');
    try {
      await ensureFolders([folder]);
      const scope = promoScope(currentUser.profile);
      let filePath = null;
      if (file) filePath = await upload('app-media', promoStoragePath(scope, file.name), file);
      check(await client.from('promos').insert({
        folder_path: folder, title: $('promoTitle').value.trim(), body: $('promoText').value.trim(),
        file_path: filePath, file_name: file?.name || null, content_type: file?.type || null,
        is_highlight: folder.toLowerCase() === 'highlight', scope_type: scope.type, scope_value: scope.value,
        storage_bucket: 'app-media', created_by: currentUser.profile.id,
      }));
      event.target.reset(); await loadCloudData(); notifyUploadSaved('Promo dipublikasikan untuk semua user.');
    } catch (error) { showError(error); }
    finally { setBusy(button, false); }
  }, true);
  document.getElementById('saveDirectoryUpload').addEventListener('click', async event => {
    stopEvent(event);
    const files = [...pendingDirectoryFiles]; if (!files.length) return;
    const button = $('saveDirectoryUpload'); setBusy(button, true, 'Mengunggah...');
    try {
      const allPaths = files.flatMap(file => directoryFileInfo(file).folderPaths);
      await ensureFolders(allPaths);
      for (const file of files) {
        const info = directoryFileInfo(file);
        await insertPromoFiles(info.folder, [file], item => ({ title: item.name.replace(/\.[^.]+$/, '') }), false);
      }
      pendingDirectoryFiles = []; $('promoDirectoryUpload').value = ''; $('directoryUploadStatus').textContent = ''; await loadCloudData();
    } catch (error) { showError(error); }
    finally { setBusy(button, false); }
  }, true);

  document.addEventListener('click', async event => {
    const target = event.target.closest('button'); if (!target) return;
    if (target.matches('[data-delete-content]')) {
      stopEvent(event);
      if (currentUser?.role !== 'admin') return showError(new Error('Hanya Admin yang dapat menghapus menu.'));
      const item = customContent.find(content => content.id === target.dataset.deleteContent);
      if (!item || !confirm(`Hapus "${item.title}" beserta semua submenu di dalamnya?`)) return;
      setBusy(target, true, 'Menghapus...');
      try {
        check(await client.from('admin_content').delete().eq('id', item.id));
        const descendants = new Set([item.id]);
        let added = true;
        while (added) {
          added = false;
          customContent.forEach(child => {
            if (descendants.has(child.parentId) && !descendants.has(child.id)) {
              descendants.add(child.id);
              added = true;
            }
          });
        }
        const files = customContent.filter(content => descendants.has(content.id) && content.filePath).map(content => content.filePath);
        if (files.length) {
          const { error } = await client.storage.from('admin-content').remove(files);
          if (error) throw new Error(`Menu terhapus, tetapi sebagian file tidak dapat dibersihkan: ${error.message}`);
        }
        await loadCloudData();
      } catch (error) { showError(error); }
      finally { setBusy(target, false); }
      return;
    }
    if (target.matches('[data-approve-reset],[data-reject-reset]')) {
      stopEvent(event);
      try { await callFunction('resolve-password-reset', { id: target.dataset.approveReset || target.dataset.rejectReset, approve: target.hasAttribute('data-approve-reset') }); await loadCloudData(); notifyUploadSaved('Permintaan reset diproses.'); }
      catch (error) { showError(error); }
      return;
    }
    if (target.matches('[data-approve-account]')) {
      stopEvent(event);
      setBusy(target, true, 'Menyetujui...');
      try {
        const staffCodes = [...target.closest('.person').querySelectorAll('[data-approve-staff]:checked')].map(input => input.dataset.approveStaff);
        await callFunction('approve-account', { userId: target.dataset.approveAccount, staffCodes });
        await loadCloudData();
        notify('Akun disetujui.', 'ok');
      } catch (error) { showError(error); }
      finally { setBusy(target, false); }
      return;
    }
    if (target.matches('[data-reject-account]')) {
      stopEvent(event);
      const reason = target.closest('.person').querySelector('[data-reject-reason]').value;
      if (!reason) return showError(new Error('Pilih alasan reject: resign atau pindah toko.'));
      if (!confirm('Tolak akun dengan alasan yang dipilih?')) return;
      setBusy(target, true, 'Memproses...');
      try {
        await callFunction('approve-account', { userId: target.dataset.rejectAccount, approve: false, reason });
        await loadCloudData();
        notify('Akun ditolak. Pemilik akun akan melihat instruksi untuk menghubungi atasannya.', 'ok');
      } catch (error) { showError(error); }
      finally { setBusy(target, false); }
      return;
    }
    if (target.matches('[data-remove-account]')) {
      stopEvent(event);
      if (!confirm(`Hapus akun ${target.dataset.removeAccount}?`)) return;
      try { await callFunction('admin-delete-user', { username: target.dataset.removeAccount }); await loadCloudData(); }
      catch (error) { showError(error); }
      return;
    }
    if (target.matches('[data-delete-promo]')) {
      stopEvent(event);
      const item = promos.find(promo => String(promo.id) === target.dataset.deletePromo);
      if (!item || !confirm('Hapus file promo ini dari semua user?')) return;
      try { if (item.filePath) check(await client.storage.from(item.storageBucket || 'app-media').remove([item.filePath])); check(await client.from('promos').delete().eq('id', item.id)); await loadCloudData(); }
      catch (error) { showError(error); }
      return;
    }
    if (target.matches('[data-save-folder-upload]')) {
      stopEvent(event);
      const section = target.closest('.promo-folder'), files = [...section.querySelector('[data-folder-upload]').files], folder = target.dataset.saveFolderUpload;
      if (!files.length) return;
      setBusy(target, true, 'Mengunggah...');
      try { await insertPromoFiles(folder, files, file => ({ title: file.name.replace(/\.[^.]+$/, '') })); }
      catch (error) { showError(error); }
      finally { setBusy(target, false); }
      return;
    }
    if (target.matches('[data-delete]')) {
      stopEvent(event);
      const code = target.dataset.delete;
      if (logs.some(item => item.code === code)) return showError(new Error('Karyawan sudah memiliki riwayat absensi dan tidak dapat dihapus.'));
      if (!confirm(`Hapus karyawan ${code}?`)) return;
      try { check(await client.from('staff').delete().eq('code', code)); await loadCloudData(); }
      catch (error) { showError(error); }
      return;
    }
    if (target.id === 'deleteFilteredHistory' || target.id === 'deleteAllHistory') {
      stopEvent(event);
      const store = $('deleteStore').value, code = $('deleteStaff').value, date = $('deleteDate').value;
      if (target.id === 'deleteFilteredHistory' && !store && !code && !date) return showError(new Error('Pilih minimal satu filter.'));
      if (!confirm('Penghapusan ini berlaku untuk semua perangkat dan tidak dapat dipulihkan. Lanjutkan?')) return;
      try {
        const storeCodes = store ? new Set(staff.filter(person => (person.storeName || person.store || 'M.H.A WEB') === store).map(person => person.code)) : null;
        const affected = logs.filter(item => (!code || item.code === code) && (!date || item.date === date) && (!storeCodes || storeCodes.has(item.code)));
        let query = client.from('attendance_logs').delete();
        if (code) query = query.eq('staff_code', code);
        if (date) query = query.eq('local_date', date);
        if (store) query = query.in('staff_code', storeCodes.size ? [...storeCodes] : ['__none__']);
        check(await query);
        const photoPaths = affected.map(item => item.photoPath).filter(Boolean);
        if (photoPaths.length) check(await client.storage.from('attendance-proofs').remove(photoPaths));
        await loadCloudData();
      } catch (error) { showError(error); }
    }
  }, true);

  document.addEventListener('change', async event => {
    const input = event.target;
    if (!(input.matches('[data-code]') || input.matches('[data-name]') || input.matches('[data-nik]'))) return;
    stopEvent(event);
    const oldCode = input.dataset.code || input.dataset.name || input.dataset.nik, row = input.closest('.staffrow');
    const code = (row.querySelector('[data-code]')?.value || oldCode).trim().toUpperCase();
    const nik = (row.querySelector('[data-nik]')?.value || '').trim();
    const name = (row.querySelector('[data-name]')?.value || '').trim();
    const existingStaff = staff.find(person => person.code === oldCode);
    const validNik = /^\d{16}$/.test(nik) || (!nik && existingStaff?.nik === '');
    if (!code || !name || !validNik
      || staff.some(person => person.code === code && person.code !== oldCode)
      || (nik && staff.some(person => person.nik === nik && person.code !== oldCode))) {
      return showError(new Error('Kode internal harus unik; NIK yang diisi wajib 16 digit dan unik; nama wajib diisi.'));
    }
    if (code !== oldCode && logs.some(item => item.code === oldCode)) return showError(new Error('Kode tidak dapat diubah setelah memiliki riwayat online. Ubah nama saja atau tambahkan karyawan baru.'));
    try { check(await client.from('staff').update({ code, nik, name }).eq('code', oldCode)); await loadCloudData(); }
    catch (error) { showError(error); }
  }, true);

  const logout = document.createElement('button');
  logout.id = 'logoutButton'; logout.className = 'secondary'; logout.innerHTML = '<span aria-hidden="true">⏻</span>'; logout.setAttribute('aria-label', 'Keluar'); logout.title = 'Keluar'; logout.hidden = true;
  logout.style.marginLeft = 'auto'; document.querySelector('header').appendChild(logout);
  logout.addEventListener('click', async () => { if (realtimeChannel) await client.removeChannel(realtimeChannel); await client.auth.signOut(); window.location.reload(); });

  async function boot() {
    staff = []; logs = []; accounts = []; promos = []; promoFolders = []; passwordResetRequests = [];
    appSettings = {};
    try { await restoreContentDraft(); }
    catch (error) { $('contentDraftStatus').textContent = 'Draft lokal tidak dapat dipulihkan.'; showError(error); }
    save = () => render();
    storeAccounts = () => renderAccounts();
    savePasswordResetRequests = () => updatePasswordResetBadge();
    savePromoData = () => false;
    $('headerLogo').removeAttribute('src'); $('headerLogo').style.display = 'none'; $('brandText').style.display = '';
    document.querySelector('header h1').textContent = 'Sistem Absensi Barcode';
    document.body.style.background = 'var(--bg)';
    applyAppearance();
    if (!config || !config.url || !config.anonKey || config.url.includes('YOUR_PROJECT_ID') || config.anonKey.includes('YOUR_SUPABASE')) {
      $('loginError').textContent = 'Aplikasi belum tersambung ke Supabase. Admin perlu mengatur URL dan anon key proyek.';
      render(); return;
    }
    try {
      client = window.supabase.createClient(config.url, config.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
      client.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY' && session) {
          recoveryFlow = true;
          currentUser = { role: null, profile: null, account: null };
          $('loginOverlay').style.display = 'none';
          $('recoveryPasswordOverlay').style.display = 'flex';
        }
      });
      const authError = new URLSearchParams(window.location.hash.slice(1));
      if (authError.get('error_code') === 'otp_expired') {
        $('loginError').textContent = 'Tautan reset password sudah kedaluwarsa atau pernah digunakan. Minta tautan baru.';
        window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}`);
      }
      const { data } = await client.auth.getSession();
      if (recoveryFlow) return;
      if (data.session) {
        const profile = await profileFor(data.session.user.id);
        if (profile.role !== 'admin' && profile.account_status !== 'approved') {
          await client.auth.signOut();
          $('loginError').textContent = 'Akun Anda masih menunggu persetujuan sesuai hierarki organisasi.';
          return;
        }
        currentUser = { role: profile.role, profile, account: null };
        const forcePasswordChange = profile.must_change_password || passwordExpired(profile);
        if (!forcePasswordChange || profile.role === 'admin') await loadCloudData();
        $('logoutButton').hidden = false;
        enterCloudApp(profile.role, profile.role === 'user' ? currentUser.account : null);
        if (forcePasswordChange) {
          $('forcePasswordOverlay').style.display = 'flex';
        } else {
          watchCloud();
        }
      } else render();
    } catch (error) { showError(error); }
  }
  boot();
})();
