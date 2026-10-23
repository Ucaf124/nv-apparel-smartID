/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Employee {
  No?: number | string;
  Employee_Code: string;
  Pre_Name?: string;
  Name: string;
  Surname: string;
  Full_Name?: string;
  Start_Date?: string;
  Resign_Date?: string;
  Probation_Date?: string;
  Employee_Type?: string;
  Line_Eng?: string;
  Group_Code?: string;
  Department_Eng: string;
  Factory_Code: string;
  Division_Eng?: string;
  Section_Eng?: string;
  Section_Unit_Eng?: string;
  Unit_Section_Eng?: string;
  Position_Eng: string;
  Cost_Center?: string;
  Phone?: string;
  Photo_Url?: string;
}

export interface TrainingSession {
  id: string;
  title: string;
  instructor: string;
  location: string;
  date: string;
  startTime: string;
  endTime: string;
  type: 'training' | 'meeting' | 'safety' | 'other' | string;
  description?: string;
  createdAt: string;
  status: 'active' | 'completed' | 'cancelled';
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  sessionTitle: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  factory: string;
  position: string;
  scanTime: string;
  date: string;
  method: 'camera_scan' | 'manual_entry' | 'photo_scan';
  note?: string;
}

export interface DepartmentPassRecord {
  id: string;
  employeeCode: string;
  employeeName: string;
  employeeDepartment: string;
  employeePosition: string;
  fromDepartment: string;
  toDepartment: string;
  reason: string;
  passType: 'check_in' | 'check_out';
  timestamp: string;
  date: string;
  status: 'active' | 'returned';
  returnTime?: string;
  returnDate?: string;
  note?: string;
}

export interface MeetingRoom {
  id: 'vinh_ha_long' | 'ba_na_hill' | string;
  name: string;
  capacity: number;
  location: string;
  equipment: string[];
  description: string;
  color: string;
  imageUrl?: string;
}

export interface RoomBooking {
  id: string;
  roomId: string;
  roomName: string;
  bookedByCode: string;
  bookedByName: string;
  department: string;
  phone?: string;
  title: string;
  hostName?: string;
  date: string;       // Ngày bắt đầu (YYYY-MM-DD)
  endDate?: string;   // Ngày kết thúc (YYYY-MM-DD)
  startTime: string;  // HH:mm
  endTime: string;    // HH:mm
  participantsCount: number;
  equipmentsNeeded: string[];
  status: 'pending' | 'confirmed' | 'cancelled' | 'rejected'; // pending: Chờ duyệt, confirmed: Đã duyệt
  approvedBy?: string; // Tên người duyệt (duypt / yaitp)
  approvedAt?: string; // Thời gian duyệt
  createdAt: string;
}

// Hàm ẩn 3 số cuối của mã thẻ để bảo mật: VD '210170019' -> '210170***'
export function maskEmployeeCode(code: string | undefined): string {
  if (!code) return '';
  const clean = code.trim();
  if (clean.length <= 3) return '***';
  return clean.slice(0, -3) + '***';
}
