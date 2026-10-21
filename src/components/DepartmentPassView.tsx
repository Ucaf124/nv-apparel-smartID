/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  ScanLine, 
  ArrowLeftRight, 
  ArrowRight, 
  FileSpreadsheet, 
  Clock, 
  UserCheck, 
  Building2, 
  CheckCircle2, 
  LogOut, 
  Search, 
  Filter, 
  ShieldAlert, 
  MapPin,
  Sparkles,
  RotateCcw
} from 'lucide-react';
import { DepartmentPassRecord, Employee } from '../types';
import { COMMON_DEPARTMENTS, COMMON_MOVE_REASONS } from '../data/mockEmployees';
import { exportDepartmentPassToExcel } from '../utils/exportExcel';
import { soundFX } from '../utils/audio';
import { updateDepartmentPassInCloud } from '../services/firebaseSync';

interface DepartmentPassViewProps {
  employees: Employee[];
  passes: DepartmentPassRecord[];
  setPasses: React.Dispatch<React.SetStateAction<DepartmentPassRecord[]>>;
  onOpenScannerForPass: (config: {
    fromDept: string;
    toDept: string;
    reason: string;
    passType: 'check_in' | 'check_out';
  }) => void;
}

export const DepartmentPassView: React.FC<DepartmentPassViewProps> = ({
  employees,
  passes,
  setPasses,
  onOpenScannerForPass
}) => {
  const [selectedPassType, setSelectedPassType] = useState<'check_in' | 'check_out'>('check_in');
  const [fromDept, setFromDept] = useState(COMMON_DEPARTMENTS[5]); // Phòng Kỹ Thuật May & Bảo Trì
  const [toDept, setToDept] = useState(COMMON_DEPARTMENTS[0]); // Xưởng 1 (Factory 1 - May)
  const [reason, setReason] = useState(COMMON_MOVE_REASONS[2]); // Bảo trì, sửa chữa máy móc
  const [customReason, setCustomReason] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'returned'>('all');

  const activeOccupants = passes.filter(p => p.passType === 'check_in' && p.status === 'active');

  const filteredPasses = passes.filter(p => {
    const matchSearch = p.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        p.employeeCode.includes(searchTerm) ||
                        p.fromDepartment.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        p.toDepartment.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        p.reason.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleStartScan = () => {
    const finalReason = customReason.trim() || reason;
    onOpenScannerForPass({
      fromDept,
      toDept,
      reason: finalReason,
      passType: selectedPassType
    });
  };

  const handleMarkReturned = async (passId: string) => {
  const now = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  soundFX.playScanSuccess();

  const targetPass = passes.find(p => p.id === passId);
    if (!targetPass) return;
  
    const updatedPass: DepartmentPassRecord = {
      ...targetPass,
      status: 'returned',
      returnTime: now
    };
  
    // 1. Cập nhật state giao diện
    setPasses(prev => prev.map(p => p.id === passId ? updatedPass : p));
  
    // 2. LƯU LÊN MÁY CHỦ CLOUD FIREBASE ĐỂ KHÔNG BỊ HIỆN LẠI "ĐANG LƯU TRÚ"
    try {
      await updateDepartmentPassInCloud(updatedPass);
    } catch (err) {
      console.error('Lỗi khi cập nhật check-out trên cloud:', err);
    }
  };

  const handleExport = () => {
    if (passes.length === 0) {
      alert('Chưa có dữ liệu nhật ký ra/vào để xuất file!');
      return;
    }
    exportDepartmentPassToExcel(passes);
  };

  return (
    <div className="space-y-5">
      {/* Title & Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              Số Hóa Giấy Ra Vào Bộ Phận
            </span>
            <h2 className="text-xl font-extrabold text-slate-900 mt-1">
              Check-In / Check-Out Giữa Các Bộ Phận & Xưởng
            </h2>
          </div>

          <button
            onClick={handleExport}
            className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm w-full sm:w-auto"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Xuất Nhật Ký Ra Vào (Excel)
          </button>
        </div>

        {/* Quick Config Station for Scanning */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-emerald-600" />
              Thiết Lập Chốt Quét Thẻ Nhanh:
            </span>

            {/* Check-in / Check-out mode switch */}
            <div className="flex p-1 bg-white border border-slate-300 rounded-xl text-xs shadow-sm self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setSelectedPassType('check_in')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  selectedPassType === 'check_in' 
                    ? 'bg-emerald-600 text-white shadow-sm' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                VÀO (Check-In)
              </button>
              <button
                type="button"
                onClick={() => setSelectedPassType('check_out')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  selectedPassType === 'check_out' 
                    ? 'bg-rose-600 text-white shadow-sm' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                RA (Check-Out)
              </button>
            </div>
          </div>

          {/* From & To Selectors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Từ Bộ Phận (Nơi xuất phát)
              </label>
              <select
                value={fromDept}
                onChange={(e) => setFromDept(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:border-emerald-500 shadow-sm"
              >
                {COMMON_DEPARTMENTS.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Đến Bộ Phận / Xưởng (Điểm đến)
              </label>
              <select
                value={toDept}
                onChange={(e) => setToDept(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:border-emerald-500 shadow-sm"
              >
                {COMMON_DEPARTMENTS.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Reasons */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Lý Do Di Chuyển (Chọn nhanh hoặc gõ):
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {COMMON_MOVE_REASONS.slice(0, 6).map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setReason(r);
                    setCustomReason('');
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                    reason === r && !customReason
                      ? 'bg-emerald-600 text-white font-bold shadow-sm'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-300 font-medium'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="Hoặc gõ lý do di chuyển khác..."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 shadow-sm"
            />
          </div>

          {/* Action Trigger */}
          <div className="pt-1">
            <button
              onClick={handleStartScan}
              className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-600/25 transition-all"
            >
              <ScanLine className="w-5 h-5 animate-pulse" />
              <span>QUÉT MÃ THẺ GHI NHẬN {selectedPassType === 'check_in' ? 'VÀO BỘ PHẬN' : 'RA BỘ PHẬN'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Real-time stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
          <span className="text-xs text-slate-500 block font-semibold">Lượt Ra/Vào Hôm Nay</span>
          <span className="text-2xl font-black text-slate-900 mt-1 block">
            {passes.length}
          </span>
          <span className="text-[11px] text-slate-400">Tổng lượt quét</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm border-l-4 border-l-emerald-600">
          <span className="text-xs text-slate-500 block font-semibold">Đang Ở Bộ Phận Khác</span>
          <span className="text-2xl font-black text-emerald-600 mt-1 block">
            {activeOccupants.length}
          </span>
          <span className="text-[11px] text-slate-400">Chưa check-out về</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
          <span className="text-xs text-slate-500 block font-semibold">Đã Hoàn Thành Về</span>
          <span className="text-2xl font-black text-blue-600 mt-1 block">
            {passes.filter(p => p.status === 'returned').length}
          </span>
          <span className="text-[11px] text-slate-400">Đã kết thúc lượt đi</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
          <span className="text-xs text-slate-500 block font-semibold">An Toàn & PCCC</span>
          <span className="text-sm font-bold text-emerald-700 mt-2 block flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Kiểm Soát 100%
          </span>
          <span className="text-[11px] text-slate-400">Đầy đủ nhật ký</span>
        </div>
      </div>

      {/* Occupants Currently in Department Banner */}
      {activeOccupants.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div className="flex items-center gap-2 text-amber-900 font-extrabold text-sm">
              <ShieldAlert className="w-4 h-4 text-amber-600 animate-pulse" />
              <span>DANH SÁCH NHÂN SỰ ĐANG LƯU TRÚ TẠI BỘ PHẬN ({activeOccupants.length})</span>
            </div>
            <span className="text-xs text-amber-700">Nhấn &ldquo;Xác nhận về&rdquo; khi công nhân rời xưởng</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {activeOccupants.map(item => (
              <div 
                key={item.id}
                className="p-3 rounded-xl bg-white border border-amber-200/90 shadow-sm flex items-center justify-between gap-2.5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-900 text-xs truncate">{item.employeeName}</span>
                    <span className="text-[10px] font-mono font-bold text-blue-700 px-1 rounded bg-blue-50 border border-blue-200">
                      {item.employeeCode}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 truncate mt-0.5">
                    {item.employeeDepartment} &rarr; <span className="text-emerald-700 font-bold">{item.toDepartment}</span>
                  </p>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">
                    Lý do: {item.reason} • Vào: <strong className="font-mono text-slate-700">{item.timestamp}</strong>
                  </p>
                </div>

                <button
                  onClick={() => handleMarkReturned(item.id)}
                  title="Xác nhận nhân viên đã rời khỏi và trở về"
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shrink-0 flex items-center gap-1 transition-all shadow-sm"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Về</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History Log Container */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-3.5 sm:p-4 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/60">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm nhật ký..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 shadow-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <div className="flex p-0.5 bg-slate-100 border border-slate-300 rounded-xl text-xs">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${statusFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
              >
                Tất cả
              </button>
              <button
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${statusFilter === 'active' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500'}`}
              >
                Đang ở xưởng
              </button>
              <button
                onClick={() => setStatusFilter('returned')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${statusFilter === 'returned' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500'}`}
              >
                Đã về
              </button>
            </div>
          </div>
        </div>

        {filteredPasses.length === 0 ? (
          <div className="p-8 sm:p-12 text-center space-y-2">
            <Building2 className="w-12 h-12 text-slate-300 mx-auto" />
            <p className="text-base font-bold text-slate-800">Chưa có nhật ký di chuyển</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Nhấn &ldquo;QUÉT MÃ THẺ GHI NHẬN&rdquo; để bắt đầu thay thế phiếu giấy kiểm soát công nhân di chuyển giữa các phòng ban.
            </p>
          </div>
        ) : (
          <div>
            {/* ================= MOBILE VIEW (NO HORIZONTAL SCROLL) ================= */}
            <div className="block md:hidden divide-y divide-slate-100">
              {filteredPasses.map((p, index) => (
                <div key={p.id} className="p-3.5 hover:bg-slate-50/80 transition-colors space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                        p.passType === 'check_in' 
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                          : 'bg-rose-100 text-rose-800 border border-rose-300'
                      }`}>
                        {p.passType === 'check_in' ? 'VÀO' : 'RA'}
                      </span>
                      <div>
                        <span className="font-bold text-slate-900 text-sm">{p.employeeName}</span>
                        <span className="font-mono text-xs text-blue-700 font-bold ml-1.5">({p.employeeCode})</span>
                      </div>
                    </div>

                    {p.status === 'active' ? (
                      <button
                        onClick={() => handleMarkReturned(p.id)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-sm shrink-0"
                      >
                        Xác nhận về
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-500 font-medium shrink-0">
                        Đã về ({p.returnTime})
                      </span>
                    )}
                  </div>

                  {/* Route & Reason */}
                  <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-700 font-semibold flex-wrap">
                      <span className="text-slate-500">{p.fromDepartment}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="text-emerald-800 font-bold">{p.toDepartment}</span>
                    </div>
                    <div className="text-slate-600 text-[11px]">
                      <strong>Lý do:</strong> {p.reason}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-mono text-slate-600">{p.date} lúc {p.timestamp}</span>
                    <span className="text-slate-500">{p.employeePosition}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* ================= DESKTOP VIEW (FULL TABLE) ================= */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold">
                    <th className="p-3 w-12 text-center">STT</th>
                    <th className="p-3">Loại</th>
                    <th className="p-3">Mã & Họ Tên NV</th>
                    <th className="p-3">Lộ Trình Di Chuyển</th>
                    <th className="p-3">Lý Do</th>
                    <th className="p-3">Thời Gian Ghi Nhận</th>
                    <th className="p-3">Trạng Thái</th>
                    <th className="p-3 text-center">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPasses.map((p, index) => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 text-center text-slate-400 font-mono font-medium">
                        {index + 1}
                      </td>
                      <td className="p-3">
                        <span className={`inline-block px-2.5 py-0.5 rounded text-[11px] font-bold ${
                          p.passType === 'check_in' 
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                            : 'bg-rose-100 text-rose-800 border border-rose-300'
                        }`}>
                          {p.passType === 'check_in' ? 'VÀO' : 'RA'}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{p.employeeName}</div>
                        <div className="text-[11px] font-mono text-blue-700 font-bold">{p.employeeCode} &bull; {p.employeePosition}</div>
                      </td>
                      <td className="p-3 text-slate-700">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500">{p.fromDepartment}</span>
                          <ArrowRight className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span className="text-emerald-800 font-bold">{p.toDepartment}</span>
                        </div>
                      </td>
                      <td className="p-3 text-slate-700 max-w-xs truncate font-medium">
                        {p.reason}
                      </td>
                      <td className="p-3 font-mono text-slate-800">
                        <div className="font-bold">{p.timestamp}</div>
                        <div className="text-[11px] text-slate-400">{p.date}</div>
                      </td>
                      <td className="p-3">
                        {p.status === 'active' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 text-[11px] font-bold">
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                            Đang lưu trú
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Đã về ({p.returnTime || 'Xong'})
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {p.status === 'active' && (
                          <button
                            onClick={() => handleMarkReturned(p.id)}
                            className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-sm"
                          >
                            Xác nhận về
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
