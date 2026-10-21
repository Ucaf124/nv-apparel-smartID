/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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
  LogOut,
  AlertTriangle
} from 'lucide-react';
import { Employee, RoomBooking } from '../types';
import { PRESET_ROOMS } from '../data/mockEmployees';
import { exportRoomBookingsToExcel } from '../utils/exportExcel';
import { soundFX } from '../utils/audio';
import { deleteRoomBookingInCloud, saveRoomBookingToCloud } from '../services/firebaseSync';

interface MeetingRoomBookingViewProps {
  employees: Employee[];
  bookings: RoomBooking[];
  setBookings: React.Dispatch<React.SetStateAction<RoomBooking[]>>;
  onOpenScannerForRoomBooking: (roomId: string, date: string) => void;
  onOpenScannerForRoomCheckIn: (bookingId: string) => void;
}

export const MeetingRoomBookingView: React.FC<MeetingRoomBookingViewProps> = ({
  employees,
  bookings,
  setBookings,
  onOpenScannerForRoomBooking,
  onOpenScannerForRoomCheckIn
}) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedRoomId, setSelectedRoomId] = useState<string>('vinh_ha_long');
  const [showBookingModal, setShowBookingModal] = useState(false);

  // Đồng hồ chạy thời gian thực để tự tính toán lố giờ từng phút
  const [currentTimeStr, setCurrentTimeStr] = useState(() => {
    const d = new Date();
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setCurrentTimeStr(`${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`);
    }, 10000); // cập nhật mỗi 10 giây
    return () => clearInterval(timer);
  }, []);

  // Form states
  const [modalRoomId, setModalRoomId] = useState('vinh_ha_long');
  const [bookTitle, setBookTitle] = useState('');
  const [bookEmpCode, setBookEmpCode] = useState('');
  const [bookEmpName, setBookEmpName] = useState('');
  const [bookDept, setBookDept] = useState('');
  const [bookPhone, setBookPhone] = useState('');
  const [bookStartTime, setBookStartTime] = useState('09:00');
  const [bookEndTime, setBookEndTime] = useState('10:30');
  const [bookParticipants, setBookParticipants] = useState(10);
  const [selectedEquipments, setSelectedEquipments] = useState<string[]>(['Máy chiếu 4K Ultra HD', 'Bảng kính']);
  const [formError, setFormError] = useState<string | null>(null);

  const handleEmpCodeChange = (code: string) => {
    setBookEmpCode(code);
    const found = employees.find(e => e.Employee_Code.trim().toLowerCase() === code.trim().toLowerCase());
    if (found) {
      setBookEmpName(found.Full_Name || `${found.Name} ${found.Surname}`);
      setBookDept(found.Department_Eng);
      if (found.Phone) setBookPhone(found.Phone);
    }
  };

  const currentRoom = PRESET_ROOMS.find(r => r.id === selectedRoomId) || PRESET_ROOMS[0];
  const dateBookings = bookings.filter(b => b.date === selectedDate);
  const roomBookings = dateBookings.filter(b => b.roomId === selectedRoomId);
  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  // Hàm tính số phút chênh lệch giữa 2 mốc thời gian HH:mm
  const getMinutesDiff = (t1: string, t2: string) => {
    const [h1, m1] = t1.split(':').map(Number);
    const [h2, m2] = t2.split(':').map(Number);
    return (h1 * 60 + m1) - (h2 * 60 + m2);
  };

  // HÀM TRẢ PHÒNG (CHECK-OUT)
  const handleCheckOut = async (booking: RoomBooking) => {
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    
    if (confirm(`Xác nhận trả phòng cho cuộc họp "${booking.title}"? Phòng sẽ chuyển về trạng thái TRỐNG cho các bộ phận khác.`)) {
      const updatedBooking: RoomBooking = {
        ...booking,
        status: 'completed',
        checkedOutAt: timeStr
      };

      setBookings(prev => prev.map(b => b.id === booking.id ? updatedBooking : b));
      await saveRoomBookingToCloud(updatedBooking);
      soundFX.playScanSuccess();
    }
  };

  const handleCreateBooking = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!bookTitle.trim()) {
      setFormError('Vui lòng nhập chủ đề cuộc họp');
      return;
    }

    if (!bookEmpCode.trim()) {
      setFormError('Vui lòng nhập hoặc quét mã thẻ người đặt');
      return;
    }

    if (bookStartTime >= bookEndTime) {
      setFormError('Giờ kết thúc phải lớn hơn giờ bắt đầu');
      return;
    }

    // Kiểm tra trùng giờ
    const isOverlap = bookings.some(b => {
      if (b.roomId !== modalRoomId || b.date !== selectedDate || b.status === 'cancelled' || b.status === 'completed') return false;
      return (
        (bookStartTime >= b.startTime && bookStartTime < b.endTime) ||
        (bookEndTime > b.startTime && bookEndTime <= b.endTime) ||
        (bookStartTime <= b.startTime && bookEndTime >= b.endTime)
      );
    });

    if (isOverlap) {
      soundFX.playError();
      setFormError('Khung giờ này đã có người đặt trước! Vui lòng chọn khung giờ khác.');
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
      date: selectedDate,
      startTime: bookStartTime,
      endTime: bookEndTime,
      participantsCount: Number(bookParticipants),
      equipmentsNeeded: selectedEquipments,
      status: 'confirmed',
      createdAt: new Date().toISOString()
    };

    soundFX.playScanSuccess();
    // Giữ nguyên các booking cũ, thêm booking mới
    setBookings(prev => [newBooking, ...prev]);
    saveRoomBookingToCloud(newBooking).catch(console.error);

    setShowBookingModal(false);
    setBookTitle('');
    setBookEmpCode('');
    setBookEmpName('');
    setBookDept('');
  };

  const handleCancelBooking = async (booking: RoomBooking) => {
    const promptInput = prompt(
      `🔐 BẢO MẬT HỦY ĐẶT PHÒNG\n\nCuộc họp: "${booking.title}"\n\nĐể hủy lịch này, vui lòng nhập MÃ THẺ của người đã đặt phòng hoặc Mật khẩu Quản trị:`
    );

    if (promptInput === null) return;

    const cleanInput = promptInput.trim().toLowerCase();
    const isOwner = cleanInput === booking.bookedByCode.trim().toLowerCase();
    const isAdmin = cleanInput === '8888';

    if (!isOwner && !isAdmin) {
      soundFX.playError();
      alert('❌ Xác thực thất bại! Bạn không phải người đã đặt phòng này và không có quyền hủy.');
      return;
    }

    if (confirm(`Xác nhận hủy cuộc họp "${booking.title}"?`)) {
      try {
        setBookings(prev => prev.filter(b => b.id !== booking.id));
        await deleteRoomBookingInCloud(booking.id);
        soundFX.playScanSuccess();
        alert('✅ Đã hủy cuộc họp thành công!');
      } catch (err) {
        console.error('Lỗi khi xóa phòng trên Cloud:', err);
      }
    }
  };

  return (
    <div className="space-y-5">
      {/* Title & Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              Đặt Phòng Họp Thông Minh Bằng Thẻ
            </span>
            <h2 className="text-xl font-extrabold text-slate-900 mt-1">
              Phòng Họp Vịnh Hạ Long & Bà Nà Hill
            </h2>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => {
                setModalRoomId(selectedRoomId);
                setShowBookingModal(true);
              }}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Đặt Phòng Mới
            </button>

            <button
              onClick={() => exportRoomBookingsToExcel(bookings)}
              className="flex-1 sm:flex-none px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Xuất Excel Lịch Họp
            </button>
          </div>
        </div>

        {/* Date Selector */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <CalendarDays className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="text-xs text-slate-700 font-bold shrink-0">Xem theo ngày:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:border-blue-500 shadow-sm"
            />
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Giờ hiện tại: <strong className="text-blue-700 font-mono text-sm">{currentTimeStr}</strong>
          </div>
        </div>
      </div>

      {/* 2 Big Meeting Rooms Spotlight Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PRESET_ROOMS.map(room => {
          const isSelected = selectedRoomId === room.id;
          const roomBookingsToday = dateBookings.filter(b => b.roomId === room.id && b.status !== 'cancelled');

          // TÌM CUỘC HỌP ĐANG HOẠT ĐỘNG HOẶC QUÁ GIỜ
          let activeMeeting: RoomBooking | undefined;
          let isOverdue = false;
          let overdueMinutes = 0;

          if (isToday) {
            // Tìm cuộc họp đã nhận phòng nhưng chưa trả phòng (hoặc đang trong giờ)
            activeMeeting = roomBookingsToday.find(b => {
              if (b.status === 'completed') return false;
              // Nếu đã check-in nhưng chưa trả phòng
              if (b.status === 'checked_in') return true;
              // Hoặc chưa check-in nhưng giờ hiện tại đã lọt vào khung giờ họp
              if (currentTimeStr >= b.startTime && currentTimeStr <= b.endTime) return true;
              return false;
            });

            // Kiểm tra xem có bị quá giờ kết thúc không
            if (activeMeeting && currentTimeStr > activeMeeting.endTime) {
              isOverdue = true;
              overdueMinutes = getMinutesDiff(currentTimeStr, activeMeeting.endTime);
            }
          }

          const isOccupied = !!activeMeeting;

          return (
            <div
              key={room.id}
              onClick={() => setSelectedRoomId(room.id)}
              className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-4 bg-white shadow-sm ${
                isSelected 
                  ? 'border-blue-600 ring-2 ring-blue-500/20' 
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  {/* Trạng thái chi tiết: Trống / Đang dùng / Quá giờ */}
                  {isOverdue ? (
                    <div className="px-2.5 py-1 rounded-full text-xs font-black flex items-center gap-1.5 bg-rose-600 text-white animate-pulse shadow-sm">
                      <AlertTriangle className="w-3.5 h-3.5 text-yellow-300" />
                      <span>QUÁ GIỜ {overdueMinutes} PHÚT ({activeMeeting?.endTime})</span>
                    </div>
                  ) : isOccupied ? (
                    <div className="px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 bg-rose-100 text-rose-800 border border-rose-300">
                      <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping"></span>
                      <span>ĐANG SỬ DỤNG ({activeMeeting?.startTime} - {activeMeeting?.endTime})</span>
                    </div>
                  ) : (
                    <div className="px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 bg-emerald-100 text-emerald-800 border border-emerald-300">
                      <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                      <span>HIỆN ĐANG TRỐNG</span>
                    </div>
                  )}

                  <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
                    <Users className="w-3.5 h-3.5 text-blue-600" /> Sức chứa: <strong className="text-slate-800">{room.capacity} người</strong>
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                    {room.name}
                  </h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    {room.location}
                  </p>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  {room.description}
                </p>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {room.equipment.map(eq => (
                    <span key={eq} className="text-[10px] px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                      {eq}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action buttons on card */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">
                  {roomBookingsToday.filter(b => b.status !== 'cancelled' && b.status !== 'completed').length} cuộc họp chưa xong
                </span>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setModalRoomId(room.id);
                    setShowBookingModal(true);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Đặt Phòng Này</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Hourly Timeline Schedule */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              Lịch Trình Trong Ngày: {currentRoom.name}
            </h3>
            <p className="text-xs text-slate-500">
              Ngày: <span className="text-blue-700 font-bold">{selectedDate}</span>
            </p>
          </div>

          <span className="text-xs text-slate-500 font-medium">
            {roomBookings.filter(b => b.status !== 'cancelled' && b.status !== 'completed').length} cuộc họp cần diễn ra
          </span>
        </div>

        {/* Schedule List */}
        {roomBookings.filter(b => b.status !== 'cancelled').length === 0 ? (
          <div className="p-8 sm:p-12 text-center space-y-2">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <p className="text-base font-bold text-slate-800">Phòng họp đang trống cả ngày!</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Chưa có ai đặt phòng {currentRoom.name} trong ngày {selectedDate}.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {roomBookings
              .filter(b => b.status !== 'cancelled')
              .sort((a, b) => a.startTime.localeCompare(b.startTime))
              .map(booking => {
                const isCheckedIn = booking.status === 'checked_in';
                const isCompleted = booking.status === 'completed';
                
                // Kiểm tra quá giờ kết thúc
                const isOverdue = isToday && isCheckedIn && currentTimeStr > booking.endTime;
                const overdueMins = isOverdue ? getMinutesDiff(currentTimeStr, booking.endTime) : 0;

                // Kiểm tra có đang trong giờ họp không
                const isCurrentSlot = isToday && currentTimeStr >= booking.startTime && currentTimeStr <= booking.endTime;

                return (
                  <div
                    key={booking.id}
                    className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-3 ${
                      isOverdue
                        ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-500/20'
                        : isCompleted
                        ? 'bg-slate-50/60 border-slate-200 opacity-75'
                        : isCheckedIn
                        ? 'bg-emerald-50/80 border-emerald-300'
                        : isCurrentSlot
                        ? 'bg-amber-50 border-amber-300'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-white text-blue-700 border border-slate-300 shadow-sm">
                          {booking.startTime} - {booking.endTime}
                        </span>

                        {isOverdue && (
                          <span className="text-[11px] px-2.5 py-0.5 rounded bg-rose-600 text-white font-extrabold uppercase animate-pulse flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-yellow-300" /> QUÁ GIỜ {overdueMins} PHÚT
                          </span>
                        )}

                        {isCompleted ? (
                          <span className="text-[11px] px-2.5 py-0.5 rounded bg-slate-200 text-slate-700 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" /> Đã trả phòng lúc {booking.checkedOutAt}
                          </span>
                        ) : isCheckedIn ? (
                          <span className="text-[11px] px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Đang sử dụng (Nhận lúc {booking.checkedInAt})
                          </span>
                        ) : isCurrentSlot ? (
                          <span className="text-[11px] px-2.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-extrabold">
                            ĐANG ĐẾN GIỜ - Chưa check-in nhận phòng
                          </span>
                        ) : (
                          <span className="text-[11px] px-2.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-300 font-medium">
                            Đặt trước (Chưa đến giờ)
                          </span>
                        )}
                      </div>

                      <h4 className="font-extrabold text-slate-900 text-sm sm:text-base">
                        {booking.title}
                      </h4>

                      <div className="text-xs text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
                        <span><strong>Người đặt:</strong> {booking.bookedByName} (<span className="font-mono text-blue-700 font-bold">{booking.bookedByCode}</span>)</span>
                        <span><strong>Bộ phận:</strong> {booking.department}</span>
                        <span><strong>Tham dự:</strong> {booking.participantsCount} người</span>
                      </div>
                    </div>

                    {/* Booking actions */}
                    <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end border-t md:border-t-0 pt-2 md:pt-0 border-slate-200">
                      {/* NÚT QUÉT THẺ NHẬN PHÒNG (KHI CHƯA CHECK-IN) */}
                      {!isCheckedIn && !isCompleted && (
                        <button
                          onClick={() => onOpenScannerForRoomCheckIn(booking.id)}
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                        >
                          <ScanLine className="w-3.5 h-3.5" />
                          Quét Thẻ Nhận Phòng
                        </button>
                      )}

                      {/* NÚT XÁC NHẬN TRẢ PHÒNG (KHI ĐANG SỬ DỤNG) */}
                      {isCheckedIn && (
                        <button
                          onClick={() => handleCheckOut(booking)}
                          className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-colors shadow-sm"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          Xác Nhận Trả Phòng
                        </button>
                      )}

                      <button
                        onClick={() => handleCancelBooking(booking)}
                        className="p-2 rounded-xl bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 transition-colors shadow-sm"
                        title="Hủy đặt phòng"
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

      {/* Manual Booking Modal */}
      {showBookingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
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
                  placeholder="VD: Họp giao ban kỹ thuật chuyền may & KCS"
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
                    onClick={() => {
                      onOpenScannerForRoomBooking(modalRoomId, selectedDate);
                    }}
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

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-700 mb-1 font-bold">Ngày Họp</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full px-2 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-medium text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 mb-1 font-bold">Từ Giờ</label>
                  <input
                    type="time"
                    value={bookStartTime}
                    onChange={(e) => setBookStartTime(e.target.value)}
                    className="w-full px-2 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-medium text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 mb-1 font-bold">Đến Giờ</label>
                  <input
                    type="time"
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
                  Xác Nhận Đặt Phòng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
