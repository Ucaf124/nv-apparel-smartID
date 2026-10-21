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
  type: 'training' | 'meeting' | 'safety' | 'other';
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
  method: 'camera_scan' | 'manual_entry';
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
  date: string;
  startTime: string; // "09:00"
  endTime: string;   // "10:30"
  participantsCount: number;
  equipmentsNeeded: string[];
  status: 'confirmed' | 'checked_in' | 'cancelled' | 'completed';
  checkedInAt?: string;
  createdAt: string;
}
