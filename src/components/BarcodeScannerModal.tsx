/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { 
  X, 
  Camera, 
  Flashlight, 
  FlipHorizontal, 
  Keyboard, 
  Search, 
  AlertCircle,
  ScanLine,
  CheckCircle2,
  Sparkles,
  Upload,
  Image as ImageIcon,
  RotateCcw,
  HelpCircle,
  Smartphone
} from 'lucide-react';
import { soundFX } from '../utils/audio';
import { Employee } from '../types';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (scannedCode: string, matchedEmployee?: Employee) => void;
  title?: string;
  subtitle?: string;
  employees: Employee[];
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  title = "Quét Barcode Thẻ Nhân Viên",
  subtitle = "Hướng camera vào mã vạch trên thẻ nhân viên",
  employees
}) => {
  const [activeScanTab, setActiveScanTab] = useState<'camera' | 'photo' | 'manual'>('camera');
  const [manualCode, setManualCode] = useState('');
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [useFacingMode, setUseFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState(false);
  const [isDecodingFile, setIsDecodingFile] = useState(false);
  const [showPermissionGuide, setShowPermissionGuide] = useState(false);
  const [lastScannedResult, setLastScannedResult] = useState<{
    code: string;
    employee?: Employee;
  } | null>(null);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const containerId = 'barcode-scanner-viewport';

  const handleFoundCode = (decodedText: string) => {
    const cleanCode = decodedText.trim();
    if (!cleanCode) return;

    soundFX.playScanSuccess();

    const matched = employees.find(
      e => e.Employee_Code.trim().toLowerCase() === cleanCode.toLowerCase()
    );

    setLastScannedResult({
      code: cleanCode,
      employee: matched
    });

    onScanSuccess(cleanCode, matched);
  };

  const startCamera = async () => {
    if (!isOpen) return;
    setIsStartingCamera(true);
    setScannerError(null);

    try {
      if (html5QrCodeRef.current) {
        if (html5QrCodeRef.current.isScanning) {
          try {
            await html5QrCodeRef.current.stop();
          } catch {
            // ignore
          }
        }
        try {
          html5QrCodeRef.current.clear();
        } catch {
          // ignore
        }
      }

      const formatsToSupport = [
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.QR_CODE
      ];

      const html5QrCode = new Html5Qrcode(containerId, {
        formatsToSupport,
        verbose: false
      });
      html5QrCodeRef.current = html5QrCode;

      const config = {
        fps: 15,
        qrbox: { width: 280, height: 160 },
        aspectRatio: 1.0
      };

      await html5QrCode.start(
        { facingMode: useFacingMode },
        config,
        (decodedText) => {
          handleFoundCode(decodedText);
        },
        () => {
          // scan frame loop
        }
      );

      setIsCameraActive(true);
      setScannerError(null);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const isPermissionDenied = 
        errorMsg.includes('NotAllowedError') || 
        errorMsg.includes('Permission denied') || 
        errorMsg.includes('permission');

      if (isPermissionDenied) {
        setScannerError(
          'Trình duyệt chưa được cấp quyền Camera. Bạn có thể cấp quyền lại, hoặc chọn tab "Chụp Ảnh Thẻ" hoặc "Nhập Mã" bên dưới.'
        );
        setShowPermissionGuide(true);
      } else {
        setScannerError(
          'Không thể khởi động camera video trực tiếp. Bạn có thể dùng tính năng "Chụp/Tải Ảnh Thẻ" hoặc "Nhập Mã Thẻ" rất tiện lợi.'
        );
      }
      setIsCameraActive(false);
    } finally {
      setIsStartingCamera(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
      setIsCameraActive(false);
      setScannerError(null);
      setLastScannedResult(null);
      setShowPermissionGuide(false);
      return;
    }

    if (activeScanTab === 'camera') {
      const timer = setTimeout(() => {
        startCamera();
      }, 250);
      return () => clearTimeout(timer);
    } else {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch(() => {});
        setIsCameraActive(false);
      }
    }
  }, [isOpen, activeScanTab, useFacingMode]);

  const toggleCameraFacing = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
      } catch {
        // ignore
      }
    }
    setUseFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  const toggleTorch = async () => {
    try {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.applyVideoConstraints({
          // @ts-expect-error torch property
          advanced: [{ torch: !torchOn }]
        });
        setTorchOn(!torchOn);
      }
    } catch {
      // ignore
    }
  };

  const handlePhotoScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsDecodingFile(true);
    setScannerError(null);

    try {
      let scanner = html5QrCodeRef.current;
      if (!scanner) {
        scanner = new Html5Qrcode(containerId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.QR_CODE
          ],
          verbose: false
        });
        html5QrCodeRef.current = scanner;
      }

      if (scanner.isScanning) {
        await scanner.stop();
        setIsCameraActive(false);
      }

      const decodedText = await scanner.scanFile(file, true);
      handleFoundCode(decodedText);
    } catch (err: unknown) {
      soundFX.playError();
      setScannerError('Không tìm thấy mã vạch rõ nét trong ảnh này. Vui lòng chụp thẳng góc mã vạch hoặc nhập mã nhân viên bằng tay.');
    } finally {
      setIsDecodingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleFoundCode(manualCode.trim());
    setManualCode('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[94vh] text-slate-900">
        {/* Header */}
        <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center">
              <ScanLine className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900">{title}</h3>
              <p className="text-[11px] text-slate-500">{subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scan Mode Switcher Tabs */}
        <div className="grid grid-cols-3 gap-1 p-2 bg-slate-50 border-b border-slate-200 text-xs">
          <button
            type="button"
            onClick={() => setActiveScanTab('camera')}
            className={`py-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeScanTab === 'camera'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Camera Trực Tiếp</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveScanTab('photo')}
            className={`py-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeScanTab === 'photo'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Chụp / Tải Ảnh Thẻ</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveScanTab('manual')}
            className={`py-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeScanTab === 'manual'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>Nhập Mã Số</span>
          </button>
        </div>

        {/* Tab 1: Live Video Camera View */}
        {activeScanTab === 'camera' && (
          <div className="relative bg-black flex-1 min-h-[260px] flex items-center justify-center overflow-hidden">
            <div id={containerId} className="w-full h-full min-h-[260px]" />

            {/* Viewfinder Overlay */}
            {isCameraActive && (
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
                <div className="relative w-64 h-36 border-2 border-blue-400 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]">
                  <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-blue-400 -mt-1 -ml-1 rounded-tl"></div>
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-blue-400 -mt-1 -mr-1 rounded-tr"></div>
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-blue-400 -mb-1 -ml-1 rounded-bl"></div>
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-blue-400 -mb-1 -mr-1 rounded-br"></div>
                  <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_8px_#ef4444] absolute top-1/2 -translate-y-1/2 animate-bounce"></div>
                </div>
                <p className="mt-3 text-xs text-white font-bold px-3 py-1 rounded-full bg-black/60 backdrop-blur-sm">
                  Căn chỉnh mã vạch vào trong khung
                </p>
              </div>
            )}

            {/* Camera Floating Controls */}
            {isCameraActive && (
              <div className="absolute top-3 right-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleTorch}
                  title="Bật/Tắt Đèn Flash"
                  className={`w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-md transition-colors ${
                    torchOn ? 'bg-amber-500 text-white' : 'bg-black/60 text-white/80 hover:bg-black/80'
                  }`}
                >
                  <Flashlight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={toggleCameraFacing}
                  title="Đổi camera trước/sau"
                  className="w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 text-white/80 flex items-center justify-center backdrop-blur-md transition-colors"
                >
                  <FlipHorizontal className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Error / Permission Overlay */}
            {scannerError && (
              <div className="absolute inset-0 bg-white/95 p-6 flex flex-col items-center justify-center text-center gap-3 z-10 overflow-y-auto text-slate-900">
                <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 border border-amber-300 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <p className="text-xs text-slate-700 max-w-xs leading-relaxed font-medium">{scannerError}</p>

                <div className="flex flex-col gap-2 w-full max-w-xs mt-1">
                  <button
                    type="button"
                    onClick={startCamera}
                    disabled={isStartingCamera}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{isStartingCamera ? 'Đang kết nối camera...' : 'Cấp Quyền & Thử Lại Camera'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveScanTab('photo')}
                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Chụp Ảnh Thẻ Bằng Điện Thoại</span>
                  </button>
                </div>

                {showPermissionGuide && (
                  <div className="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 text-left space-y-1">
                    <p className="font-bold text-slate-800">Cách bật Camera trên điện thoại:</p>
                    <p>• <strong>iPhone (Safari):</strong> Bấm nút <span className="font-bold font-mono">aA</span> trên thanh địa chỉ &rarr; Cài đặt trang web &rarr; Camera &rarr; Chọn Cho phép.</p>
                    <p>• <strong>Android (Chrome):</strong> Bấm biểu tượng <span className="font-bold">ổ khóa 🔒</span> trên thanh địa chỉ &rarr; Quyền &rarr; Bật Máy ảnh.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Photo Upload */}
        {activeScanTab === 'photo' && (
          <div className="p-6 bg-white flex-1 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
              <Camera className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h4 className="font-extrabold text-sm text-slate-900">Chụp hoặc Tải Ảnh Thẻ Nhân Viên</h4>
              <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                Mở trực tiếp máy ảnh điện thoại chụp ảnh mã vạch trên thẻ hoặc chọn ảnh thẻ có sẵn.
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoScan}
              className="hidden"
            />

            <button
              type="button"
              disabled={isDecodingFile}
              onClick={() => fileInputRef.current?.click()}
              className="w-full max-w-xs py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 active:scale-98 transition-all"
            >
              <Camera className="w-4 h-4" />
              <span>{isDecodingFile ? 'Đang giải mã barcode...' : 'Mở Máy Ảnh Chụp Thẻ Ngay'}</span>
            </button>

            {scannerError && (
              <p className="text-xs text-rose-600 max-w-xs font-semibold">{scannerError}</p>
            )}
          </div>
        )}

        {/* Tab 3: Manual Code Entry */}
        {activeScanTab === 'manual' && (
          <div className="p-5 bg-white flex-1 flex flex-col justify-center space-y-4">
            <div className="text-center space-y-1">
              <h4 className="font-extrabold text-sm text-slate-900">Nhập Mã Số Thẻ Nhân Viên</h4>
              <p className="text-xs text-slate-500">
                Nhập số in dưới mã vạch trên thẻ (VD: 210181178)
              </p>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-3">
              <div className="relative">
                <Keyboard className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  autoFocus
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="Nhập mã nhân viên..."
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-sm"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Xác Nhận Mã Thẻ</span>
              </button>
            </form>
          </div>
        )}

        {/* Last Scanned Result Banner */}
        {lastScannedResult && (
          <div className="p-3 bg-emerald-50 border-t border-b border-emerald-200 flex items-center justify-between gap-3 animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="truncate text-xs">
                <span className="font-bold text-emerald-900 block">
                  {lastScannedResult.employee ? lastScannedResult.employee.Full_Name : `Mã thẻ: ${lastScannedResult.code}`}
                </span>
                <span className="text-slate-600 block truncate text-[11px]">
                  {lastScannedResult.employee ? `${lastScannedResult.employee.Position_Eng} • ${lastScannedResult.employee.Department_Eng}` : 'Đã quét thành công!'}
                </span>
              </div>
            </div>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-600 text-white font-mono font-bold shrink-0">
              {lastScannedResult.code}
            </span>
          </div>
        )}

        {/* Official Production Status */}
        <div className="p-3 bg-slate-50 border-t border-slate-200">
          <div className="flex items-center justify-between text-[11px] text-slate-600">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Chế độ chính thức: Quét thẻ thật hoặc nhập mã thẻ</span>
            </span>
            <span className="text-slate-500 font-mono text-[10px]">
              {employees.length > 0 ? `${employees.length} nhân sự` : 'Chưa có file Excel'}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-white border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
          >
            Đóng Trình Quét
          </button>
        </div>
      </div>
    </div>
  );
};
