/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  ScanLine, 
  Plus, 
  FileSpreadsheet, 
  Users, 
  Clock, 
  Calendar, 
  Search, 
  CheckCircle2, 
  Trash2, 
  Filter, 
  MapPin, 
  Image as ImageIcon, 
  Keyboard, 
  Camera 
} from 'lucide-react';
import { translations, Language } from '../i18n/translations';
import { AttendanceRecord, Employee, TrainingSession, maskEmployeeCode, RoomBooking } from '../types';
import { exportAttendanceToExcel } from '../utils/exportExcel';
import { deleteAttendanceRecordInCloud, deleteTrainingSessionInCloud, saveTrainingSessionToCloud } from '../services/firebaseSync';
import { soundFX } from '../utils/audio';

interface TrainingAttendanceViewProps {
  employees: Employee[];
  onOpenScanner: (sessionId: string) => void;
  sessions: TrainingSession[];
  setSessions: React.Dispatch<React.SetStateAction<TrainingSession[]>>;
  attendanceRecords: AttendanceRecord[];
  setAttendanceRecords: React.Dispatch<React.SetStateAction<AttendanceRecord[]>>;
  activeSessionId: string;
  setActiveSessionId: (id: string) => void;
  bookings?: RoomBooking[];
  lang?: Language;
}

export const TrainingAttendanceView: React.FC<TrainingAttendanceViewProps> = ({
  employees,
  onOpenScanner,
  sessions,
  setSessions,
  attendanceRecords,
  setAttendanceRecords,
  activeSessionId,
  setActiveSessionId,
  bookings,
  lang = 'vi'
}) => {
  const t = translations[lang];
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('all');

  // Form state for creating new session
  const [newTitle, setNewTitle] = useState('');
  const [newInstructor, setNewInstructor] = useState('');
  const [newInstructorCode, setNewInstructorCode] = useState('');
  const [customTypeName, setCustomTypeName] = useState('');
  const [selectedLocationType, setSelectedLocationType] = useState('Phòng Họp Vịnh Hạ Long (NV1)');
  const [customLocationName, setCustomLocationName] = useState('');
  const [newType, setNewType] = useState<'training' | 'meeting' | 'safety' | 'other'>('training');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newStartTime, setNewStartTime] = useState('08:30');
  const [newEndTime, setNewEndTime] = useState('10:00');

  const currentSession = sessions.find(s => s.id === activeSessionId) || sessions[0];
  
  // Ca điểm danh hiện tại đang chọn trên banner
  const activeShift = currentSession?.currentShift || 'Ca Sáng';

  // CHỈ LẤY BẢN GHI ĐIỂM DANH THUỘC ĐÚNG CA ĐANG CHỌN NÀY
  const currentRecords = useMemo(() => {
    if (!currentSession) return [];
    return attendanceRecords.filter(r => 
      r.sessionId === currentSession.id && 
      (r.attendanceShift || 'Ca Sáng') === activeShift
    );
  }, [attendanceRecords, currentSession, activeShift]);

  const filteredRecords = currentRecords.filter(r => {
    const matchSearch = r.employeeName.toLowerCase().includes(searchFilter.toLowerCase()) ||
                        r.employeeCode.includes(searchFilter) ||
                        r.department.toLowerCase().includes(searchFilter.toLowerCase());
    const matchDept = selectedDeptFilter === 'all' || r.department === selectedDeptFilter;
    return matchSearch && matchDept;
  });

  // HÀM BẬT / TẮT KHÓA ĐIỂM DANH (SONG NGỮ HOÀN TOÀN)
  const handleToggleAttendanceOpen = async (session: TrainingSession) => {
    const isCurrentlyOpen = session.isAttendanceOpen ?? false;
    const actionText = isCurrentlyOpen 
      ? (lang === 'th' ? 'ปิดระบบลงชื่อ' : 'KHÓA (KẾT THÚC) ĐIỂM DANH') 
      : (lang === 'th' ? 'เปิดระบบลงชื่อ' : 'MỞ KHÓA ĐIỂM DANH');

    const promptMsg = lang === 'th'
      ? `🔐 ความปลอดภัย: ${actionText}\n\nการประชุม: "${session.title}"\nประธาน: ${session.instructor}\n\nกรุณาป้อนรหัสบัตรของประธาน หรือรหัสผู้ดูแลระบบ (8888):`
      : `🔐 BẢO MẬT ${actionText}\n\nBuổi họp: "${session.title}"\nNgười chủ trì: ${session.instructor}\n\nĐể ${actionText.toLowerCase()}, vui lòng nhập MÃ THẺ của Người chủ trì hoặc Mật khẩu Quản trị:`;

    const promptInput = prompt(promptMsg);
    if (promptInput === null) return;

    const cleanInput = promptInput.trim().toLowerCase();
    const isAdmin = cleanInput === '8888';

    let isAuthorized = isAdmin;

    if (!isAuthorized) {
      if (session.instructorCode && cleanInput === session.instructorCode.trim().toLowerCase()) {
        isAuthorized = true;
      } else {
        const foundEmp = employees.find(
          e => e.Employee_Code.trim().toLowerCase() === cleanInput
        );

        if (foundEmp) {
          const empFullName = (foundEmp.Full_Name || `${foundEmp.Name} ${foundEmp.Surname}`).trim().toLowerCase();
          const targetInstructor = session.instructor.trim().toLowerCase();

          const removeAccents = (str: string) => 
            str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');

          const cleanEmpName = removeAccents(empFullName);
          const cleanInstructor = removeAccents(targetInstructor);

          if (cleanEmpName.includes(cleanInstructor) || cleanInstructor.includes(cleanEmpName)) {
            isAuthorized = true;
          }
        }
      }
    }

    if (!isAuthorized) {
      soundFX.playError();
      alert(lang === 'th'
        ? `❌ ยืนยันตัวตนไม่สำเร็จ!\n\nรหัสบัตรที่ป้อนไม่ตรงกับประธาน (${session.instructor})\nคุณไม่มีสิทธิ์เปิด/ปิดระบบลงชื่อสำหรับรายการนี้`
        : `❌ XÁC THỰC THẤT BẠI!\n\nMã thẻ vừa nhập không trùng khớp với Người chủ trì (${session.instructor}).\nBạn không có quyền Mở/Khóa điểm danh cho buổi này.`
      );
      return;
    }

    const nextState = !isCurrentlyOpen;
    const updatedSession: TrainingSession = {
      ...session,
      isAttendanceOpen: nextState
    };

    setSessions(prev => prev.map(s => s.id === session.id ? updatedSession : s));
    await saveTrainingSessionToCloud(updatedSession);

    soundFX.playScanSuccess();
    const shiftDisplayName = session.currentShift === 'Ca Chiều' ? (lang === 'th' ? 'รอบบ่าย' : 'Ca Chiều') : (lang === 'th' ? 'รอบเช้า' : 'Ca Sáng');
    alert(nextState 
      ? (lang === 'th' 
          ? `🟢 เปิดระบบลงชื่อสำเร็จแล้ว!\nพนักงานสามารถสแกนบาร์โค้ดบัตรเพื่อลงชื่อ [${shiftDisplayName}] ได้แล้ว`
          : `🟢 ĐÃ MỞ ĐIỂM DANH THÀNH CÔNG!\nBây giờ công nhân viên có thể quét mã vạch thẻ để điểm danh [${shiftDisplayName}].`)
      : (lang === 'th'
          ? `🔒 ปิดระบบลงชื่อเรียบร้อยแล้ว!\nระบบหยุดรับการลงชื่อสำหรับรายการนี้แล้ว`
          : `🔒 ĐÃ KHÓA ĐIỂM DANH!\nHệ thống đã ngừng nhận điểm danh cho buổi này.`)
    );
  };

  // HÀM CHUYỂN ĐỔI ĐỢT ĐIỂM DANH
  const handleChangeShift = async (session: TrainingSession, newShift: string) => {
    const updatedSession: TrainingSession = {
      ...session,
      currentShift: newShift
    };
    setSessions(prev => prev.map(s => s.id === session.id ? updatedSession : s));
    await saveTrainingSessionToCloud(updatedSession);
    soundFX.playScanSuccess();
  };

  // HÀM TẠO BUỔI MỚI (SONG NGỮ HOÀN TOÀN)
  const handleCreateSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const finalType = newType === 'other' ? (customTypeName.trim() || (lang === 'th' ? 'กิจกรรมอื่นๆ' : 'Hoạt động khác')) : newType;

    const finalLocation = selectedLocationType === 'other' 
      ? (customLocationName.trim() || (lang === 'th' ? 'ห้องอื่นๆ' : 'Phòng họp khác'))
      : selectedLocationType;

    // KIỂM TRA TRÙNG LỊCH PHÒNG
    const isHaLong = finalLocation.includes('Hạ Long') || finalLocation.includes('NV1') || finalLocation.includes('ฮาลอง');
    const isBaNa = finalLocation.includes('Bà Nà') || finalLocation.includes('NV2') || finalLocation.includes('บานา');

    if (isHaLong || isBaNa) {
      const checkRoomId = isHaLong ? 'vinh_ha_long' : 'ba_na_hill';
      const conflict = (bookings || []).find(b => {
        if (b.roomId !== checkRoomId || b.status === 'cancelled' || b.status === 'rejected') {
          return false;
        }

        const end = b.endDate || b.date;
        const dateInRange = newDate >= b.date && newDate <= end;
        if (!dateInRange) return false;

        return (
          (newStartTime >= b.startTime && newStartTime < b.endTime) ||
          (newEndTime > b.startTime && newEndTime <= b.endTime) ||
          (newStartTime <= b.startTime && newEndTime >= b.endTime)
        );
      });

      if (conflict) {
        soundFX.playError();
        alert(lang === 'th'
          ? `⚠️ ห้องนี้ถูกจองไว้แล้ว!\n\nสถานที่: ${finalLocation}\nเวลา: ${conflict.startTime} - ${conflict.endTime}\nการประชุม: "${conflict.title}" โดย ${conflict.bookedByName}\n\nกรุณาเลือกเวลาอื่นหรือเลือก "ห้องอื่นๆ"!`
          : `⚠️ PHÒNG ĐÃ CÓ NGƯỜI ĐẶT TRƯỚC!\n\nĐịa điểm: ${finalLocation}\nThời gian: ${conflict.startTime} - ${conflict.endTime}\nCuộc họp: "${conflict.title}"\nTrạng thái: ${conflict.status === 'confirmed' ? 'Đã duyệt' : 'Chờ duyệt'}\n\nVui lòng chọn giờ khác hoặc chọn "Phòng khác"!`
        );
        return;
      }
    }

    const newSession: TrainingSession = {
      id: `session_${Date.now()}`,
      title: newTitle.trim(),
      instructor: newInstructor.trim() || (lang === 'th' ? 'ฝ่ายฝึกอบรม & บุคคล' : 'Ban Đào Tạo & Nhân Sự'),
      instructorCode: newInstructorCode.trim(), 
      location: finalLocation,
      date: newDate,
      startTime: newStartTime,
      endTime: newEndTime,
      type: finalType,
      customTypeName: newType === 'other' ? customTypeName.trim() : undefined,
      isAttendanceOpen: false, 
      currentShift: 'Ca Sáng', 
      createdAt: new Date().toISOString(),
      status: 'active'
    };

    setSessions([newSession, ...sessions]);
    setActiveSessionId(newSession.id);
    saveTrainingSessionToCloud(newSession).catch(console.error);

    soundFX.playScanSuccess();
    setShowCreateModal(false);
    setNewTitle('');
    setNewInstructor('');
    setNewInstructorCode('');
    setCustomLocationName('');
    setCustomTypeName('');
  };

  // XUẤT EXCEL (SONG NGỮ BẢO MẬT)
  const handleExport = () => {
    if (!currentSession) return;
    if (currentRecords.length === 0) {
      alert(lang === 'th' ? 'ยังไม่มีพนักงานลงชื่อในรอบนี้เพื่อส่งออกไฟล์!' : 'Chưa có công nhân viên nào điểm danh trong phiên này để xuất file!');
      return;
    }
  
    const promptMsg = lang === 'th'
      ? '🔐 ความปลอดภัย: ส่งออกรายงาน\n\nไฟล์ Excel มีข้อมูลรหัสบัตรพนักงานครบถ้วน\nกรุณาป้อนรหัสผ่านผู้ดูแลระบบ (8888) เพื่อดาวน์โหลด:'
      : '🔐 BẢO MẬT XUẤT BÁO CÁO\n\nFile Excel chứa đầy đủ thông tin và mã thẻ nhân sự.\nVui lòng nhập Mật khẩu Quản trị để tải:';

    const pin = prompt(promptMsg);
    if (pin === null) return;
  
    if (pin.trim() !== '8888') {
      soundFX.playError();
      alert(lang === 'th' ? '❌ รหัสผ่านไม่ถูกต้อง! คุณไม่มีสิทธิ์ดาวน์โหลดไฟล์รายงานนี้' : '❌ Mật khẩu không đúng! Bạn không có quyền tải file báo cáo này.');
      return;
    }
  
    soundFX.playScanSuccess();
    exportAttendanceToExcel(currentSession, currentRecords);
  };

  // HÀM XÓA BUỔI HỌP (SONG NGỮ HOÀN TOÀN)
  const handleDeleteSession = async (sessionToDelete: TrainingSession) => {
    const promptMsg = lang === 'th'
      ? `🔐 ความปลอดภัย: ลบการประชุม\n\nคุณกำลังต้องการลบ: "${sessionToDelete.title}" (${sessionToDelete.date})\n\nการดำเนินการนี้จะลบการประชุมและข้อมูลการลงชื่อทั้งหมดอย่างถาวร\nกรุณาป้อนรหัสผ่านผู้ดูแลระบบ (8888) เพื่อยืนยัน:`
      : `🔐 BẢO MẬT XÓA BUỔI HỌP\n\nBạn đang yêu cầu xóa: "${sessionToDelete.title}" (${sessionToDelete.date})\n\nThao tác này sẽ xóa vĩnh viễn buổi họp và toàn bộ danh sách điểm danh liên quan.\nVui lòng nhập Mật khẩu Quản trị để xác nhận:`;

    const pin = prompt(promptMsg);
    if (pin === null) return;

    if (pin.trim() !== '8888') {
      soundFX.playError();
      alert(lang === 'th' ? '❌ รหัสผ่านผู้ดูแลระบบไม่ถูกต้อง! ไม่สามารถลบได้' : '❌ Mật khẩu quản trị không đúng! Không thể xóa buổi họp này.');
      return;
    }

    const confirmMsg = lang === 'th'
      ? `ยืนยันการลบการประชุม "${sessionToDelete.title}" อย่างถาวร?`
      : `Xác nhận xóa vĩnh viễn buổi họp "${sessionToDelete.title}"?`;

    if (confirm(confirmMsg)) {
      try {
        const remainingSessions = sessions.filter(s => s.id !== sessionToDelete.id);
        setSessions(remainingSessions);
        setAttendanceRecords(prev => prev.filter(r => r.sessionId !== sessionToDelete.id));

        if (activeSessionId === sessionToDelete.id) {
          setActiveSessionId(remainingSessions[0]?.id || '');
        }

        await deleteTrainingSessionInCloud(sessionToDelete.id);
        soundFX.playScanSuccess();
        alert(lang === 'th' ? '✅ ลบการประชุมและข้อมูลที่เกี่ยวข้องสำเร็จแล้ว!' : '✅ Đã xóa buổi họp và dữ liệu liên quan thành công!');
      } catch (err) {
        console.error('Lỗi khi xóa buổi họp trên cloud:', err);
      }
    }
  };

  // HÀM ĐỔI CHỦ ĐỀ CHO RIÊNG CA NÀY (SONG NGỮ HOÀN TOÀN)
  const handleEditShiftTopic = async (session: TrainingSession) => {
    const shift = session.currentShift || 'Ca Sáng';
    const shiftNameDisplay = shift === 'Ca Chiều' ? (lang === 'th' ? 'รอบบ่าย' : 'Ca Chiều') : (lang === 'th' ? 'รอบเช้า' : 'Ca Sáng');
    const currentTopic = (session.shiftTopics && session.shiftTopics[shift]) || session.title;

    const promptMsg = lang === 'th'
      ? `🔐 ความปลอดภัย: เปลี่ยนหัวข้อ [${shiftNameDisplay}]\n\nประธาน: "${session.instructor}"\nกรุณาป้อนรหัสบัตรของประธาน หรือรหัสผู้ดูแลระบบ (8888):`
      : `🔐 BẢO MẬT ĐỔI CHỦ ĐỀ [${shiftNameDisplay}]\n\nChủ trì cuộc họp: "${session.instructor}"\n\nVui lòng nhập MÃ THẺ của Người chủ trì hoặc Mật khẩu Quản trị:`;

    const promptPin = prompt(promptMsg);
    if (promptPin === null) return;

    const cleanInput = promptPin.trim().toLowerCase();
    const isAdmin = cleanInput === '8888';

    let isAuthorized = isAdmin;

    if (!isAuthorized) {
      if (session.instructorCode && cleanInput === session.instructorCode.trim().toLowerCase()) {
        isAuthorized = true;
      } else {
        const foundEmp = employees.find(
          e => e.Employee_Code.trim().toLowerCase() === cleanInput
        );

        if (foundEmp) {
          const empFullName = (foundEmp.Full_Name || `${foundEmp.Name} ${foundEmp.Surname}`).trim().toLowerCase();
          const targetInstructor = session.instructor.trim().toLowerCase();

          const removeAccents = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');

          const cleanEmpName = removeAccents(empFullName);
          const cleanInstructor = removeAccents(targetInstructor);

          if (cleanEmpName.includes(cleanInstructor) || cleanInstructor.includes(cleanEmpName)) {
            isAuthorized = true;
          }
        }
      }
    }

    if (!isAuthorized) {
      soundFX.playError();
      alert(lang === 'th'
        ? `❌ ยืนยันตัวตนไม่สำเร็จ!\n\nรหัสบัตรที่ป้อนไม่ตรงกับประธาน (${session.instructor})\nเฉพาะประธานเท่านั้นที่สามารถเปลี่ยนหัวข้อการอบรมของรอบนี้ได้`
        : `❌ XÁC THỰC THẤT BẠI!\n\nMã thẻ vừa nhập không trùng khớp với Người chủ trì cuộc họp này (${session.instructor}).\nChỉ người chủ trì cuộc họp mới có quyền đổi chủ đề của ca họp.`
      );
      return;
    }

    const topicPrompt = lang === 'th'
      ? `📝 เปลี่ยนหัวข้อการอบรมสำหรับ [${shiftNameDisplay}]:\n(หัวข้อของรอบก่อนหน้าจะถูกเก็บรักษาไว้โดยอิสระ)\n\nป้อนชื่อหัวข้อใหม่:`
      : `📝 ĐỔI CHỦ ĐỀ ĐÀO TẠO CHO [${shiftNameDisplay}]:\n(Chủ đề của ca trước vẫn được giữ nguyên độc lập)\n\nNhập tên chủ đề mới:`;

    const newTopicName = prompt(topicPrompt, currentTopic);
    if (newTopicName === null || !newTopicName.trim()) return;

    const updatedTopics = {
      ...(session.shiftTopics || {}),
      [shift]: newTopicName.trim()
    };

    const updatedSession: TrainingSession = {
      ...session,
      shiftTopics: updatedTopics
    };

    setSessions(prev => prev.map(s => s.id === session.id ? updatedSession : s));
    await saveTrainingSessionToCloud(updatedSession);

    soundFX.playScanSuccess();
    alert(lang === 'th'
      ? `✅ อัปเดตหัวข้อสำหรับ [${shiftNameDisplay}] สำเร็จแล้ว!\n"${newTopicName.trim()}"`
      : `✅ Đã cập nhật chủ đề cho [${shiftNameDisplay}] thành công!\n"${newTopicName.trim()}"`
    );
  };
  
  // HÀM XÓA LƯỢT ĐIỂM DANH (SONG NGỮ HOÀN TOÀN)
  const handleDeleteRecord = async (record: AttendanceRecord) => {
    const promptMsg = lang === 'th'
      ? `🔐 ความปลอดภัย: ลบการลงชื่อ\n\nคุณกำลังต้องการลบการลงชื่อของ:\n"${record.employeeName}" (รหัส: ${record.employeeCode})\nเวลา: ${record.scanTime} - วันที่: ${record.date}\n\nกรุณาป้อนรหัสผ่านผู้ดูแลระบบ (8888) เพื่อยืนยัน:`
      : `🔐 BẢO MẬT XÓA ĐIỂM DANH\n\nBạn đang yêu cầu xóa lượt điểm danh của:\n"${record.employeeName}" (Mã: ${record.employeeCode})\nThời gian: ${record.scanTime} - Ngày ${record.date}\n\nVui lòng nhập Mật khẩu Quản trị để xác nhận xóa:`;

    const pin = prompt(promptMsg);
    if (pin === null) return;

    if (pin.trim() !== '8888') {
      soundFX.playError();
      alert(lang === 'th' ? '❌ รหัสผ่านไม่ถูกต้อง! คุณไม่มีสิทธิ์ลบรายการนี้' : '❌ Mật khẩu quản trị không đúng! Bạn không có quyền xóa lượt điểm danh này.');
      return;
    }

    const confirmMsg = lang === 'th'
      ? `ยืนยันการลบการลงชื่อของ "${record.employeeName}" อย่างถาวร?`
      : `Xác nhận xóa vĩnh viễn lượt điểm danh của "${record.employeeName}"?`;

    if (confirm(confirmMsg)) {
      try {
        setAttendanceRecords(prev => prev.filter(r => r.id !== record.id));
        await deleteAttendanceRecordInCloud(record.id);
        soundFX.playScanSuccess();
        alert(lang === 'th' ? '✅ ลบรายการลงชื่อสำเร็จแล้ว!' : '✅ Đã xóa lượt điểm danh thành công!');
      } catch (err) {
        console.error('Lỗi khi xóa điểm danh trên cloud:', err);
      }
    }
  };

  const availableDepts = Array.from(new Set(currentRecords.map(r => r.department)));

  return (
    <div className="space-y-5">
      {/* Top Banner / Session Switcher */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              {t.att_banner_badge}
            </span>
            <h2 className="text-xl font-extrabold text-slate-900 mt-1">
              {t.att_title}
            </h2>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex-1 sm:flex-none px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 text-blue-600" />
              <span>{t.att_btn_create_session}</span>
            </button>
            <button
              onClick={handleExport}
              className="flex-1 sm:flex-none px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{t.att_btn_export_excel}</span>
            </button>
          </div>
        </div>

        {/* Current Active Session Info Card */}
        {currentSession ? (
          <div className="bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-white border border-blue-200 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-2 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-md ${
                  currentSession.type === 'safety' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                  currentSession.type === 'training' ? 'bg-blue-100 text-blue-800 border border-blue-300' : 'bg-purple-100 text-purple-800 border border-purple-300'
                }`}>
                  {currentSession.type === 'safety' ? (lang === 'th' ? 'ความปลอดภัย & ดับเพลิง' : 'An toàn lao động & PCCC') :
                   currentSession.type === 'training' ? (lang === 'th' ? 'ฝึกอบรมภายใน' : 'Đào tạo nội bộ') :
                   currentSession.type === 'meeting' ? (lang === 'th' ? 'การประชุม' : 'CUỘC HỌP') : currentSession.type}
                </span>
                <span className="text-xs text-slate-600 flex items-center gap-1 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" /> {currentSession.date}
                </span>
                <span className="text-xs text-slate-600 flex items-center gap-1 font-medium">
                  <Clock className="w-3.5 h-3.5 text-blue-600" /> {currentSession.startTime} - {currentSession.endTime}
                </span>
              </div>

              {/* TIÊU ĐỀ CUỘC HỌP THEO ĐỢT HIỆN TẠI */}
              <div className="space-y-0.5">
                <h3 className="text-base sm:text-lg font-black text-slate-900 leading-snug flex items-center gap-2 flex-wrap">
                  <span>
                    {(currentSession.shiftTopics && currentSession.shiftTopics[currentSession.currentShift || 'Ca Sáng']) || currentSession.title}
                  </span>
                  {currentSession.shiftTopics && currentSession.shiftTopics[currentSession.currentShift || 'Ca Sáng'] && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold border border-purple-200">
                      {lang === 'th' ? `หัวข้อเฉพาะ [${activeShift === 'Ca Chiều' ? 'รอบบ่าย' : 'รอบเช้า'}]` : `Chủ đề riêng [${currentSession.currentShift || 'Ca Sáng'}]`}
                    </span>
                  )}
                </h3>

                {currentSession.shiftTopics && currentSession.shiftTopics[currentSession.currentShift || 'Ca Sáng'] && (
                  <p className="text-[11px] text-slate-500 font-medium">
                    ({lang === 'th' ? 'หลักสูตรดั้งเดิม:' : 'Khóa đào tạo gốc:'} {currentSession.title})
                  </p>
                )}
              </div>

              <div className="text-xs text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
                <span><strong>{t.att_instructor_label}</strong> {currentSession.instructor}</span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-400" /> 
                  <strong>{t.att_location_label}</strong> {currentSession.location}
                </span>
              </div>
            </div>

            {/* KHU VỰC ĐIỀU KHIỂN ĐIỂM DANH & NÚT ON / OFF */}
            <div className="w-full md:w-auto shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              {/* CÔNG TẮC BẬT / TẮT (ON / OFF) */}
              <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-white border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase mb-1">
                  {t.att_status_label}
                </span>
                
                <button
                  type="button"
                  onClick={() => handleToggleAttendanceOpen(currentSession)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                    currentSession.isAttendanceOpen
                      ? 'bg-emerald-600 text-white ring-2 ring-emerald-400 animate-pulse'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                  title={lang === 'th' ? 'กดเพื่อเปิด/ปิดระบบลงชื่อ (ต้องใช้รหัสบัตรวิทยากร)' : 'Bấm để Mở/Khóa điểm danh (Cần mã thẻ giảng viên)'}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${currentSession.isAttendanceOpen ? 'bg-white' : 'bg-rose-500'}`}></span>
                  <span>{currentSession.isAttendanceOpen ? t.att_status_open : t.att_status_closed}</span>
                </button>
              </div>

              {/* CHỌN ĐỢT ĐIỂM DANH */}
              <div className="flex flex-col p-2 rounded-xl bg-white border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">
                    {t.att_shift_label}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleEditShiftTopic(currentSession)}
                    className="text-[10px] text-blue-600 hover:text-blue-800 font-bold hover:underline cursor-pointer"
                  >
                    {t.att_btn_edit_topic}
                  </button>
                </div>

                <select
                  value={currentSession.currentShift || 'Ca Sáng'}
                  onChange={(e) => handleChangeShift(currentSession, e.target.value)}
                  className="px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-lg text-xs font-extrabold text-blue-900 focus:outline-none cursor-pointer"
                >
                  <option value="Ca Sáng">{lang === 'th' ? '☀️ รอบเช้า (07:30-11:30)' : '☀️ Ca Sáng (07:30-11:30)'}</option>
                  <option value="Ca Chiều">{lang === 'th' ? '🌤️ รอบบ่าย (12:30-16:30)' : '🌤️ Ca Chiều (12:30-16:30)'}</option>
                </select>
              </div>

              {/* NÚT QUÉT BARCODE THẺ */}
              <button
                type="button"
                onClick={() => {
                  if (!currentSession.isAttendanceOpen) {
                    soundFX.playError();
                    alert(lang === 'th' 
                      ? `🔒 ปิดการลงชื่ออยู่!\n\nผู้รับผิดชอบ (${currentSession.instructor}) ยังไม่ได้เปิดให้ลงชื่อ.\nกรุณากดปุ่มเปิด (ON) ก่อนสแกนบัตร!`
                      : `🔒 ĐIỂM DANH ĐANG BỊ KHÓA!\n\nNgười chủ trì (${currentSession.instructor}) chưa bật mở điểm danh.\nVui lòng bấm vào nút [ĐÃ KHÓA (OFF)] bên cạnh để mở khóa trước khi quét thẻ!`
                    );
                    return;
                  }
                  onOpenScanner(currentSession.id);
                }}
                className={`px-5 py-3.5 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all active:scale-98 ${
                  currentSession.isAttendanceOpen
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25 cursor-pointer'
                    : 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                }`}
              >
                <ScanLine className="w-5 h-5 animate-pulse" />
                <span>{t.att_btn_scan} [{activeShift === 'Ca Chiều' ? (lang === 'th' ? 'รอบบ่าย' : 'Ca Chiều') : (lang === 'th' ? 'รอบเช้า' : 'Ca Sáng')}]</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-6 sm:p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 mx-auto flex items-center justify-center border border-blue-200">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900">
                {lang === 'th' ? 'ยังไม่มีรายการการประชุม / ฝึกอบรม' : 'Chưa Có Buổi Họp / Đào Tạo Nào'}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                {lang === 'th' 
                  ? 'กดปุ่ม "สร้างการประชุมใหม่" ด้านล่างเพื่อตั้งค่าหลักสูตรฝึกอบรมหรือการประชุม แล้วเริ่มสแกนบาร์โค้ดลงชื่อ'
                  : 'Bấm nút "Tạo Buổi Mới" bên dưới để thiết lập khóa đào tạo hoặc cuộc họp và bắt đầu quét mã vạch điểm danh.'}
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{lang === 'th' ? 'สร้างรายการแรก' : 'Tạo Buổi Đầu Tiên'}</span>
            </button>
          </div>
        )}

        {/* KHU VỰC CHỌN BUỔI HỌP DROPDOWN */}
        {sessions.length > 0 && (
          <div className="pt-3 border-t border-slate-200/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 flex-1">
              <span className="text-xs font-bold text-slate-700 shrink-0 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>{t.att_session_list_title} ({sessions.length}):</span>
              </span>

              <div className="relative flex-1 max-w-md">
                <select
                  value={currentSession?.id || ''}
                  onChange={(e) => setActiveSessionId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-blue-200 hover:border-blue-400 rounded-xl text-xs font-extrabold text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-xs cursor-pointer truncate"
                >
                  {sessions.map(s => {
                    const count = attendanceRecords.filter(r => r.sessionId === s.id).length;
                    return (
                      <option key={s.id} value={s.id}>
                        [{s.date}] {s.title} ({count} {lang === 'th' ? 'คนลงชื่อแล้ว' : 'người đã điểm danh'})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {currentSession && (
              <button
                type="button"
                onClick={() => handleDeleteSession(currentSession)}
                className="px-3 py-2 rounded-xl bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 hover:border-rose-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-2xs shrink-0 cursor-pointer"
                title={`Xóa buổi "${currentSession.title}"`}
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                <span>{t.att_btn_delete_session}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* 4 THẺ THỐNG KÊ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
          <span className="text-xs text-slate-500 block font-semibold">{t.att_stat_total}</span>
          <span className="text-2xl font-black text-blue-600 mt-1 block">
            {currentRecords.length}
          </span>
          <span className="text-[11px] text-slate-400">{lang === 'th' ? 'พนักงานทั้งหมด' : 'Tổng công nhân viên'}</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
          <span className="text-xs text-slate-500 block font-semibold flex items-center gap-1">
            <Camera className="w-3.5 h-3.5 text-emerald-600" />
            <span>{t.att_stat_camera}</span>
          </span>
          <span className="text-2xl font-black text-emerald-600 mt-1 block">
            {currentRecords.filter(r => r.method === 'camera_scan' || !r.method).length}
          </span>
          <span className="text-[11px] text-slate-400">{lang === 'th' ? 'เรียลไทม์' : 'Trực tiếp thời gian thực'}</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
          <span className="text-xs text-slate-500 block font-semibold flex items-center gap-1">
            <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
            <span>{t.att_stat_photo}</span>
          </span>
          <span className="text-2xl font-black text-indigo-600 mt-1 block">
            {currentRecords.filter(r => r.method === 'photo_scan').length}
          </span>
          <span className="text-[11px] text-slate-400">{lang === 'th' ? 'ถอดรหัสจากภาพ' : 'Giải mã barcode từ ảnh'}</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
          <span className="text-xs text-slate-500 block font-semibold flex items-center gap-1">
            <Keyboard className="w-3.5 h-3.5 text-purple-600" />
            <span>{t.att_stat_manual}</span>
          </span>
          <span className="text-2xl font-black text-purple-600 mt-1 block">
            {currentRecords.filter(r => r.method === 'manual_entry').length}
          </span>
          <span className="text-[11px] text-slate-400">{lang === 'th' ? 'ป้อนรหัสเอง' : 'Nhập thủ công bằng tay'}</span>
        </div>
      </div>

      {/* Main List Container */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {/* Search & Filter Header */}
        <div className="p-3.5 sm:p-4 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/60">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder={lang === 'th' ? 'ค้นหาตามชื่อ, รหัส, แผนก...' : 'Tìm theo tên, mã NV, bộ phận...'}
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-sm"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <select
              value={selectedDeptFilter}
              onChange={(e) => setSelectedDeptFilter(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:border-blue-500 shadow-sm cursor-pointer"
            >
              <option value="all">{t.att_all_depts} ({currentRecords.length})</option>
              {availableDepts.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Empty State */}
        {filteredRecords.length === 0 ? (
          <div className="p-8 sm:p-12 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-600 mx-auto flex items-center justify-center border border-blue-100">
              <Users className="w-7 h-7" />
            </div>
            <p className="text-base font-bold text-slate-800">
              {currentRecords.length === 0 
                ? (lang === 'th' ? `ยังไม่มีใครลงชื่อสำหรับ [${activeShift === 'Ca Chiều' ? 'รอบบ่าย' : 'รอบเช้า'}]` : `Chưa có ai điểm danh cho [${activeShift}]`)
                : (lang === 'th' ? 'ไม่พบข้อมูลที่ตรงกัน' : 'Không tìm thấy kết quả phù hợp')}
            </p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              {currentRecords.length === 0 
                ? (lang === 'th' 
                    ? `กดเปิดระบบ (ON) และกดปุ่ม "สแกนบัตร" เพื่อเริ่มบันทึกการลงชื่อสำหรับรอบนี้`
                    : `Bấm mở khóa ON và bấm nút "QUÉT THẺ" để bắt đầu ghi nhận điểm danh cho ca này.`)
                : (lang === 'th' ? 'กรุณาลองค้นหาด้วยคำค้นหาหรือแผนกอื่น' : 'Vui lòng thử tìm kiếm bằng từ khóa hoặc bộ phận khác.')}
            </p>
          </div>
        ) : (
          <div>
            {/* ================= MOBILE VIEW ================= */}
            <div className="block md:hidden divide-y divide-slate-100">
              {filteredRecords.map((r) => (
                <div key={r.id} className="p-3.5 hover:bg-slate-50/80 transition-colors space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-extrabold text-sm flex items-center justify-center shrink-0 border border-blue-200">
                        {r.employeeName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-slate-900 truncate">
                          {r.employeeName}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="font-mono font-bold text-blue-700">{maskEmployeeCode(r.employeeCode)}</span>
                          <span className="text-slate-400">&bull;</span>
                          <span className="text-slate-600 truncate">{r.position}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteRecord(r)}
                      title="Xóa lượt này"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                    <div className="text-slate-600 truncate max-w-[60%]">
                      <span>{r.department}</span>
                      <span className="text-slate-400 text-[11px] ml-1">({r.factory})</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 text-[11px]">
                        {r.scanTime}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ================= DESKTOP VIEW ================= */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold">
                    <th className="p-3 w-12 text-center">{t.att_col_stt}</th>
                    <th className="p-3">{t.att_col_code}</th>
                    <th className="p-3">{t.att_col_name}</th>
                    <th className="p-3">{t.att_col_dept}</th>
                    <th className="p-3">{t.att_col_position}</th>
                    <th className="p-3">{t.att_col_shift}</th>
                    <th className="p-3">{t.att_col_shift_topic}</th>
                    <th className="p-3">{t.att_col_time}</th>
                    <th className="p-3">{t.att_col_method}</th>
                    <th className="p-3 w-14 text-center">{t.att_col_action}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRecords.map((r, index) => (
                    <tr key={r.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="p-3 text-center text-slate-400 font-mono font-medium">
                        {index + 1}
                      </td>
                      <td className="p-3 font-mono font-bold text-blue-700">
                        {maskEmployeeCode(r.employeeCode)}
                      </td>
                      <td className="p-3 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center font-bold text-xs text-blue-700">
                            {r.employeeName.charAt(0)}
                          </div>
                          <span>{r.employeeName}</span>
                        </div>
                      </td>
                      <td className="p-3 text-slate-700">
                        <div className="font-medium">{r.department}</div>
                        <span className="text-[11px] text-slate-400">{r.factory}</span>
                      </td>
                      <td className="p-3 text-slate-600">
                        {r.position}
                      </td>
                      <td className="p-3">
                        <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-800 font-bold text-[11px] border border-blue-200">
                          {r.attendanceShift === 'Ca Chiều' ? (lang === 'th' ? 'รอบบ่าย' : 'Ca Chiều') : (lang === 'th' ? 'รอบเช้า' : 'Ca Sáng')}
                        </span>
                      </td>
                      <td className="p-3 text-slate-800 font-bold max-w-xs truncate" title={r.shiftTopicTitle || r.sessionTitle}>
                        {r.shiftTopicTitle || r.sessionTitle}
                      </td>
                      <td className="p-3 font-mono text-emerald-700 font-bold">
                        {r.scanTime}
                      </td>
                      <td className="p-3">
                        {r.method === 'photo_scan' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-semibold">
                            <ImageIcon className="w-3 h-3" /> {t.att_method_photo}
                          </span>
                        ) : r.method === 'manual_entry' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-[11px] font-semibold">
                            <Keyboard className="w-3 h-3" /> {t.att_method_manual}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> {t.att_method_camera}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleDeleteRecord(r)}
                          title="Xóa lượt này"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Create Session */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4 text-slate-900 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-base text-slate-900">{t.att_modal_title}</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleCreateSession} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 mb-1 font-bold">
                  {t.att_modal_name} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={t.att_modal_name_ph}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-bold">
                  {t.att_modal_type} <span className="text-rose-500">*</span>
                </label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as any)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500 font-medium cursor-pointer"
                >
                  <option value="training">{t.att_modal_type_training}</option>
                  <option value="safety">{t.att_modal_type_safety}</option>
                  <option value="meeting">{t.att_modal_type_meeting}</option>
                  <option value="other">{t.att_modal_type_other}</option>
                </select>

                {newType === 'other' && (
                  <div className="mt-2 animate-in fade-in duration-150">
                    <input
                      type="text"
                      required
                      value={customTypeName}
                      onChange={(e) => setCustomTypeName(e.target.value)}
                      placeholder={lang === 'th' ? 'ระบุชื่อกิจกรรมอื่นๆ...' : 'Gõ tên phân loại hoạt động khác...'}
                      className="w-full px-3 py-2 bg-purple-50/70 border border-purple-300 rounded-xl text-slate-900 focus:outline-none focus:border-purple-500 font-medium text-xs placeholder-slate-400"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-bold">
                  {t.att_modal_instructor} <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    value={newInstructor}
                    onChange={(e) => setNewInstructor(e.target.value)}
                    placeholder={t.att_modal_inst_name_ph}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500 font-medium text-xs"
                  />
                  <input
                    type="text"
                    required
                    value={newInstructorCode}
                    onChange={(e) => setNewInstructorCode(e.target.value)}
                    placeholder={t.att_modal_inst_code_ph}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500 font-mono font-bold text-xs"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1 italic">
                  {t.att_modal_inst_hint}
                </p>
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-bold">
                  {t.att_modal_location} <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedLocationType}
                  onChange={(e) => setSelectedLocationType(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500 font-medium cursor-pointer"
                >
                  <option value="Phòng Họp Vịnh Hạ Long (NV1)">{t.att_modal_loc_halong}</option>
                  <option value="Phòng Họp Bà Nà Hill (NV2)">{t.att_modal_loc_bana}</option>
                  <option value="other">{t.att_modal_loc_other}</option>
                </select>
              
                {selectedLocationType === 'other' && (
                  <div className="mt-2">
                    <input
                      type="text"
                      required
                      value={customLocationName}
                      onChange={(e) => setCustomLocationName(e.target.value)}
                      placeholder={lang === 'th' ? 'พิมพ์ชื่อห้องหรือสถานที่ (เช่น โรงอาหาร, แผนกเย็บ 1...)' : 'Gõ tên phòng hoặc địa điểm (VD: Hội trường nhà ăn, Xưởng May 1...)'}
                      className="w-full px-3 py-2 bg-blue-50/60 border border-blue-300 rounded-xl text-slate-900 text-xs font-bold"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-700 mb-1 font-bold">{t.att_modal_date}</label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full px-2 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 mb-1 font-bold">{t.att_modal_start}</label>
                  <input
                    type="time"
                    value={newStartTime}
                    onChange={(e) => setNewStartTime(e.target.value)}
                    className="w-full px-2 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 mb-1 font-bold">{t.att_modal_end}</label>
                  <input
                    type="time"
                    value={newEndTime}
                    onChange={(e) => setNewEndTime(e.target.value)}
                    className="w-full px-2 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs font-medium"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors cursor-pointer"
                >
                  {t.att_modal_btn_cancel}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors shadow-sm cursor-pointer"
                >
                  {t.att_modal_btn_submit}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
