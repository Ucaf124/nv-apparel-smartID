/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  ExternalLink, 
  FileSpreadsheet, 
  ScanLine, 
  ArrowLeftRight, 
  CalendarDays, 
  Trash2, 
  ShieldCheck, 
  Smartphone, 
  Wifi,
  Sparkles,
  BookOpen
} from 'lucide-react';

interface ProductionGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWipeData: () => void;
  employeeCount: number;
  sessionCount: number;
  attendanceCount: number;
  passCount: number;
  bookingCount: number;
}

export const ProductionGuideModal: React.FC<ProductionGuideModalProps> = ({
  isOpen,
  onClose,
  onWipeData,
  employeeCount,
  sessionCount,
  attendanceCount,
  passCount,
  bookingCount
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Use the canonical production shared URL or current window URL
  const appUrl = typeof window !== 'undefined' 
    ? window.location.origin 
    : 'https://ais-pre-vymdz7ci5wz2msdecbhre6-428733231026.asia-northeast1.run.app';

  const handleCopy = () => {
    navigator.clipboard.writeText(appUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden text-slate-900 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-blue-50/80 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg text-slate-900 leading-tight">
                Hướng Dẫn Sử Dụng Chính Thức
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                SmartFactory Pass • NV Apparel
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 text-xs sm:text-sm">
          {/* Share Link Box */}
          <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-blue-900 flex items-center gap-1.5 text-xs">
                <Wifi className="w-3.5 h-3.5 text-blue-600" />
                Đường Link Truy Cập Mở (Dùng 4G/Wifi Mọi Thiết Bị):
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                Không Cần VPN
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                readOnly
                value={appUrl}
                className="flex-1 px-3 py-2 bg-white border border-blue-200 rounded-xl text-xs font-mono text-slate-700 select-all focus:outline-none"
              />
              <button
                onClick={handleCopy}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Đã sao chép!' : 'Sao chép link'}</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500 leading-snug">
              Bạn có thể gửi link này qua nhóm Zalo, Telegram hoặc ghim lên màn hình chính điện thoại của quản đốc xưởng, nhân sự HR và phòng bảo vệ.
            </p>
          </div>

          {/* 5-Step Production Workflow */}
          <div className="space-y-3">
            <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-slate-900 text-white text-xs font-mono font-bold flex items-center justify-center">
                ✓
              </span>
              Quy Trình 5 Bước Vận Hành Thực Tế Tại Nhà Máy
            </h4>

            <div className="space-y-3">
              {/* Step 1 */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center">1</span>
                  <span className="font-extrabold text-slate-900 text-xs">Nạp Danh Sách Công Nhân Nhà Máy</span>
                </div>
                <p className="text-xs text-slate-600 pl-7 leading-relaxed">
                  Vào tab <strong>&ldquo;Danh Sách Công Nhân & Excel&rdquo;</strong>, bấm <strong>&ldquo;Tải Lên File Excel (.xlsx)&rdquo;</strong> để đưa file danh sách toàn bộ nhân sự vào hệ thống. Hệ thống tự động nhận diện đúng các cột theo ảnh bảng tính của bạn.
                </p>
              </div>

              {/* Step 2 */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center">2</span>
                  <span className="font-extrabold text-slate-900 text-xs">Điểm Danh Đào Tạo & Tham Dự Họp</span>
                </div>
                <p className="text-xs text-slate-600 pl-7 leading-relaxed">
                  Tạo buổi đào tạo hoặc họp mới &rarr; bấm nút <strong>&ldquo;QUÉT BARCODE THẺ&rdquo;</strong>. Khi công nhân bước vào, hướng camera vào mã vạch sau thẻ của họ. Hệ thống phát tiếng bíp xác nhận và ngăn chặn điểm danh lặp lại.
                </p>
              </div>

              {/* Step 3 */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center">3</span>
                  <span className="font-extrabold text-slate-900 text-xs">Ghi Nhận Ra/Vào Giữa Các Bộ Phận (Thay Sổ Giấy)</span>
                </div>
                <p className="text-xs text-slate-600 pl-7 leading-relaxed">
                  Nhân viên hoặc thợ bảo trì di chuyển giữa Xưởng 1, Xưởng 2, Tổ cắt, Kho vải chỉ cần quét mã vạch thẻ để ghi nhận <strong>Vào</strong> hoặc <strong>Ra</strong>. Quản đốc theo dõi danh sách ai đang có mặt trong xưởng theo thời gian thực.
                </p>
              </div>

              {/* Step 4 */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center">4</span>
                  <span className="font-extrabold text-slate-900 text-xs">Đặt & Nhận Phòng Họp (Vịnh Hạ Long / Bà Nà Hill)</span>
                </div>
                <p className="text-xs text-slate-600 pl-7 leading-relaxed">
                  Xem lịch trống của 2 phòng họp, đăng ký giờ họp và quét thẻ để xác nhận nhận phòng khi đến giờ họp thực tế.
                </p>
              </div>

              {/* Step 5 */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center">5</span>
                  <span className="font-extrabold text-slate-900 text-xs">Xuất File Báo Cáo Excel</span>
                </div>
                <p className="text-xs text-slate-600 pl-7 leading-relaxed">
                  Ở bất kỳ màn hình nào, bấm nút <strong>&ldquo;Xuất File Excel&rdquo;</strong> để tải toàn bộ bảng điểm danh / nhật ký ra vào / lịch phòng họp về máy tính để lưu trữ hoặc gửi cho bộ phận Nhân sự & Ban Giám đốc.
                </p>
              </div>
            </div>
          </div>

          {/* Clean Slate / Wipe Data Section */}
          <div className="p-4 bg-rose-50/70 border border-rose-200 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-900 font-extrabold text-xs">
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>Làm Sạch Dữ Liệu Thử Nghiệm Để Khởi Đầu Mới</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-300">
                Khởi tạo chính thức
              </span>
            </div>

            <div className="text-xs text-rose-800/80 leading-relaxed space-y-1">
              <p>Hiện tại hệ thống đang lưu trữ:</p>
              <div className="flex flex-wrap gap-2 text-[11px] font-medium text-slate-700">
                <span className="px-2 py-1 rounded bg-white border border-rose-200">
                  Công nhân: <strong>{employeeCount}</strong>
                </span>
                <span className="px-2 py-1 rounded bg-white border border-rose-200">
                  Buổi đào tạo: <strong>{sessionCount}</strong>
                </span>
                <span className="px-2 py-1 rounded bg-white border border-rose-200">
                  Lượt điểm danh: <strong>{attendanceCount}</strong>
                </span>
                <span className="px-2 py-1 rounded bg-white border border-rose-200">
                  Lượt ra vào xưởng: <strong>{passCount}</strong>
                </span>
                <span className="px-2 py-1 rounded bg-white border border-rose-200">
                  Lịch phòng họp: <strong>{bookingCount}</strong>
                </span>
              </div>
            </div>

            <button
              onClick={onWipeData}
              className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors shadow-xs active:scale-98"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>XOÁ SẠCH TOÀN BỘ DỮ LIỆU THỬ NGHIỆM ĐỂ VẬN HÀNH TỪ SỐ 0</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors"
          >
            Đã Hiểu & Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
