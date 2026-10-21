/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export function verifyAdminAction(actionName: string): boolean {
  // Luôn luôn hỏi mật khẩu mỗi khi bấm, không lưu nhớ phiên làm việc
  const pin = prompt(`🔐 BẢO MẬT QUẢN TRỊ NHÀ MÁY\n\nThao tác "${actionName}" yêu cầu quyền Quản trị viên / Phòng Nhân Sự.\nVui lòng nhập Mật khẩu Quản trị:`);
  
  if (pin === null) {
    return false; // Người dùng bấm Hủy
  }

  const ADMIN_PASSWORD = '8888'; // Đổi mật khẩu của bạn ở đây

  if (pin.trim() === ADMIN_PASSWORD) {
    return true; // Đúng pass thì cho làm
  } else {
    alert('❌ Mật khẩu quản trị không đúng! Thao tác đã bị hủy.');
    return false;
  }
}