/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  ScanLine, 
  ArrowRight, 
  FileSpreadsheet, 
  Building2, 
  Search, 
  Filter, 
  ShieldAlert, 
  MapPin, 
  RotateCcw,
  Trash2,
  Check,
  X
} from 'lucide-react';
import { DepartmentPassRecord, Employee, maskEmployeeCode } from '../types';
import { COMMON_DEPARTMENTS, COMMON_MOVE_REASONS } from '../data/mockEmployees';
import { exportDepartmentPassToExcel } from '../utils/exportExcel';
import { soundFX } from '../utils/audio';
import { updateDepartmentPassInCloud, deleteDepartmentPassInCloud } from '../services/firebaseSync';

interface DepartmentPassViewProps {
  employees: Employee[];
  passes: DepartmentPassRecord[];
  setPasses: React.Dispatch<React.SetStateAction<DepartmentPassRecord[]>>;
  onOpenScannerForPass: (config: {
    factory: string; // Thêm trường factory bắt buộc
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
  const [fromDept, setFromDept] = useState(COMMON_DEPARTMENTS[5]);
  const [toDept, setToDept] = useState(COMMON_DEPARTMENTS[0]);
  const [reason, setReason] = useState(COMMON_MOVE_REASONS[2]);
  const [customReason, setCustomReason] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'returned'>('all');

  // BẮT BUỘC CHỌN NHÀ MÁY (Mặc định NV1)
  const [selectedFactory, setSelectedFactory] = useState<'NV1' | 'NV2'>('NV1');
  const [selectedFactoryFilter, setSelectedFactoryFilter] = useState<string[]>([]);
  const uniqueFactories = useMemo(() => ['NV1', 'NV2'], []);
  
  // Multi-select filters cho từng cột (dạng Excel Filter)
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [selectedRoutes, setSelectedRoutes] = useState<string[]>([]);
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [selectedInDates, setSelectedInDates] = useState<string[]>([]);
  const [selectedOutStatuses, setSelectedOutStatuses] = useState<string[]>([]);

  // Quản lý popup filter nào đang mở
  const [openFilterCol, setOpenFilterCol] = useState<string | null>(null);
  const filterPopupRef = useRef<HTMLDivElement | null>(null);

  // Đóng filter popup khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterPopupRef.current && !filterPopupRef.current.contains(e.target as Node)) {
        setOpenFilterCol(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const todayStr = new Date().toISOString().split('T')[0];
  const todayPassCount = passes.filter(p => p.date === todayStr).length;
  const activeOccupants = passes.filter(p => p.status === 'active');

  // Danh sách các giá trị duy nhất cho từng cột
  const uniqueEmployees = useMemo(() => Array.from(new Set(passes.map(p => p.employeeName))), [passes]);
  const uniqueRoutes = useMemo(() => Array.from(new Set(passes.map(p => `${p.fromDepartment} → ${p.toDepartment}`))), [passes]);
  const uniqueReasons = useMemo(() => Array.from(new Set(passes.map(p => p.reason))), [passes]);
  const uniqueInDates = useMemo(() => Array.from(new Set(passes.map(p => p.date))), [passes]);
  const uniqueOutStatuses = useMemo(() => ['Chưa Check-Out', 'Đã về'], []);

  // Lọc chồng lọc (Multi-level combine filters)
  const filteredPasses = useMemo(() => {
    return passes.filter(p => {
      // 1. Tìm kiếm chung
      const matchSearch = p.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.employeeCode.includes(searchTerm) ||
                          p.fromDepartment.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.toDepartment.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.reason.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchSearch) return false;
      // Lọc cột Nhà Máy (Chốt)
      if (selectedFactoryFilter.length > 0) {
        const passFactory = p.factoryCheckPoint || 'NV1';
        if (!selectedFactoryFilter.includes(passFactory)) return false;
      }
      // 2. Lọc nhanh thanh công cụ
      if (statusFilter === 'active' && p.status !== 'active') return false;
      if (statusFilter === 'returned' && p.status !== 'returned') return false;

      // 3. Lọc cột Tên/Mã NV
      if (selectedEmployees.length > 0 && !selectedEmployees.includes(p.employeeName)) return false;

      // 4. Lọc cột Lộ Trình
      const routeStr = `${p.fromDepartment} → ${p.toDepartment}`;
      if (selectedRoutes.length > 0 && !selectedRoutes.includes(routeStr)) return false;

      // 5. Lọc cột Lý Do
      if (selectedReasons.length > 0 && !selectedReasons.includes(p.reason)) return false;

      // 6. Lọc cột Ngày Vào
      if (selectedInDates.length > 0 && !selectedInDates.includes(p.date)) return false;

      // 7. Lọc cột Trạng thái Ra
      const outStatus = p.status === 'active' ? 'Chưa Check-Out' : 'Đã về';
      if (selectedOutStatuses.length > 0 && !selectedOutStatuses.includes(outStatus)) return false;

      
      return true;
    });
  }, [passes, searchTerm, statusFilter, selectedEmployees, selectedRoutes, selectedReasons, selectedInDates, selectedOutStatuses]);

  const handleStartScan = () => {
    const finalReason = customReason.trim() || reason;
    onOpenScannerForPass({
      factory: selectedFactory, // Truyền nhà máy đã chọn sang máy quét
      fromDept,
      toDept,
      reason: finalReason,
      passType: 'check_in'
    });
  };

  const handleMarkReturned = async (pass: DepartmentPassRecord) => {
    const promptInput = prompt(
      `🔐 BẢO MẬT XÁC NHẬN VỀ\n\nNhân sự: ${pass.employeeName}\nLộ trình: ${pass.fromDepartment} → ${pass.toDepartment}\n\nVui lòng nhập MÃ THẺ của bạn hoặc Mật khẩu Quản trị để xác nhận rời khỏi bộ phận:`
    );

    if (promptInput === null) return;

    const cleanInput = promptInput.trim().toLowerCase();
    const isOwner = cleanInput === pass.employeeCode.trim().toLowerCase();
    const isAdmin = cleanInput === '8888';

    if (!isOwner && !isAdmin) {
      soundFX.playError();
      alert('❌ Xác thực thất bại! Bạn không phải nhân sự này và không có quyền xác nhận về thay người khác.');
      return;
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateStr = now.toISOString().split('T')[0];

    const updatedPass: DepartmentPassRecord = {
      ...pass,
      status: 'returned',
      returnTime: timeStr,
      returnDate: dateStr
    };

    setPasses(prev => prev.map(p => p.id === pass.id ? updatedPass : p));
    await updateDepartmentPassInCloud(updatedPass);
    soundFX.playScanSuccess();
    alert(`✅ Đã xác nhận ra khỏi bộ phận thành công lúc ${timeStr}!`);
  };

  const handleDeletePass = async (pass: DepartmentPassRecord) => {
    const pin = prompt(
      `🔐 BẢO MẬT XÓA NHẬT KÝ\n\nBạn đang yêu cầu xóa lượt di chuyển của "${pass.employeeName}" (${pass.date} lúc ${pass.timestamp}).\nVui lòng nhập Mật khẩu Quản trị để xác nhận:`
    );

    if (pin === null) return;

    if (pin.trim() !== '8888') {
      soundFX.playError();
      alert('❌ Mật khẩu quản trị không đúng! Không thể xóa nhật ký này.');
      return;
    }

    if (confirm(`Xác nhận xóa vĩnh viễn lượt di chuyển của ${pass.employeeName}?`)) {
      setPasses(prev => prev.filter(p => p.id !== pass.id));
      await deleteDepartmentPassInCloud(pass.id);
      soundFX.playScanSuccess();
    }
  };

  const handleExport = () => {
    if (passes.length === 0) {
      alert('Chưa có dữ liệu nhật ký ra/vào để xuất file!');
      return;
    }
    const pin = prompt('🔐 BẢO MẬT XUẤT NHẬT KÝ\n\nVui lòng nhập Mật khẩu Quản trị để tải file Excel:');
    if (pin === null) return;
    if (pin.trim() !== '8888') {
      soundFX.playError();
      alert('❌ Mật khẩu không đúng! Bạn không có quyền tải file này.');
      return;
    }
    exportDepartmentPassToExcel(passes);
  };

  // Helper render popup filter checkbox cho từng cột
  const renderMultiSelectFilter = (
    colKey: string,
    title: string,
    options: string[],
    selectedValues: string[],
    setSelectedValues: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    const isOpen = openFilterCol === colKey;
    const hasFilter = selectedValues.length > 0;

    const toggleOption = (val: string) => {
      setSelectedValues(prev => 
        prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]
      );
    };

    const toggleAll = () => {
      if (selectedValues.length === options.length) {
        setSelectedValues([]);
      } else {
        setSelectedValues([...options]);
      }
    };

    return (
      <div className="relative inline-block ml-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpenFilterCol(isOpen ? null : colKey);
          }}
          className={`p-1 rounded hover:bg-slate-200 transition-colors ${
            hasFilter ? 'text-rose-600 bg-rose-50 ring-1 ring-rose-400 font-bold' : 'text-slate-400'
          }`}
          title={`Lọc theo ${title}`}
        >
          <Filter className="w-3.5 h-3.5" />
        </button>

        {isOpen && (
          <div 
            ref={filterPopupRef}
            onClick={(e) => e.stopPropagation()}
            className="absolute left-0 mt-2 w-64 bg-white border border-slate-300 rounded-xl shadow-2xl p-3 z-50 text-slate-800 text-xs normal-case font-normal animate-in fade-in zoom-in-95 duration-100"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="font-bold text-slate-900">Lọc {title}</span>
              <button onClick={() => setOpenFilterCol(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="py-2 flex items-center justify-between text-[11px] text-blue-700 font-bold">
              <button type="button" onClick={toggleAll} className="hover:underline">
                {selectedValues.length === options.length ? 'Bỏ chọn hết' : 'Chọn tất cả'}
              </button>
              {hasFilter && (
                <button type="button" onClick={() => setSelectedValues([])} className="text-rose-600 hover:underline">
                  Xóa lọc ({selectedValues.length})
                </button>
              )}
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1 py-1">
              {options.map(opt => {
                const checked = selectedValues.includes(opt);
                return (
                  <label key={opt} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleOption(opt)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                    />
                    <span className="truncate max-w-[200px]" title={opt}>{opt}</span>
                  </label>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setOpenFilterCol(null)}
                className="px-3 py-1 bg-emerald-600 text-white rounded-lg font-bold text-xs shadow-xs"
              >
                Áp dụng
              </button>
            </div>
          </div>
        )}
      </div>
    );
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

        {/* Thiết lập chốt quét thẻ nhanh */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-emerald-600" />
            Thiết Lập Chốt Quét Thẻ Nhanh:
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* 1. CHỌN NHÀ MÁY (BẮT BUỘC) */}
            <div>
              <label className="block text-xs font-black text-slate-800 mb-1 flex items-center gap-1">
                <span>🏢 Nhà Máy (Chốt Quẹt Thẻ)</span>
                <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={selectedFactory}
                onChange={(e) => setSelectedFactory(e.target.value as 'NV1' | 'NV2')}
                className="w-full px-3 py-2.5 bg-blue-50/80 border-2 border-blue-400 rounded-xl text-xs text-blue-950 font-black focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-xs cursor-pointer"
              >
                <option value="NV1">🏭 Nhà máy NV1 (Factory 1)</option>
                <option value="NV2">🏭 Nhà máy NV2 (Factory 2)</option>
              </select>
            </div>
            
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

          <div className="pt-1">
            <button
              onClick={handleStartScan}
              className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-600/25 transition-all"
            >
              <ScanLine className="w-5 h-5 animate-pulse" />
              <span>QUÉT MÃ THẺ GHI NHẬN VÀO BỘ PHẬN</span>
            </button>
          </div>
        </div>
      </div>

      {/* Danh sách người chưa check-out rời xưởng */}
      {activeOccupants.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div className="flex items-center gap-2 text-amber-900 font-extrabold text-sm">
              <ShieldAlert className="w-4 h-4 text-amber-600 animate-pulse" />
              <span>DANH SÁCH NHÂN SỰ CHƯA CHECK-OUT ({activeOccupants.length})</span>
            </div>
            <span className="text-xs text-amber-700">Nhấn &ldquo;Xác nhận về&rdquo; khi công nhân rời xưởng</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {activeOccupants.map(item => (
              <div 
                key={item.id}
                className="p-3 rounded-xl bg-white border border-amber-200 shadow-sm flex items-center justify-between gap-2.5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-900 text-xs truncate">{item.employeeName}</span>
                    <span className="text-[10px] font-mono font-bold text-blue-700 px-1 rounded bg-blue-50 border border-blue-200">
                      {maskEmployeeCode(item.employeeCode)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 truncate mt-0.5">
                    {item.fromDepartment} &rarr; <span className="text-emerald-700 font-bold">{item.toDepartment}</span>
                  </p>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">
                    Vào: <strong className="font-mono text-slate-700">{item.timestamp}</strong> ({item.date})
                  </p>
                </div>

                <button
                  onClick={() => handleMarkReturned(item)}
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
        {/* Toolbar: Thẻ Hôm Nay + Tìm Kiếm + Bộ Lọc Nhanh */}
        <div className="p-3.5 sm:p-4 border-b border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-50/70">
          <div className="flex items-center gap-3 flex-1">
            <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 shrink-0 shadow-2xs">
              <span className="text-xs font-bold text-emerald-900">Hôm nay:</span>
              <span className="text-base font-black text-emerald-700 font-mono">{todayPassCount}</span>
              <span className="text-[10px] text-emerald-600">lượt</span>
            </div>

            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm theo tên, mã NV, bộ phận, lý do..."
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 shadow-sm"
              />
            </div>
          </div>

          {/* Bộ lọc nhanh: ĐỔI "Đang ở xưởng" THÀNH "Chưa Check-Out" */}
          <div className="flex items-center gap-2 shrink-0">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <div className="flex p-0.5 bg-white border border-slate-300 rounded-xl text-xs shadow-2xs">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${statusFilter === 'all' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Tất cả ({passes.length})
              </button>
              <button
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${statusFilter === 'active' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Chưa Check-Out ({activeOccupants.length})
              </button>
              <button
                onClick={() => setStatusFilter('returned')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${statusFilter === 'returned' ? 'bg-slate-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Đã về ({passes.filter(p => p.status === 'returned').length})
              </button>
            </div>
          </div>
        </div>

        {filteredPasses.length === 0 ? (
          <div className="p-8 sm:p-12 text-center space-y-2">
            <Building2 className="w-12 h-12 text-slate-300 mx-auto" />
            <p className="text-base font-bold text-slate-800">Không tìm thấy nhật ký di chuyển phù hợp</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-extrabold select-none">
                  <th className="p-3 w-12 text-center">STT</th>
                  
                  <th className="p-3 w-28">
                    <div className="flex items-center">
                      <span>Nhà Máy</span>
                      {renderMultiSelectFilter('factory', 'Nhà Máy', uniqueFactories, selectedFactoryFilter, setSelectedFactoryFilter)}
                    </div>
                  </th>

                  {/* CỘT MÃ & HỌ TÊN + BỘ LỌC MULTI-SELECT */}
                  <th className="p-3">
                    <div className="flex items-center">
                      <span>Mã & Họ Tên NV</span>
                      {renderMultiSelectFilter('employee', 'Nhân Sự', uniqueEmployees, selectedEmployees, setSelectedEmployees)}
                    </div>
                  </th>

                  {/* CỘT LỘ TRÌNH + BỘ LỌC MULTI-SELECT */}
                  <th className="p-3">
                    <div className="flex items-center">
                      <span>Lộ Trình Di Chuyển</span>
                      {renderMultiSelectFilter('route', 'Lộ Trình', uniqueRoutes, selectedRoutes, setSelectedRoutes)}
                    </div>
                  </th>

                  {/* CỘT LÝ DO + BỘ LỌC MULTI-SELECT */}
                  <th className="p-3">
                    <div className="flex items-center">
                      <span>Lý Do</span>
                      {renderMultiSelectFilter('reason', 'Lý Do', uniqueReasons, selectedReasons, setSelectedReasons)}
                    </div>
                  </th>

                  {/* CỘT THỜI GIAN VÀO + BỘ LỌC MULTI-SELECT THEO NGÀY */}
                  <th className="p-3">
                    <div className="flex items-center">
                      <span>Thời Gian Vào</span>
                      {renderMultiSelectFilter('inDate', 'Ngày Vào', uniqueInDates, selectedInDates, setSelectedInDates)}
                    </div>
                  </th>

                  {/* CỘT THỜI GIAN RA + BỘ LỌC MULTI-SELECT TRẠNG THÁI */}
                  <th className="p-3">
                    <div className="flex items-center">
                      <span>Thời Gian Ra</span>
                      {renderMultiSelectFilter('outStatus', 'Trạng Thái Ra', uniqueOutStatuses, selectedOutStatuses, setSelectedOutStatuses)}
                    </div>
                  </th>

                  <th className="p-3 text-center w-24">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPasses.map((p, index) => {
                  const isNotCheckedOut = p.status === 'active';

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 text-center text-slate-400 font-mono font-medium">
                        {index + 1}
                      </td>

                      <td className="p-3">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-black inline-flex items-center gap-1 border shadow-2xs ${
                          (p.factoryCheckPoint || 'NV1') === 'NV1'
                            ? 'bg-blue-50 text-blue-800 border-blue-200'
                            : 'bg-purple-50 text-purple-800 border-purple-200'
                        }`}>
                          <span>🏢</span>
                          <span>{p.factoryCheckPoint || 'NV1'}</span>
                        </span>
                      </td>
                      
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{p.employeeName}</div>
                        <div className="text-[11px] font-mono text-blue-700 font-bold">
                          {maskEmployeeCode(p.employeeCode)} &bull; {p.employeePosition}
                        </div>
                      </td>
                      <td className="p-3 text-slate-700">
                        <div className="flex items-center gap-1.5 font-medium">
                          <span className="text-slate-500">{p.fromDepartment}</span>
                          <ArrowRight className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span className="text-emerald-800 font-bold">{p.toDepartment}</span>
                        </div>
                      </td>
                      <td className="p-3 text-slate-700 max-w-xs truncate font-medium">
                        {p.reason}
                      </td>
                      <td className="p-3 font-mono text-slate-800">
                        <div className="font-bold text-emerald-700">{p.timestamp}</div>
                        <div className="text-[11px] text-slate-400">{p.date}</div>
                      </td>
                      {/* CỘT THỜI GIAN RA: ĐỔI "Đang ở xưởng" THÀNH "Chưa Check-Out" */}
                      <td className="p-3 font-mono">
                        {isNotCheckedOut ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-sans font-bold text-[11px] border border-amber-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse"></span>
                            Chưa Check-Out
                          </span>
                        ) : (
                          <div>
                            <div className="font-bold text-blue-700">{p.returnTime}</div>
                            <div className="text-[11px] text-slate-400">{p.returnDate || p.date}</div>
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {isNotCheckedOut && (
                            <button
                              onClick={() => handleMarkReturned(p)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-colors shadow-xs"
                              title="Xác nhận check-out ra về (Cần mã thẻ hoặc pass 8888)"
                            >
                              Về
                            </button>
                          )}

                          <button
                            onClick={() => handleDeletePass(p)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Xóa nhật ký này (Cần pass 8888)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
