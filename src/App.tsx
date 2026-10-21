/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { 
  ScanLine, 
  UserCheck, 
  ArrowLeftRight, 
  CalendarDays, 
  Users, 
  FileSpreadsheet, 
  CreditCard, 
  ShieldCheck, 
  Wifi, 
  Smartphone,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Info,
  BookOpen,
  Trash2,
  Camera,
  Upload,
  Cloud,
  RefreshCw
} from 'lucide-react';
import { AttendanceRecord, DepartmentPassRecord, Employee, RoomBooking, TrainingSession } from './types';
import { INITIAL_EMPLOYEES, PRESET_ROOMS } from './data/mockEmployees';
import { TrainingAttendanceView } from './components/TrainingAttendanceView';
import { DepartmentPassView } from './components/DepartmentPassView';
import { MeetingRoomBookingView } from './components/MeetingRoomBookingView';
import { EmployeeManagerView } from './components/EmployeeManagerView';
import { BarcodeScannerModal } from './components/BarcodeScannerModal';
import { VirtualCardModal } from './components/VirtualCardModal';
import { ProductionGuideModal } from './components/ProductionGuideModal';
import { NVLogo } from './components/NVLogo';
import { soundFX } from './utils/audio';
import { verifyAdminAction } from './utils/adminAuth';
import {
  subscribeToCompanyLogo,
  saveCompanyLogoToCloud,
  subscribeToEmployees,
  saveEmployeesToCloud,
  updateSingleEmployeePhotoInCloud,
  clearAllEmployeesInCloud,
  subscribeToTrainingSessions,
  saveTrainingSessionToCloud,
  subscribeToAttendanceRecords,
  saveAttendanceRecordToCloud,
  clearAttendanceRecordsInCloud,
  subscribeToDepartmentPasses,
  saveDepartmentPassToCloud,
  subscribeToRoomBookings,
  saveRoomBookingToCloud
} from './services/firebaseSync';

type ActiveTab = 'attendance' | 'department_pass' | 'room_booking' | 'employees';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('attendance');

  // Employees data (persisted in localStorage)
  const [employees, setEmployees] = useState<Employee[]>(() => {
    try {
      const saved = localStorage.getItem('smartfactory_prod_roster');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Nếu bộ nhớ tạm có đủ từ 5000 người trở lên thì mới lấy, nếu ít hơn 5000 người thì bỏ qua lấy gốc!
        if (Array.isArray(parsed) && parsed.length >= 5000) return parsed;
      }
    } catch {
      // ignore
    }
    // MẶC ĐỊNH LUÔN LẤY ĐỦ 100% 5.379 NGƯỜI
    return INITIAL_EMPLOYEES;
  });

  useEffect(() => {
    localStorage.setItem('smartfactory_prod_roster', JSON.stringify(employees));
  }, [employees]);

  // Sessions for training & meetings (starts clean, created as needed)
  const [sessions, setSessions] = useState<TrainingSession[]>(() => {
    try {
      const saved = localStorage.getItem('smartfactory_prod_sessions');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('smartfactory_prod_sessions', JSON.stringify(sessions));
  }, [sessions]);

  const [activeSessionId, setActiveSessionId] = useState<string>(sessions[0]?.id || '');

  // Keep activeSessionId in sync with sessions
  useEffect(() => {
    if (!activeSessionId && sessions.length > 0) {
      setActiveSessionId(sessions[0].id);
    }
  }, [sessions, activeSessionId]);

  // Attendance Records (starts clean)
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(() => {
    try {
      const saved = localStorage.getItem('smartfactory_prod_attendance');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('smartfactory_prod_attendance', JSON.stringify(attendanceRecords));
  }, [attendanceRecords]);

  // Inter-department Passes (starts clean)
  const [passes, setPasses] = useState<DepartmentPassRecord[]>(() => {
    try {
      const saved = localStorage.getItem('smartfactory_prod_passes');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('smartfactory_prod_passes', JSON.stringify(passes));
  }, [passes]);

  // Room Bookings (starts clean)
  const [bookings, setBookings] = useState<RoomBooking[]>(() => {
    try {
      const saved = localStorage.getItem('smartfactory_prod_bookings');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('smartfactory_prod_bookings', JSON.stringify(bookings));
  }, [bookings]);

  // 1. Tự động đồng bộ từ Máy Chủ Local khi web vừa mở lên (trên cả PC và Điện thoại)
  useEffect(() => {
    // Tải danh sách công nhân
    fetch('/api/local/employees')
      .then(res => res.json())
      .then((data: Employee[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setEmployees(data);
          localStorage.setItem('smartfactory_prod_roster', JSON.stringify(data));
        }
      })
      .catch(console.error);

    // Tải lịch sử điểm danh
    fetch('/api/local/attendance')
      .then(res => res.json())
      .then((data: AttendanceRecord[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setAttendanceRecords(data);
        }
      })
      .catch(console.error);

    // Tải danh sách ra vào xưởng
    fetch('/api/local/passes')
      .then(res => res.json())
      .then((data: DepartmentPassRecord[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setPasses(data);
        }
      })
      .catch(console.error);
  }, []);

  // Scanner Modal Controller
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerMode, setScannerMode] = useState<
    | { type: 'attendance'; sessionId: string }
    | { type: 'department_pass'; fromDept: string; toDept: string; reason: string; passType: 'check_in' | 'check_out' }
    | { type: 'room_booking'; roomId: string; date: string }
    | { type: 'room_check_in'; bookingId: string }
    | null
  >(null);

  // Virtual Card Modal Controller
  const [cardModalEmployee, setCardModalEmployee] = useState<Employee | null>(null);

  // Production Guide Modal Controller
  const [showGuideModal, setShowGuideModal] = useState(false);

  // Cloud sync indicator
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);

  // Company Logo (persisted in localStorage + Cloud Firestore)
  const [customLogo, setCustomLogo] = useState<string | null>(() => {
    try {
      return localStorage.getItem('smartfactory_custom_logo') || null;
    } catch {
      return null;
    }
  });

  const logoInputRef = useRef<HTMLInputElement | null>(null);

  // 1. Initial Migration: Chỉ giữ logo nếu có, không tự ý bơm roster cũ lên Cloud
  useEffect(() => {
    const localLogo = localStorage.getItem('smartfactory_custom_logo');
    if (localLogo) {
      saveCompanyLogoToCloud(localLogo).catch(console.error);
    }
  }, []);

  // 2. Real-time Cloud Subscriptions across all devices
  useEffect(() => {
    // Listen to Company Logo
    const unsubLogo = subscribeToCompanyLogo((cloudLogo) => {
      if (cloudLogo !== undefined) {
        setCustomLogo(cloudLogo);
        if (cloudLogo) {
          localStorage.setItem('smartfactory_custom_logo', cloudLogo);
        } else {
          localStorage.removeItem('smartfactory_custom_logo');
        }
      }
    });

    // Listen to Employees Roster (CHỐNG NHÁY VÀ CHỐNG ĐÈ MẤT 4.000 NGƯỜI)
    const unsubEmployees = subscribeToEmployees((cloudEmployees) => {
      // Chỉ nhận từ Cloud nếu Cloud có đầy đủ (từ 5.000 người trở lên), không nhận nếu Cloud bị thiếu!
      if (cloudEmployees && cloudEmployees.length >= 5000) {
        setEmployees(cloudEmployees);
        localStorage.setItem('smartfactory_prod_roster', JSON.stringify(cloudEmployees));
      }
    });

    // Listen to Training Sessions
    const unsubSessions = subscribeToTrainingSessions((cloudSessions) => {
      if (cloudSessions && cloudSessions.length > 0) {
        setSessions(cloudSessions);
      }
    });

    // Listen to Attendance Records
    const unsubAttendance = subscribeToAttendanceRecords((cloudRecords) => {
      if (cloudRecords && cloudRecords.length > 0) {
        setAttendanceRecords(cloudRecords);
      }
    });

    // Listen to Department Passes
    const unsubPasses = subscribeToDepartmentPasses((cloudPasses) => {
      if (cloudPasses && cloudPasses.length > 0) {
        setPasses(cloudPasses);
      }
    });

    // Listen to Meeting Room Bookings
    const unsubBookings = subscribeToRoomBookings((cloudBookings) => {
      if (cloudBookings && cloudBookings.length > 0) {
        setBookings(cloudBookings);
      }
    });

    return () => {
      unsubLogo();
      unsubEmployees();
      unsubSessions();
      unsubAttendance();
      unsubPasses();
      unsubBookings();
    };
  }, []);

  const handleUpdateLogo = async (newLogoUrl: string | null) => {
    setCustomLogo(newLogoUrl);
    if (newLogoUrl) {
      localStorage.setItem('smartfactory_custom_logo', newLogoUrl);
      showToast('info', 'Đang đồng bộ logo lên máy chủ đám mây...');
      try {
        await saveCompanyLogoToCloud(newLogoUrl);
        showToast('success', 'Đã đồng bộ logo đám mây thành công!', 'Mọi điện thoại và máy tính khác vào web đều sẽ thấy logo mới.');
      } catch (err) {
        console.error('Failed to sync logo to cloud:', err);
      }
    } else {
      localStorage.removeItem('smartfactory_custom_logo');
      try {
        await saveCompanyLogoToCloud(null);
        showToast('info', 'Đã đặt lại logo mặc định toàn hệ thống.');
      } catch (err) {
        console.error('Failed to reset logo in cloud:', err);
      }
    }
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!verifyAdminAction('Thay đổi Logo công ty')) {
      if (logoInputRef.current) logoInputRef.current.value = '';
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('warning', 'Định dạng không hợp lệ', 'Vui lòng chọn file hình ảnh (PNG, JPG, SVG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        handleUpdateLogo(dataUrl);
      }
    };
    reader.readAsDataURL(file);
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  // Toast
  const [toast, setToast] = useState<{
    type: 'success' | 'warning' | 'info';
    message: string;
    details?: string;
  } | null>(null);

  const showToast = (type: 'success' | 'warning' | 'info', message: string, details?: string) => {
    setToast({ type, message, details });
    setTimeout(() => setToast(null), 4000);
  };

  // Cloud-aware Employee List Update
  const handleSetEmployees: React.Dispatch<React.SetStateAction<Employee[]>> = (action) => {
    setEmployees(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      
      // Lưu tức thì về Máy Chủ Local (lưu thành file trên ổ cứng máy bạn)
      fetch('/api/local/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next)
      })
      .then(() => {
        showToast('success', 'Đã lưu vào máy chủ thành công!', `Tất cả điện thoại kết nối vào web sẽ tự động nhận ${next.length} công nhân viên.`);
      })
      .catch(err => console.error('Lỗi lưu local server:', err));

      return next;
    });
  };

  const handleWipeAllProductionData = async () => {
    if (!verifyAdminAction('Xoá sạch toàn bộ dữ liệu hệ thống')) return;
    if (confirm('XÁC NHẬN: Bạn có chắc chắn muốn xoá sạch toàn bộ dữ liệu (công nhân, điểm danh, ra vào, đặt phòng) trên TẤT CẢ các thiết bị để bắt đầu từ số 0 không?')) {
      localStorage.removeItem('smartfactory_prod_roster');
      localStorage.removeItem('smartfactory_prod_sessions');
      localStorage.removeItem('smartfactory_prod_attendance');
      localStorage.removeItem('smartfactory_prod_passes');
      localStorage.removeItem('smartfactory_prod_bookings');
      setEmployees([]);
      setSessions([]);
      setAttendanceRecords([]);
      setPasses([]);
      setBookings([]);
      setActiveSessionId('');
      try {
        await clearAllEmployeesInCloud();
        await clearAttendanceRecordsInCloud();
      } catch (e) {
        console.error('Error clearing cloud data:', e);
      }
      soundFX.playScanSuccess();
      showToast('success', 'Đã xoá sạch toàn bộ dữ liệu toàn hệ thống!', 'Hệ thống đã sẵn sàng 100% cho vận hành chính thức.');
      setShowGuideModal(false);
    }
  };

  const handleUpdateEmployeePhoto = async (employeeCode: string, photoUrl: string | null) => {
    setEmployees(prev => prev.map(e => {
      if (e.Employee_Code === employeeCode) {
        return { ...e, Photo_Url: photoUrl || undefined };
      }
      return e;
    }));
    try {
      await updateSingleEmployeePhotoInCloud(employeeCode, photoUrl);
      showToast('success', 'Đã đồng bộ ảnh thẻ lên máy chủ đám mây!');
    } catch (err) {
      console.error('Failed to sync employee photo to cloud:', err);
    }
  };

  const handleOpenScannerForAttendance = (sessionId: string) => {
    setScannerMode({ type: 'attendance', sessionId });
    setScannerOpen(true);
  };

  const handleOpenScannerForPass = (config: {
    fromDept: string;
    toDept: string;
    reason: string;
    passType: 'check_in' | 'check_out';
  }) => {
    setScannerMode({ type: 'department_pass', ...config });
    setScannerOpen(true);
  };

  const handleOpenScannerForRoomBooking = (roomId: string, date: string) => {
    setScannerMode({ type: 'room_booking', roomId, date });
    setScannerOpen(true);
  };

  const handleOpenScannerForRoomCheckIn = (bookingId: string) => {
    setScannerMode({ type: 'room_check_in', bookingId });
    setScannerOpen(true);
  };

  const handleBarcodeScanned = (scannedCode: string, matchedEmployee?: Employee) => {
    const code = scannedCode.trim();
    const now = new Date();
    const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateStr = now.toISOString().split('T')[0];

    const empName = matchedEmployee 
      ? matchedEmployee.Full_Name || `${matchedEmployee.Name} ${matchedEmployee.Surname}`.trim()
      : `Công nhân #${code}`;

    const empDept = matchedEmployee?.Department_Eng || 'Nhà máy';
    const empFactory = matchedEmployee?.Factory_Code || 'Factory 1';
    const empPosition = matchedEmployee?.Position_Eng || 'Công nhân viên';

    // 1. Process Attendance
    if (scannerMode?.type === 'attendance') {
      const sessionId = scannerMode.sessionId;
      const targetSession = sessions.find(s => s.id === sessionId) || sessions[0];

      const alreadyChecked = attendanceRecords.some(
        r => r.sessionId === targetSession.id && r.employeeCode.trim().toLowerCase() === code.trim().toLowerCase()
      );

      if (alreadyChecked) {
        soundFX.playWarning();
        showToast('warning', 'Đã điểm danh trước đó!', `${empName} (Mã: ${code}) đã có trong danh sách.`);
        return;
      }

      const newRecord: AttendanceRecord = {
        id: `att_${Date.now()}`,
        sessionId: targetSession.id,
        sessionTitle: targetSession.title,
        employeeCode: code,
        employeeName: empName,
        department: empDept,
        factory: empFactory,
        position: empPosition,
        scanTime: timeStr,
        date: dateStr,
        method: 'camera_scan'
      };

      setAttendanceRecords(prev => [newRecord, ...prev]);
      saveAttendanceRecordToCloud(newRecord).catch(console.error);
      soundFX.playScanSuccess();
      showToast('success', 'Điểm danh thành công!', `${empName} (${empPosition} • ${empDept}) lúc ${timeStr}`);
      return;
    }

    // 2. Process Department Pass
    if (scannerMode?.type === 'department_pass') {
      const { fromDept, toDept, reason, passType } = scannerMode;

      const newPass: DepartmentPassRecord = {
        id: `pass_${Date.now()}`,
        employeeCode: code,
        employeeName: empName,
        employeeDepartment: empDept,
        employeePosition: empPosition,
        fromDepartment: fromDept,
        toDepartment: toDept,
        reason: reason,
        passType: passType,
        timestamp: timeStr,
        date: dateStr,
        status: passType === 'check_in' ? 'active' : 'returned'
      };

      setPasses(prev => [newPass, ...prev]);
      saveDepartmentPassToCloud(newPass).catch(console.error);
      soundFX.playScanSuccess();
      showToast(
        'success', 
        `Ghi nhận ${passType === 'check_in' ? 'VÀO' : 'RA'} bộ phận thành công!`,
        `${empName} (${code}) • ${fromDept} → ${toDept}`
      );
      return;
    }

    // 3. Process Room Booking (CODE MỚI CHUẨN XỊN: CHỈ LẤY THÔNG TIN ĐIỀN VÀO FORM)
    if (scannerMode?.type === 'room_booking') {
      soundFX.playScanSuccess();
      showToast(
        'success', 
        'Nhận diện thẻ thành công!', 
        `Đã lấy thông tin: ${empName} (${code} - ${empDept}). Vui lòng nhập nội dung và chọn giờ họp.`
      );
      setScannerOpen(false);
      return;
    }

    // 4. Process Room Check-in
    if (scannerMode?.type === 'room_check_in') {
      setBookings(prev => prev.map(b => {
        if (b.id === scannerMode.bookingId) {
          const updated = {
            ...b,
            status: 'checked_in' as const,
            checkedInAt: timeStr
          };
          saveRoomBookingToCloud(updated).catch(console.error);
          return updated;
        }
        return b;
      }));
      soundFX.playScanSuccess();
      showToast('success', 'Check-in phòng họp thành công!', `${empName} đã xác nhận nhận phòng lúc ${timeStr}`);
      setScannerOpen(false);
      return;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans selection:bg-blue-600 selection:text-white pb-20 sm:pb-8">
      {/* Top Navbar */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 px-2 py-1 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-center">
              <NVLogo className="h-7 w-auto max-w-[120px]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-base sm:text-lg tracking-tight text-slate-900">
                  NV APPAREL
                </span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  Smart Pass
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
                Hệ Thống Quét Barcode Thẻ Thay Thế Giấy Ký Tên & Check-In
              </p>
            </div>
          </div>

          {/* Cloud Sync & Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Realtime Cloud Sync Live Badge */}
            <div 
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-xs ${
                isCloudSyncing 
                  ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              }`}
              title="Dữ liệu được tự động đồng bộ thời gian thực qua máy chủ Cloud Firestore"
            >
              {isCloudSyncing ? (
                <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin" />
              ) : (
                <Cloud className="w-3.5 h-3.5 text-emerald-600" />
              )}
              <span className="hidden md:inline">
                {isCloudSyncing ? 'Đang đồng bộ đám mây...' : 'Đồng Bộ Đám Mây Mọi Thiết Bị'}
              </span>
              <span className="md:hidden">
                {isCloudSyncing ? 'Đang lưu...' : 'Cloud Live'}
              </span>
            </div>

            <button
              onClick={() => setShowGuideModal(true)}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs active:scale-98"
              title="Xem hướng dẫn triển khai thực tế tại nhà máy và cách dùng trên điện thoại"
            >
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Hướng Dẫn Vận Hành</span>
              <span className="sm:hidden">Hướng Dẫn</span>
            </button>
          </div>
        </div>

        {/* Desktop Tab Bar */}
        <div className="max-w-7xl mx-auto px-4 hidden sm:flex items-center gap-1 border-t border-slate-100 overflow-x-auto text-xs">
          <button
            onClick={() => setActiveTab('attendance')}
            className={`py-3 px-4 font-bold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'attendance'
                ? 'border-blue-600 text-blue-700 bg-blue-50/60'
                : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Điểm Danh Đào Tạo & Họp</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-mono font-bold">
              {attendanceRecords.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('department_pass')}
            className={`py-3 px-4 font-bold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'department_pass'
                ? 'border-emerald-600 text-emerald-800 bg-emerald-50/60'
                : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <ArrowLeftRight className="w-4 h-4" />
            <span>Check-In / Out Bộ Phận</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono font-bold">
              {passes.filter(p => p.status === 'active').length} đang ở xưởng
            </span>
          </button>

          <button
            onClick={() => setActiveTab('room_booking')}
            className={`py-3 px-4 font-bold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'room_booking'
                ? 'border-indigo-600 text-indigo-700 bg-indigo-50/60'
                : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            <span>Đặt Phòng Họp (Hạ Long & Bà Nà)</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-mono font-bold">
              {bookings.filter(b => b.status !== 'cancelled' && b.status !== 'completed').length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('employees')}
            className={`py-3 px-4 font-bold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'employees'
                ? 'border-purple-600 text-purple-700 bg-purple-50/60'
                : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Danh Sách Công Nhân & Excel</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-mono font-bold">
              {employees.length}
            </span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {activeTab === 'attendance' && (
          <TrainingAttendanceView
            employees={employees}
            sessions={sessions}
            setSessions={setSessions}
            attendanceRecords={attendanceRecords}
            setAttendanceRecords={setAttendanceRecords}
            activeSessionId={activeSessionId}
            setActiveSessionId={setActiveSessionId}
            onOpenScanner={handleOpenScannerForAttendance}
          />
        )}

        {activeTab === 'department_pass' && (
          <DepartmentPassView
            employees={employees}
            passes={passes}
            setPasses={setPasses}
            onOpenScannerForPass={handleOpenScannerForPass}
          />
        )}

        {activeTab === 'room_booking' && (
          <MeetingRoomBookingView
            employees={employees}
            bookings={bookings}
            setBookings={setBookings}
            onOpenScannerForRoomBooking={handleOpenScannerForRoomBooking}
            onOpenScannerForRoomCheckIn={handleOpenScannerForRoomCheckIn}
          />
        )}

        {activeTab === 'employees' && (
          <EmployeeManagerView
            employees={employees}
            setEmployees={handleSetEmployees}
            onViewCard={(emp) => setCardModalEmployee(emp)}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/98 backdrop-blur-md border-t border-slate-200 flex items-center justify-around py-2 px-1 shadow-lg">
        <button
          onClick={() => setActiveTab('attendance')}
          className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl text-[10px] font-bold transition-colors ${
            activeTab === 'attendance' ? 'text-blue-600' : 'text-slate-500'
          }`}
        >
          <UserCheck className="w-5 h-5" />
          <span>Điểm danh</span>
        </button>

        <button
          onClick={() => setActiveTab('department_pass')}
          className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl text-[10px] font-bold transition-colors ${
            activeTab === 'department_pass' ? 'text-emerald-700' : 'text-slate-500'
          }`}
        >
          <ArrowLeftRight className="w-5 h-5" />
          <span>Check-in/Out</span>
        </button>

        <button
          onClick={() => {
            if (activeTab === 'attendance') {
              handleOpenScannerForAttendance(activeSessionId);
            } else if (activeTab === 'department_pass') {
              handleOpenScannerForPass({
                fromDept: 'Phòng Kỹ Thuật May & Bảo Trì (Maintenance)',
                toDept: 'Xưởng 1 (Factory 1 - May)',
                reason: 'Bảo trì máy',
                passType: 'check_in'
              });
            } else {
              handleOpenScannerForRoomBooking('vinh_ha_long', new Date().toISOString().split('T')[0]);
            }
          }}
          className="w-12 h-12 -mt-5 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/35 active:scale-95 transition-transform"
        >
          <ScanLine className="w-6 h-6 animate-pulse" />
        </button>

        <button
          onClick={() => setActiveTab('room_booking')}
          className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl text-[10px] font-bold transition-colors ${
            activeTab === 'room_booking' ? 'text-blue-600' : 'text-slate-500'
          }`}
        >
          <CalendarDays className="w-5 h-5" />
          <span>Phòng họp</span>
        </button>

        <button
          onClick={() => setActiveTab('employees')}
          className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl text-[10px] font-bold transition-colors ${
            activeTab === 'employees' ? 'text-blue-600' : 'text-slate-500'
          }`}
        >
          <Users className="w-5 h-5" />
          <span>Công nhân</span>
        </button>
      </nav>

      {/* Barcode Scanner Camera Modal */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanSuccess={handleBarcodeScanned}
        employees={employees}
        title={
          scannerMode?.type === 'attendance' ? 'Quét Thẻ Điểm Danh Tham Dự' :
          scannerMode?.type === 'department_pass' ? 'Quét Thẻ Ra/Vào Bộ Phận' :
          scannerMode?.type === 'room_booking' ? 'Quét Thẻ Người Đặt Phòng Họp' : 'Quét Thẻ Nhận Phòng Họp'
        }
        subtitle={
          scannerMode?.type === 'attendance' ? 'Hướng camera vào mã vạch trên thẻ công nhân viên' :
          scannerMode?.type === 'department_pass' ? 'Ghi nhận vị trí và thời gian di chuyển qua lại xưởng' :
          scannerMode?.type === 'room_booking' ? 'Tự động điền mã số, họ tên và bộ phận' : 'Xác nhận mở phòng họp'
        }
      />

      {/* Virtual Badge Card Modal */}
      <VirtualCardModal
        isOpen={!!cardModalEmployee}
        onClose={() => setCardModalEmployee(null)}
        employee={cardModalEmployee}
        onUpdateEmployeePhoto={handleUpdateEmployeePhoto}
        customLogo={customLogo}
        onUpdateLogo={handleUpdateLogo}
      />

      {/* Production Guide & System Reset Modal */}
      <ProductionGuideModal
        isOpen={showGuideModal}
        onClose={() => setShowGuideModal(false)}
        onWipeData={handleWipeAllProductionData}
        employeeCount={employees.length}
        sessionCount={sessions.length}
        attendanceCount={attendanceRecords.length}
        passCount={passes.length}
        bookingCount={bookings.length}
      />

      {/* Toast Notification Alert */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 max-w-sm w-full bg-white border border-slate-200 rounded-2xl p-4 shadow-xl flex items-start gap-3 animate-in slide-in-from-top-4 duration-200">
          {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />}
          {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />}
          {toast.type === 'info' && <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />}
          <div className="flex-1 min-w-0">
            <h4 className="font-extrabold text-xs text-slate-900">{toast.message}</h4>
            {toast.details && (
              <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                {toast.details}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
