/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  collection, 
  onSnapshot, 
  writeBatch, 
  getDocs,
  deleteDoc
} from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { AttendanceRecord, DepartmentPassRecord, Employee, RoomBooking, TrainingSession } from '../types';

// Cấu hình trực tiếp project nva-smart-pass chuẩn xác 100%
const firebaseConfig = {
  apiKey: "AIzaSyCj82ngc_TpFkU-cOOENB3Ewd9ufWApeDk",
  authDomain: "nva-smart-pass.firebaseapp.com",
  projectId: "nva-smart-pass",
  storageBucket: "nva-smart-pass.firebasestorage.app",
  messagingSenderId: "884508830966",
  appId: "1:884508830966:web:23931edcfa1832a3e910d7"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// KẾT NỐI VÀO DATABASE 'default' (HOẶC GỌI KHÔNG THAM SỐ)
export const db = getFirestore(app);
export const auth = getAuth(app);

// Đăng nhập ẩn danh
signInAnonymously(auth).catch((err) => {
  console.warn('[Firebase Auth] Anonymous sign-in warning:', err?.message);
});

// Hàm dọn dẹp các trường undefined để Firestore không bao giờ bị lỗi
function cleanDataForFirestore<T extends Record<string, any>>(obj: T): Partial<T> {
  const cleaned: any = {};
  Object.keys(obj).forEach(key => {
    if (obj[key] !== undefined && obj[key] !== null) {
      cleaned[key] = obj[key];
    }
  });
  return cleaned;
}

// ======================= APP SETTINGS / LOGO SYNC =======================

export function subscribeToCompanyLogo(callback: (logoUrl: string | null) => void) {
  const settingRef = doc(db, 'settings', 'general');
  return onSnapshot(settingRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data().customLogoUrl || null);
    } else {
      callback(null);
    }
  }, (err) => {
    console.warn('Lỗi subscribe logo:', err?.message);
  });
}

export async function saveCompanyLogoToCloud(logoUrl: string | null) {
  try {
    const settingRef = doc(db, 'settings', 'general');
    await setDoc(settingRef, {
      customLogoUrl: logoUrl,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    console.warn('Lỗi save logo:', err);
  }
}

// ======================= EMPLOYEES ROSTER SYNC =======================

export function subscribeToEmployees(callback: (employees: Employee[]) => void) {
  const shardsCol = collection(db, 'roster_shards');
  return onSnapshot(shardsCol, (snapshot) => {
    const list: Employee[] = [];
    snapshot.forEach((d) => {
      const data = d.data();
      if (data && Array.isArray(data.employees)) {
        list.push(...data.employees);
      }
    });
    list.sort((a, b) => Number(a.No || 0) - Number(b.No || 0));
    callback(list);
  }, (err) => {
    console.warn('Lỗi subscribe employees:', err?.message);
  });
}

export async function saveEmployeesToCloud(employees: Employee[]) {
  const chunkSize = 200;
  try {
    const shardsSnapshot = await getDocs(collection(db, 'roster_shards'));
    const deleteBatch = writeBatch(db);
    shardsSnapshot.docs.forEach(d => deleteBatch.delete(d.ref));
    await deleteBatch.commit();

    const saveBatch = writeBatch(db);
    for (let i = 0; i < employees.length; i += chunkSize) {
      const chunk = employees.slice(i, i + chunkSize);
      const shardIndex = Math.floor(i / chunkSize);
      const shardRef = doc(db, 'roster_shards', `shard_${String(shardIndex).padStart(4, '0')}`);
      saveBatch.set(shardRef, {
        shardIndex: shardIndex,
        employees: chunk,
        updatedAt: new Date().toISOString()
      });
    }
    await saveBatch.commit();
  } catch (err) {
    console.warn('Lỗi save employees:', err);
  }
}

export async function updateSingleEmployeePhotoInCloud(employeeCode: string, photoUrl: string | null) {
  try {
    const docRef = doc(db, 'employee_photos', employeeCode);
    await setDoc(docRef, { photoUrl, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (err) {
    console.warn('Lỗi save photo:', err);
  }
}

export async function clearAllEmployeesInCloud() {
  try {
    const shardsSnapshot = await getDocs(collection(db, 'roster_shards'));
    const batch = writeBatch(db);
    shardsSnapshot.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  } catch (err) {
    console.warn('Lỗi clear employees:', err);
  }
}

// ======================= TRAINING SESSIONS & ATTENDANCE =======================

export function subscribeToTrainingSessions(callback: (sessions: TrainingSession[]) => void) {
  const sessionsCol = collection(db, 'training_sessions');
  return onSnapshot(sessionsCol, (snapshot) => {
    const list: TrainingSession[] = [];
    snapshot.forEach((d) => {
      list.push(d.data() as TrainingSession);
    });
    list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    // Luôn gọi callback kể cả khi mảng rỗng [] để đồng bộ khi bị xóa
    callback(list);
  }, (err) => {
    console.warn('Lỗi subscribe sessions:', err?.message);
  });
}

export async function saveTrainingSessionToCloud(session: TrainingSession) {
  try {
    const cleaned = cleanDataForFirestore(session);
    await setDoc(doc(db, 'training_sessions', session.id), cleaned, { merge: true });
  } catch (err) {
    console.warn('Lỗi save session:', err);
  }
}

export async function deleteTrainingSessionInCloud(sessionId: string) {
  try {
    await deleteDoc(doc(db, 'training_sessions', sessionId));
  } catch (err) {
    console.warn('Lỗi delete session:', err);
  }
}

export function subscribeToAttendanceRecords(callback: (records: AttendanceRecord[]) => void) {
  const colRef = collection(db, 'attendance_records');
  return onSnapshot(colRef, (snapshot) => {
    const list: AttendanceRecord[] = [];
    snapshot.forEach((d) => {
      list.push(d.data() as AttendanceRecord);
    });
    list.sort((a, b) => (b.scanTime || '').localeCompare(a.scanTime || ''));
    callback(list);
  }, (err) => {
    console.warn('Lỗi subscribe attendance:', err?.message);
  });
}

export async function saveAttendanceRecordToCloud(record: AttendanceRecord) {
  try {
    const cleaned = cleanDataForFirestore(record);
    await setDoc(doc(db, 'attendance_records', record.id), cleaned, { merge: true });
  } catch (err) {
    console.warn('Lỗi save attendance:', err);
  }
}

export async function deleteAttendanceRecordInCloud(recordId: string) {
  try {
    await deleteDoc(doc(db, 'attendance_records', recordId));
  } catch (err) {
    console.warn('Lỗi delete attendance:', err);
  }
}

export async function clearAttendanceRecordsInCloud() {
  try {
    const snapshot = await getDocs(collection(db, 'attendance_records'));
    const batch = writeBatch(db);
    snapshot.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  } catch (err) {
    console.warn('Lỗi clear attendance:', err);
  }
}

// ======================= DEPARTMENT PASSES =======================

export function subscribeToDepartmentPasses(callback: (passes: DepartmentPassRecord[]) => void) {
  const colRef = collection(db, 'department_passes');
  return onSnapshot(colRef, (snapshot) => {
    const list: DepartmentPassRecord[] = [];
    snapshot.forEach((d) => {
      list.push(d.data() as DepartmentPassRecord);
    });
    list.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
    callback(list);
  }, (err) => {
    console.warn('Lỗi subscribe passes:', err?.message);
  });
}

export async function saveDepartmentPassToCloud(pass: DepartmentPassRecord) {
  try {
    const cleaned = cleanDataForFirestore(pass);
    await setDoc(doc(db, 'department_passes', pass.id), cleaned, { merge: true });
  } catch (err) {
    console.warn('Lỗi save pass:', err);
  }
}

export async function updateDepartmentPassInCloud(pass: DepartmentPassRecord) {
  try {
    const cleaned = cleanDataForFirestore(pass);
    await setDoc(doc(db, 'department_passes', pass.id), cleaned, { merge: true });
  } catch (err) {
    console.warn('Lỗi update pass:', err);
  }
}

export async function deleteDepartmentPassInCloud(passId: string) {
  try {
    await deleteDoc(doc(db, 'department_passes', passId));
  } catch (err) {
    console.warn('Lỗi delete pass:', err);
  }
}

// ======================= MEETING ROOM BOOKINGS (ĐỒNG BỘ 100%) =======================

export function subscribeToRoomBookings(callback: (bookings: RoomBooking[]) => void) {
  const colRef = collection(db, 'room_bookings');
  return onSnapshot(colRef, (snapshot) => {
    const list: RoomBooking[] = [];
    snapshot.forEach((d) => {
      list.push(d.data() as RoomBooking);
    });
    list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    // Luôn gửi danh sách mới về cho máy khác, kể cả khi rỗng []
    callback(list);
  }, (err) => {
    console.warn('Lỗi subscribe room bookings:', err?.message);
  });
}

export async function saveRoomBookingToCloud(booking: RoomBooking) {
  try {
    const cleaned = cleanDataForFirestore(booking);
    await setDoc(doc(db, 'room_bookings', booking.id), cleaned, { merge: true });
    console.log('[Firestore] Đã lưu đặt phòng thành công lên Cloud:', booking.id, booking.title);
  } catch (err) {
    console.error('Lỗi save room booking lên cloud:', err);
    throw err;
  }
}

export async function deleteRoomBookingInCloud(bookingId: string) {
  try {
    await deleteDoc(doc(db, 'room_bookings', bookingId));
    console.log('[Firestore] Đã xóa vĩnh viễn đặt phòng trên Cloud:', bookingId);
  } catch (err) {
    console.error('Lỗi delete room booking trên cloud:', err);
    throw err;
  }
}
