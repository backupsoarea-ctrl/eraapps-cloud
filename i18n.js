(function () {
  const LANGS = { en: 'English', id: 'Bahasa Indonesia', zh: '中文', ar: 'العربية', vi: 'Tiếng Việt' };
  const UI = { en: 'Language', id: 'Bahasa', zh: '语言', ar: 'اللغة', vi: 'Ngôn ngữ' };
  // Source texts are Indonesian. Values: [English, Chinese, Arabic, Vietnamese].
  const D = {
    'Absensi': ['Attendance', '考勤', 'الحضور', 'Chấm công'],
    'Aktivitas': ['Activity', '活动', 'النشاط', 'Hoạt động'],
    'Aktivitas Harian': ['Daily Activity', '每日活动', 'النشاط اليومي', 'Hoạt động hằng ngày'],
    'Aktivitas Terbaru': ['Latest Activity', '最新活动', 'آخر الأنشطة', 'Hoạt động mới nhất'],
    'Akun & Pendaftaran': ['Accounts & Registration', '账号与注册', 'الحسابات والتسجيل', 'Tài khoản & Đăng ký'],
    'Ambil foto': ['Take photo', '拍照', 'التقاط صورة', 'Chụp ảnh'],
    'Anggota dalam lingkup Anda': ['Members in your scope', '您范围内的成员', 'الأعضاء ضمن نطاقك', 'Thành viên trong phạm vi của bạn'],
    'Approval akun': ['Account Approval', '账号审批', 'اعتماد الحسابات', 'Duyệt tài khoản'],
    'Persetujuan Akun': ['Account Approval', '账号审批', 'اعتماد الحسابات', 'Duyệt tài khoản'],
    'Persetujuan Reset Password': ['Password Reset Approval', '密码重置审批', 'اعتماد إعادة تعيين كلمة المرور', 'Duyệt đặt lại mật khẩu'],
    'Belum ada data absensi.': ['No attendance data yet.', '暂无考勤数据。', 'لا توجد بيانات حضور بعد.', 'Chưa có dữ liệu chấm công.'],
    'Belum ada karyawan dipilih': ['No employee selected', '未选择员工', 'لم يتم اختيار موظف', 'Chưa chọn nhân viên'],
    'Belum ada rekap pada tanggal ini.': ['No recap for this date.', '该日期暂无汇总。', 'لا يوجد ملخص لهذا التاريخ.', 'Chưa có tổng hợp cho ngày này.'],
    'Belum pulang': ['Not checked out', '未下班', 'لم ينصرف', 'Chưa về'],
    'Berikutnya': ['Next', '下一个', 'التالي', 'Tiếp'],
    'Sebelumnya': ['Previous', '上一个', 'السابق', 'Trước'],
    'Setting': ['Settings', '设置', 'الإعدادات', 'Cài đặt'],
    'Tampilan & Keamanan': ['Appearance & Security', '外观与安全', 'المظهر والأمان', 'Giao diện & Bảo mật'],
    'Bold': ['Bold', '粗体', 'غامق', 'In đậm'],
    'Italic': ['Italic', '斜体', 'مائل', 'In nghiêng'],
    'Underline': ['Underline', '下划线', 'تسطير', 'Gạch chân'],
    'Rata kanan': ['Align right', '右对齐', 'محاذاة لليمين', 'Căn phải'],
    'Rata kiri': ['Align left', '左对齐', 'محاذاة لليسار', 'Căn trái'],
    'Rata tengah': ['Center', '居中', 'توسيط', 'Căn giữa'],
    'Buat Akun': ['Create Account', '创建账号', 'إنشاء حساب', 'Tạo tài khoản'],
    'Buat akun pengguna': ['Create user account', '创建用户账号', 'إنشاء حساب مستخدم', 'Tạo tài khoản người dùng'],
    'Buat semua akun': ['Create all accounts', '创建所有账号', 'إنشاء كل الحسابات', 'Tạo tất cả tài khoản'],
    'Buka kamera foto': ['Open photo camera', '打开拍照相机', 'فتح كاميرا الصورة', 'Mở camera chụp'],
    'Buka kamera scan': ['Open scan camera', '打开扫描相机', 'فتح كاميرا المسح', 'Mở camera quét'],
    'Matikan kamera': ['Turn off camera', '关闭相机', 'إيقاف الكاميرا', 'Tắt camera'],
    'Bulan': ['Month', '月', 'الشهر', 'Tháng'],
    'Cadangkan JSON': ['Back up JSON', '备份 JSON', 'نسخ احتياطي JSON', 'Sao lưu JSON'],
    'Cari': ['Search', '搜索', 'بحث', 'Tìm'],
    'Cari nama / aktivitas...': ['Search name / activity...', '搜索姓名/活动...', 'ابحث بالاسم / النشاط...', 'Tìm tên / hoạt động...'],
    'Catat Absensi': ['Record Attendance', '记录考勤', 'تسجيل الحضور', 'Ghi chấm công'],
    'Dashboard': ['Dashboard', '仪表盘', 'لوحة التحكم', 'Bảng điều khiển'],
    'Data Karyawan (maksimal 30)': ['Employee Data (max 30)', '员工数据（最多30）', 'بيانات الموظفين (بحد أقصى 30)', 'Dữ liệu nhân viên (tối đa 30)'],
    'Daftarkan ERO': ['Register ERO', '登记 ERO', 'تسجيل ERO', 'Đăng ký ERO'],
    'Pendaftaran ERO/Promotor': ['ERO/Promotor Registration', 'ERO/Promotor 注册', 'تسجيل ERO/Promotor', 'Đăng ký ERO/Promotor'],
    'Daftarkan Promotor': ['Register Promotor', '登记 Promotor', 'تسجيل Promotor', 'Đăng ký Promotor'],
    'Buat akun LOB, TSH, atau Store Leader': ['Create a LOB, TSH, or Store Leader account', '创建 LOB、TSH 或 Store Leader 账号', 'إنشاء حساب LOB أو TSH أو Store Leader', 'Tạo tài khoản LOB, TSH hoặc Store Leader'],
    'Buat Akun ERO': ['Create ERO Account', '创建 ERO 账号', 'إنشاء حساب ERO', 'Tạo tài khoản ERO'],
    'Buat Akun Promotor': ['Create Promotor Account', '创建 Promotor 账号', 'إنشاء حساب Promotor', 'Tạo tài khoản Promotor'],
    'Download JPEG': ['Download JPEG', '下载 JPEG', 'تنزيل JPEG', 'Tải JPEG'],
    'Download template Excel (.xlsx)': ['Download Excel template (.xlsx)', '下载 Excel 模板 (.xlsx)', 'تنزيل قالب Excel (.xlsx)', 'Tải mẫu Excel (.xlsx)'],
    'Upload template': ['Upload template', '上传模板', 'رفع القالب', 'Tải lên mẫu'],
    'Impor massal dari template Excel': ['Bulk import from Excel template', '通过 Excel 模板批量导入', 'استيراد جماعي من قالب Excel', 'Nhập hàng loạt từ mẫu Excel'],
    'ERO': ['ERO', 'ERO', 'ERO', 'ERO'],
    'Email aktif': ['Active email', '有效邮箱', 'البريد الإلكتروني الفعال', 'Email đang dùng'],
    'Email akun': ['Account email', '账号邮箱', 'بريد الحساب', 'Email tài khoản'],
    'Email atau username': ['Email or username', '邮箱或用户名', 'البريد أو اسم المستخدم', 'Email hoặc tên đăng nhập'],
    'EraApps · Sistem Absensi Web': ['EraApps · Web Attendance System', 'EraApps · 网页考勤系统', 'EraApps · نظام الحضور عبر الويب', 'EraApps · Hệ thống chấm công web'],
    'Sistem Absensi Barcode': ['Barcode Attendance System', '条码考勤系统', 'نظام الحضور بالباركود', 'Hệ thống chấm công mã vạch'],
    'Sistem Absensi Barcode · Ciputat': ['Barcode Attendance System · Ciputat', '条码考勤系统 · Ciputat', 'نظام الحضور بالباركود · Ciputat', 'Hệ thống chấm công mã vạch · Ciputat'],
    'File (maks. 5 MB)': ['File (max 5 MB)', '文件（最大 5 MB）', 'ملف (الحد الأقصى 5 ميجابايت)', 'Tệp (tối đa 5 MB)'],
    'Filter karyawan (opsional)': ['Employee filter (optional)', '员工筛选（可选）', 'تصفية الموظفين (اختياري)', 'Lọc nhân viên (tùy chọn)'],
    'Filter toko (opsional)': ['Store filter (optional)', '门店筛选（可选）', 'تصفية المتاجر (اختياري)', 'Lọc cửa hàng (tùy chọn)'],
    'Folder': ['Folder', '文件夹', 'مجلد', 'Thư mục'],
    'Folder / submenu': ['Folder / submenu', '文件夹 / 子菜单', 'مجلد / قائمة فرعية', 'Thư mục / menu con'],
    'Folder induk (opsional)': ['Parent folder (optional)', '上级文件夹（可选）', 'المجلد الأصل (اختياري)', 'Thư mục cha (tùy chọn)'],
    'Folder promo dan file': ['Promo folders and files', '促销文件夹和文件', 'مجلدات وملفات العروض', 'Thư mục và tệp khuyến mãi'],
    'Foto': ['Photo', '照片', 'صورة', 'Ảnh'],
    'Foto background (opsional)': ['Background photo (optional)', '背景图片（可选）', 'صورة الخلفية (اختياري)', 'Ảnh nền (tùy chọn)'],
    'Foto bukti absensi (wajib)': ['Attendance proof photo (required)', '考勤证明照片（必填）', 'صورة إثبات الحضور (إلزامية)', 'Ảnh minh chứng chấm công (bắt buộc)'],
    'Foto promo': ['Promo photo', '促销图片', 'صورة العرض', 'Ảnh khuyến mãi'],
    'Ganti Password Admin': ['Change Admin Password', '修改管理员密码', 'تغيير كلمة مرور المدير', 'Đổi mật khẩu quản trị'],
    'Ganti Password Akun': ['Change Account Password', '修改账号密码', 'تغيير كلمة مرور الحساب', 'Đổi mật khẩu tài khoản'],
    'Hapus Draft': ['Delete Draft', '删除草稿', 'حذف المسودة', 'Xóa bản nháp'],
    'Hapus Foto Background': ['Remove Background Photo', '删除背景图片', 'حذف صورة الخلفية', 'Xóa ảnh nền'],
    'Hapus Riwayat Absensi': ['Delete Attendance History', '删除考勤记录', 'حذف سجل الحضور', 'Xóa lịch sử chấm công'],
    'Hapus Riwayat Sesuai Filter': ['Delete History by Filter', '按筛选删除记录', 'حذف السجل حسب التصفية', 'Xóa lịch sử theo bộ lọc'],
    'Hapus Semua Riwayat Absensi': ['Delete All Attendance History', '删除所有考勤记录', 'حذف كل سجل الحضور', 'Xóa toàn bộ lịch sử chấm công'],
    'Informasi': ['Information', '信息', 'معلومات', 'Thông tin'],
    'Informasi promo': ['Promo information', '促销信息', 'معلومات العرض', 'Thông tin khuyến mãi'],
    'Istirahat': ['Break', '休息', 'استراحة', 'Nghỉ giải lao'],
    'Izin keluar': ['Leave permission', '外出许可', 'إذن الخروج', 'Xin ra ngoài'],
    'Jenis konten': ['Content type', '内容类型', 'نوع المحتوى', 'Loại nội dung'],
    'Judul': ['Title', '标题', 'العنوان', 'Tiêu đề'],
    'Judul halaman / promo': ['Page / promo title', '页面 / 促销标题', 'عنوان الصفحة / العرض', 'Tiêu đề trang / khuyến mãi'],
    'Karyawan': ['Employee', '员工', 'الموظف', 'Nhân viên'],
    'Karyawan terdaftar': ['Registered employees', '已登记员工', 'الموظفون المسجلون', 'Nhân viên đã đăng ký'],
    'Keamanan Admin': ['Admin Security', '管理员安全', 'أمان المدير', 'Bảo mật quản trị'],
    'Keluar': ['Log out', '退出', 'تسجيل الخروج', 'Đăng xuất'],
    'Keluar ke toilet': ['Go to toilet', '去洗手间', 'الذهاب للحمام', 'Đi vệ sinh'],
    'Keluar sementara': ['Temporary leave', '临时外出', 'خروج مؤقت', 'Ra ngoài tạm thời'],
    'Kembali bekerja': ['Back to work', '返回工作', 'العودة للعمل', 'Quay lại làm việc'],
    'Kembali dari izin': ['Back from leave', '外出归来', 'العودة من الإذن', 'Quay lại sau khi xin phép'],
    'Keterangan': ['Notes', '备注', 'ملاحظات', 'Ghi chú'],
    'Kode': ['Code', '代码', 'الرمز', 'Mã'],
    'Kode Toko': ['Store Code', '门店代码', 'رمز المتجر', 'Mã cửa hàng'],
    'Store Leader': ['Store Leader', '店长', 'قائد المتجر', 'Quản lý cửa hàng'],
    'Pilih Store Leader': ['Select Store Leader', '选择 Store Leader', 'اختر Store Leader', 'Chọn Store Leader'],
    'Belum ada Store Leader aktif pada scope ini': ['No active Store Leader exists in this scope', '此范围内没有启用的 Store Leader', 'لا يوجد Store Leader نشط ضمن هذا النطاق', 'Chưa có Store Leader đang hoạt động trong phạm vi này'],
    'Pilih Store Leader aktif yang sesuai dengan LOB, TSH, dan toko.': ['Select an active Store Leader matching the LOB, TSH, and store.', '请选择与 LOB、TSH 和门店匹配的启用 Store Leader。', 'اختر Store Leader نشطاً يطابق LOB وTSH والمتجر.', 'Chọn Store Leader đang hoạt động khớp với LOB, TSH và cửa hàng.'],
    'Akun berhasil dibuat. NIK dan nama yang sama otomatis ditautkan sebagai staf; password awal wajib diganti saat login pertama.': ['Account created. The same NIK and name are linked as the staff record; change the initial password at first login.', '账号已创建。相同的 NIK 和姓名会自动关联为员工记录；首次登录时必须更改初始密码。', 'تم إنشاء الحساب. سيتم ربط رقم NIK والاسم نفسيهما كسجل موظف؛ يجب تغيير كلمة المرور الأولية عند أول تسجيل دخول.', 'Đã tạo tài khoản. NIK và tên tương ứng được liên kết làm hồ sơ nhân viên; cần đổi mật khẩu ban đầu khi đăng nhập lần đầu.'],
    'Komposisi Aktivitas': ['Activity Breakdown', '活动构成', 'تركيبة الأنشطة', 'Cơ cấu hoạt động'],
    'Kembali ke Login': ['Back to Login', '返回登录', 'العودة لتسجيل الدخول', 'Quay lại đăng nhập'],
    'Kirim tautan pemulihan': ['Send recovery link', '发送恢复链接', 'إرسال رابط الاستعادة', 'Gửi liên kết khôi phục'],
    'Kode pemulihan': ['Recovery code', '恢复码', 'رمز الاستعادة', 'Mã khôi phục'],
    'Log absensi': ['Attendance log', '考勤日志', 'سجل الحضور', 'Nhật ký chấm công'],
    'Logo header (opsional)': ['Header logo (optional)', '页眉标志（可选）', 'شعار الترويسة (اختياري)', 'Logo tiêu đề (tùy chọn)'],
    'Masuk': ['Log in', '登录', 'تسجيل الدخول', 'Đăng nhập'],
    'Menu & Konten Tambahan': ['Additional Menus & Content', '附加菜单与内容', 'قوائم ومحتوى إضافي', 'Menu & nội dung bổ sung'],
    'Menu tambahan': ['Additional menu', '附加菜单', 'قائمة إضافية', 'Menu bổ sung'],
    'Menu utama': ['Main menu', '主菜单', 'القائمة الرئيسية', 'Menu chính'],
    'Menu yang tersimpan': ['Saved menus', '已保存的菜单', 'القوائم المحفوظة', 'Menu đã lưu'],
    'Minimal 6 karakter': ['Minimum 6 characters', '至少6个字符', '6 أحرف على الأقل', 'Tối thiểu 6 ký tự'],
    'NIK Barcode Karyawan': ['Employee NIK Barcode', '员工 NIK 条码', 'باركود NIK للموظف', 'Mã vạch NIK nhân viên'],
    'NIK karyawan': ['Employee NIK', '员工 NIK', 'NIK الموظف', 'NIK nhân viên'],
    'NIK (untuk user)': ['NIK (for users)', 'NIK（用户）', 'NIK (للمستخدمين)', 'NIK (cho người dùng)'],
    'Nama': ['Name', '姓名', 'الاسم', 'Tên'],
    'Nama folder baru': ['New folder name', '新文件夹名称', 'اسم المجلد الجديد', 'Tên thư mục mới'],
    'Nama header': ['Header name', '页眉名称', 'اسم الترويسة', 'Tên tiêu đề'],
    'Nama karyawan': ['Employee name', '员工姓名', 'اسم الموظف', 'Tên nhân viên'],
    'Nama lengkap': ['Full name', '全名', 'الاسم الكامل', 'Họ và tên'],
    'Nama lengkap (untuk user)': ['Full name (for users)', '全名（用户）', 'الاسم الكامل (للمستخدمين)', 'Họ và tên (cho người dùng)'],
    'Nama menu / konten': ['Menu / content name', '菜单 / 内容名称', 'اسم القائمة / المحتوى', 'Tên menu / nội dung'],
    'Nama organisasi': ['Organization name', '组织名称', 'اسم المنظمة', 'Tên tổ chức'],
    'Nama pengguna': ['Username', '用户名', 'اسم المستخدم', 'Tên người dùng'],
    'Nama toko': ['Store name', '门店名称', 'اسم المتجر', 'Tên cửa hàng'],
    'Organisasi/perusahaan': ['Organization/company', '组织/公司', 'المنظمة/الشركة', 'Tổ chức/công ty'],
    'Password': ['Password', '密码', 'كلمة المرور', 'Mật khẩu'],
    'Preview': ['Preview', '预览', 'معاينة', 'Xem trước'],
    'Preview tampilan role': ['Role preview', '角色预览', 'معاينة الدور', 'Xem trước vai trò'],
    'Pratinjau baca-saja. Data dan sesi admin tidak diubah.': ['Read-only preview. Admin data and session are not changed.', '只读预览，不会更改管理员数据或会话。', 'معاينة للقراءة فقط. لن يتم تغيير بيانات المسؤول أو جلسته.', 'Bản xem trước chỉ đọc. Không thay đổi dữ liệu hay phiên quản trị.'],
    'Role yang dipratinjau': ['Role to preview', '要预览的角色', 'الدور المراد معاينته', 'Vai trò cần xem trước'],
    'Akun contoh (opsional)': ['Example account (optional)', '示例账号（可选）', 'حساب نموذجي (اختياري)', 'Tài khoản mẫu (không bắt buộc)'],
    'Contoh role': ['Role example', '角色示例', 'مثال الدور', 'Mẫu vai trò'],
    'Tutup preview': ['Close preview', '关闭预览', 'إغلاق المعاينة', 'Đóng xem trước'],
    'Password admin baru': ['New admin password', '新管理员密码', 'كلمة مرور المدير الجديدة', 'Mật khẩu quản trị mới'],
    'Password admin saat ini': ['Current admin password', '当前管理员密码', 'كلمة مرور المدير الحالية', 'Mật khẩu quản trị hiện tại'],
    'Password awal': ['Initial password', '初始密码', 'كلمة المرور الأولية', 'Mật khẩu ban đầu'],
    'Password baru (minimal 6 karakter)': ['New password (min. 6 characters)', '新密码（至少6个字符）', 'كلمة مرور جديدة (6 أحرف على الأقل)', 'Mật khẩu mới (tối thiểu 6 ký tự)'],
    'Pilih Aktivitas': ['Choose Activity', '选择活动', 'اختر النشاط', 'Chọn hoạt động'],
    'Pilih Folder dari PC': ['Choose Folder from PC', '从电脑选择文件夹', 'اختر مجلداً من الكمبيوتر', 'Chọn thư mục từ máy tính'],
    'Pilih Foto dari Perangkat': ['Choose Photo from Device', '从设备选择照片', 'اختر صورة من الجهاز', 'Chọn ảnh từ thiết bị'],
    'Promo / Informasi': ['Promo / Information', '促销 / 信息', 'العروض / المعلومات', 'Khuyến mãi / Thông tin'],
    'Promo / Informasi Toko': ['Store Promo / Information', '门店促销 / 信息', 'عروض / معلومات المتجر', 'Khuyến mãi / Thông tin cửa hàng'],
    'Promotor': ['Promotor', '促销员', 'المروّج', 'Promotor'],
    'Publikasikan Promo': ['Publish Promo', '发布促销', 'نشر العرض', 'Đăng khuyến mãi'],
    'Publikasikan promo / informasi': ['Publish promo / information', '发布促销 / 信息', 'نشر العرض / المعلومات', 'Đăng khuyến mãi / thông tin'],
    'Pulang': ['Check out', '下班', 'انصراف', 'Về'],
    'Pulihkan akun admin': ['Recover admin account', '恢复管理员账号', 'استعادة حساب المدير', 'Khôi phục tài khoản quản trị'],
    'Pemulihan admin tanpa email': ['Admin recovery without email', '无邮箱管理员恢复', 'استعادة المدير بدون بريد', 'Khôi phục quản trị không email'],
    'Rekap & Ekspor': ['Recap & Export', '汇总与导出', 'الملخص والتصدير', 'Tổng hợp & Xuất'],
    'Export CSV / Excel': ['Export CSV / Excel', '导出 CSV / Excel', 'تصدير CSV / Excel', 'Xuất CSV / Excel'],
    'Reset Filter': ['Reset Filter', '重置筛选', 'إعادة تعيين التصفية', 'Đặt lại bộ lọc'],
    'Reset pilihan': ['Reset selection', '重置选择', 'إعادة تعيين الاختيار', 'Đặt lại lựa chọn'],
    'Riwayat Absensi Saya': ['My Attendance History', '我的考勤记录', 'سجل حضوري', 'Lịch sử chấm công của tôi'],
    'Role pengguna': ['User role', '用户角色', 'دور المستخدم', 'Vai trò người dùng'],
    'Scan Barcode & Catat Aktivitas': ['Scan Barcode & Record Activity', '扫描条码并记录活动', 'مسح الباركود وتسجيل النشاط', 'Quét mã vạch & ghi hoạt động'],
    'Scan hari ini': ['Scans today', '今日扫描', 'المسح اليوم', 'Quét hôm nay'],
    'Selesai bekerja': ['Finish work', '结束工作', 'إنهاء العمل', 'Kết thúc làm việc'],
    'Semua LOB': ['All LOB', '所有 LOB', 'كل LOB', 'Tất cả LOB'],
    'Semua TSH': ['All TSH', '所有 TSH', 'كل TSH', 'Tất cả TSH'],
    'Semua karyawan': ['All employees', '所有员工', 'كل الموظفين', 'Tất cả nhân viên'],
    'Semua toko': ['All stores', '所有门店', 'كل المتاجر', 'Tất cả cửa hàng'],
    'Setting Admin': ['Admin Settings', '管理员设置', 'إعدادات المدير', 'Cài đặt quản trị'],
    'Simpan Folder': ['Save Folder', '保存文件夹', 'حفظ المجلد', 'Lưu thư mục'],
    'Simpan Foto': ['Save Photo', '保存照片', 'حفظ الصورة', 'Lưu ảnh'],
    'Simpan Menu': ['Save Menu', '保存菜单', 'حفظ القائمة', 'Lưu menu'],
    'Simpan Password Baru': ['Save New Password', '保存新密码', 'حفظ كلمة المرور الجديدة', 'Lưu mật khẩu mới'],
    'Simpan Tampilan': ['Save Appearance', '保存外观', 'حفظ المظهر', 'Lưu giao diện'],
    'Buat Password Baru': ['Create New Password', '创建新密码', 'إنشاء كلمة مرور جديدة', 'Tạo mật khẩu mới'],
    'Ganti Password': ['Change Password', '修改密码', 'تغيير كلمة المرور', 'Đổi mật khẩu'],
    'Lupa password?': ['Forgot password?', '忘记密码？', 'نسيت كلمة المرور؟', 'Quên mật khẩu?'],
    'Status': ['Status', '状态', 'الحالة', 'Trạng thái'],
    'Sudah masuk': ['Checked in', '已上班', 'تم الحضور', 'Đã vào'],
    'Tambah': ['Add', '添加', 'إضافة', 'Thêm'],
    'Tambah Folder': ['Add Folder', '添加文件夹', 'إضافة مجلد', 'Thêm thư mục'],
    'Tampilan Header & Background': ['Header & Background Appearance', '页眉与背景外观', 'مظهر الترويسة والخلفية', 'Giao diện tiêu đề & nền'],
    'Tampilkan untuk role': ['Show to roles', '显示给角色', 'عرض للأدوار', 'Hiển thị cho vai trò'],
    'Tanggal (opsional)': ['Date (optional)', '日期（可选）', 'التاريخ (اختياري)', 'Ngày (tùy chọn)'],
    'Tanggal rekap': ['Recap date', '汇总日期', 'تاريخ الملخص', 'Ngày tổng hợp'],
    'Tautan': ['Link', '链接', 'رابط', 'Liên kết'],
    'Terbitkan': ['Publish', '发布', 'نشر', 'Đăng'],
    'Terbitkan Informasi untuk Lingkup Anda': ['Publish Information for Your Scope', '为您的范围发布信息', 'نشر معلومات لنطاقك', 'Đăng thông tin cho phạm vi của bạn'],
    'Toilet': ['Toilet', '洗手间', 'الحمام', 'Nhà vệ sinh'],
    'Tren Absensi · 7 Hari': ['Attendance Trend · 7 Days', '考勤趋势 · 7天', 'اتجاه الحضور · 7 أيام', 'Xu hướng chấm công · 7 ngày'],
    'Tulis informasi untuk area Anda': ['Write information for your area', '为您的区域撰写信息', 'اكتب معلومات لمنطقتك', 'Viết thông tin cho khu vực của bạn'],
    'URL tautan': ['Link URL', '链接地址', 'عنوان الرابط', 'URL liên kết'],
    'Ukuran': ['Size', '大小', 'الحجم', 'Kích thước'],
    'Ulangi foto': ['Retake photo', '重拍', 'إعادة الالتقاط', 'Chụp lại'],
    'Ulangi password admin baru': ['Repeat new admin password', '重复新管理员密码', 'أعد كلمة مرور المدير الجديدة', 'Nhập lại mật khẩu quản trị mới'],
    'Ulangi password baru': ['Repeat new password', '重复新密码', 'أعد كلمة المرور الجديدة', 'Nhập lại mật khẩu mới'],
    'Upload berhasil disimpan': ['Upload saved successfully', '上传已成功保存', 'تم حفظ الرفع بنجاح', 'Đã lưu tải lên'],
    'Username': ['Username', '用户名', 'اسم المستخدم', 'Tên đăng nhập'],
    'Video': ['Video', '视频', 'فيديو', 'Video'],
    'Waktu': ['Time', '时间', 'الوقت', 'Thời gian'],
    'Warna': ['Color', '颜色', 'اللون', 'Màu'],
    'Warna background solid': ['Solid background color', '纯色背景', 'لون خلفية صلب', 'Màu nền đơn sắc'],
    'Warna header': ['Header color', '页眉颜色', 'لون الترويسة', 'Màu tiêu đề'],
    'Waktu diambil otomatis dari perangkat ini.': ['Time is taken automatically from this device.', '时间自动取自此设备。', 'يؤخذ الوقت تلقائياً من هذا الجهاز.', 'Thời gian được lấy tự động từ thiết bị này.'],
    'Scan NIK atau kode barcode lama.': ['Scan NIK or the old barcode code.', '扫描 NIK 或旧条码。', 'امسح NIK أو الباركود القديم.', 'Quét NIK hoặc mã vạch cũ.'],
    'Detail promo atau informasi untuk karyawan': ['Promo or information details for employees', '面向员工的促销或信息详情', 'تفاصيل العرض أو المعلومات للموظفين', 'Chi tiết khuyến mãi hoặc thông tin cho nhân viên'],
    'Untuk keamanan, Anda wajib mengganti password default': ['For security, you must change the default password before continuing.', '为了安全，继续之前您必须更改默认密码。', 'لأسباب أمنية، يجب تغيير كلمة المرور الافتراضية قبل المتابعة.', 'Vì lý do bảo mật, bạn phải đổi mật khẩu mặc định trước khi tiếp tục.'],
    'Akun dibuat oleh admin melalui menu': ['Accounts are created by the admin via the Accounts & Registration menu.', '账号由管理员通过“账号与注册”菜单创建。', 'ينشئ المدير الحسابات من قائمة الحسابات والتسجيل.', 'Tài khoản do quản trị viên tạo qua menu Tài khoản & Đăng ký.'],
    'Masukkan email aktif akun.': ['Enter the account email. Non-admin users must also enter full name and NIK. If the data matches, a one-time recovery link will be sent.', '请输入账号邮箱。非管理员用户还须填写全名和 NIK。信息匹配后将发送一次性恢复链接。', 'أدخل بريد الحساب. يجب على غير المدراء إدخال الاسم الكامل وNIK أيضاً. إذا تطابقت البيانات سيُرسل رابط استعادة لمرة واحدة.', 'Nhập email tài khoản. Người dùng không phải quản trị còn phải nhập họ tên và NIK. Nếu khớp, liên kết khôi phục dùng một lần sẽ được gửi.'],
    'Gunakan kode pemulihan satu kali': ['Use the one-time recovery code kept by the project owner. It is not sent by email.', '请使用项目所有者保管的一次性恢复码。该码不会通过邮件发送。', 'استخدم رمز الاستعادة لمرة واحدة الذي يحتفظ به مالك المشروع. لا يُرسل بالبريد.', 'Dùng mã khôi phục một lần do chủ dự án giữ. Mã không được gửi qua email.'],
    'Tautan pemulihan berhasil diverifikasi': ['Recovery link verified. Enter a new password.', '恢复链接已验证。请输入新密码。', 'تم التحقق من رابط الاستعادة. أدخل كلمة مرور جديدة.', 'Đã xác minh liên kết khôi phục. Nhập mật khẩu mới.'],
    'EraApps | created and developed by': ['EraApps | created and developed by Helmi Alatas', 'EraApps | 由 Helmi Alatas 创建与开发', 'EraApps | أنشأه وطوّره Helmi Alatas', 'EraApps | được tạo và phát triển bởi Helmi Alatas'],
    'Created by Helmi Alatas': ['Created by Helmi Alatas', '由 Helmi Alatas 创建', 'من إنشاء Helmi Alatas', 'Tạo bởi Helmi Alatas'],
    'Unduh template .xlsx': ['Download the .xlsx template and fill in one row per account. An active email is required for password recovery.', '下载 .xlsx 模板，每个账号填写一行。需要有效邮箱用于密码恢复。', 'نزّل قالب .xlsx واملأ صفاً لكل حساب. البريد الفعال مطلوب لاستعادة كلمة المرور.', 'Tải mẫu .xlsx và điền một dòng cho mỗi tài khoản. Cần email đang dùng để khôi phục mật khẩu.'],
    'Alasan wajib diisi': ['A reason is required for every attendance activity and is recorded in the log and reports.', '每项考勤活动都必须填写原因，并记录在日志和报表中。', 'السبب مطلوب لكل نشاط حضور ويُسجّل في السجل والتقارير.', 'Bắt buộc nhập lý do cho mỗi hoạt động chấm công và sẽ được ghi vào nhật ký và báo cáo.'],
    'Wajib diisi. Contoh': ['Required. Example: start of morning shift, lunch break, personal matter, toilet, or end of shift.', '必填。例如：早班开始、午休、私事、洗手间或下班。', 'إلزامي. مثال: بدء الوردية الصباحية، استراحة الغداء، أمر شخصي، الحمام، أو نهاية الوردية.', 'Bắt buộc. Ví dụ: bắt đầu ca sáng, nghỉ ăn trưa, việc cá nhân, đi vệ sinh hoặc hết ca.'],
    'Absensi tidak bisa dikirim': ['Attendance cannot be submitted before the photo is captured.', '拍照成功前无法提交考勤。', 'لا يمكن إرسال الحضور قبل التقاط الصورة.', 'Không thể gửi chấm công trước khi chụp ảnh thành công.'],
    'Penghapusan bersifat permanen': ['Deletion is permanent in this browser. Choose one store/employee or delete all history.', '删除在此浏览器中是永久性的。请选择一个门店/员工或删除全部记录。', 'الحذف دائم في هذا المتصفح. اختر متجراً/موظفاً أو احذف كل السجل.', 'Việc xóa là vĩnh viễn trên trình duyệt này. Chọn một cửa hàng/nhân viên hoặc xóa toàn bộ lịch sử.'],
    'Menampilkan tanggal, jam': ['Shows date, time, activity, and photo.', '显示日期、时间、活动和照片。', 'يعرض التاريخ والوقت والنشاط والصورة.', 'Hiển thị ngày, giờ, hoạt động và ảnh.'],
    'Tambahkan folder/menu': ['Add a folder/menu, link, or media for the selected roles. Max file size 5 MB. Form drafts are saved.', '为所选角色添加文件夹/菜单、链接或媒体。文件最大 5 MB。表单草稿会被保存。', 'أضف مجلداً/قائمة أو رابطاً أو وسائط للأدوار المحددة. الحد الأقصى للملف 5 ميجابايت. تُحفظ مسودات النموذج.', 'Thêm thư mục/menu, liên kết hoặc phương tiện cho vai trò đã chọn. Tệp tối đa 5 MB. Bản nháp biểu mẫu được lưu.'],
    'Tambahkan folder/menu, tautan, atau media untuk role yang dipilih. File maksimal 5 MB. Draft formulir disimpan di perangkat ini agar dapat dilanjutkan setelah refresh.': ['Add folders/menus, links, or media for selected roles. Files are limited to 5 MB. Form drafts are saved on this device and can be resumed after refresh.', '为选定角色添加文件夹/菜单、链接或媒体。文件最大 5 MB。表单草稿保存在此设备上，刷新后可继续。', 'أضف مجلدات/قوائم أو روابط أو وسائط للأدوار المحددة. الحد الأقصى للملفات 5 ميجابايت. تُحفظ المسودات على هذا الجهاز ويمكن متابعتها بعد التحديث.', 'Thêm thư mục/menu, liên kết hoặc nội dung cho vai trò đã chọn. Tệp tối đa 5 MB. Bản nháp được lưu trên thiết bị này và có thể tiếp tục sau khi tải lại.'],
    'Belum ada promo highlight': ['No highlight promos yet', '暂无精选促销', 'لا توجد عروض مميزة بعد', 'Chưa có khuyến mãi nổi bật'],
    'Belum ada promo atau informasi.': ['No promos or information yet.', '暂无促销或信息。', 'لا توجد عروض أو معلومات بعد.', 'Chưa có khuyến mãi hoặc thông tin.'],
    'Belum ada akun pengguna.': ['No user accounts yet.', '暂无用户账号。', 'لا توجد حسابات مستخدمين بعد.', 'Chưa có tài khoản người dùng.'],
    'Belum ada permintaan reset password.': ['No password reset requests yet.', '暂无密码重置请求。', 'لا توجد طلبات إعادة تعيين كلمة المرور بعد.', 'Chưa có yêu cầu đặt lại mật khẩu.'],
    'Folder masih kosong.': ['This folder is empty.', '此文件夹为空。', 'هذا المجلد فارغ.', 'Thư mục này đang trống.'],
    'Pilih file': ['Choose files', '选择文件', 'اختر الملفات', 'Chọn tệp'],
    'Simpan Upload': ['Save uploads', '保存上传内容', 'حفظ الملفات المرفوعة', 'Lưu tệp tải lên'],
    'Lengkapi dan verifikasi NIK unik setiap karyawan sebelum mencetak barcode baru. Kode internal lama tidak diubah agar riwayat absensi tetap terhubung.': ['Complete and verify each employee’s unique NIK before printing new barcodes. Existing internal codes remain unchanged so attendance history stays linked.', '打印新条码前，请补全并核实每位员工唯一的 NIK。旧内部代码保持不变，以继续关联考勤记录。', 'أكمل وتحقق من رقم NIK الفريد لكل موظف قبل طباعة رموز جديدة. ستبقى الرموز الداخلية القديمة كما هي للحفاظ على ارتباط سجل الحضور.', 'Hoàn tất và xác minh NIK duy nhất của từng nhân viên trước khi in mã vạch mới. Mã nội bộ cũ được giữ nguyên để liên kết lịch sử chấm công.'],
    'Menampilkan tanggal, jam, aktivitas, dan foto.': ['Shows date, time, activity, and photo.', '显示日期、时间、活动和照片。', 'يعرض التاريخ والوقت والنشاط والصورة.', 'Hiển thị ngày, giờ, hoạt động và ảnh.'],
    'Karyawan yang terhubung ke akun ini': ['Employees linked to this account', '关联到此账号的员工', 'الموظفون المرتبطون بهذا الحساب', 'Nhân viên được liên kết với tài khoản này'],
    '+ Tambah Karyawan': ['+ Add employee', '+ 添加员工', '+ إضافة موظف', '+ Thêm nhân viên'],
    'Template Excel berisi dua sheet: Akun Login dan Pendaftaran Karyawan. Isi ERO/Promotor pada kedua sheet dengan username yang sama. NIK karyawan bebas format; email hanya diperiksa formatnya, tidak diuji aktif/tidaknya. LOB, TSH, dan Store Leader didaftarkan lewat form manual agar scope tetap lengkap.': ['The Excel template has two sheets: Login Account and Employee Registration. Enter ERO/Promotor accounts on both sheets with the same username. Employee NIK can use any format; email syntax is checked, but mailbox activity is not verified. Register LOB, TSH, and Store Leader through the manual form so their scope is complete.', 'Excel 模板包含两个工作表：登录账号和员工注册。ERO/Promotor 账号需在两个表中使用相同用户名。员工 NIK 格式不限；系统仅检查邮箱格式，不验证邮箱是否有效。LOB、TSH 和 Store Leader 请通过手动表单注册，以填写完整权限范围。', 'يحتوي قالب Excel على ورقتين: حساب تسجيل الدخول وتسجيل الموظف. أدخل حسابات ERO/Promotor في الورقتين باسم المستخدم نفسه. تنسيق NIK للموظف غير مقيد؛ يتم فحص صيغة البريد فقط دون التحقق من نشاط صندوق البريد. سجّل LOB وTSH وStore Leader عبر النموذج اليدوي لاستكمال النطاق.', 'Mẫu Excel có hai sheet: Tài khoản đăng nhập và Đăng ký nhân viên. Nhập tài khoản ERO/Promotor ở cả hai sheet với cùng username. NIK nhân viên không giới hạn định dạng; chỉ kiểm tra cú pháp email, không xác minh hộp thư hoạt động. Đăng ký LOB, TSH và Store Leader bằng biểu mẫu thủ công để đủ phạm vi.'],
    'Barcode baru menggunakan NIK setelah semua karyawan dipetakan; kode lama tetap diterima. Scanner USB biasanya mengetik otomatis dan menekan Enter.': ['New barcodes use NIK once all employees are mapped; old codes remain accepted. USB scanners usually type automatically and press Enter.', '所有员工完成映射后，新条码将使用 NIK；旧代码仍可使用。USB 扫描器通常会自动输入并按 Enter。', 'تستخدم الرموز الجديدة رقم NIK بعد ربط جميع الموظفين؛ وتظل الرموز القديمة مقبولة. عادةً ما تكتب ماسحات USB تلقائياً ثم تضغط Enter.', 'Mã vạch mới dùng NIK sau khi đã ánh xạ tất cả nhân viên; mã cũ vẫn được chấp nhận. Máy quét USB thường tự nhập và nhấn Enter.'],
    'Reason / Alasan setiap absensi': ['Reason for each attendance entry', '每条考勤记录的原因', 'سبب كل تسجيل حضور', 'Lý do cho mỗi lần chấm công'],
    'Reason / Alasan': ['Reason', '原因', 'السبب', 'Lý do'],
    'Alasan wajib diisi untuk setiap aktivitas absensi dan akan masuk ke log serta laporan.': ['A reason is required for every attendance activity and will appear in logs and reports.', '每项考勤活动都必须填写原因，并将显示在日志和报表中。', 'يجب إدخال سبب لكل نشاط حضور وسيظهر في السجلات والتقارير.', 'Bắt buộc nhập lý do cho mỗi hoạt động chấm công; lý do sẽ xuất hiện trong nhật ký và báo cáo.'],
    'CSV dapat dibuka di Excel. Simpan cadangan JSON secara berkala agar data tidak hilang saat browser dibersihkan atau perangkat berganti.': ['CSV files can be opened in Excel. Save JSON backups regularly to avoid losing data when browser storage is cleared or devices change.', 'CSV 文件可在 Excel 中打开。请定期保存 JSON 备份，以免清除浏览器数据或更换设备时丢失数据。', 'يمكن فتح ملفات CSV في Excel. احفظ نسخ JSON احتياطية بانتظام لتجنب فقدان البيانات عند مسح المتصفح أو تغيير الجهاز.', 'Có thể mở CSV bằng Excel. Hãy sao lưu JSON định kỳ để tránh mất dữ liệu khi xóa dữ liệu trình duyệt hoặc đổi thiết bị.'],
    'Mulai bekerja': ['Start work', '开始工作', 'بدء العمل', 'Bắt đầu làm việc'],
    'Mulai istirahat': ['Start break', '开始休息', 'بدء الاستراحة', 'Bắt đầu nghỉ giải lao'],
    '🟢 Masuk': ['🟢 Clock in', '🟢 上班', '🟢 تسجيل الحضور', '🟢 Vào ca'],
    '☕ Keluar Istirahat': ['☕ Start break', '☕ 开始休息', '☕ بدء الاستراحة', '☕ Ra nghỉ'],
    '↩️ Masuk dari Istirahat': ['↩️ Return from break', '↩️ 结束休息', '↩️ العودة من الاستراحة', '↩️ Vào lại sau nghỉ'],
    '🏪 Izin Keluar Toko': ['🏪 Leave store temporarily', '🏪 临时离店', '🏪 مغادرة المتجر مؤقتاً', '🏪 Xin ra ngoài tạm thời'],
    '↩️ Masuk Setelah Izin': ['↩️ Return after leave', '↩️ 返回门店', '↩️ العودة بعد الإذن', '↩️ Vào lại sau khi ra ngoài'],
    '🚻 Izin ke Toilet': ['🚻 Toilet break', '🚻 去洗手间', '🚻 استراحة للحمام', '🚻 Đi vệ sinh'],
    '✅ Kembali dari Toilet': ['✅ Return from toilet', '✅ 返回洗手间', '✅ العودة من الحمام', '✅ Quay lại từ nhà vệ sinh'],
    'Tambahan untuk menghitung durasi toilet': ['Used to calculate toilet break duration', '用于计算如厕时长', 'يُستخدم لحساب مدة استراحة الحمام', 'Dùng để tính thời gian đi vệ sinh'],
    'Download ZIP folder': ['Download folder ZIP', '下载文件夹 ZIP', 'تنزيل ملف ZIP للمجلد', 'Tải ZIP thư mục'],
    'Password admin baru (minimal 12 karakter)': ['New admin password (min. 12 characters)', '新管理员密码（至少 12 个字符）', 'كلمة مرور المسؤول الجديدة (12 حرفاً على الأقل)', 'Mật khẩu quản trị mới (tối thiểu 12 ký tự)'],
    'Repeat new password': ['Repeat new password', '重复新密码', 'أعد كلمة المرور الجديدة', 'Nhập lại mật khẩu mới'],
    'Pilih alasan reject': ['Choose a rejection reason', '选择拒绝原因', 'اختر سبب الرفض', 'Chọn lý do từ chối'],
    'Pindah toko': ['Transferred to another store', '调往其他门店', 'نقل إلى متجر آخر', 'Chuyển cửa hàng'],
    'Resign': ['Resigned', '已离职', 'استقال', 'Đã nghỉ việc'],
    'Kode internal lama, mis. EA006': ['Legacy internal code, e.g. EA006', '旧内部代码，例如 EA006', 'الرمز الداخلي القديم، مثل EA006', 'Mã nội bộ cũ, ví dụ EA006'],
    'Lokasi belum diatur': ['Location not set', '尚未设置位置', 'لم يتم إعداد الموقع', 'Chưa cài đặt vị trí']
  };
  const exact = new Map(Object.entries(D));
  const prefixes = Object.keys(D).filter(k => k.length > 24).sort((a, b) => b.length - a.length);
  const IDX = { en: 0, zh: 1, ar: 2, vi: 3 };
  const originals = new WeakMap();
  const ATTRS = ['placeholder', 'title', 'aria-label', 'data-placeholder'];
  let lang = 'en';
  try { lang = localStorage.getItem('eraapps-lang') || 'en'; } catch (e) {}
  if (!LANGS[lang]) lang = 'en';
  let busy = false;

  function lookup(src) {
    const key = src.trim();
    if (!key) return null;
    let row = exact.get(key);
    if (!row) { const p = prefixes.find(k => key.startsWith(k)); if (p) row = exact.get(p); }
    return row || null;
  }
  function apply(node) {
    if (node.nodeType === 3) {
      const parent = node.parentElement;
      if (!parent || /^(SCRIPT|STYLE|TEXTAREA|TD)$/.test(parent.tagName) || parent.closest('[data-no-i18n],[contenteditable="true"]')) return;
      let rec = originals.get(node);
      if (!rec || (node.nodeValue !== rec.shown && node.nodeValue !== rec.src)) { rec = { src: node.nodeValue, shown: node.nodeValue }; originals.set(node, rec); }
      let next = rec.src;
      if (lang !== 'id') {
        const row = lookup(rec.src);
        if (row) next = rec.src.replace(rec.src.trim(), row[IDX[lang]] ?? row[0]);
      }
      if (node.nodeValue !== next) node.nodeValue = next;
      rec.shown = next;
    } else if (node.nodeType === 1) {
      if (node.closest && node.closest('[data-no-i18n]')) return;
      for (const a of ATTRS) {
        if (!node.hasAttribute(a)) continue;
        const key = 'i18n-' + a;
        if (!node.hasAttribute('data-' + key)) node.setAttribute('data-' + key, node.getAttribute(a));
        const src = node.getAttribute('data-' + key);
        const row = lang === 'id' ? null : lookup(src);
        const next = row ? (row[IDX[lang]] ?? row[0]) : src;
        if (node.getAttribute(a) !== next) node.setAttribute(a, next);
      }
      node.childNodes.forEach(apply);
    }
  }
  function run() {
    busy = true;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    apply(document.body);
    const label = document.getElementById('langLabel');
    if (label) label.textContent = UI[lang];
    busy = false;
  }
  function set(next) {
    if (!LANGS[next]) return;
    lang = next;
    try { localStorage.setItem('eraapps-lang', lang); } catch (e) {}
    run();
    const select = document.getElementById('langSelect');
    if (select) select.value = lang;
  }
  function buildMenu() {
    const style = document.createElement('style');
    style.textContent = '#logoutButton{position:fixed;top:10px;right:14px;z-index:10000;margin:0!important;min-width:40px;width:40px;height:38px;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;color:#fff!important;box-shadow:none!important;font-size:24px;line-height:1;display:grid;place-items:center}#logoutButton:hover,#logoutButton:active{background:transparent!important;filter:none;transform:none;box-shadow:none!important}#logoutButton[hidden],#rolePreviewButton[hidden]{display:none!important}#rolePreviewButton{position:fixed;top:10px;right:76px;z-index:10000;margin:0!important;padding:8px 4px!important;border:0!important;border-radius:0!important;background:transparent!important;color:#fff!important;box-shadow:none!important;font-weight:700}#rolePreviewButton:hover,#rolePreviewButton:active{background:transparent!important;filter:none;transform:none;box-shadow:none!important}#langMenu{position:fixed;top:54px;right:14px;z-index:10000;display:flex;flex-direction:column;align-items:center;gap:4px;color:#fff;font-family:Helvetica,Arial,sans-serif}' +
      '#langButton{position:relative;width:38px;height:38px;border:0;border-radius:0;background:transparent;box-shadow:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;padding:0;cursor:pointer;transition:none}' +
      '#langButton:hover,#langButton:active{filter:none;transform:none;box-shadow:none;background:transparent}' +
      '#langButton i{display:block;width:20px;height:2px;background:#fff}' +
      '#langLabel{font-size:11px;font-weight:700;line-height:19px;color:#fff;background:transparent;padding:0;border-radius:0}' +
      '#accountInfo{position:fixed;top:96px;right:84px;z-index:10000;max-width:min(220px,calc(100vw - 128px));padding:0;color:#fff;background:transparent;border:0;border-radius:0;font-size:11px;font-weight:700;line-height:19px;text-align:right;overflow-wrap:anywhere}#accountInfo[hidden]{display:none}' +
      '#loginCreditRow{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;margin:8px 0 16px}#loginCreditRow>p{flex:1;min-width:0;margin:0;color:#111;text-align:left}#loginCreditRow #langMenu{position:static;display:flex;flex-direction:column;align-items:center;gap:2px;color:#111;flex:none;transform:translateY(10px)}#loginCreditRow #langButton{width:34px;height:34px}#loginCreditRow #langButton i{background:#111}#loginCreditRow #langLabel{color:#111}' +
      '#langSelect{position:absolute;top:0;left:0;width:100%;height:100%;opacity:0;cursor:pointer}' +
      '#langButton{position:relative}';
    document.head.appendChild(style);
    const wrap = document.createElement('div');
    wrap.id = 'langMenu';
    wrap.setAttribute('data-no-i18n', '');
    wrap.innerHTML = '<div id="langButton" title="Language" aria-label="Language"><i></i><i></i><i></i><select id="langSelect" aria-label="Language"></select></div><span id="langLabel"></span>';
    const credit = document.querySelector('#loginBrand')?.nextElementSibling;
    if (credit?.parentElement) {
      const row = document.createElement('div');
      row.id = 'loginCreditRow';
      credit.parentElement.insertBefore(row, credit);
      row.append(credit, wrap);
    } else document.body.appendChild(wrap);
    const accountInfo = document.createElement('span');
    accountInfo.id = 'accountInfo';
    accountInfo.hidden = true;
    accountInfo.setAttribute('data-no-i18n', '');
    document.body.appendChild(accountInfo);
    const select = wrap.querySelector('select');
    Object.entries(LANGS).forEach(([code, name]) => { const o = document.createElement('option'); o.value = code; o.textContent = name; select.appendChild(o); });
    select.value = lang;
    select.addEventListener('change', () => set(select.value));
  }
  window.EraI18n = { set, get: () => lang, t: s => { const r = lang === 'id' ? null : lookup(s); return r ? r[IDX[lang]] : s; } };
  document.addEventListener('DOMContentLoaded', () => {
    buildMenu();
    run();
    new MutationObserver(muts => {
      if (busy) return;
      busy = true;
      try { muts.forEach(m => { if (m.type === 'characterData') apply(m.target); else m.addedNodes.forEach(apply); if (m.type === 'attributes') apply(m.target); }); } finally { busy = false; }
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  });
})();
