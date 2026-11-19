/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Employee } from '../types';
import rawEmployees from './employees.json';

// Nạp sẵn toàn bộ 5.379 công nhân viên vào trang web
export const INITIAL_EMPLOYEES: Employee[] = rawEmployees as Employee[];

export const PRESET_ROOMS = [
  {
    id: 'vinh_ha_long',
    name: 'Phòng Họp Vịnh Hạ Long',
    capacity: 25,
    location: 'Khu vực phòng nhân sự_Nhà máy NV1',
    equipment: ['Máy chiếu 4K Ultra HD', 'Hệ thống âm thanh hội trường', 'Micro không dây', 'Máy lạnh 2.5 HP'],
    description: 'Phòng họp ấm cúng, trang bị họp trực tuyến hybrid, họp ban quản đốc và thảo luận chuyên môn.',
    color: 'from-blue-600 to-indigo-700'
  },
  {
    id: 'ba_na_hill',
    name: 'Phòng Họp Bà Nà Hill',
    capacity: 40,
    location: 'Đối diện phòng BU Traner_Nhà máy NV2',
    equipment: ['Máy chiếu 4K Ultra HD', 'Hệ thống âm thanh hội trường', 'Micro không dây', 'Máy lạnh 2.5 HP'],
    description: 'Phòng họp lớn chuyên dụng cho đào tạo nhân viên, họp tổng kết xưởng và tiếp đón khách đối tác.',
    color: 'from-emerald-600 to-teal-700'
  },
  {
    id: 'cfa_nv1',
    name: 'Phòng Họp CFA - NV1',
    capacity: 15,
    location: 'Khu vực CFA _ Nhà máy NV1',
    equipment: ['Smart TV', 'Bảng trắng', 'Máy lạnh'],
    description: 'Phòng họp chuyên dụng cho kiểm tra mẫu, họp kỹ thuật CFA và thảo luận chuyền may NV1.',
    color: 'from-amber-600 to-orange-700'
  },
  {
    id: 'cfa_nv2',
    name: 'Phòng Họp CFA - NV2',
    capacity: 15,
    location: 'Khu vực CFA _ Nhà máy NV2',
    equipment: ['Smart TV', 'Bảng trắng', 'Máy lạnh'],
    description: 'Phòng họp chuyên dụng cho kiểm tra mẫu, họp kỹ thuật CFA và thảo luận chuyền may NV2.',
    color: 'from-purple-600 to-violet-700'
  },
  {
    id: 'customer_room_nv2',
    name: 'Phòng Khách Hàng NV2',
    capacity: 20,
    location: 'Khu vực tiếp khách đối tác _ Nhà máy NV2',
    equipment: ['Smart TV màn hình lớn', 'Hệ thống họp trực tuyến', 'Bảng trắng', 'Máy lạnh'],
    description: 'Phòng tiếp đón khách hàng, đối tác nhãn hàng quốc tế nhà máy NV2.',
    color: 'from-rose-600 to-pink-700'
  }
];

export const COMMON_DEPARTMENTS = [
  'Bộ phận Production',
  'Bộ phận Cutting',
  'Bộ phận Store',
  'Bộ phận MI',
  'Bộ phận Supermarket',
  'Bộ phận Heat stranfer',
  'Bộ phận Padprint',
  'Bộ phận Fuse',
  'Bộ phận Screen',
  'Bộ phận PCO',
  'Bộ phận IE',
  'Bộ phận Scan',
  'Bộ Phận Quality (QA/QC)',
  'Bộ phận Kỹ Thuật May (TI)',
  'Bộ phận Bảo Trì (MTN)',
  'Bộ phận kế hoạc (PPC)',
  'Văn Phòng Nhân Sự (HR Dept)',
  'Phòng Kế Toán & Tài Chính (Finance)',
  'Bộ Phận Xuất Nhập Khẩu (Logistics)'
];

export const COMMON_MOVE_REASONS = [
  'Giao nhận bán thành phẩm (BTP)',
  'Lấy mẫu vải & phụ liệu',
  'Bảo trì, sửa chữa máy móc chuyền',
  'Scan kim loại',
  'Sửa máy scan',
  'Vệ sinh máy & kiểm tra máy scan',
  'Hỗ trợ kỹ thuật may & chuyền sản xuất',
  'Kiểm tra chất lượng đột xuất (Inline QA)',
  'Liên hệ thủ tục nhân sự / Ký giấy tờ',
  'Họp nhanh trao đổi công việc',
  'Kiểm kê hàng hóa tồn kho',
  'Lý do khác'
];
