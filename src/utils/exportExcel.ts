/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from 'xlsx';
import { AttendanceRecord, DepartmentPassRecord, Employee, RoomBooking, TrainingSession } from '../types';

export function exportAttendanceToExcel(session: TrainingSession, records: AttendanceRecord[]) {
  const data = records.map((r, index) => ({
    'STT': index + 1,
    'Mã Nhân Viên': r.employeeCode,
    'Họ và Tên': r.employeeName,
    'Phòng Ban': r.department,
    'Nhà Máy / Xưởng': r.factory,
    'Chức Vụ': r.position,
    'Đợt Điểm Danh': r.attendanceShift || 'Ca Sáng',
    'Chủ Đề Đào Tạo Của Ca': r.shiftTopicTitle || r.sessionTitle, // Xuất đúng chủ đề của ca đó
    'Giờ Điểm Danh': r.scanTime,
    'Ngày': r.date,
    'Phương Thức': r.method === 'photo_scan' ? 'Chụp/Tải Ảnh Thẻ' : r.method === 'manual_entry' ? 'Nhập Mã Số' : 'Quét Camera Barcode',
    'Xác Thực': 'HỢP LỆ (ĐÃ QUÉT BARCODE THẺ)'
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  
  worksheet['!cols'] = [
    { wch: 6 },
    { wch: 15 },
    { wch: 25 },
    { wch: 22 },
    { wch: 16 },
    { wch: 25 },
    { wch: 16 }, // Đợt
    { wch: 35 }, // Chủ đề của ca
    { wch: 14 },
    { wch: 12 },
    { wch: 22 },
    { wch: 26 },
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Diem_Danh');
  const safeTitle = session.title.replace(/[/\\?%*:|"<>]/g, '_').slice(0, 30);
  XLSX.writeFile(workbook, `DiemDanh_${safeTitle}_${session.date}.xlsx`);
}

export function exportDepartmentPassToExcel(passes: DepartmentPassRecord[]) {
  const data = passes.map((p, index) => ({
    'STT': index + 1,
    'Mã Nhân Viên': p.employeeCode,
    'Họ và Tên': p.employeeName,
    'Bộ Phận Gốc': p.employeeDepartment,
    'Chức Vụ': p.employeePosition,
    'Từ Bộ Phận': p.fromDepartment,
    'Đến Bộ Phận': p.toDepartment,
    'Lý Do Di Chuyển': p.reason,
    'Thời Gian Vào': p.timestamp,
    'Ngày Vào': p.date,
    'Thời Gian Ra': p.returnTime || 'Chưa về',
    'Ngày Ra': p.returnDate || (p.returnTime ? p.date : '-'),
    'Trạng Thái': p.status === 'active' ? 'Đang ở xưởng' : 'Đã về'
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();

  worksheet['!cols'] = [
    { wch: 6 },
    { wch: 15 },
    { wch: 24 },
    { wch: 20 },
    { wch: 22 },
    { wch: 22 },
    { wch: 22 },
    { wch: 30 },
    { wch: 15 },
    { wch: 12 },
    { wch: 15 },
    { wch: 12 },
    { wch: 14 }
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Nhat_Ky_Ra_Vao');
  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `NhatKy_RaVao_BoPhan_${dateStr}.xlsx`);
}

export function exportRoomBookingsToExcel(bookings: RoomBooking[]) {
  const data = bookings.map((b, index) => ({
    'STT': index + 1,
    'Phòng Họp': b.roomName,
    'Tiêu Đề Cuộc Họp': b.title,
    'Người Đặt': b.bookedByName,
    'Mã Thẻ NV': b.bookedByCode,
    'Phòng Ban': b.department,
    'Điện Thoại': b.phone || '-',
    'Ngày Họp': b.date,
    'Bắt Đầu': b.startTime,
    'Kết Thúc': b.endTime,
    'Số Người': b.participantsCount,
    'Thiết Bị': b.equipmentsNeeded.join(', '),
    'Trạng Thái': b.status === 'checked_in' ? 'Đã nhận phòng' : b.status === 'confirmed' ? 'Đã xác nhận' : b.status
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  worksheet['!cols'] = [
    { wch: 6 },
    { wch: 24 },
    { wch: 30 },
    { wch: 22 },
    { wch: 15 },
    { wch: 20 },
    { wch: 15 },
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 30 },
    { wch: 16 }
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Lich_Dat_Phong');
  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `LichDatPhong_Hop_${dateStr}.xlsx`);
}

export function exportEmployeeListToExcel(employees: Employee[]) {
  const data = employees.map((e, index) => ({
    'No': e.No || index + 1,
    'Employee_Code': e.Employee_Code,
    'Pre_Name': e.Pre_Name || '',
    'Name': e.Name || '',
    'Surname': e.Surname || '',
    'Full_Name': e.Full_Name || `${e.Name} ${e.Surname}`.trim(),
    'Start_Date': e.Start_Date || '',
    'Employee_Type': e.Employee_Type || '',
    'Line_Eng': e.Line_Eng || '',
    'Department_Eng': e.Department_Eng || '',
    'Factory_Code': e.Factory_Code || '',
    'Division_Eng': e.Division_Eng || '',
    'Section_Eng': e.Section_Eng || '',
    'Position_Eng': e.Position_Eng || '',
    'Cost_Center': e.Cost_Center || ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Danh_Sach_Nhan_Vien');
  XLSX.writeFile(workbook, `DanhSach_ToanThe_CongNhan_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// Export clean sample template for HR / Factory users to fill in
export function exportSampleTemplateExcel() {
  const sampleHeaders = [
    {
      'No': 1,
      'Employee_Code': '210181178',
      'Pre_Name': 'Mr.',
      'Name': 'Cao Văn',
      'Surname': 'Quí',
      'Full_Name': 'Cao Văn Quí',
      'Start_Date': '05/06/2018',
      'Employee_Type': 'Full-time',
      'Line_Eng': 'Line 01',
      'Department_Eng': 'Production',
      'Factory_Code': 'Factory 1',
      'Division_Eng': 'Garment',
      'Section_Eng': 'Lean',
      'Position_Eng': 'Lean Specialist',
      'Cost_Center': 'CC-101',
      'Phone': '0901234567'
    }
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleHeaders);
  const workbook = XLSX.utils.book_new();
  worksheet['!cols'] = [
    { wch: 6 },
    { wch: 16 },
    { wch: 10 },
    { wch: 18 },
    { wch: 14 },
    { wch: 22 },
    { wch: 14 },
    { wch: 15 },
    { wch: 12 },
    { wch: 20 },
    { wch: 14 },
    { wch: 16 },
    { wch: 14 },
    { wch: 22 },
    { wch: 14 },
    { wch: 15 }
  ];
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Mau_Import_Cong_Nhan');
  XLSX.writeFile(workbook, 'Mau_DanhSach_CongNhan_NhaMay.xlsx');
}

// Read and parse uploaded Excel file (.xlsx, .xls, .csv)
export function parseEmployeesFromExcel(file: File): Promise<Employee[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const buffer = e.target?.result;
        const workbook = XLSX.read(buffer, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to array of objects
        const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!rawRows || rawRows.length === 0) {
          resolve([]);
          return;
        }

        const employees: Employee[] = rawRows.map((row, index) => {
          // Normalize key finding
          const getVal = (...keys: string[]): string => {
            for (const key of keys) {
              const matchedKey = Object.keys(row).find(
                k => k.trim().toLowerCase() === key.toLowerCase() ||
                     k.trim().toLowerCase().replace(/[\s_-]/g, '') === key.toLowerCase().replace(/[\s_-]/g, '')
              );
              if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null) {
                return String(row[matchedKey]).trim();
              }
            }
            return '';
          };

          const code = getVal('Employee_Code', 'Employee Code', 'Mã NV', 'Ma NV', 'Mã Thẻ', 'Code', 'ID');
          const name = getVal('Name', 'Tên', 'Ten', 'First Name', 'Họ');
          const surname = getVal('Surname', 'Họ', 'Ho', 'Tên Đệm', 'Last Name');
          const preName = getVal('Pre_Name', 'Pre Name', 'Danh xưng', 'Ông/Bà');
          const dept = getVal('Department_Eng', 'Department', 'Phòng ban', 'Bộ phận', 'Bo Phan');
          const factory = getVal('Factory_Code', 'Factory', 'Nhà máy', 'Xưởng', 'Xuong') || 'Factory 1';
          const pos = getVal('Position_Eng', 'Position', 'Chức vụ', 'Chuc vu', 'Vị trí');
          const div = getVal('Division_Eng', 'Division', 'Khối', 'Bộ phận chi tiết');
          const sec = getVal('Section_Eng', 'Section', 'Tổ', 'Chuyền');
          const startDate = getVal('Start_Date', 'Start Date', 'Ngày vào');
          const empType = getVal('Employee_Type', 'Employee Type', 'Loại NV');
          const costCenter = getVal('Cost_Center', 'Cost Center');
          const phone = getVal('Phone', 'Điện thoại', 'Số ĐT', 'Mobile');

          let fullName = getVal('Full_Name', 'Full Name', 'Họ và Tên', 'Ho va Ten');
          if (!fullName) {
            fullName = `${name} ${surname}`.trim() || `Công nhân #${code}`;
          }

          return {
            No: index + 1,
            Employee_Code: code || `NV${index + 1000}`,
            Pre_Name: preName,
            Name: name,
            Surname: surname,
            Full_Name: fullName,
            Start_Date: startDate,
            Employee_Type: empType,
            Department_Eng: dept || 'Sản xuất',
            Factory_Code: factory,
            Division_Eng: div,
            Section_Eng: sec,
            Position_Eng: pos || 'Công nhân viên',
            Cost_Center: costCenter,
            Phone: phone
          };
        }).filter(emp => emp.Employee_Code.length > 0);

        resolve(employees);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(file);
  });
}
