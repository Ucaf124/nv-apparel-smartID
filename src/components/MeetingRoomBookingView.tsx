/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { deleteRoomBookingInCloud } from '../services/firebaseSync';
import React, { useState } from 'react';
import { 
  Calendar, 
  Clock, 
  Users, 
  Video, 
  Tv, 
  FileSpreadsheet, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  ScanLine, 
  Sparkles, 
  Trash2, 
  UserCheck, 
  MapPin, 
  Info,
  CalendarDays
} from 'lucide-react';
import { Employee, MeetingRoom, RoomBooking } from '../types';
import { PRESET_ROOMS } from '../data/mockEmployees';
import { exportRoomBookingsToExcel } from '../utils/exportExcel';
import { soundFX } from '../utils/audio';

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
  const [selectedEquipments, setSelectedEquipments] = useState<string[]>(['Máy chiếu 4K', 'Bảng kính']);
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
  const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });

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

    // Check overlap for same room on same date
    const isOverlap = bookings.some(b => {
      if (b.roomId !== modalRoomId || b.date !== selectedDate || b.status === 'cancelled') return false;
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
    setBookings([newBooking, ...bookings]);
    setShowBookingModal(false);
    setBookTitle('');
    setBookEmpCode('');
    setBookEmpName('');
    setBookDept('');
  };

  const handleCancelBooking = async (booking: RoomBooking) => {
    // Popup bảo mật kín tuyệt đối - KHÔNG gợi ý bất cứ thông tin nào
    const promptInput = prompt(
      `🔐 BẢO MẬT HỦY ĐẶT PHÒNG\n\nCuộc họp: "${booking.title}"\n\nĐể hủy lịch này, vui lòng nhập MÃ THẺ của người đã đặt phòng hoặc Mật khẩu Quản trị:`
    );

    if (promptInput === null) return; // Bấm Cancel thì thôi

    const cleanInput = promptInput.trim().toLowerCase();
    const isOwner = cleanInput === booking.bookedByCode.trim().toLowerCase();
    const isAdmin = cleanInput === '8888'; // Pass admin

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
        alert('Lỗi kết nối máy chủ khi xóa lịch họp.');
      }
    }
  };

  const handleExport = () => {
    if (bookings.length === 0) {
      alert('Chưa có dữ liệu đặt phòng để xuất!');
      return;
    }
    exportRoomBookingsToExcel(bookings);
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
              onClick={handleExport}
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
            Hôm nay: <strong className="text-slate-800">{new Date().toLocaleDateString('vi-VN')}</strong>
          </div>
        </div>
      </div>

      {/* 2 Big Meeting Rooms Spotlight Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PRESET_ROOMS.map(room => {
          const isSelected = selectedRoomId === room.id;
          const roomBookingsToday = dateBookings.filter(b => b.roomId === room.id && b.status !== 'cancelled');
          // Tính giờ hiện tại theo chuẩn HH:mm 24h
          const currentHours = new Date().getHours().toString().padStart(2, '0');
          const currentMinutes = new Date().getMinutes().toString().padStart(2, '0');
          const currentHM = `${currentHours}:${currentMinutes}`;
          
          // Phòng bận khi: Trong ngày hôm nay, có cuộc họp ĐÃ NHẬN PHÒNG (chưa quá giờ kết thúc), hoặc đang nằm trong khung giờ họp
          const activeMeeting = isToday ? roomBookingsToday.find(b => {
            if (b.status === 'cancelled') return false;
            // Nếu đã check-in và chưa hết giờ kết thúc -> Phòng đang bận
            if (b.status === 'checked_in' && currentHM <= b.endTime) return true;
            // Hoặc đang trong khung giờ họp
            if (currentHM >= b.startTime && currentHM <= b.endTime) return true;
            return false;
          }) : null;
          
          const isCurrentlyOccupied = !!activeMeeting;

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
                  <div className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                    isCurrentlyOccupied 
                      ? 'bg-rose-100 text-rose-800 border border-rose-300' 
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${isCurrentlyOccupied ? 'bg-rose-600 animate-ping' : 'bg-emerald-600'}`}></span>
                    <span>{isCurrentlyOccupied ? `ĐANG SỬ DỤNG (${activeMeeting?.startTime} - ${activeMeeting?.endTime})` : 'HIỆN ĐANG TRỐNG'}</span>
                  </div>

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

                {/* Equipment Tags */}
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
                  {roomBookingsToday.length} cuộc họp ngày {selectedDate}
                </span>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setModalRoomId(room.id);
                    setShowBookingModal(true);
                    // Mở scanner để quét thẻ điền tự động vào form đặt phòng
                    onOpenScannerForRoomBooking(room.id, selectedDate);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <ScanLine className="w-3.5 h-3.5" />
                  <span>Quét Thẻ Đặt Phòng</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Hourly Timeline Schedule for Selected Room */}
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
            {roomBookings.filter(b => b.status !== 'cancelled').length} lượt đặt trước
          </span>
        </div>

        {/* Schedule List */}
        {roomBookings.filter(b => b.status !== 'cancelled').length === 0 ? (
          <div className="p-8 sm:p-12 text-center space-y-2">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <p className="text-base font-bold text-slate-800">Phòng họp đang trống cả ngày!</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Chưa có ai đặt phòng {currentRoom.name} trong ngày {selectedDate}. Bạn có thể quét mã thẻ để đặt ngay.
            </p>
            <button
              onClick={() => onOpenScannerForRoomBooking(currentRoom.id, selectedDate)}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5 transition-colors mt-2 shadow-sm"
            >
              <ScanLine className="w-4 h-4" />
              Quét Thẻ Đặt Phòng
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {roomBookings
              .filter(b => b.status !== 'cancelled')
              .sort((a, b) => a.startTime.localeCompare(b.startTime))
              .map(booking => {
                const isHappening = isToday && booking.startTime <= nowTime && booking.endTime >= nowTime;

                return (
                  <div
                    key={booking.id}
                    className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-3 ${
                      isHappening 
                        ? 'bg-rose-50 border-rose-300' 
                        : booking.status === 'checked_in'
                        ? 'bg-emerald-50/70 border-emerald-300'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-white text-blue-700 border border-slate-300 shadow-sm">
                          {booking.startTime} - {booking.endTime}
                        </span>

                        {isHappening && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-rose-600 text-white font-extrabold uppercase tracking-wider animate-pulse">
                            Đang diễn ra
                          </span>
                        )}

                        {booking.status === 'checked_in' ? (
                          <span className="text-[11px] px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Đã nhận phòng lúc {booking.checkedInAt || 'đúng giờ'}
                          </span>
                        ) : (
                          <span className="text-[11px] px-2.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 font-semibold">
                            Chưa check-in nhận phòng
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
                        {booking.phone && <span><strong>SĐT:</strong> {booking.phone}</span>}
                      </div>

                      {booking.equipmentsNeeded.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {booking.equipmentsNeeded.map(eq => (
                            <span key={eq} className="text-[9px] px-2 py-0.5 rounded bg-white text-slate-600 border border-slate-200">
                              {eq}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Booking actions */}
                    <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end border-t md:border-t-0 pt-2 md:pt-0 border-slate-200">
                      {booking.status !== 'checked_in' && (
                        <button
                          onClick={() => onOpenScannerForRoomCheckIn(booking.id)}
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                        >
                          <ScanLine className="w-3.5 h-3.5" />
                          Quét Thẻ Nhận Phòng
                        </button>
                      )}

                      <button
                        onClick={() => handleCancelBooking(booking)}
                        className="p-2 rounded-xl bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 transition-colors shadow-sm"
                        title="Hủy đặt phòng họp"
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
                      setShowBookingModal(false);
                      onOpenScannerForRoomBooking(modalRoomId, selectedDate);
                    }}
                    className="text-[11px] text-blue-600 hover:text-blue-800 flex items-center gap-1 font-bold"
                  >
                    <ScanLine className="w-3.5 h-3.5" />
                    Mở Camera Quét Thẻ
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={bookEmpCode}
                  onChange={(e) => handleEmpCodeChange(e.target.value)}
                  placeholder="VD: 210181178 hoặc 210170003"
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
                    placeholder="Tự điền khi nhập mã"
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
