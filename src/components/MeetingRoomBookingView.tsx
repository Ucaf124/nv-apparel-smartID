/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Clock, 
  Users, 
  FileSpreadsheet, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  ScanLine, 
  Trash2, 
  MapPin, 
  CalendarDays,
  Calendar as CalendarIcon,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  UserCheck,
  Lock
} from 'lucide-react';
import { Employee, RoomBooking, TrainingSession, maskEmployeeCode } from '../types';
import { PRESET_ROOMS } from '../data/mockEmployees';
import { exportRoomBookingsToExcel } from '../utils/exportExcel';
import { soundFX } from '../utils/audio';
import { deleteRoomBookingInCloud, saveRoomBookingToCloud, saveTrainingSessionToCloud } from '../services/firebaseSync';

// Danh sách tài khoản có quyền duyệt đặt phòng họp
const APPROVERS = [
  { username: 'duypt', pass: 'duypt@356', name: 'Phan Thị Mỹ Duyên', code: '210190653' },
  { username: 'yaitp', pass: 'yaitp#632', name: 'Thaisit Phawang (Yai)', code: '210180632' },
  { username: 'admin', pass: '8888', name: 'Quản Trị Viên (Admin)', code: 'ADMIN' }
];

interface MeetingRoomBookingViewProps {
  employees: Employee[];
  bookings: RoomBooking[];
  setSessions?: React.Dispatch<React.SetStateAction<TrainingSession[]>>;
  setBookings: React.Dispatch<React.SetStateAction<RoomBooking[]>>;
  onOpenScannerForRoomBooking: (roomId: string, date: string) => void;
  onOpenScannerForRoomCheckIn?: (bookingId: string) => void;
}

export const MeetingRoomBookingView: React.FC<MeetingRoomBookingViewProps> = ({
  employees,
  bookings,
  setSessions,
  setBookings,
  onOpenScannerForRoomBooking
}) => {
  const todayStr = new Date().toISOString().split('T')[0];

  // Chế độ xem: 'calendar' (Lịch tháng) hoặc 'list' (Chi tiết theo ngày)
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedRoomId, setSelectedRoomId] = useState<string>('vinh_ha_long');

  // Điều hướng tháng trong Lịch Tháng
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth()); // 0 - 11

  // Form states
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [modalRoomId, setModalRoomId] = useState('vinh_ha_long');
  const [bookTitle, setBookTitle] = useState('');
  const [bookHostName, setBookHostName] = useState('');
  const [bookEmpCode, setBookEmpCode] = useState('');
  const [bookEmpName, setBookEmpName] = useState('');
  const [bookDept, setBookDept] = useState('');
  const [bookPhone, setBookPhone] = useState('');
  
  // Đặt phòng theo dải ngày: Từ ngày -> Đến ngày
  const [bookStartDate, setBookStartDate] = useState(todayStr);
  const [bookEndDate, setBookEndDate] = useState(todayStr);
  
  const [bookStartTime, setBookStartTime] = useState('09:00');
  const [bookEndTime, setBookEndTime] = useState('10:30');
  const [bookParticipants, setBookParticipants] = useState(10);
  const [selectedEquipments, setSelectedEquipments] = useState<string[]>(['Máy chiếu 4K Ultra HD', 'Bảng kính']);
  const [formError, setFormError] = useState<string | null>(null);

  // Popup duyệt đăng nhập
  const [approvingBooking, setApprovingBooking] = useState<RoomBooking | null>(null);
  const [approverUser, setApproverUser] = useState('');
  const [approverPass, setApproverPass] = useState('');
  const [approverError, setApproverError] = useState('');

  const currentRoom = PRESET_ROOMS.find(r => r.id === selectedRoomId) || PRESET_ROOMS[0];

  const handleEmpCodeChange = (code: string) => {
    setBookEmpCode(code);
    const found = employees.find(e => e.Employee_Code.trim().toLowerCase() === code.trim().toLowerCase());
    if (found) {
      const name = found.Full_Name || `${found.Name} ${found.Surname}`;
      setBookEmpName(name);
      setBookDept(found.Department_Eng);
      if (!bookHostName) setBookHostName(name);
      if (found.Phone) setBookPhone(found.Phone);
    }
  };

  // Helper kiểm tra 1 ngày cụ thể có nằm trong dải [startDate, endDate] của booking hay không
  const isDateInRange = (checkDate: string, startDate: string, endDate?: string) => {
    const end = endDate || startDate;
    return checkDate >= startDate && checkDate <= end;
  };

  // Lọc bookings cho ngày đang chọn
  const dateBookings = useMemo(() => {
    return bookings.filter(b => isDateInRange(selectedDate, b.date, b.endDate));
  }, [bookings, selectedDate]);

  const roomBookings = useMemo(() => {
    return dateBookings.filter(b => b.roomId === selectedRoomId);
  }, [dateBookings, selectedRoomId]);

  // HÀM TẠO ĐẶT PHÒNG (TRẠNG THÁI BAN ĐẦU: PENDING - CHỜ DUYỆT)
  const handleCreateBooking = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!bookTitle.trim()) {
      setFormError('Vui lòng nhập chủ đề cuộc họp');
      return;
    }
    if (!bookHostName.trim()) {
      setFormError('Vui lòng nhập người chủ trì / người họp');
      return;
    }
    if (!bookEmpCode.trim()) {
      setFormError('Vui lòng nhập hoặc quét mã thẻ người đặt');
      return;
    }
    if (bookStartDate > bookEndDate) {
      setFormError('Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu');
      return;
    }
    if (bookStartTime >= bookEndTime) {
      setFormError('Giờ kết thúc phải lớn hơn giờ bắt đầu');
      return;
    }

    // Kiểm tra trùng lịch: Trong bất kỳ ngày nào thuộc dải ngày [bookStartDate -> bookEndDate], cùng phòng họp, trùng giờ
    const isConflict = bookings.some(b => {
      if (b.roomId !== modalRoomId || b.status === 'cancelled' || b.status === 'rejected') return false;

      const bStart = b.date;
      const bEnd = b.endDate || b.date;

      // Kiểm tra 2 dải ngày có giao nhau không
      const dateOverlap = !(bookEndDate < bStart || bookStartDate > bEnd);
      if (!dateOverlap) return false;

      // Kiểm tra khung giờ có đụng nhau không
      const timeOverlap = (
        (bookStartTime >= b.startTime && bookStartTime < b.endTime) ||
        (bookEndTime > b.startTime && bookEndTime <= b.endTime) ||
        (bookStartTime <= b.startTime && bookEndTime >= b.endTime)
      );

      return timeOverlap;
    });

    if (isConflict) {
      soundFX.playError();
      setFormError('Khoảng thời gian này phòng đã có người đặt trước! Vui lòng chọn ngày hoặc giờ khác.');
      return;
    }

    const roomObj = PRESET_ROOMS.find(r => r.id === modalRoomId);

    const newBooking: RoomBooking = {
      id: `booking_${Date.now()}`,
      roomId: modalRoomId,
      roomName: roomObj?.name || 'Phòng họp',
      bookedByCode: bookEmpCode.trim(),
      bookedByName: bookEmpName.trim() || 'Người đặt phòng',
      department: bookDept.trim() || 'Khối Sản Xuất',
      phone: bookPhone.trim(),
      title: bookTitle.trim(),
      hostName: bookHostName.trim(),
      date: bookStartDate,
      endDate: bookEndDate,
      startTime: bookStartTime,
      endTime: bookEndTime,
      participantsCount: Number(bookParticipants),
      equipmentsNeeded: selectedEquipments,
      status: 'pending', // Chờ duyệt
      createdAt: new Date().toISOString()
    };

    soundFX.playScanSuccess();
    setBookings(prev => [newBooking, ...prev]);
    saveRoomBookingToCloud(newBooking).catch(console.error);

    setShowBookingModal(false);
    setBookTitle('');
    setBookHostName('');
    setBookEmpCode('');
    setBookEmpName('');
    setBookDept('');
    alert('✅ Đã gửi yêu cầu đặt phòng thành công! Cuộc họp đang ở trạng thái CHỜ XÁC NHẬN từ chị Mỹ Duyên hoặc anh Yai.');
  };

  // HÀM PHÊ DUYỆT ĐẶT PHÒNG (Duyệt bởi duypt hoặc yaitp)
  const handleApproveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApproverError('');

    const matchedApprover = APPROVERS.find(
      u => u.username.toLowerCase() === approverUser.trim().toLowerCase() && u.pass === approverPass.trim()
    );

    if (!matchedApprover) {
      soundFX.playError();
      setApproverError('Sai tên đăng nhập hoặc mật khẩu người duyệt!');
      return;
    }

    if (!approvingBooking) return;

    const nowStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + todayStr;

    // 1. Tạo object booking đã duyệt
    const updatedBooking: RoomBooking = {
      ...approvingBooking,
      status: 'confirmed',
      approvedBy: `${matchedApprover.name} (${matchedApprover.username})`,
      approvedAt: nowStr
    };

    // 2. Tạo object buổi họp bên Điểm danh
    const autoSession: TrainingSession = {
      id: `session_auto_${updatedBooking.id}`,
      title: updatedBooking.title,
      instructor: updatedBooking.hostName || updatedBooking.bookedByName,
      location: updatedBooking.roomName,
      date: updatedBooking.date,
      startTime: updatedBooking.startTime,
      endTime: updatedBooking.endTime,
      type: 'meeting',
      createdAt: new Date().toISOString(),
      status: 'active'
    };

    // 3. Cập nhật state giao diện máy hiện tại ngay lập tức
    setBookings(prev => prev.map(b => b.id === approvingBooking.id ? updatedBooking : b));

    if (setSessions) {
      setSessions(prev => {
        if (prev.some(s => s.id === autoSession.id || (s.title === autoSession.title && s.date === autoSession.date))) {
          return prev;
        }
        return [autoSession, ...prev];
      });
    }

    // 4. LƯU LÊN CLOUD FIREBASE (CHẠY SONG SONG ĐỘC LẬP - BẢO ĐẢM CẢ 2 ĐỀU ĐƯỢC ĐẨY LÊN)
    try {
      await Promise.all([
        saveRoomBookingToCloud(updatedBooking),
        saveTrainingSessionToCloud(autoSession)
      ]);
      console.log('Đã đồng bộ trạng thái duyệt và buổi điểm danh lên Cloud thành công!');
    } catch (err) {
      console.error('Lỗi khi đẩy dữ liệu duyệt lên Cloud:', err);
    }

    soundFX.playScanSuccess();
    setApprovingBooking(null);
    setApproverUser('');
    setApproverPass('');
    alert(`✅ ĐÃ XÁC NHẬN ĐẶT PHÒNG THÀNH CÔNG!\n\nNgười duyệt: ${matchedApprover.name}\nĐã tự động tạo form ký tên buổi họp "${updatedBooking.title}" bên tab Điểm Danh.`);
  };

  // Hủy/Xóa đặt phòng
  const handleCancelBooking = async (booking: RoomBooking) => {
    const promptInput = prompt(
      `🔐 BẢO MẬT HỦY ĐẶT PHÒNG\n\nCuộc họp: "${booking.title}"\n\nĐể hủy lịch này, vui lòng nhập MÃ THẺ của người đặt hoặc Mật khẩu Quản trị:`
    );

    if (promptInput === null) return;

    const cleanInput = promptInput.trim().toLowerCase();
    const isOwner = cleanInput === booking.bookedByCode.trim().toLowerCase();
    const isAdmin = cleanInput === '8888' || cleanInput === 'duypt@356' || cleanInput === 'yaitp#632';

    if (!isOwner && !isAdmin) {
      soundFX.playError();
      alert('❌ Xác thực thất bại! Bạn không có quyền hủy lịch này.');
      return;
    }

    if (confirm(`Xác nhận hủy cuộc họp "${booking.title}"?`)) {
      setBookings(prev => prev.filter(b => b.id !== booking.id));
      await deleteRoomBookingInCloud(booking.id);
      soundFX.playScanSuccess();
    }
  };

  // LOGIC LỊCH THÁNG (Calendar Grid)
  const monthNames = [
    'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
    'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
  ];

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay(); // 0 là CN, 1 là T2...
  // Chuyển về chuẩn Thứ 2 = 0, CN = 6
  const startOffset = (firstDayOfWeek + 6) % 7;

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(y => y - 1);
    } else {
      setCurrentMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(y => y + 1);
    } else {
      setCurrentMonth(m => m + 1);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Banner & Action */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              Quy Trình Duyệt Phòng Họp Nhà Máy
            </span>
            <h2 className="text-xl font-extrabold text-slate-900 mt-1">
              Phòng Họp Vịnh Hạ Long & Bà Nà Hill
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Phê duyệt bởi: <strong>Chị Phan Thị Mỹ Duyên</strong> hoặc <strong>Anh Thaisit Phawang (Yai)</strong>
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Chuyển đổi xem Lịch Tháng / Lịch Ngày */}
            <div className="flex p-0.5 bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold shadow-2xs">
              <button
                onClick={() => setViewMode('calendar')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  viewMode === 'calendar' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CalendarIcon className="w-3.5 h-3.5" />
                <span>Lịch Tháng</span>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  viewMode === 'list' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Lịch Theo Ngày</span>
              </button>
            </div>

            <button
              onClick={() => {
                setModalRoomId(selectedRoomId);
                setShowBookingModal(true);
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Đặt Phòng Mới</span>
            </button>

            <button
              onClick={() => exportRoomBookingsToExcel(bookings)}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden sm:inline">Xuất Excel</span>
            </button>
          </div>
        </div>

        {/* Chú thích màu trạng thái (Legend) */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <span className="font-bold text-slate-700">Chú thích lịch:</span>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-xs"></span>
              <span className="font-semibold text-emerald-800">Đã Xác Nhận (Đã Duyệt)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-400 shadow-xs"></span>
              <span className="font-semibold text-amber-800">Chờ Xác Nhận (Chưa Duyệt)</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500">Xem phòng:</span>
            <select
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
              className="px-2.5 py-1 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-blue-900 focus:outline-none"
            >
              {PRESET_ROOMS.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ================= GIAO DIỆN 1: LỊCH XEM THEO THÁNG (MONTH CALENDAR) ================= */}
      {viewMode === 'calendar' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
          {/* Header điều hướng Tháng */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <h3 className="font-black text-base sm:text-lg text-slate-900">
                {monthNames[currentMonth]} / {currentYear}
              </h3>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-200">
                {currentRoom.name}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 transition-colors shadow-2xs"
                title="Tháng trước"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setCurrentYear(new Date().getFullYear());
                  setCurrentMonth(new Date().getMonth());
                }}
                className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-bold hover:bg-slate-50"
              >
                Hôm nay
              </button>
              <button
                onClick={handleNextMonth}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 transition-colors shadow-2xs"
                title="Tháng sau"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Lưới Lịch Tháng (Thứ 2 -> Chủ Nhật) */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'].map((dayName, idx) => (
              <div key={dayName} className="text-center font-bold text-xs py-2 text-slate-500 bg-slate-50 rounded-lg">
                {dayName}
              </div>
            ))}

            {/* Các ô trống trước ngày 1 */}
            {Array.from({ length: startOffset }).map((_, i) => (
              <div key={'empty-' + i} className="min-h-[90px] sm:min-h-[115px] p-1 bg-slate-50/40 rounded-xl border border-dashed border-slate-200/60" />
            ))}

            {/* Các ngày trong tháng */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateString = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const isTodayCell = dateString === todayStr;

              // Lấy các cuộc họp trong ngày này của phòng đang chọn
              const cellBookings = bookings.filter(b => 
                b.roomId === selectedRoomId && 
                b.status !== 'cancelled' && 
                b.status !== 'rejected' &&
                isDateInRange(dateString, b.date, b.endDate)
              );

              return (
                <div
                  key={dateString}
                  onClick={() => {
                    setSelectedDate(dateString);
                    setViewMode('list'); // Bấm vào ngày để xem chi tiết
                  }}
                  className={`min-h-[95px] sm:min-h-[120px] p-1.5 sm:p-2 rounded-xl border transition-all flex flex-col justify-between cursor-pointer ${
                    isTodayCell
                      ? 'bg-blue-50/50 border-blue-400 ring-2 ring-blue-500/20'
                      : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-black w-6 h-6 rounded-full flex items-center justify-center ${
                      isTodayCell ? 'bg-blue-600 text-white' : 'text-slate-800'
                    }`}>
                      {dayNum}
                    </span>

                    {cellBookings.length > 0 && (
                      <span className="text-[10px] font-mono font-bold text-slate-400">
                        {cellBookings.length} cuộc
                      </span>
                    )}
                  </div>

                  {/* Danh sách các cuộc họp mini trong ô ngày */}
                  <div className="space-y-1 my-1 overflow-y-auto max-h-[70px] sm:max-h-[85px]">
                    {cellBookings.slice(0, 3).map(b => {
                      const isConfirmed = b.status === 'confirmed';
                      const isMultiDay = b.endDate && b.endDate !== b.date;

                      return (
                        <div
                          key={b.id + '-' + dateString}
                          className={`p-1 rounded text-[10px] leading-tight font-semibold border truncate ${
                            isConfirmed
                              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                              : 'bg-amber-50 text-amber-900 border-amber-200 animate-pulse'
                          }`}
                          title={`[${b.startTime} - ${b.endTime}] ${b.title}\nNgười đặt: ${b.bookedByName}\nChủ trì: ${b.hostName || '-'}\nTrạng thái: ${isConfirmed ? 'Đã duyệt' : 'Chờ duyệt'}`}
                        >
                          <div className="flex items-center gap-1 font-mono text-[9px] font-bold">
                            <span>{b.startTime}-{b.endTime}</span>
                            {isMultiDay && <span className="text-purple-600 font-sans">📅 Nhiều ngày</span>}
                          </div>
                          <div className="truncate font-bold">{b.title}</div>
                        </div>
                      );
                    })}

                    {cellBookings.length > 3 && (
                      <div className="text-[9px] text-slate-500 font-bold text-center">
                        + {cellBookings.length - 3} cuộc khác
                      </div>
                    )}
                  </div>

                  {cellBookings.length === 0 && (
                    <div className="text-[10px] text-slate-300 text-center font-medium py-1">
                      Trống
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= GIAO DIỆN 2: CHI TIẾT THEO NGÀY (CÓ NÚT DUYỆT BỞI MỸ DUYÊN / YAI) ================= */}
      {viewMode === 'list' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-3">
              <CalendarDays className="w-5 h-5 text-blue-600" />
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                  Lịch Trình Chi Tiết: {currentRoom.name}
                </h3>
                <p className="text-xs text-slate-500">
                  Ngày đang chọn: <strong className="text-blue-700">{selectedDate}</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
              />
              <button
                onClick={() => setViewMode('calendar')}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold hover:bg-slate-50"
              >
                Về Lịch Tháng
              </button>
            </div>
          </div>

          {roomBookings.length === 0 ? (
            <div className="p-8 sm:p-12 text-center space-y-2">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <p className="text-base font-bold text-slate-800">Ngày này chưa có cuộc họp nào!</p>
              <p className="text-xs text-slate-500">Bạn có thể bấm &ldquo;Đặt Phòng Mới&rdquo; để đăng ký mượn phòng.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {roomBookings
                .sort((a, b) => a.startTime.localeCompare(b.startTime))
                .map(booking => {
                  const isConfirmed = booking.status === 'confirmed';
                  const isPending = booking.status === 'pending';
                  const isMultiDay = booking.endDate && booking.endDate !== booking.date;

                  return (
                    <div
                      key={booking.id}
                      className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-3 ${
                        isConfirmed
                          ? 'bg-emerald-50/70 border-emerald-300'
                          : 'bg-amber-50/80 border-amber-300'
                      }`}
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-white text-blue-700 border border-slate-300 shadow-2xs">
                            {booking.startTime} - {booking.endTime}
                          </span>

                          {isMultiDay && (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-300">
                              Từ {booking.date} đến {booking.endDate}
                            </span>
                          )}

                          {isConfirmed ? (
                            <span className="text-[11px] px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              ĐÃ XÁC NHẬN (Bởi {booking.approvedBy || 'Quản trị viên'})
                            </span>
                          ) : (
                            <span className="text-[11px] px-2.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-extrabold flex items-center gap-1 animate-pulse">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                              CHỜ XÁC NHẬN (Chưa duyệt)
                            </span>
                          )}
                        </div>

                        <h4 className="font-extrabold text-slate-900 text-sm sm:text-base">
                          {booking.title}
                        </h4>

                        <div className="text-xs text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
                          <span><strong>Người họp / Chủ trì:</strong> <span className="text-blue-900 font-bold">{booking.hostName || booking.bookedByName}</span></span>
                          <span><strong>Người đặt:</strong> {booking.bookedByName} ({maskEmployeeCode(booking.bookedByCode)})</span>
                          <span><strong>Bộ phận:</strong> {booking.department}</span>
                          <span><strong>Số người:</strong> {booking.participantsCount}</span>
                        </div>
                      </div>

                      {/* Nút thao tác: Duyệt & Hủy */}
                      <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end border-t md:border-t-0 pt-2 md:pt-0 border-slate-200">
                        {/* NÚT DUYỆT (CHỈ HIỆN KHI CHƯA DUYỆT) */}
                        {isPending && (
                          <button
                            onClick={() => {
                              setApprovingBooking(booking);
                              setApproverUser('');
                              setApproverPass('');
                              setApproverError('');
                            }}
                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                          >
                            <ShieldCheck className="w-4 h-4" />
                            <span>Xác Nhận Đặt Phòng</span>
                          </button>
                        )}

                        <button
                          onClick={() => handleCancelBooking(booking)}
                          className="p-2 rounded-xl bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 transition-colors shadow-2xs"
                          title="Hủy / Xóa lịch này (Cần mã thẻ người đặt hoặc pass 8888)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* ================= MODAL 1: ĐẶT PHÒNG HỌP (CÓ TỪ NGÀY -> ĐẾN NGÀY) ================= */}
      {showBookingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-base text-slate-900">
                Đặt Phòng Họp Nhà Máy
              </h3>
              <button
                onClick={() => setShowBookingModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateBooking} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 mb-1 font-bold">
                  Chọn Phòng Họp <span className="text-rose-500">*</span>
                </label>
                <select
                  value={modalRoomId}
                  onChange={(e) => setModalRoomId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500 font-bold"
                >
                  {PRESET_ROOMS.map(r => (
                    <option key={r.id} value={r.id}>{r.name} (Sức chứa {r.capacity} người)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-bold">
                  Chủ Đề Cuộc Họp <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={bookTitle}
                  onChange={(e) => setBookTitle(e.target.value)}
                  placeholder="VD: Họp KPI, SCR, Kế hoạch tuần..."
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>

              {/* Ô NGƯỜI HỌP / CHỦ TRÌ (BỔ SUNG THEO YÊU CẦU) */}
              <div>
                <label className="block text-slate-700 mb-1 font-bold">
                  Người Họp / Chủ Trì Cuộc Họp <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={bookHostName}
                  onChange={(e) => setBookHostName(e.target.value)}
                  placeholder="VD: Nguyễn Huỳnh Như Ngọc (Sewing Supervisor)"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-700 font-bold">
                    Mã Thẻ Người Đặt <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => onOpenScannerForRoomBooking(modalRoomId, bookStartDate)}
                    className="text-[11px] text-blue-600 hover:text-blue-800 flex items-center gap-1 font-bold"
                  >
                    <ScanLine className="w-3.5 h-3.5" />
                    Bật Camera Quét Thẻ
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={bookEmpCode}
                  onChange={(e) => handleEmpCodeChange(e.target.value)}
                  placeholder="Nhập hoặc quét mã thẻ nhân viên..."
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono font-bold focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 mb-1 font-bold">Họ Tên</label>
                  <input
                    type="text"
                    value={bookEmpName}
                    onChange={(e) => setBookEmpName(e.target.value)}
                    placeholder="Tự điền khi quét/nhập mã"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-medium focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 mb-1 font-bold">Bộ Phận</label>
                  <input
                    type="text"
                    value={bookDept}
                    onChange={(e) => setBookDept(e.target.value)}
                    placeholder="VD: Production"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-medium focus:outline-none"
                  />
                </div>
              </div>

              {/* CHỌN TỪ NGÀY -> ĐẾN NGÀY (HỖ TRỢ MƯỢN NHIỀU NGÀY) */}
              <div className="grid grid-cols-2 gap-2 p-2.5 bg-blue-50/60 border border-blue-200 rounded-xl">
                <div>
                  <label className="block text-blue-900 mb-1 font-bold">Từ Ngày</label>
                  <input
                    type="date"
                    required
                    value={bookStartDate}
                    onChange={(e) => {
                      setBookStartDate(e.target.value);
                      if (e.target.value > bookEndDate) setBookEndDate(e.target.value);
                    }}
                    className="w-full px-2 py-2 bg-white border border-blue-200 rounded-lg text-slate-900 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-blue-900 mb-1 font-bold">Đến Ngày</label>
                  <input
                    type="date"
                    required
                    value={bookEndDate}
                    onChange={(e) => setBookEndDate(e.target.value)}
                    className="w-full px-2 py-2 bg-white border border-blue-200 rounded-lg text-slate-900 text-xs font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 mb-1 font-bold">Từ Giờ</label>
                  <input
                    type="time"
                    required
                    value={bookStartTime}
                    onChange={(e) => setBookStartTime(e.target.value)}
                    className="w-full px-2 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-medium text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 mb-1 font-bold">Đến Giờ</label>
                  <input
                    type="time"
                    required
                    value={bookEndTime}
                    onChange={(e) => setBookEndTime(e.target.value)}
                    className="w-full px-2 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-medium text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-bold">Số Người Tham Gia</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={bookParticipants}
                  onChange={(e) => setBookParticipants(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-medium"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowBookingModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors shadow-sm"
                >
                  Gửi Yêu Cầu Đặt Phòng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL 2: XÁC NHẬN DUYỆT BỞI MỸ DUYÊN / YAI ================= */}
      {approvingBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4 text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="font-extrabold text-sm text-slate-900">
                  Xác Nhận Phê Duyệt Phòng Họp
                </h3>
              </div>
              <button
                onClick={() => setApprovingBooking(null)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
              <p><strong>Cuộc họp:</strong> {approvingBooking.title}</p>
              <p><strong>Phòng:</strong> {approvingBooking.roomName}</p>
              <p><strong>Thời gian:</strong> {approvingBooking.startTime} - {approvingBooking.endTime}</p>
              <p><strong>Ngày:</strong> {approvingBooking.date}{approvingBooking.endDate && approvingBooking.endDate !== approvingBooking.date ? ` đến ${approvingBooking.endDate}` : ''}</p>
              <p><strong>Người chủ trì:</strong> {approvingBooking.hostName || approvingBooking.bookedByName}</p>
            </div>

            {approverError && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
                ❌ {approverError}
              </div>
            )}

            <form onSubmit={handleApproveSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 mb-1 font-bold">
                  Tài khoản người duyệt:
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={approverUser}
                  onChange={(e) => setApproverUser(e.target.value)}
                  placeholder="duypt hoặc yaitp..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-bold">
                  Mật khẩu:
                </label>
                <input
                  type="password"
                  required
                  value={approverPass}
                  onChange={(e) => setApproverPass(e.target.value)}
                  placeholder="Nhập mật khẩu người duyệt..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setApprovingBooking(null)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black transition-all shadow-sm"
                >
                  Xác Nhận & Tạo Form
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
