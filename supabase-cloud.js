(function () {
  const config = window.ERAAPPS_SUPABASE_CONFIG;
  let client;
  let refreshTimer;
  let realtimeChannel;
  let mediaSequence = 0;
  let recoveryFlow = false;
  const aliasEmail = username => `${String(username).trim().toLowerCase()}@eraapps.invalid`;
  const fail = (error, fallback = 'Operasi online gagal.') => { throw new Error(error?.message || fallback); };
  const check = result => { if (result.error) fail(result.error); return result.data; };
  const isImageFile = (contentType, fileName) => String(contentType || '').toLowerCase().startsWith('image/') || /\.(jpe?g|png|gif|webp|bmp|avif)$/i.test(String(fileName || ''));
  const isHighlightPath = path => { const value = String(path || '').toLowerCase(); return value === 'highlight' || value.startsWith('highlight/'); };
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
    if (error) return '';
    return data.signedUrl;
  };
  const profileFor = async userId => {
    const result = await client.from('profiles').select('*').eq('id', userId).single();
    return check(result);
  };
  const userAccountFrom = (profile, codes) => ({
    username: profile.username, name: profile.full_name, lob: profile.lob, tsh: profile.tsh,
    storeCode: profile.store_code, storeName: profile.store_name, store: profile.store_name,
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
    const [staffResult, logResult, folderResult, promoResult, settingsResult] = await Promise.all([
      client.from('staff').select('*').order('code'),
      client.from('attendance_logs').select('*').order('occurred_at', { ascending: false }).limit(5000),
      client.from('promo_folders').select('*').order('path'),
      client.from('promos').select('*').order('created_at', { ascending: false }),
      client.from('app_settings').select('value').eq('id', true).maybeSingle(),
    ]);
    staff = check(staffResult).map(row => ({ code: row.code, name: row.name, lob: row.lob, tsh: row.tsh, storeCode: row.store_code, storeName: row.store_name, store: row.store_name }));
    const accessResult = profile.role === 'admin'
      ? await client.from('staff_access').select('user_id,staff_code')
      : await client.from('staff_access').select('user_id,staff_code').eq('user_id', profile.id);
    const accessRows = check(accessResult);
    if (profile.role === 'admin') {
      const profileResult = await client.from('profiles').select('*').eq('role', 'user').order('username');
      const profiles = check(profileResult);
      accounts = profiles.map(item => userAccountFrom(item, accessRows.filter(access => access.user_id === item.id).map(access => access.staff_code)));
    } else {
      const ownCodes = accessRows.map(access => access.staff_code);
      currentUser.account = userAccountFrom(profile, ownCodes);
      accounts = [currentUser.account];
    }
    const rawLogs = check(logResult);
    logs = await Promise.all(rawLogs.map(async row => {
      const person = staff.find(item => item.code === row.staff_code);
      const photo = await signedFileUrl('attendance-proofs', row.photo_path);
      return { id: row.id, ts: new Date(row.occurred_at).getTime(), date: row.local_date, time: row.local_time, code: row.staff_code, name: person?.name || row.staff_code, action: row.action, detail: row.detail, photo, photoPath: row.photo_path };
    }));
    promoFolders = check(folderResult).map(row => row.path);
    promos = await Promise.all(check(promoResult).map(async row => {
      const imageFile = isImageFile(row.content_type, row.file_name);
      return {
        id: row.id, title: row.title, text: row.body, folder: row.folder_path,
        image: row.file_path && imageFile ? await signedFileUrl('app-media', row.file_path) : '',
        fileData: row.file_path && !imageFile ? await signedFileUrl('app-media', row.file_path) : '',
        filePath: row.file_path, fileName: row.file_name, imageType: row.content_type,
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
    if (profile.role === 'admin') {
      const resetResult = await client.from('password_reset_requests').select('*').order('requested_at', { ascending: false });
      passwordResetRequests = check(resetResult).map(row => ({ id: row.id, code: row.staff_code, name: row.employee_name, username: row.username, status: row.status, created: new Date(row.requested_at).toLocaleString('id-ID'), createdAt: new Date(row.requested_at).getTime() }));
    } else passwordResetRequests = [];
    applyAppearance();
    renderAccounts();
    renderPasswordResetRequests();
    renderPromos();
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
      const detail = result.error.context?.json ? await result.error.context.json().catch(() => null) : null;
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
    for (const path of paths) {
      if (known.has(path.toLowerCase())) continue;
      const parent = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : null;
      check(await client.from('promo_folders').insert({ path, parent_path: parent, created_by: currentUser.profile.id }));
      known.add(path.toLowerCase());
    }
  };
  const insertPromoFiles = async (folder, files, descriptions = {}, reload = true) => {
    await ensureFolders([folder]);
    const addedPaths = [];
    try {
      for (const file of files) {
        const path = await upload('app-media', `promos/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`, file);
        addedPaths.push(path);
        const item = descriptions(file);
        check(await client.from('promos').insert({
          folder_path: folder, title: item.title || '', body: item.body || '', file_path: path,
          file_name: file.name, content_type: file.type || 'application/octet-stream',
          is_highlight: folder.toLowerCase() === 'highlight', created_by: currentUser.profile.id,
        }));
      }
    } catch (error) {
      if (addedPaths.length) await client.storage.from('app-media').remove(addedPaths);
      throw error;
    }
    if (reload) await loadCloudData();
  };
  const accountPayload = (username, password, storeName, lob, tsh, storeCode, employees) => ({ username, password, storeName, lob, tsh, storeCode, employees });
  const stopEvent = event => { event.preventDefault(); event.stopImmediatePropagation(); };
  const enterCloudApp = (role, account = null) => {
    const profile = currentUser.profile;
    const activeAccount = role === 'user' ? (account || currentUser.account) : null;
    enterApp(role, activeAccount);
    currentUser = { role, profile, account: activeAccount };
  };

  document.getElementById('loginForm').addEventListener('submit', async event => {
    stopEvent(event);
    if (!client) return showError(new Error('Cloud belum dikonfigurasi. Lengkapi URL dan anon key Supabase.'));
    const button = $('loginForm').querySelector('button[type="submit"]');
    setBusy(button, true, 'Memeriksa...');
    try {
      const loginIdentifier = $('loginUsername').value.trim().toLowerCase();
      const email = loginIdentifier.includes('@') ? loginIdentifier : aliasEmail(loginIdentifier);
      const { data, error } = await client.auth.signInWithPassword({ email, password: $('loginPassword').value });
      if (error) fail(error, 'Username atau password tidak sesuai.');
      const profile = await profileFor(data.user.id);
      if (profile.role !== $('loginRole').value) { await client.auth.signOut(); throw new Error('Jenis akun tidak sesuai.'); }
      currentUser = { role: profile.role, profile, account: null };
      await loadCloudData();
      $('logoutButton').hidden = false;
      enterCloudApp(profile.role, profile.role === 'user' ? currentUser.account : null);
      if (profile.role === 'user' && profile.must_change_password) $('forcePasswordOverlay').style.display = 'flex';
      watchCloud();
    } catch (error) { showError(error); }
    finally { setBusy(button, false); }
  }, true);

  document.getElementById('passwordResetForm').addEventListener('submit', async event => {
    stopEvent(event);
    try {
      await callFunction('password-reset-request', { code: $('resetBarcode').value.trim().toUpperCase(), name: $('resetEmployeeName').value.trim() }, true);
      event.target.reset(); $('passwordResetStatus').className = 'login-success'; $('passwordResetStatus').textContent = 'Permintaan terkirim dan menunggu persetujuan admin.';
    } catch (error) { $('passwordResetStatus').textContent = error.message; }
  }, true);

  $('openAdminRecovery').onclick = () => {
    $('loginOverlay').style.display = 'none';
    $('adminRecoveryOverlay').style.display = 'flex';
    $('adminRecoveryStatus').textContent = '';
  };
  $('cancelAdminRecovery').onclick = () => {
    $('adminRecoveryOverlay').style.display = 'none';
    $('loginOverlay').style.display = 'flex';
  };
  document.getElementById('adminRecoveryForm').addEventListener('submit', async event => {
    stopEvent(event);
    const token = $('adminRecoveryToken').value.trim();
    const password = $('adminRecoveryPassword').value;
    if (password.length < 12 || password !== $('adminRecoveryConfirm').value) {
      $('adminRecoveryStatus').textContent = 'Password baru tidak cocok atau kurang dari 12 karakter.';
      return;
    }
    const button = event.target.querySelector('button[type="submit"]');
    setBusy(button, true, 'Memulihkan...');
    try {
      await callFunction('admin-recover-password', { token, password }, true);
      event.target.reset();
      $('adminRecoveryOverlay').style.display = 'none';
      $('loginOverlay').style.display = 'flex';
      $('loginRole').value = 'admin';
      $('loginUsername').value = 'admin';
      $('loginError').textContent = 'Password admin berhasil diubah. Masuk dengan password baru.';
    } catch (error) {
      $('adminRecoveryStatus').textContent = error.message;
    } finally { setBusy(button, false); }
  }, true);

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
      await client.auth.signOut();
      window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}`);
      event.target.reset();
      $('recoveryPasswordOverlay').style.display = 'none';
      $('loginOverlay').style.display = 'flex';
      $('loginError').textContent = 'Password berhasil diperbarui. Silakan masuk dengan password baru.';
    } catch (error) {
      $('recoveryPasswordError').textContent = error.message || 'Password gagal diperbarui.';
    } finally { setBusy(button, false); }
  }, true);

  document.getElementById('forcePasswordForm').addEventListener('submit', async event => {
    stopEvent(event);
    const oldPassword = $('forceOldPassword').value, nextPassword = $('forceNewPassword').value;
    if (nextPassword.length < 6 || nextPassword !== $('forceConfirmPassword').value) { $('forcePasswordError').textContent = 'Password baru tidak cocok atau kurang dari 6 karakter.'; return; }
    try {
      const { error } = await client.auth.updateUser({ password: nextPassword });
      if (error) fail(error);
      check(await client.rpc('mark_password_changed'));
      currentUser.profile.must_change_password = false;
      $('forcePasswordOverlay').style.display = 'none'; event.target.reset();
      enterCloudApp('user', currentUser.account); notify('Password berhasil diperbarui.', 'ok');
    } catch (error) { $('forcePasswordError').textContent = error.message || 'Password gagal diperbarui.'; }
  }, true);

  document.getElementById('record').addEventListener('click', event => { stopEvent(event); saveAttendance().catch(showError); }, true);
  document.getElementById('staffForm').addEventListener('submit', async event => {
    stopEvent(event);
    const code = $('staffCode').value.trim().toUpperCase(), name = $('staffName').value.trim();
    if (!code || !name || staff.length >= 30 || staff.some(person => person.code === code)) return showError(new Error('Kode harus unik dan data karyawan maksimal 30.'));
    try { check(await client.from('staff').insert({ code, name })); $('staffForm').reset(); await loadCloudData(); }
    catch (error) { showError(error); }
  }, true);
  document.getElementById('accountForm').addEventListener('submit', async event => {
    stopEvent(event);
    const username = $('newUsername').value.trim().toLowerCase(), password = $('newPassword').value;
    const employees = [...document.querySelectorAll('.employee-account-row')].map(row => ({ code: row.querySelector('.employee-code').value.trim().toUpperCase(), name: row.querySelector('.employee-name').value.trim() }));
    if (new Set(employees.map(person => person.code)).size !== employees.length || employees.some(person => staff.some(existing => existing.code === person.code))) return showError(new Error('Kode karyawan harus unik dan belum digunakan.'));
    try {
      await saveAccount(accountPayload(username, password, $('newStore').value.trim(), $('newLob').value.trim(), $('newTsh').value.trim(), $('newStoreCode').value.trim().toUpperCase(), employees), $('accountForm').querySelector('button[type="submit"]'));
      event.target.reset(); $('newStore').value = 'M.H.A WEB';
      $('newEmployeeRows').innerHTML = '<div class="staffrow employee-account-row"><input class="employee-code" required placeholder="Kode barcode, mis. EA006"><input class="employee-name" required placeholder="Nama karyawan"><span></span></div>';
    } catch (error) { showError(error); }
  }, true);
  document.getElementById('saveAccountImport').addEventListener('click', async event => {
    stopEvent(event);
    if (!pendingAccountImport.length) return;
    const button = $('saveAccountImport'); setBusy(button, true, 'Menyimpan...');
    try {
      const grouped = new Map();
      pendingAccountImport.forEach(item => { if (!grouped.has(item.username)) grouped.set(item.username, []); grouped.get(item.username).push(item); });
      for (const [username, employees] of grouped) {
        const first = employees[0];
        await callFunction('admin-create-user', accountPayload(username, first.password, first.storeName, first.lob, first.tsh, first.storeCode, employees));
      }
      pendingAccountImport = []; $('importAccountStatus').textContent = 'Import berhasil disimpan ke cloud.'; $('accountExcelFile').value = '';
      await loadCloudData(); notifyUploadSaved('Import akun tersimpan online.');
    } catch (error) { showError(error); }
    finally { setBusy(button, false); }
  }, true);

  document.getElementById('adminPasswordForm').addEventListener('submit', async event => {
    stopEvent(event);
    const next = $('adminNewPassword').value;
    if (next.length < 6 || next !== $('adminConfirmPassword').value) return showError(new Error('Password baru tidak cocok atau kurang dari 6 karakter.'));
    try {
      const { error } = await client.auth.updateUser({ password: next });
      if (error) fail(error);
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
      let filePath = null;
      if (file) filePath = await upload('app-media', `promos/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`, file);
      check(await client.from('promos').insert({ folder_path: folder, title: $('promoTitle').value.trim(), body: $('promoText').value.trim(), file_path: filePath, file_name: file?.name || null, content_type: file?.type || null, is_highlight: folder.toLowerCase() === 'highlight', created_by: currentUser.profile.id }));
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
    if (target.matches('[data-approve-reset],[data-reject-reset]')) {
      stopEvent(event);
      try { await callFunction('resolve-password-reset', { id: target.dataset.approveReset || target.dataset.rejectReset, approve: target.hasAttribute('data-approve-reset') }); await loadCloudData(); notifyUploadSaved('Permintaan reset diproses.'); }
      catch (error) { showError(error); }
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
      try { check(await client.from('promos').delete().eq('id', item.id)); if (item.filePath) await client.storage.from('app-media').remove([item.filePath]); await loadCloudData(); }
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
    if (!(input.matches('[data-code]') || input.matches('[data-name]'))) return;
    stopEvent(event);
    const oldCode = input.dataset.code, row = input.closest('.staffrow');
    const code = (row.querySelector('[data-code]')?.value || oldCode).trim().toUpperCase();
    const name = (row.querySelector('[data-name]')?.value || '').trim();
    if (!code || !name || staff.some(person => person.code === code && person.code !== oldCode)) return showError(new Error('Kode harus unik dan nama/kode tidak boleh kosong.'));
    if (code !== oldCode && logs.some(item => item.code === oldCode)) return showError(new Error('Kode tidak dapat diubah setelah memiliki riwayat online. Ubah nama saja atau tambahkan karyawan baru.'));
    try { check(await client.from('staff').update({ code, name }).eq('code', oldCode)); await loadCloudData(); }
    catch (error) { showError(error); }
  }, true);

  const logout = document.createElement('button');
  logout.id = 'logoutButton'; logout.className = 'secondary'; logout.textContent = 'Keluar'; logout.hidden = true;
  logout.style.marginLeft = 'auto'; document.querySelector('header').appendChild(logout);
  logout.addEventListener('click', async () => { if (realtimeChannel) await client.removeChannel(realtimeChannel); await client.auth.signOut(); window.location.reload(); });

  async function boot() {
    staff = []; logs = []; accounts = []; promos = []; promoFolders = []; passwordResetRequests = [];
    appSettings = {};
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
        currentUser = { role: profile.role, profile, account: null };
        await loadCloudData(); $('logoutButton').hidden = false;
        enterCloudApp(profile.role, profile.role === 'user' ? currentUser.account : null);
        if (profile.role === 'user' && profile.must_change_password) $('forcePasswordOverlay').style.display = 'flex';
        watchCloud();
      } else render();
    } catch (error) { showError(error); }
  }
  boot();
})();
