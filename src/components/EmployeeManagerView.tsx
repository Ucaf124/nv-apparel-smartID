/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { 
  Users, 
  Upload, 
  FileSpreadsheet, 
  Search, 
  Filter, 
  CreditCard, 
  CheckCircle2, 
  RotateCcw, 
  AlertCircle,
  Building2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Plus,
  Lock,
  KeyRound
} from 'lucide-react';
import { Employee } from '../types';
import { INITIAL_EMPLOYEES } from '../data/mockEmployees';
import { exportEmployeeListToExcel, exportSampleTemplateExcel, parseEmployeesFromExcel } from '../utils/exportExcel';
import { soundFX } from '../utils/audio';
import { verifyAdminAction } from '../utils/adminAuth';

interface EmployeeManagerViewProps {
  employees: Employee[];
  setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
  onViewCard: (employee: Employee) => void;
}

export const EmployeeManagerView: React.FC<EmployeeManagerViewProps> = ({
  employees,
  setEmployees,
  onViewCard
}) => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState(false);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput.trim() === '8888') {
      soundFX.playScanSuccess();
      setIsUnlocked(true);
      setAuthError(false);
    } else {
      soundFX.playError();
      setAuthError(true);
      setPasswordInput('');
    }
  };
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFactory, setSelectedFactory] = useState('all');
  const [selectedDept, setSelectedDept] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Reset to page 1 whenever search, filters, or page size change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedFactory, selectedDept, pageSize]);

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const fullName = emp.Full_Name || `${emp.Name} ${emp.Surname}`.trim();
      const matchSearch = fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          emp.Employee_Code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          emp.Position_Eng.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          emp.Department_Eng.toLowerCase().includes(searchTerm.toLowerCase());

      const matchFactory = selectedFactory === 'all' || emp.Factory_Code === selectedFactory;
      const matchDept = selectedDept === 'all' || emp.Department_Eng === selectedDept;

      return matchSearch && matchFactory && matchDept;
    });
  }, [employees, searchTerm, selectedFactory, selectedDept]);

  const totalItems = filteredEmployees.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedEmployees = useMemo(() => {
    return filteredEmployees.slice(startIndex, endIndex);
  }, [filteredEmployees, startIndex, endIndex]);

  const handlePageChange = (page: number) => {
    const validPage = Math.min(Math.max(1, page), totalPages);
    setCurrentPage(validPage);
  };

  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | string)[] = [];
    if (safeCurrentPage <= 4) {
      pages.push(1, 2, 3, 4, 5, '...', totalPages);
    } else if (safeCurrentPage >= totalPages - 3) {
      pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, '...', safeCurrentPage - 1, safeCurrentPage, safeCurrentPage + 1, '...', totalPages);
    }
    return pages;
  };

  const uniqueFactories = Array.from(new Set(employees.map(e => e.Factory_Code).filter(Boolean)));
  const uniqueDepts = Array.from(new Set(employees.map(e => e.Department_Eng).filter(Boolean)));

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!verifyAdminAction('Tải lên danh sách nhân sự từ Excel')) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccessMessage(null);

    try {
      const parsed = await parseEmployeesFromExcel(file);
      if (parsed.length === 0) {
        throw new Error('Không tìm thấy dữ liệu hợp lệ trong file Excel. Vui lòng kiểm tra lại cấu trúc cột.');
      }

      // 1. TỰ ĐỘNG LỌC TRÙNG BÊN TRONG FILE EXCEL VỪA TẢI (Dựa theo Mã Thẻ Employee_Code)
      const uniqueNewEmployeesMap = new Map<string, Employee>();
      parsed.forEach(emp => {
        const cleanCode = emp.Employee_Code.trim().toLowerCase();
        if (cleanCode && !uniqueNewEmployeesMap.has(cleanCode)) {
          uniqueNewEmployeesMap.set(cleanCode, emp);
        }
      });
      const deduplicatedParsed = Array.from(uniqueNewEmployeesMap.values());

      let finalRoster: Employee[] = [];

      // 2. NẾU ĐÃ CÓ SẴN DANH SÁCH CŨ TRONG HỆ THỐNG -> HỎI LỰA CHỌN GHI ĐÈ HAY CỘNG DỒN
      if (employees.length > 0) {
        const confirmMerge = confirm(
          `📊 PHÁT HIỆN HỆ THỐNG ĐÃ CÓ ${employees.length.toLocaleString()} NHÂN SỰ!\n\nBạn muốn xử lý file Excel mới (${deduplicatedParsed.length.toLocaleString()} người) như thế nào?\n\n• Bấm [OK] để: NẠP BỔ SUNG & CẬP NHẬT (Không làm mất công nhân cũ, tự động loại bỏ trùng lặp mã thẻ).\n• Bấm [Cancel] để: THAY THẾ TOÀN BỘ (Xóa sạch danh sách cũ, chỉ lấy danh sách trong file mới này).`
        );

        if (confirmMerge) {
          // CHẾ ĐỘ NẠP BỔ SUNG & TỰ ĐỘNG CHỐNG TRÙNG
          const existingMap = new Map<string, Employee>();
          employees.forEach(emp => {
            existingMap.set(emp.Employee_Code.trim().toLowerCase(), emp);
          });

          // Gộp người mới vào, nếu trùng mã thẻ thì lấy thông tin mới nhất cập nhật đè lên
          deduplicatedParsed.forEach(newEmp => {
            existingMap.set(newEmp.Employee_Code.trim().toLowerCase(), newEmp);
          });

          finalRoster = Array.from(existingMap.values());
        } else {
          // CHẾ ĐỘ THAY THẾ TOÀN BỘ
          finalRoster = deduplicatedParsed;
        }
      } else {
        finalRoster = deduplicatedParsed;
      }

      // Đánh lại số thứ tự STT chuẩn từ 1 đến hết
      finalRoster = finalRoster.map((emp, idx) => ({
        ...emp,
        No: idx + 1
      }));

      // Cập nhật danh sách
      setEmployees(finalRoster);
      soundFX.playScanSuccess();
      setUploadSuccessMessage(
        `Đã nạp thành công! Hệ thống hiện có tổng cộng ${finalRoster.length.toLocaleString()} công nhân viên (Đã tự động lọc trùng mã thẻ).`
      );
      setTimeout(() => setUploadSuccessMessage(null), 6000);
    } catch (err: unknown) {
      console.error('Upload excel error:', err);
      soundFX.playError();
      const message = err instanceof Error ? err.message : 'Lỗi khi đọc file Excel';
      setUploadError(message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleClearAllData = async () => {
    if (!verifyAdminAction('Xoá sạch danh sách nhân sự nhà máy')) return;
    if (confirm('BẠN CÓ CHẮC CHẮN MUỐN XOÁ SẠCH TOÀN BỘ 5.379 NHÂN SỰ TRÊN TẤT CẢ THIẾT BỊ? Thao tác này sẽ xoá cả trên máy chủ Cloud và không thể hoàn tác.')) {
      // Gọi hàm setEmployees([]) -> Hàm này sẽ tự động gọi clearAllEmployeesInCloud() bên App.tsx
      setEmployees([]);
      localStorage.removeItem('smartfactory_prod_roster');
      soundFX.playScanSuccess();
      setUploadSuccessMessage('Đã xoá sạch danh sách nhân sự trên toàn hệ thống.');
      setTimeout(() => setUploadSuccessMessage(null), 4000);
    }
  };

  // NẾU CHƯA NHẬP ĐÚNG PASS 8888 THÌ HIỆN MÀN HÌNH KHÓA BẢO MẬT
  if (!isUnlocked) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-12 shadow-sm text-center max-w-md mx-auto my-8 space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-purple-50 text-purple-600 border border-purple-200 flex items-center justify-center mx-auto shadow-sm">
          <Lock className="w-8 h-8" />
        </div>
        <div>
          <h3 className="text-lg font-extrabold text-slate-900">Khu Vực Bảo Mật Nhân Sự</h3>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Danh sách toàn thể <strong>{employees.length.toLocaleString()} công nhân viên</strong> chứa thông tin nội bộ. Vui lòng nhập mật khẩu quản trị để xem.
          </p>
        </div>

        <form onSubmit={handleUnlock} className="space-y-3 pt-2">
          <div className="relative">
            <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              autoFocus
              value={passwordInput}
              onChange={(e) => {
                setPasswordInput(e.target.value);
                setAuthError(false);
              }}
              placeholder="Nhập mật khẩu quản trị..."
              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500 shadow-sm text-center"
            />
          </div>

          {authError && (
            <p className="text-xs text-rose-600 font-bold animate-shake">
              ❌ Mật khẩu không chính xác! Vui lòng thử lại.
            </p>
          )}

          <button
            type="submit"
            className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-extrabold transition-all shadow-sm active:scale-98"
          >
            Mở Khóa Xem Danh Sách
          </button>
        </form>
      </div>
    );
  }
  
  return (
    <div className="space-y-5">
      {/* Header & Excel Upload Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              Cơ Sở Dữ Liệu Nhân Sự & Thẻ Barcode
            </span>
            <h2 className="text-xl font-extrabold text-slate-900 mt-1">
              Danh Sách Toàn Thể Công Nhân Nhà Máy
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Tổng cộng: <strong className="text-slate-800">{employees.length}</strong> nhân sự trong hệ thống
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Upload Excel Button */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => {
                if (verifyAdminAction('Tải lên danh sách công nhân viên (Excel)')) {
                  fileInputRef.current?.click();
                }
              }}
              disabled={isUploading}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-98"
            >
              <Upload className="w-4 h-4" />
              <span>{isUploading ? 'Đang đọc Excel...' : 'Tải Lên File Excel (.xlsx)'}</span>
            </button>

            {/* Template Download Button */}
            <button
              onClick={exportSampleTemplateExcel}
              className="flex-1 sm:flex-none px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              title="Tải file Excel mẫu có định dạng chuẩn để điền dữ liệu"
            >
              <FileSpreadsheet className="w-4 h-4 text-blue-600" />
              <span>Tải File Mẫu Chuẩn</span>
            </button>

            {/* Export Excel Button (if employees exist) */}
            {employees.length > 0 && (
              <button
                onClick={() => exportEmployeeListToExcel(employees)}
                className="flex-1 sm:flex-none px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Xuất File Excel</span>
              </button>
            )}

            {/* Clear All Button */}
            {employees.length > 0 && (
              <button
                onClick={handleClearAllData}
                title="Xoá sạch danh sách nhân sự"
                className="p-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Success / Error Alerts */}
        {uploadSuccessMessage && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{uploadSuccessMessage}</span>
          </div>
        )}

        {uploadError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{uploadError}</span>
          </div>
        )}


      </div>

      {/* Filter and Search Container */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {employees.length === 0 ? (
          <div className="p-8 sm:p-12 text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 mx-auto flex items-center justify-center border border-blue-200 shadow-sm">
              <Upload className="w-8 h-8 animate-bounce" />
            </div>
            <div className="space-y-1">
              <h3 className="font-extrabold text-lg text-slate-900">Sẵn Sàng Đưa Vào Sử Dụng Chính Thức</h3>
              <p className="text-xs text-slate-500 max-w-lg mx-auto leading-relaxed">
                Toàn bộ dữ liệu ảo đã được làm sạch 100%. Để bắt đầu vận hành, bạn chỉ cần tải lên file Excel danh sách công nhân viên nhà máy của bạn.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => {
                  if (verifyAdminAction('Tải lên danh sách công nhân viên (Excel)')) {
                    fileInputRef.current?.click();
                  }
                }}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-xl text-xs font-extrabold inline-flex items-center gap-2 shadow-md shadow-blue-500/25 transition-all"
              >
                <Upload className="w-4 h-4" />
                <span>TẢI LÊN FILE EXCEL CÔNG NHÂN (.xlsx)</span>
              </button>

              <button
                onClick={exportSampleTemplateExcel}
                className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold inline-flex items-center gap-2 transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                <span>TẢI FILE EXCEL MẪU CHUẨN (.xlsx)</span>
              </button>
            </div>

            {/* Quick 3-step onboarding guide */}
            <div className="max-w-xl mx-auto pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center">1</span>
                <p className="text-xs font-bold text-slate-800">Tải File Excel Lên</p>
                <p className="text-[11px] text-slate-500">File chứa mã thẻ, họ tên, bộ phận, xưởng theo mẫu NV Apparel.</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center">2</span>
                <p className="text-xs font-bold text-slate-800">Quét Barcode Thẻ Thật</p>
                <p className="text-[11px] text-slate-500">Mở điện thoại quét mã vạch in sau thẻ để điểm danh hoặc check-in.</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center">3</span>
                <p className="text-xs font-bold text-slate-800">Xuất Báo Cáo Excel</p>
                <p className="text-[11px] text-slate-500">Bấm nút Xuất File Excel để tải bảng ký điện tử lưu trữ và báo cáo.</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Filter and Top Pagination Toolbar */}
            <div className="p-3.5 sm:p-4 border-b border-slate-200 bg-slate-50/70 space-y-3">
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                {/* Search box */}
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Tìm theo mã thẻ, họ tên, chức vụ, bộ phận..."
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-xs"
                  />
                </div>

                {/* Filters & Page Size */}
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={selectedFactory}
                    onChange={(e) => setSelectedFactory(e.target.value)}
                    className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-700 font-medium focus:outline-none shadow-xs"
                  >
                    <option value="all">Tất cả xưởng</option>
                    {uniqueFactories.map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>

                  <select
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                    className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-700 font-medium focus:outline-none shadow-xs"
                  >
                    <option value="all">Tất cả phòng ban</option>
                    {uniqueDepts.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>

                  {/* Page Size Selector */}
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="px-3 py-2 bg-white border border-blue-200 text-blue-800 font-bold rounded-xl text-xs focus:outline-none shadow-xs"
                    title="Số lượng công nhân viên hiển thị trên 1 trang"
                  >
                    <option value={50}>50 người / trang</option>
                    <option value={100}>100 người / trang</option>
                    <option value={200}>200 người / trang</option>
                    <option value={500}>500 người / trang</option>
                  </select>
                </div>
              </div>

              {/* Status & Quick Pagination Strip */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-1 border-t border-slate-200/60 text-xs text-slate-600">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">
                    Hiển thị <strong className="text-blue-700 font-mono font-bold">{totalItems === 0 ? 0 : startIndex + 1} - {endIndex}</strong> trên tổng số <strong className="text-slate-900 font-mono font-bold">{totalItems.toLocaleString()}</strong> công nhân viên
                  </span>
                  {searchTerm && (
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                      Lọc theo từ khóa: &quot;{searchTerm}&quot;
                    </span>
                  )}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    <button
                      onClick={() => handlePageChange(safeCurrentPage - 1)}
                      disabled={safeCurrentPage === 1}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-xs font-semibold flex items-center transition-colors"
                      title="Trang trước"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>

                    <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-700">
                      Trang {safeCurrentPage} / {totalPages}
                    </span>

                    <button
                      onClick={() => handlePageChange(safeCurrentPage + 1)}
                      disabled={safeCurrentPage === totalPages}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-xs font-semibold flex items-center transition-colors"
                      title="Trang sau"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Empty state for search */}
            {filteredEmployees.length === 0 ? (
              <div className="p-12 text-center text-slate-500 space-y-2">
                <Search className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-700">Không tìm thấy nhân viên nào phù hợp</p>
                <p className="text-xs text-slate-400">Vui lòng thử tìm kiếm bằng từ khóa hoặc bộ phận khác</p>
              </div>
            ) : (
              <>
                {/* ================= MOBILE VIEW (CARDS) ================= */}
                <div className="block md:hidden divide-y divide-slate-100">
                  {paginatedEmployees.map((emp, index) => {
                    const displayName = emp.Full_Name || `${emp.Name} ${emp.Surname}`.trim();
                    const photo = localStorage.getItem(`photo_${emp.Employee_Code}`) || emp.Photo_Url;
                    const isRealCardInPhoto = emp.Employee_Code === '210181178';
                    const rowNumber = emp.No || startIndex + index + 1;

                    return (
                      <div key={emp.Employee_Code + '-' + (startIndex + index)} className="p-3.5 hover:bg-slate-50 transition-colors space-y-2.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-6 text-center text-[11px] font-mono font-medium text-slate-400 shrink-0">
                              #{rowNumber}
                            </span>

                            {photo ? (
                              <img
                                src={photo}
                                alt={displayName}
                                className="w-10 h-10 rounded-full object-cover border border-slate-300 shadow-xs shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center font-extrabold text-sm text-blue-700 shrink-0">
                                {displayName.charAt(0) || 'N'}
                              </div>
                            )}

                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-extrabold text-sm text-slate-900">{displayName}</span>
                                {isRealCardInPhoto && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300">
                                    Thẻ thật
                                  </span>
                                )}
                                {photo && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                                    Có ảnh
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-600 truncate">{emp.Position_Eng}</div>
                            </div>
                          </div>

                          <button
                            onClick={() => onViewCard(emp)}
                            className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-200 text-xs font-bold inline-flex items-center gap-1 transition-all shrink-0"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>Xem Thẻ</span>
                          </button>
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 text-slate-600">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-blue-700">{emp.Employee_Code}</span>
                            <span>&bull;</span>
                            <span className="truncate max-w-[140px]">{emp.Department_Eng}</span>
                          </div>

                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[10px] border border-slate-200">
                            {emp.Factory_Code}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ================= DESKTOP VIEW (FULL TABLE) ================= */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold">
                        <th className="p-3 w-14 text-center">STT</th>
                        <th className="p-3">Mã Thẻ (Barcode)</th>
                        <th className="p-3">Họ và Tên</th>
                        <th className="p-3">Chức Vụ</th>
                        <th className="p-3">Phòng Ban / Khối</th>
                        <th className="p-3">Xưởng</th>
                        <th className="p-3">Tổ / Chuyền</th>
                        <th className="p-3 text-center">Thẻ & Barcode</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedEmployees.map((emp, index) => {
                        const displayName = emp.Full_Name || `${emp.Name} ${emp.Surname}`.trim();
                        const photo = localStorage.getItem(`photo_${emp.Employee_Code}`) || emp.Photo_Url;
                        const isRealCardInPhoto = emp.Employee_Code === '210181178';
                        const rowNumber = emp.No || startIndex + index + 1;

                        return (
                          <tr key={emp.Employee_Code + '-' + (startIndex + index)} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 text-center text-slate-400 font-mono font-medium">
                              {rowNumber}
                            </td>
                            <td className="p-3 font-mono font-bold text-blue-700">
                              <div className="flex items-center gap-1.5">
                                <span>{emp.Employee_Code}</span>
                                {isRealCardInPhoto && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300 font-sans font-bold">
                                    Thẻ thật
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-3 font-bold text-slate-900">
                              <div className="flex items-center gap-2.5">
                                {photo ? (
                                  <img
                                    src={photo}
                                    alt={displayName}
                                    className="w-8 h-8 rounded-full object-cover border border-slate-300 shadow-xs shrink-0"
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center font-bold text-xs text-blue-700 shrink-0">
                                    {displayName.charAt(0) || 'N'}
                                  </div>
                                )}
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span>{displayName}</span>
                                    {photo && (
                                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold border border-emerald-300">
                                        Có ảnh
                                      </span>
                                    )}
                                  </div>
                                  {emp.Pre_Name && (
                                    <span className="text-[10px] text-slate-500 font-normal">{emp.Pre_Name}</span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="p-3 text-slate-700 font-medium">
                              {emp.Position_Eng}
                            </td>
                            <td className="p-3 text-slate-600">
                              <div>{emp.Department_Eng}</div>
                              {emp.Division_Eng && (
                                <div className="text-[11px] text-slate-400">{emp.Division_Eng}</div>
                              )}
                            </td>
                            <td className="p-3">
                              <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold border border-slate-200">
                                {emp.Factory_Code}
                              </span>
                            </td>
                            <td className="p-3 text-slate-600">
                              {emp.Section_Eng || '-'}
                            </td>
                            <td className="p-3 text-center">
                              <button
                                onClick={() => onViewCard(emp)}
                                className="px-3 py-1 rounded-lg bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-200 text-xs font-bold inline-flex items-center gap-1 transition-all shadow-xs"
                              >
                                <CreditCard className="w-3.5 h-3.5" />
                                <span>Xem Thẻ</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* ================= COMPREHENSIVE PAGINATION FOOTER ================= */}
                <div className="p-3.5 sm:p-4 border-t border-slate-200 bg-slate-50/80 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-slate-700">
                  {/* Status & Summary */}
                  <div className="flex items-center gap-2 font-medium">
                    <span>
                      Đang xem <strong className="text-blue-700 font-mono font-bold">{startIndex + 1} - {endIndex}</strong> trên <strong className="text-slate-900 font-mono font-bold">{totalItems.toLocaleString()}</strong> công nhân viên
                    </span>
                    <span className="hidden sm:inline text-slate-400">&bull;</span>
                    <span className="hidden sm:inline text-slate-500">
                      (Trang {safeCurrentPage} / {totalPages})
                    </span>
                  </div>

                  {/* Pagination Numbers and Action Buttons */}
                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    {/* First Page */}
                    <button
                      onClick={() => handlePageChange(1)}
                      disabled={safeCurrentPage === 1}
                      className="px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-35 disabled:hover:bg-white text-xs font-bold flex items-center transition-colors shadow-xs"
                      title="Trang đầu tiên"
                    >
                      <ChevronsLeft className="w-3.5 h-3.5" />
                    </button>

                    {/* Prev Page */}
                    <button
                      onClick={() => handlePageChange(safeCurrentPage - 1)}
                      disabled={safeCurrentPage === 1}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-35 disabled:hover:bg-white text-xs font-bold flex items-center gap-1 transition-colors shadow-xs"
                      title="Trang trước"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Trước</span>
                    </button>

                    {/* Page Numbers */}
                    <div className="flex items-center gap-1">
                      {getPageNumbers().map((pageNum, idx) => {
                        if (pageNum === '...') {
                          return (
                            <span key={'ellipsis-' + idx} className="px-2 py-1 text-slate-400 font-bold">
                              ...
                            </span>
                          );
                        }

                        const isCurrent = pageNum === safeCurrentPage;
                        return (
                          <button
                            key={'page-' + pageNum}
                            onClick={() => handlePageChange(Number(pageNum))}
                            className={`min-w-8 h-8 px-2 rounded-lg text-xs font-bold transition-all shadow-xs ${
                              isCurrent
                                ? 'bg-blue-600 text-white shadow-blue-500/20'
                                : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>

                    {/* Next Page */}
                    <button
                      onClick={() => handlePageChange(safeCurrentPage + 1)}
                      disabled={safeCurrentPage === totalPages}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-35 disabled:hover:bg-white text-xs font-bold flex items-center gap-1 transition-colors shadow-xs"
                      title="Trang sau"
                    >
                      <span className="hidden sm:inline">Sau</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>

                    {/* Last Page */}
                    <button
                      onClick={() => handlePageChange(totalPages)}
                      disabled={safeCurrentPage === totalPages}
                      className="px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-35 disabled:hover:bg-white text-xs font-bold flex items-center transition-colors shadow-xs"
                      title="Trang cuối cùng"
                    >
                      <ChevronsRight className="w-3.5 h-3.5" />
                    </button>

                    {/* Quick Jump Dropdown when multiple pages */}
                    {totalPages > 4 && (
                      <div className="hidden lg:flex items-center gap-1.5 ml-2 pl-2 border-l border-slate-300">
                        <span className="text-[11px] text-slate-500 font-medium">Đến trang:</span>
                        <select
                          value={safeCurrentPage}
                          onChange={(e) => handlePageChange(Number(e.target.value))}
                          className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-blue-700 focus:outline-none"
                        >
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                            <option key={'jump-' + p} value={p}>
                              Trang {p}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};
