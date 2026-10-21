/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { 
  X, 
  CreditCard, 
  RotateCw, 
  Upload, 
  Trash2, 
  Camera, 
  Check, 
  Printer, 
  ShieldCheck, 
  Building2, 
  Sparkles,
  LayoutTemplate
} from 'lucide-react';
import { Employee } from '../types';
import { NVLogo } from './NVLogo';
import { verifyAdminAction } from '../utils/adminAuth';

interface VirtualCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
  onUpdateEmployeePhoto?: (employeeCode: string, photoUrl: string | null) => void;
  customLogo?: string | null;
  onUpdateLogo?: (newLogoUrl: string | null) => void;
}

// Helper to remove accents for English uppercase name
function toNonAccentUppercase(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toUpperCase();
}

export const VirtualCardModal: React.FC<VirtualCardModalProps> = ({
  isOpen,
  onClose,
  employee,
  onUpdateEmployeePhoto,
  customLogo,
  onUpdateLogo
}) => {
  const [cardSide, setCardSide] = useState<'front' | 'back'>('front');
  const [cardOrientation, setCardOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [employeePhoto, setEmployeePhoto] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const barcodeSvgRef = useRef<SVGSVGElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const logoFileInputRef = useRef<HTMLInputElement | null>(null);

  // Load photo from employee or localStorage
  useEffect(() => {
    if (employee) {
      const savedPhoto = localStorage.getItem(`photo_${employee.Employee_Code}`);
      if (savedPhoto) {
        setEmployeePhoto(savedPhoto);
      } else if (employee.Photo_Url) {
        setEmployeePhoto(employee.Photo_Url);
      } else {
        setEmployeePhoto(null);
      }
    }
  }, [employee]);

  // Generate real barcode on back of card
  useEffect(() => {
    if (isOpen && employee && cardSide === 'back' && barcodeSvgRef.current) {
      try {
        const isLandscape = cardOrientation === 'landscape';
        JsBarcode(barcodeSvgRef.current, employee.Employee_Code, {
          format: "CODE128",
          width: isLandscape ? 2.6 : 2.1,
          height: isLandscape ? 58 : 50,
          displayValue: false,
          margin: 0,
          background: "#ffffff",
          lineColor: "#000000"
        });
      } catch (err) {
        console.error("Barcode generation failed:", err);
      }
    }
  }, [isOpen, employee, cardSide, cardOrientation]);

  if (!isOpen || !employee) return null;

  const displayNameVi = employee.Full_Name || `${employee.Name} ${employee.Surname}`.trim();
  const displayNameEn = toNonAccentUppercase(displayNameVi);
  const sectionName = employee.Section_Eng || employee.Department_Eng || 'Production';
  const effectiveDate = employee.Start_Date || '05/06/2018';

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!verifyAdminAction('Thay đổi ảnh thẻ nhân viên')) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setEmployeePhoto(result);
        localStorage.setItem(`photo_${employee.Employee_Code}`, result);
        if (onUpdateEmployeePhoto) {
          onUpdateEmployeePhoto(employee.Employee_Code, result);
        }
      }
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!verifyAdminAction('Thay đổi Logo công ty')) {
      if (logoFileInputRef.current) logoFileInputRef.current.value = '';
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        if (onUpdateLogo) {
          onUpdateLogo(result);
        } else {
          localStorage.setItem('smartfactory_custom_logo', result);
        }
      }
    };
    reader.readAsDataURL(file);
    if (logoFileInputRef.current) logoFileInputRef.current.value = '';
  };

  const handleRemovePhoto = () => {
    if (!verifyAdminAction('Xoá ảnh thẻ nhân viên')) return;
    setEmployeePhoto(null);
    localStorage.removeItem(`photo_${employee.Employee_Code}`);
    if (onUpdateEmployeePhoto) {
      onUpdateEmployeePhoto(employee.Employee_Code, null);
    }
  };

  const isLandscape = cardOrientation === 'landscape';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/65 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto">
      <div 
        className={`relative w-full ${isLandscape ? 'max-w-2xl' : 'max-w-md'} bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 shadow-2xl space-y-4 my-auto text-slate-900 transition-all duration-200`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-600" />
            <div>
              <span className="font-extrabold text-sm text-slate-900">
                Thẻ Nhân Viên Chuẩn NV Apparel ({isLandscape ? 'Dạng Ngang • Landscape' : 'Dạng Đứng • Portrait'})
              </span>
              <p className="text-[10px] text-slate-500">
                Hiển thị đầy đủ 100% họ tên và thông tin công nhân viên
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Card Display Viewport */}
        <div className="flex justify-center py-1 overflow-x-auto">
          {/* Card Container (Landscape or Portrait) */}
          <div 
            id="nv-badge-card"
            className={`${
              isLandscape 
                ? 'w-full max-w-[580px] min-h-[355px] p-4 sm:p-5' 
                : 'w-[350px] min-h-[510px] p-4'
            } rounded-2xl shadow-xl border-2 border-slate-300 bg-white text-slate-900 flex flex-col justify-between relative overflow-hidden select-none transition-all duration-200`}
            style={{ 
              fontFamily: cardSide === 'back' 
                ? "'Times New Roman', Times, Georgia, serif" 
                : "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" 
            }}
          >
            {/* Lanyard punch hole at top (only shown on front of card) */}
            {cardSide === 'front' && (
              <div className={`${isLandscape ? 'w-14' : 'w-12'} h-3 rounded-full bg-slate-300 mx-auto -mt-1 mb-2.5 shadow-inner`}></div>
            )}

            {/* ======================= FRONT OF CARD ======================= */}
            {cardSide === 'front' ? (
              <div className="flex-1 flex flex-col justify-between text-slate-900">
                {/* 1. TOP HEADER: Company Name + Interactive Logo */}
                <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2">
                  <div className="flex-1 pr-3">
                    <h2 className="font-black text-[15px] sm:text-[16px] leading-tight text-slate-900 tracking-tight">
                      Công Ty TNHH NV Apparel
                    </h2>
                    <h3 className="font-bold text-[12px] sm:text-[13px] leading-tight text-slate-700 mt-0.5 tracking-tight">
                      NV Apparel Company Limited
                    </h3>
                  </div>

                  {/* Undistorted Logo with true aspect ratio & Click-to-upload */}
                  <div className="relative group shrink-0 pl-1">
                    <div className="h-9 flex items-center justify-end pl-1 shrink-0">
                      <NVLogo className="h-8 sm:h-9 w-auto max-w-[130px]" />
                    </div>
                  </div>
                </div>

                {/* 2. MIDDLE SECTION: Details + 3x4 Photo */}
                {isLandscape ? (
                  /* Landscape Layout: Photo on Left, Wide Info on Right (NO TRUNCATION!) */
                  <div className="flex items-center gap-4 py-3">
                    {/* Left Column: 3x4 Photo Container */}
                    <div className="w-[110px] h-[142px] shrink-0 flex flex-col items-center">
                      <div className="relative group w-full h-full rounded-lg bg-[#1e88e5] border-2 border-slate-300 shadow overflow-hidden flex flex-col items-center justify-center">
                        {employeePhoto ? (
                          <img 
                            src={employeePhoto} 
                            alt={displayNameVi} 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-white/95 p-1 text-center">
                            <Camera className="w-6 h-6 mb-1 opacity-80" />
                            <span className="text-[10px] font-bold">ẢNH 3x4</span>
                            <span className="text-[8px] opacity-80">(Chưa có ảnh)</span>
                          </div>
                        )}

                        {/* Hover action to upload/change photo */}
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-[10px] font-bold transition-opacity"
                        >
                          <Upload className="w-4 h-4 mb-0.5" />
                          <span>Đổi Ảnh</span>
                        </button>
                      </div>
                    </div>

                    {/* Right Column: Full Employee Details without any truncation */}
                    <div className="flex-1 space-y-1.5 text-slate-900 min-w-0 pr-1">
                      {/* Tên */}
                      <div className="flex items-baseline text-[14px] sm:text-[15px]">
                        <span className="font-bold w-[80px] sm:w-[90px] text-slate-900 shrink-0">Tên:</span>
                        <span className="font-black text-slate-950 text-[15px] sm:text-[16px] leading-tight">{displayNameVi}</span>
                      </div>
                      {/* Name */}
                      <div className="flex items-baseline text-[13px] sm:text-[14px]">
                        <span className="font-bold w-[80px] sm:w-[90px] text-slate-900 shrink-0">Name.:</span>
                        <span className="font-black text-slate-900 tracking-wide text-[13.5px] sm:text-[14.5px] leading-tight">{displayNameEn}</span>
                      </div>

                      {/* Bộ phận & Sect */}
                      <div className="flex flex-wrap items-baseline text-[12.5px] sm:text-[13px] pt-0.5">
                        <span className="font-bold w-[80px] sm:w-[90px] text-slate-900 shrink-0">Bộ phận:</span>
                        <span className="font-extrabold text-slate-900">{sectionName}</span>
                        <span className="text-slate-400 mx-2">•</span>
                        <span className="font-bold text-slate-700 mr-1">Sect.:</span>
                        <span className="font-extrabold text-slate-900">{sectionName}</span>
                      </div>

                      {/* Mã NV */}
                      <div className="flex items-baseline text-[13px] sm:text-[13.5px] pt-0.5">
                        <span className="font-bold w-[80px] sm:w-[90px] text-slate-900 shrink-0">Mã NV(Code):</span>
                        <span className="font-mono font-black text-blue-900 text-[15px] sm:text-[16px]">{employee.Employee_Code}</span>
                      </div>

                      {/* Ngày bắt đầu */}
                      <div className="flex flex-wrap items-baseline text-[12px] sm:text-[12.5px] pt-0.5 text-slate-800">
                        <span className="font-bold w-[80px] sm:w-[90px] text-slate-900 shrink-0">Ngày bắt đầu:</span>
                        <span className="font-semibold text-slate-900 mr-3">{effectiveDate}</span>
                        <span className="font-bold text-slate-700 mr-1">Effective Date:</span>
                        <span className="font-semibold text-slate-900">{effectiveDate}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Portrait Layout fallback */
                  <div className="flex items-start justify-between gap-2.5 py-3">
                    <div className="flex-1 space-y-1 text-slate-900 min-w-0 pr-1">
                      <div className="flex items-baseline text-[13px]">
                        <span className="font-bold w-[78px] text-slate-900 shrink-0">Tên:</span>
                        <span className="font-extrabold text-slate-950 text-[14px] leading-tight">{displayNameVi}</span>
                      </div>
                      <div className="flex items-baseline text-[12px]">
                        <span className="font-bold w-[78px] text-slate-900 shrink-0">Name.:</span>
                        <span className="font-black text-slate-900 tracking-wide text-[12.5px] leading-tight">{displayNameEn}</span>
                      </div>
                      <div className="flex items-baseline text-[12px] pt-1">
                        <span className="font-bold w-[78px] text-slate-900 shrink-0">Bộ phận:</span>
                        <span className="font-bold text-slate-900">{sectionName}</span>
                      </div>
                      <div className="flex items-baseline text-[12px]">
                        <span className="font-bold w-[78px] text-slate-900 shrink-0">Sect.:</span>
                        <span className="font-bold text-slate-900">{sectionName}</span>
                      </div>
                      <div className="flex items-baseline text-[12px] pt-1">
                        <span className="font-bold w-[78px] text-slate-900 shrink-0">Mã NV(Code):</span>
                        <span className="font-mono font-black text-slate-950 text-[13.5px] ml-1">{employee.Employee_Code}</span>
                      </div>
                      <div className="flex items-baseline text-[11.5px] pt-1">
                        <span className="font-bold text-slate-900 shrink-0">Ngày bắt đầu:</span>
                        <span className="font-semibold text-slate-900 ml-1">{effectiveDate}</span>
                      </div>
                    </div>

                    <div className="w-[105px] h-[135px] shrink-0 flex flex-col items-center">
                      <div className="relative group w-full h-full rounded-lg bg-[#1e88e5] border-2 border-slate-300 shadow overflow-hidden flex flex-col items-center justify-center">
                        {employeePhoto ? (
                          <img 
                            src={employeePhoto} 
                            alt={displayNameVi} 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-white/95 p-1 text-center">
                            <Camera className="w-6 h-6 mb-1 opacity-80" />
                            <span className="text-[10px] font-bold">ẢNH 3x4</span>
                            <span className="text-[8px] opacity-80">(Chưa có ảnh)</span>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-[10px] font-bold transition-opacity"
                        >
                          <Upload className="w-4 h-4 mb-0.5" />
                          <span>Đổi Ảnh</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. BOTTOM SECTION: Clean Signatures (No sticker logo) */}
                <div className="border-t border-slate-200 pt-2 pb-1">
                  <div className="flex items-end justify-between px-2 sm:px-4">
                    {/* Left: Employee Signature */}
                    <div className={`${isLandscape ? 'w-[160px]' : 'w-[130px]'} flex flex-col items-center text-center`}>
                      <div className="h-9 flex items-center justify-center w-full">
                        <svg viewBox="0 0 100 35" className="w-24 h-7 text-blue-900 stroke-current fill-none stroke-[2.2]">
                          <path d="M5 28 Q 20 6, 38 18 T 65 10 Q 80 28, 95 14" />
                        </svg>
                      </div>
                      <div className="w-full border-t border-dashed border-slate-300 pt-1">
                        <p className="text-[10px] sm:text-[10.5px] font-extrabold text-slate-900 leading-tight">
                          Công nhân viên ký tên
                        </p>
                        <p className="text-[9px] font-bold text-slate-600 leading-tight">
                          Signature
                        </p>
                      </div>
                    </div>

                    {/* Right: HR Manager Signature */}
                    <div className={`${isLandscape ? 'w-[160px]' : 'w-[130px]'} flex flex-col items-center text-center`}>
                      <div className="h-9 flex items-center justify-center w-full">
                        <svg viewBox="0 0 100 30" className="w-24 h-7 text-indigo-900 stroke-current fill-none stroke-[2]">
                          <path d="M10 16 Q 32 3, 52 22 T 72 6 Q 86 26, 96 16" />
                        </svg>
                      </div>
                      <div className="w-full border-t border-dashed border-slate-300 pt-1">
                        <p className="text-[10px] sm:text-[10.5px] font-extrabold text-slate-900 leading-tight">
                          Giám đốc nhân sự
                        </p>
                        <p className="text-[9px] font-bold text-slate-600 leading-tight">
                          HR Manager
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* ======================= BACK OF CARD (EXACT AS PHOTO 321625.jpg) ======================= */
              <div 
                className="flex-1 flex flex-col justify-between text-black select-text"
                style={{ fontFamily: "'Times New Roman', Times, Georgia, serif" }}
              >
                {/* Title: Điều kiện/Condition (Centered, Bold, Exact as photo) */}
                <h3 className="text-center font-bold text-[14px] sm:text-[15.5px] leading-tight text-black mb-1.5">
                  Điều kiện/Condition
                </h3>

                {/* 4 Conditions - Exact text, wording, punctuation & formatting from real card */}
                <div className={`${isLandscape ? 'text-[10px] sm:text-[10.5px] space-y-1.5 leading-[1.32]' : 'text-[9px] sm:text-[9.5px] space-y-1.5 leading-[1.28]'} text-black`}>
                  <p>
                    1. Công nhân viên cần phải đeo thẻ trong suốt thời gian làm việc/ Employees must show the employee card visible at all time.
                  </p>

                  <p>
                    2. Nếu thẻ bị hư hỏng, bị mất, hoặc bị đánh cắp thì xin vui lòng liên hệ với Phòng nhân &nbsp; sự để làm lại thẻ mới.Please contact HR.dept.in case of employee card damaged, lost or stolen for renew.
                  </p>

                  <p>
                    3. Trường hợp công nhân viên nghỉ việc, xin vui lòng trả lại thẻ cho Phòng Nhân sự/ Please return employee card to HR.dept.in case of resingnation
                  </p>

                  <p>
                    4. Bất kỳ ai giữ được thẻ này, xin vui lòng gửi trả lại cho Công ty TNHH NV Apparel theo địa chỉ: Lô C1, Khu Công nghiệp Bình Hòa, Xã Bình Hòa, Huyện Châu Thành, Tỉnh An Giang, Việt Nam. Số điện thoại: 086-9900017
                  </p>

                  <div className="pt-0.5">
                    <p>
                      Anyone found this card,please return to address:Plot C1 Binh Hoa Industrial Park, Binh Hoa Ward, Chau Thanh District, An Giang Province, Vietnam
                    </p>
                    <div className="flex items-baseline justify-between pt-0.5">
                      <span>Tel 086-9900017</span>
                      <span className="font-bold text-[14px] sm:text-[16px] text-black font-sans tracking-wide">
                        {employee.Employee_Code}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Barcode: Horizontal 1D barcode spanning across bottom, exactly matching photo */}
                <div className="mt-1 pt-0.5 flex justify-center">
                  <svg 
                    ref={barcodeSvgRef} 
                    className="w-full h-14 sm:h-16"
                    style={{ shapeRendering: 'crispEdges' }}
                  ></svg>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Hidden File Inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handlePhotoUpload}
          className="hidden"
        />

        <input
          ref={logoFileInputRef}
          type="file"
          accept="image/*"
          onChange={handleLogoUpload}
          className="hidden"
        />

        {/* Action Controls */}
        <div className="space-y-2.5 pt-1">
          {/* Card Orientation & Flip Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* Flip Card Button */}
            <button
              onClick={() => setCardSide(prev => prev === 'front' ? 'back' : 'front')}
              className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5 transition-colors border border-slate-300 shadow-sm"
            >
              <RotateCw className="w-3.5 h-3.5 text-blue-600" />
              <span>{cardSide === 'front' ? 'Xem Mặt Sau (Barcode)' : 'Xem Mặt Trước (Ảnh Thẻ)'}</span>
            </button>

            {/* Switch Orientation Button */}
            <button
              onClick={() => setCardOrientation(prev => prev === 'landscape' ? 'portrait' : 'landscape')}
              className="py-2.5 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-xs font-bold text-blue-700 flex items-center justify-center gap-1.5 transition-colors border border-blue-200 shadow-sm"
              title="Chuyển đổi giữa định dạng thẻ ngang và đứng"
            >
              <LayoutTemplate className="w-3.5 h-3.5 text-blue-600" />
              <span>Đổi Định Dạng ({isLandscape ? 'Dạng Ngang' : 'Dạng Đứng'})</span>
            </button>

            {/* Upload Employee Photo Button */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-98"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{employeePhoto ? 'Đổi Ảnh 3x4' : 'Tải Ảnh 3x4'}</span>
              </button>

              {employeePhoto && (
                <button
                  onClick={handleRemovePhoto}
                  title="Xóa ảnh nhân viên"
                  className="p-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <p className="text-[11px] text-slate-500 text-center">
            {employeePhoto ? (
              <span className="text-emerald-700 font-bold">✓ Đã gắn ảnh thẻ cho nhân viên ({employee.Employee_Code})</span>
            ) : (
              <span>Chỗ ảnh người đang để trống; bấm &ldquo;Tải Ảnh 3x4&rdquo; để gắn ảnh chân dung cho nhân viên bất cứ lúc nào.</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};
