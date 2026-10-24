/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
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
import { AttendanceRecord, Employee, TrainingSession, maskEmployeeCode } from '../types';
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
  bookings
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('all');

  // Form state for creating new session
  const [newTitle, setNewTitle] = useState('');
  const [newInstructor, setNewInstructor] = useState('');
  const [newInstructorCode, setNewInstructorCode] = useState('');
  const [customTypeName, setCustomTypeName] = useState('');
  const [newLocation, setNewLocation] = useState('Phòng Họp Vịnh Hạ Long');
  const [selectedLocationType, setSelectedLocationType] = useState('Phòng Họp Vịnh Hạ Long');
  const [customLocationName, setCustomLocationName] = useState('');
  const [newType, setNewType] = useState<'training' | 'meeting' | 'safety' | 'other'>('training');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newStartTime, setNewStartTime] = useState('08:30');
  const [newEndTime, setNewEndTime] = useState('10:00');

  const currentSession = sessions.find(s => s.id === activeSessionId) || sessions[0];
  const currentRecords = attendanceRecords.filter(r => r.sessionId === currentSession?.id);

  const filteredRecords = currentRecords.filter(r => {
    const matchSearch = r.employeeName.toLowerCase().includes(searchFilter.toLowerCase()) ||
                        r.employeeCode.includes(searchFilter) ||
                        r.department.toLowerCase().includes(searchFilter.toLowerCase());
    const matchDept = selectedDeptFilter === 'all' || r.department === selectedDeptFilter;
    return matchSearch && matchDept;
  });

  // HÀM BẬT / TẮT KHÓA ĐIỂM DANH (XÁC THỰC MÃ THẺ GIẢNG VIÊN THÔNG MINH)
  const handleToggleAttendanceOpen = async (session: TrainingSession) => {
    const isCurrentlyOpen = session.isAttendanceOpen ?? false;
    const actionText = isCurrentlyOpen ? 'KHÓA (KẾT THÚC) ĐIỂM DANH' : 'MỞ KHÓA ĐIỂM DANH';

    const promptInput = prompt(
      `🔐 BẢO MẬT ${actionText}\n\nBuổi họp: "${session.title}"\nNgười chủ trì: ${session.instructor}\n\nĐể ${actionText.toLowerCase()}, vui lòng nhập MÃ THẺ của Người chủ trì hoặc Mật khẩu Quản trị:`
    );

    if (promptInput === null) return; // Người dùng bấm Hủy

    const cleanInput = promptInput.trim().toLowerCase();
    const isAdmin = cleanInput === '8888';

    let isAuthorized = isAdmin;

    if (!isAuthorized) {
      // 1. Kiểm tra nếu mã nhập trùng trực tiếp với instructorCode đã lưu
      if (session.instructorCode && cleanInput === session.instructorCode.trim().toLowerCase()) {
        isAuthorized = true;
      } else {
        // 2. Tra cứu mã thẻ trong danh sách 5.379 nhân sự xem có đúng là giảng viên không
        const foundEmp = employees.find(
          e => e.Employee_Code.trim().toLowerCase() === cleanInput
        );

        if (foundEmp) {
          const empFullName = (foundEmp.Full_Name || `${foundEmp.Name} ${foundEmp.Surname}`).trim().toLowerCase();
          const targetInstructor = session.instructor.trim().toLowerCase();

          // Hàm bỏ dấu tiếng Việt để so sánh tên không bị lệch dấu
          const removeAccents = (str: string) => 
            str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');

          const cleanEmpName = removeAccents(empFullName);
          const cleanInstructor = removeAccents(targetInstructor);

          // Nếu tên người nhập trùng khớp với tên người chủ trì -> HỢP LỆ!
          if (cleanEmpName.includes(cleanInstructor) || cleanInstructor.includes(cleanEmpName)) {
            isAuthorized = true;
          }
        }
      }
    }

    if (!isAuthorized) {
      soundFX.playError();
      alert(`❌ XÁC THỰC THẤT BẠI!\n\nMã thẻ vừa nhập không trùng khớp với Người chủ trì (${session.instructor}).\nBạn không có quyền Mở/Khóa điểm danh cho buổi này.`);
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
    alert(nextState 
      ? `🟢 ĐÃ MỞ ĐIỂM DANH THÀNH CÔNG!\nBây giờ công nhân viên có thể quét mã vạch thẻ để điểm danh [${session.currentShift || 'Ca Sáng'}].`
      : `🔒 ĐÃ KHÓA ĐIỂM DANH!\nHệ thống đã ngừng nhận điểm danh cho buổi này.`
    );
  };

  // HÀM CHUYỂN ĐỔI ĐỢT ĐIỂM DANH (CA SÁNG / CA CHIỀU)
  const handleChangeShift = async (session: TrainingSession, newShift: string) => {
    const updatedSession: TrainingSession = {
      ...session,
      currentShift: newShift
    };
    setSessions(prev => prev.map(s => s.id === session.id ? updatedSession : s));
    await saveTrainingSessionToCloud(updatedSession);
    soundFX.playScanSuccess();
  };
  const handleCreateSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    // Xác định tên phân loại: nếu chọn 'other' thì lấy chuỗi tự gõ
    const finalType = newType === 'other' ? (customTypeName.trim() || 'Hoạt động khác') : newType;

    // Xác định địa điểm
    const finalLocation = selectedLocationType === 'other' 
      ? (customLocationName.trim() || 'Phòng họp khác')
      : selectedLocationType;

    // KIỂM TRA TRÙNG LỊCH VỚI ĐẶT PHÒNG NẾU CHỌN 2 PHÒNG CỐ ĐỊNH
    const isHaLong = finalLocation.includes('Hạ Long') || finalLocation.includes('NV1');
    const isBaNa = finalLocation.includes('Bà Nà') || finalLocation.includes('NV2');

    if (isHaLong || isBaNa) {
      const checkRoomId = isHaLong ? 'vinh_ha_long' : 'ba_na_hill';
      const conflict = (bookings || []).find(b => {
        if (b.roomId !== checkRoomId || b.status === 'cancelled' || b.status === 'rejected') {
          return false;
        }

        // Kiểm tra xem ngày newDate có nằm trong khoảng [b.date -> b.endDate] không
        const end = b.endDate || b.date;
        const dateInRange = newDate >= b.date && newDate <= end;
        if (!dateInRange) return false;

        // Kiểm tra đụng giờ
        return (
          (newStartTime >= b.startTime && newStartTime < b.endTime) ||
          (newEndTime > b.startTime && newEndTime <= b.endTime) ||
          (newStartTime <= b.startTime && newEndTime >= b.endTime)
        );
      });

      if (conflict) {
        soundFX.playError();
        alert(
          `⚠️ PHÒNG ĐÃ CÓ NGƯỜI ĐẶT TRƯỚC!\n\nĐịa điểm: ${finalLocation}\nThời gian: ${conflict.startTime} - ${conflict.endTime}\nCuộc họp: "${conflict.title}"\nTrạng thái: ${conflict.status === 'confirmed' ? 'Đã duyệt' : 'Chờ duyệt'}\n\nVui lòng chọn giờ khác hoặc chọn "Phòng khác"!`
        );
        return;
      }
    }

    const newSession: TrainingSession = {
      id: `session_${Date.now()}`,
      title: newTitle.trim(),
      instructor: newInstructor.trim() || 'Ban Đào Tạo & Nhân Sự',
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
    setCustomLocationName('');
    setCustomTypeName(''); // Reset ô nhập
  };

  const handleExport = () => {
    if (!currentSession) return;
    if (currentRecords.length === 0) {
      alert('Chưa có công nhân viên nào điểm danh trong phiên này để xuất file!');
      return;
    }
  
    // Khóa mật khẩu tải file Excel
    const pin = prompt('🔐 BẢO MẬT XUẤT BÁO CÁO\n\nFile Excel chứa đầy đủ thông tin và mã thẻ nhân sự.\nVui lòng nhập Mật khẩu Quản trị để tải:');
    if (pin === null) return; // Bấm Cancel
  
    if (pin.trim() !== '8888') {
      soundFX.playError();
      alert('❌ Mật khẩu không đúng! Bạn không có quyền tải file báo cáo này.');
      return;
    }
  
    soundFX.playScanSuccess();
    exportAttendanceToExcel(currentSession, currentRecords);
  };

  // HÀM XÓA BUỔI HỌP / ĐÀO TẠO (BẢO MẬT: BẮT NHẬP PASS 8888)
  const handleDeleteSession = async (sessionToDelete: TrainingSession) => {
    const pin = prompt(
      `🔐 BẢO MẬT XÓA BUỔI HỌP\n\nBạn đang yêu cầu xóa: "${sessionToDelete.title}" (${sessionToDelete.date})\n\nThao tác này sẽ xóa vĩnh viễn buổi họp và toàn bộ danh sách điểm danh liên quan.\nVui lòng nhập Mật khẩu Quản trị để xác nhận:`
    );

    if (pin === null) return; // Người dùng bấm Hủy

    if (pin.trim() !== '8888') {
      soundFX.playError();
      alert('❌ Mật khẩu quản trị không đúng! Không thể xóa buổi họp này.');
      return;
    }

    if (confirm(`Xác nhận xóa vĩnh viễn buổi họp "${sessionToDelete.title}"?`)) {
      try {
        // 1. Xóa trong state sessions
        const remainingSessions = sessions.filter(s => s.id !== sessionToDelete.id);
        setSessions(remainingSessions);

        // 2. Xóa các bản ghi điểm danh của buổi đó
        setAttendanceRecords(prev => prev.filter(r => r.sessionId !== sessionToDelete.id));

        // 3. Chuyển active sang buổi kế tiếp nếu đang xem buổi bị xóa
        if (activeSessionId === sessionToDelete.id) {
          setActiveSessionId(remainingSessions[0]?.id || '');
        }

        // 4. Xóa sạch vĩnh viễn trên Cloud Firebase
        await deleteTrainingSessionInCloud(sessionToDelete.id);

        soundFX.playScanSuccess();
        alert('✅ Đã xóa buổi họp và dữ liệu liên quan thành công!');
      } catch (err) {
        console.error('Lỗi khi xóa buổi họp trên cloud:', err);
      }
    }
  };

  // HÀM ĐỔI CHỦ ĐỀ CHO RIÊNG ĐỢT ĐIỂM DANH (XÁC THỰC MÃ THẺ CHỦ TRÌ THÔNG MINH)
  const handleEditShiftTopic = async (session: TrainingSession) => {
    const shift = session.currentShift || 'Ca Sáng';
    const currentTopic = (session.shiftTopics && session.shiftTopics[shift]) || session.title;

    // 1. Popup nhập mã thẻ
    const promptPin = prompt(
      `🔐 BẢO MẬT ĐỔI CHỦ ĐỀ [${shift}]\n\nChủ trì cuộc họp: "${session.instructor}"\n\nVui lòng nhập MÃ THẺ của Người chủ trì hoặc Mật khẩu Quản trị:`
    );

    if (promptPin === null) return; // Bấm Cancel

    const cleanInput = promptPin.trim().toLowerCase();
    const isAdmin = cleanInput === '8888';

    // 2. Tìm kiếm nhân sự theo mã thẻ vừa gõ trong danh sách 5.379 người
    let isAuthorized = isAdmin;

    if (!isAuthorized) {
      // Kiểm tra trùng trực tiếp mã thẻ đã lưu (nếu có)
      if (session.instructorCode && cleanInput === session.instructorCode.trim().toLowerCase()) {
        isAuthorized = true;
      } else {
        // Tìm thông tin người đang nhập mã trong danh sách nhân sự
        const foundEmp = employees.find(
          e => e.Employee_Code.trim().toLowerCase() === cleanInput
        );

        if (foundEmp) {
          // Lấy họ tên chuẩn của người nhập mã
          const empFullName = (foundEmp.Full_Name || `${foundEmp.Name} ${foundEmp.Surname}`).trim().toLowerCase();
          const targetInstructor = session.instructor.trim().toLowerCase();

          // Hàm phụ bỏ dấu tiếng Việt để so sánh chuẩn xác tuyệt đối
          const removeAccents = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');

          const cleanEmpName = removeAccents(empFullName);
          const cleanInstructor = removeAccents(targetInstructor);

          // Nếu tên người nhập chứa tên giảng viên hoặc ngược lại -> HỢP LỆ!
          if (cleanEmpName.includes(cleanInstructor) || cleanInstructor.includes(cleanEmpName)) {
            isAuthorized = true;
          }
        }
      }
    }

    // 3. Nếu không khớp cả tên lẫn mã thẻ
    if (!isAuthorized) {
      soundFX.playError();
      alert(`❌ XÁC THỰC THẤT BẠI!\n\nMã thẻ vừa nhập không trùng khớp với Người chủ trì cuộc họp này (${session.instructor}).\nChỉ người chủ trì cuộc họp mới có quyền đổi chủ đề của ca họp.`);
      return;
    }

    // 4. Nhập tên chủ đề mới cho ca này
    const newTopicName = prompt(
      `📝 ĐỔI CHỦ ĐỀ ĐÀO TẠO CHO [${shift}]:\n(Chủ đề của ca trước vẫn được giữ nguyên độc lập)\n\nNhập tên chủ đề mới:`,
      currentTopic
    );

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
    alert(`✅ Đã cập nhật chủ đề cho [${shift}] thành công!\n"${newTopicName.trim()}"`);
  };
  
  // HÀM XÓA LƯỢT ĐIỂM DANH (BẢO MẬT: BẮT BUỘC NHẬP PASS 8888)
  const handleDeleteRecord = async (record: AttendanceRecord) => {
    // 1. Popup bảo mật yêu cầu nhập mật khẩu quản trị
    const pin = prompt(
      `🔐 BẢO MẬT XÓA ĐIỂM DANH\n\nBạn đang yêu cầu xóa lượt điểm danh của:\n"${record.employeeName}" (Mã: ${record.employeeCode})\nThời gian: ${record.scanTime} - Ngày ${record.date}\n\nVui lòng nhập Mật khẩu Quản trị để xác nhận xóa:`
    );

    if (pin === null) return; // Người dùng bấm Hủy / Cancel

    // 2. Kiểm tra mật khẩu 8888
    if (pin.trim() !== '8888') {
      soundFX.playError();
      alert('❌ Mật khẩu quản trị không đúng! Bạn không có quyền xóa lượt điểm danh này.');
      return;
    }

    // 3. Nếu đúng mật khẩu thì mới tiến hành xóa sạch cả giao diện lẫn Cloud
    if (confirm(`Xác nhận xóa vĩnh viễn lượt điểm danh của "${record.employeeName}"?`)) {
      try {
        // Xóa trong danh sách giao diện
        setAttendanceRecords(prev => prev.filter(r => r.id !== record.id));

        // Xóa vĩnh viễn trên Cloud Firebase
        await deleteAttendanceRecordInCloud(record.id);

        soundFX.playScanSuccess();
        alert('✅ Đã xóa lượt điểm danh thành công!');
      } catch (err) {
        console.error('Lỗi khi xóa điểm danh trên cloud:', err);
        alert('Lỗi kết nối khi xóa dữ liệu trên máy chủ.');
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
              Điểm Danh Điện Tử Thay Giấy Ký Tên
            </span>
            <h2 className="text-xl font-extrabold text-slate-900 mt-1">
              Điểm Danh Đào Tạo & Tham Dự Họp
            </h2>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex-1 sm:flex-none px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4 text-blue-600" />
              Tạo Buổi Mới
            </button>
            <button
              onClick={handleExport}
              className="flex-1 sm:flex-none px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Xuất File Excel
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
                  {currentSession.type === 'safety' ? 'An toàn lao động' :
                   currentSession.type === 'training' ? 'Đào tạo nội bộ' :
                   currentSession.type === 'meeting' ? 'Cuộc họp' : currentSession.type}
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
                      Chủ đề riêng [{currentSession.currentShift || 'Ca Sáng'}]
                    </span>
                  )}
                </h3>

                {/* Nếu ca này có đổi tên riêng thì vẫn hiện tên gốc ban đầu nhỏ ở dưới */}
                {currentSession.shiftTopics && currentSession.shiftTopics[currentSession.currentShift || 'Ca Sáng'] && (
                  <p className="text-[11px] text-slate-500 font-medium">
                    (Khóa đào tạo gốc: {currentSession.title})
                  </p>
                )}
              </div>

              <div className="text-xs text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
                <span><strong>Giảng viên / Chủ trì:</strong> {currentSession.instructor}</span>
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-slate-400" /> <strong>Địa điểm:</strong> {currentSession.location}</span>
              </div>
            </div>

            {/* KHU VỰC ĐIỀU KHIỂN ĐIỂM DANH & NÚT ON / OFF */}
            <div className="w-full md:w-auto shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              {/* CÔNG TẮC BẬT / TẮT (ON / OFF) MỞ KHÓA ĐIỂM DANH */}
              <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-white border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Trạng thái điểm danh
                </span>
                
                <button
                  type="button"
                  onClick={() => handleToggleAttendanceOpen(currentSession)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all shadow-xs ${
                    currentSession.isAttendanceOpen
                      ? 'bg-emerald-600 text-white ring-2 ring-emerald-400 animate-pulse'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                  title="Bấm để Mở/Khóa điểm danh (Cần mã thẻ giảng viên)"
                >
                  <span className={`w-2 h-2 rounded-full ${currentSession.isAttendanceOpen ? 'bg-white' : 'bg-rose-500'}`}></span>
                  <span>{currentSession.isAttendanceOpen ? 'ĐANG MỞ (ON)' : 'ĐÃ KHÓA (OFF)'}</span>
                </button>
              </div>

              {/* CHỌN ĐỢT ĐIỂM DANH (CA SÁNG / CA CHIỀU) + NÚT ĐỔI CHỦ ĐỀ */}
              <div className="flex flex-col p-2 rounded-xl bg-white border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">
                    Đợt điểm danh
                  </span>
                  {/* NÚT BẤM ĐỔI CHỦ ĐỀ CHO RIÊNG CA NÀY */}
                  <button
                    type="button"
                    onClick={() => handleEditShiftTopic(currentSession)}
                    className="text-[10px] text-blue-600 hover:text-blue-800 font-bold hover:underline"
                    title="Đổi chủ đề đào tạo riêng cho ca này (Cần mã thẻ giảng viên)"
                  >
                    Đổi chủ đề ✏️
                  </button>
                </div>

                <select
                  value={currentSession.currentShift || 'Ca Sáng'}
                  onChange={(e) => handleChangeShift(currentSession, e.target.value)}
                  className="px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-lg text-xs font-extrabold text-blue-900 focus:outline-none cursor-pointer"
                >
                  <option value="Ca Sáng">☀️Sáng 07:00-11:30 (Đợt 1)</option>
                  <option value="Ca Chiều">🌤️Chiều 12:30-16:30 (Đợt 2)</option>
                </select>
              </div>

              {/* NÚT QUÉT BARCODE THẺ (SẼ BỊ KHÓA NẾU ĐANG OFF) */}
              <button
                type="button"
                onClick={() => {
                  if (!currentSession.isAttendanceOpen) {
                    soundFX.playError();
                    alert(`🔒 ĐIỂM DANH ĐANG BỊ KHÓA!\n\nNgười chủ trì (${currentSession.instructor}) chưa bật mở điểm danh.\nVui lòng bấm vào nút [ĐÃ KHÓA (OFF)] bên cạnh để mở khóa trước khi quét thẻ!`);
                    return;
                  }
                  onOpenScanner(currentSession.id);
                }}
                className={`px-5 py-3.5 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all active:scale-98 ${
                  currentSession.isAttendanceOpen
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25 cursor-pointer'
                    : 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                }`}
                title={currentSession.isAttendanceOpen ? 'Bấm để mở camera quét mã thẻ' : 'Điểm danh đang bị khóa bởi Giảng viên'}
              >
                <ScanLine className="w-5 h-5 animate-pulse" />
                <span>QUÉT THẺ [{currentSession.currentShift || 'Ca Sáng'}]</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-6 sm:p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 mx-auto flex items-center justify-center border border-blue-200">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900">Chưa Có Buổi Họp / Đào Tạo Nào</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                Bấm nút &ldquo;Tạo Buổi Mới&rdquo; bên dưới để thiết lập khóa đào tạo hoặc cuộc họp và bắt đầu quét mã vạch điểm danh.
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Tạo Buổi Đầu Tiên
            </button>
          </div>
        )}

        {/* KHU VỰC CHỌN BUỔI HỌP THIẾT KẾ MỚI (DROPDOWN + THÔNG TIN + NÚT XÓA) */}
        {sessions.length > 0 && (
          <div className="pt-3 border-t border-slate-200/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 flex-1">
              <span className="text-xs font-bold text-slate-700 shrink-0 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>Danh sách buổi họp ({sessions.length}):</span>
              </span>

              {/* Menu chọn buổi gọn gàng */}
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
                        [{s.date}] {s.title} ({count} người đã điểm danh)
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {/* Nút Xóa buổi họp hiện tại (Khóa Pass 8888) */}
            {currentSession && (
              <button
                type="button"
                onClick={() => handleDeleteSession(currentSession)}
                className="px-3 py-2 rounded-xl bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 hover:border-rose-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-2xs shrink-0"
                title={`Xóa buổi "${currentSession.title}"`}
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                <span>Xóa Buổi Này</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* 4 THẺ THỐNG KÊ MỚI: TỔNG SỐ - CAMERA TRỰC TIẾP - CHỤP ẢNH THẺ - NHẬP MÃ SỐ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Thẻ 1: Tổng số người đã điểm danh */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
          <span className="text-xs text-slate-500 block font-semibold">Đã Điểm Danh</span>
          <span className="text-2xl font-black text-blue-600 mt-1 block">
            {currentRecords.length}
          </span>
          <span className="text-[11px] text-slate-400">Tổng công nhân viên</span>
        </div>
      
        {/* Thẻ 2: Quét Camera Trực Tiếp */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
          <span className="text-xs text-slate-500 block font-semibold flex items-center gap-1">
            <Camera className="w-3.5 h-3.5 text-emerald-600" />
            <span>Camera Quét Thẻ</span>
          </span>
          <span className="text-2xl font-black text-emerald-600 mt-1 block">
            {currentRecords.filter(r => r.method === 'camera_scan' || !r.method).length}
          </span>
          <span className="text-[11px] text-slate-400">Trực tiếp thời gian thực</span>
        </div>
      
        {/* Thẻ 3: Chụp / Tải Ảnh Thẻ (THAY CHO THẺ PHÒNG BAN DỰ CŨ) */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
          <span className="text-xs text-slate-500 block font-semibold flex items-center gap-1">
            <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
            <span>Chụp / Tải Ảnh Thẻ</span>
          </span>
          <span className="text-2xl font-black text-indigo-600 mt-1 block">
            {currentRecords.filter(r => r.method === 'photo_scan').length}
          </span>
          <span className="text-[11px] text-slate-400">Giải mã barcode từ ảnh</span>
        </div>
      
        {/* Thẻ 4: Nhập Mã Số Thủ Công (THAY CHO THẺ CHỮ KÝ GIẤY CŨ) */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
          <span className="text-xs text-slate-500 block font-semibold flex items-center gap-1">
            <Keyboard className="w-3.5 h-3.5 text-purple-600" />
            <span>Nhập Mã Số Thẻ</span>
          </span>
          <span className="text-2xl font-black text-purple-600 mt-1 block">
            {currentRecords.filter(r => r.method === 'manual_entry').length}
          </span>
          <span className="text-[11px] text-slate-400">Nhập thủ công bằng tay</span>
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
              placeholder="Tìm theo tên, mã NV, bộ phận..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-sm"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <select
              value={selectedDeptFilter}
              onChange={(e) => setSelectedDeptFilter(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:border-blue-500 shadow-sm"
            >
              <option value="all">Tất cả phòng ban ({currentRecords.length})</option>
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
                ? 'Chưa có ai điểm danh cho buổi này' 
                : 'Không tìm thấy kết quả phù hợp'}
            </p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              Nhấn nút &ldquo;QUÉT BARCODE THẺ&rdquo; để quét mã vạch trên thẻ công nhân viên ghi nhận điểm danh tức thì.
            </p>
            <button
              onClick={() => onOpenScanner(currentSession.id)}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <ScanLine className="w-4 h-4" />
              Mở Trình Quét Ngay
            </button>
          </div>
        ) : (
          <div>
            {/* ================= MOBILE VIEW (NO HORIZONTAL SCROLL) ================= */}
            <div className="block md:hidden divide-y divide-slate-100">
              {filteredRecords.map((r, index) => (
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
                      title="Xoá lượt này"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0"
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

            {/* ================= DESKTOP VIEW (CLEAN TABLE) ================= */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold">
                    <th className="p-3 w-12 text-center">STT</th>
                    <th className="p-3">Mã Thẻ (Code)</th>
                    <th className="p-3">Họ và Tên</th>
                    <th className="p-3">Bộ Phận / Xưởng</th>
                    <th className="p-3">Chức Vụ</th>
                    <th className="p-3">Giờ Điểm Danh</th>
                    <th className="p-3">Chủ Đề Đào Tạo Của Ca</th>
                    <th className="p-3">Phương Thức</th>
                    <th className="p-3 w-14 text-center">Thao Tác</th>
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
                          {r.attendanceShift || 'Ca Sáng'}
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
                            <ImageIcon className="w-3 h-3" /> Chụp ảnh thẻ
                          </span>
                        ) : r.method === 'manual_entry' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-[11px] font-semibold">
                            <Keyboard className="w-3 h-3" /> Nhập mã số
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Camera quét thẻ
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleDeleteRecord(r)}
                          title="Xoá lượt này"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
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
          <div className="bg-white border border-slate-200 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4 text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-base text-slate-900">Tạo Buổi Họp / Đào Tạo Mới</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleCreateSession} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 mb-1 font-bold">
                  Tên Khóa Đào Tạo / Cuộc Họp <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="VD: Đào tạo quy trình may áo Polo xuất khẩu 2026"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-bold">
                  Phân Loại <span className="text-rose-500">*</span>
                </label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500 font-medium"
                >
                  <option value="training">Đào tạo tay nghề & Kỹ thuật</option>
                  <option value="safety">An toàn lao động & PCCC</option>
                  <option value="meeting">Họp giao ban / Cuộc họp nội bộ</option>
                  <option value="other">📌 Hoạt động khác...</option>
                </select>

                {newType === 'other' && (
                  <div className="mt-2 animate-in fade-in duration-150">
                    <input
                      type="text"
                      required
                      value={customTypeName}
                      onChange={(e) => setCustomTypeName(e.target.value)}
                      placeholder="Gõ tên phân loại (VD: Khám sức khỏe định kỳ, Tập huấn 5S, Team building...)"
                      className="w-full px-3 py-2 bg-purple-50/70 border border-purple-300 rounded-xl text-slate-900 focus:outline-none focus:border-purple-500 font-medium text-xs placeholder-slate-400"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-bold">
                  Người Phụ Trách / Giảng Viên <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    value={newInstructor}
                    onChange={(e) => setNewInstructor(e.target.value)}
                    placeholder="Họ tên giảng viên"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500 font-medium text-xs"
                  />
                  <input
                    type="text"
                    required
                    value={newInstructorCode}
                    onChange={(e) => setNewInstructorCode(e.target.value)}
                    placeholder="Mã thẻ giảng viên"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500 font-mono font-bold text-xs"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1 italic">
                  * Giảng viên sẽ dùng Mã số thẻ này để BẬT/TẮT mở khóa điểm danh cho buổi học.
                </p>
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-bold">
                  Địa Điểm Họp / Đào Tạo <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedLocationType}
                  onChange={(e) => setSelectedLocationType(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500 font-medium"
                >
                  <option value="Phòng Họp Vịnh Hạ Long (NV1)">Phòng Họp Vịnh Hạ Long (Nhà máy NV1)</option>
                  <option value="Phòng Họp Bà Nà Hill (NV2)">Phòng Họp Bà Nà Hill (Nhà máy NV2)</option>
                  <option value="other">📍 Phòng khác / Khu vực khác...</option>
                </select>
              
                {selectedLocationType === 'other' && (
                  <div className="mt-2">
                    <input
                      type="text"
                      required
                      value={customLocationName}
                      onChange={(e) => setCustomLocationName(e.target.value)}
                      placeholder="Gõ tên phòng hoặc địa điểm (VD: Hội trường nhà ăn, Xưởng May 1...)"
                      className="w-full px-3 py-2 bg-blue-50/60 border border-blue-300 rounded-xl text-slate-900 text-xs font-bold"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-700 mb-1 font-bold">Ngày</label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full px-2 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 mb-1 font-bold">Bắt Đầu</label>
                  <input
                    type="time"
                    value={newStartTime}
                    onChange={(e) => setNewStartTime(e.target.value)}
                    className="w-full px-2 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 mb-1 font-bold">Kết Thúc</label>
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
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors shadow-sm"
                >
                  Tạo Mới & Bắt Đầu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
