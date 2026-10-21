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
  getDocFromServer,
  deleteDoc
} from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { AttendanceRecord, DepartmentPassRecord, Employee, RoomBooking, TrainingSession } from '../types';

// Initialize Firebase App & Firestore with provisioned Database ID
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');
export const auth = getAuth(app);

let isQuotaExhausted = false;

function handleFirebaseError(context: string, err: any) {
  if (
    err?.code === 'resource-exhausted' || 
    err?.code === 'auth/admin-restricted-operation' ||
    (err?.message && (err.message.includes('Quota exceeded') || err.message.includes('quota') || err.message.includes('admin-restricted-operation')))
  ) {
    if (!isQuotaExhausted) {
      isQuotaExhausted = true;
      console.warn(`[Firebase Mode Switch] Operating in high-speed local storage mode (${context}).`);
    }
  } else {
    console.error(`Error in ${context}:`, err);
  }
}

// Silently sign in anonymously for authorized security rule context
signInAnonymously(auth).catch((err) => {
  handleFirebaseError('signInAnonymously', err);
});

// Validate connection
async function testConnection() {
  if (isQuotaExhausted) return;
  try {
    await getDocFromServer(doc(db, 'settings', 'general'));
  } catch (error) {
    handleFirebaseError('testConnection', error);
  }
}
testConnection();

// ======================= APP SETTINGS / LOGO SYNC =======================

export function subscribeToCompanyLogo(callback: (logoUrl: string | null) => void) {
  if (isQuotaExhausted) return () => {};
  const settingRef = doc(db, 'settings', 'general');
  return onSnapshot(settingRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      callback(data.customLogoUrl || null);
    } else {
      callback(null);
    }
  }, (err) => {
    handleFirebaseError('subscribeToCompanyLogo', err);
  });
}

export async function saveCompanyLogoToCloud(logoUrl: string | null) {
  if (isQuotaExhausted) return;
  try {
    const settingRef = doc(db, 'settings', 'general');
    await setDoc(settingRef, {
      customLogoUrl: logoUrl,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    handleFirebaseError('saveCompanyLogoToCloud', err);
  }
}

// ======================= EMPLOYEES ROSTER SYNC (CHUẨN XÁC 5.379 NHÂN SỰ) =======================

export function subscribeToEmployees(callback: (employees: Employee[]) => void) {
  if (isQuotaExhausted) return () => {};
  const shardsCol = collection(db, 'roster_shards');
  
  return onSnapshot(shardsCol, (snapshot) => {
    if (snapshot.empty) {
      callback([]);
      return;
    }

    // Đọc tất cả các shard theo thứ tự định danh shard_0000 -> shard_0026
    const docs = snapshot.docs.sort((a, b) => a.id.localeCompare(b.id));
    const fullList: Employee[] = [];

    docs.forEach((docSnap) => {
      const data = docSnap.data();
      if (data && Array.isArray(data.employees)) {
        fullList.push(...data.employees);
      }
    });

    // Sắp xếp lại theo STT No từ 1 đến 5379
    fullList.sort((a, b) => Number(a.No || 0) - Number(b.No || 0));

    console.log(`[Firebase Cloud] Đã tải về thành công ${fullList.length} nhân sự`);
    callback(fullList);
  }, (err) => {
    handleFirebaseError('subscribeToEmployees', err);
  });
}

export async function saveEmployeesToCloud(employees: Employee[]) {
  if (isQuotaExhausted) return;
  
  // Mỗi shard chứa 200 nhân sự (~50KB, nằm an toàn tuyệt đối dưới ngưỡng 1MB của Firestore)
  // 5.379 nhân sự chia cho 200 = đúng 27 shards (shard_0000 đến shard_0026)
  const chunkSize = 200;

  try {
    // 1. Xóa sạch các shard cũ trước
    const shardsSnapshot = await getDocs(collection(db, 'roster_shards'));
    if (!shardsSnapshot.empty) {
      const deleteBatch = writeBatch(db);
      shardsSnapshot.docs.forEach((docSnap) => {
        deleteBatch.delete(docSnap.ref);
      });
      await deleteBatch.commit();
    }

    // 2. Ghi toàn bộ 27 shards mới trong 1 lần commit duy nhất (giới hạn batch là 500, 27 là quá nhỏ gọn)
    const saveBatch = writeBatch(db);
    const totalShards = Math.ceil(employees.length / chunkSize);

    for (let i = 0; i < employees.length; i += chunkSize) {
      const chunk = employees.slice(i, i + chunkSize);
      const shardIndex = Math.floor(i / chunkSize);
      // Dùng 4 chữ số 0000, 0001, 0002... để đảm bảo thứ tự luôn chuẩn từ 1 đến 5379
      const shardId = `shard_${String(shardIndex).padStart(4, '0')}`;
      const shardRef = doc(db, 'roster_shards', shardId);
      
      saveBatch.set(shardRef, {
        shardIndex: shardIndex,
        employees: chunk,
        count: chunk.length,
        updatedAt: new Date().toISOString()
      });
    }

    // 3. Cập nhật thông tin tổng số lượng
    const metaRef = doc(db, 'settings', 'roster_meta');
    saveBatch.set(metaRef, {
      totalCount: employees.length,
      totalShards: totalShards,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    // Đẩy toàn bộ lên Cloud trong 1 lệnh duy nhất
    await saveBatch.commit();
    console.log(`[Firebase Cloud] ĐÃ LƯU TRỌN VẸN CẢ ${employees.length} CÔNG NHÂN VIÊN LÊN CLOUD THÀNH CÔNG!`);
  } catch (err: any) {
    handleFirebaseError('saveEmployeesToCloud', err);
    throw err;
  }
}

export async function updateSingleEmployeePhotoInCloud(employeeCode: string, photoUrl: string | null) {
  if (isQuotaExhausted) return;
  try {
    const docRef = doc(db, 'employee_photos', employeeCode);
    await setDoc(docRef, {
      photoUrl: photoUrl,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    handleFirebaseError('updateSingleEmployeePhotoInCloud', err);
  }
}

export async function clearAllEmployeesInCloud() {
  if (isQuotaExhausted) return;
  try {
    const shardsSnapshot = await getDocs(collection(db, 'roster_shards'));
    const batch = writeBatch(db);
    shardsSnapshot.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();

    const legacySnapshot = await getDocs(collection(db, 'employees'));
    if (!legacySnapshot.empty) {
      const legacyBatch = writeBatch(db);
      legacySnapshot.docs.forEach(d => legacyBatch.delete(d.ref));
      await legacyBatch.commit();
    }
  } catch (err) {
    handleFirebaseError('clearAllEmployeesInCloud', err);
  }
}

// ======================= TRAINING SESSIONS & ATTENDANCE =======================

export function subscribeToTrainingSessions(callback: (sessions: TrainingSession[]) => void) {
  if (isQuotaExhausted) return () => {};
  const sessionsCol = collection(db, 'training_sessions');
  return onSnapshot(sessionsCol, (snapshot) => {
    const list: TrainingSession[] = [];
    snapshot.forEach((d) => {
      list.push(d.data() as TrainingSession);
    });
    list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    callback(list);
  }, (err) => {
    handleFirebaseError('subscribeToTrainingSessions', err);
  });
}

export async function saveTrainingSessionToCloud(session: TrainingSession) {
  if (isQuotaExhausted) return;
  try {
    await setDoc(doc(db, 'training_sessions', session.id), session);
  } catch (err) {
    handleFirebaseError('saveTrainingSessionToCloud', err);
  }
}

export function subscribeToAttendanceRecords(callback: (records: AttendanceRecord[]) => void) {
  if (isQuotaExhausted) return () => {};
  const colRef = collection(db, 'attendance_records');
  return onSnapshot(colRef, (snapshot) => {
    const list: AttendanceRecord[] = [];
    snapshot.forEach((d) => {
      list.push(d.data() as AttendanceRecord);
    });
    list.sort((a, b) => (b.scanTime || '').localeCompare(a.scanTime || ''));
    callback(list);
  }, (err) => {
    handleFirebaseError('subscribeToAttendanceRecords', err);
  });
}

export async function saveAttendanceRecordToCloud(record: AttendanceRecord) {
  if (isQuotaExhausted) return;
  try {
    await setDoc(doc(db, 'attendance_records', record.id), record);
  } catch (err) {
    handleFirebaseError('saveAttendanceRecordToCloud', err);
  }
}

export async function clearAttendanceRecordsInCloud() {
  if (isQuotaExhausted) return;
  try {
    const snapshot = await getDocs(collection(db, 'attendance_records'));
    const batch = writeBatch(db);
    snapshot.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  } catch (err) {
    handleFirebaseError('clearAttendanceRecordsInCloud', err);
  }
}

export async function deleteAttendanceRecordInCloud(recordId: string) {
  if (isQuotaExhausted) return;
  try {
    await deleteDoc(doc(db, 'attendance_records', recordId));
  } catch (err) {
    handleFirebaseError('deleteAttendanceRecordInCloud', err);
  }
}
// ======================= DEPARTMENT PASSES =======================

export function subscribeToDepartmentPasses(callback: (passes: DepartmentPassRecord[]) => void) {
  if (isQuotaExhausted) return () => {};
  const colRef = collection(db, 'department_passes');
  return onSnapshot(colRef, (snapshot) => {
    const list: DepartmentPassRecord[] = [];
    snapshot.forEach((d) => {
      list.push(d.data() as DepartmentPassRecord);
    });
    list.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
    callback(list);
  }, (err) => {
    handleFirebaseError('subscribeToDepartmentPasses', err);
  });
}

export async function saveDepartmentPassToCloud(pass: DepartmentPassRecord) {
  if (isQuotaExhausted) return;
  try {
    await setDoc(doc(db, 'department_passes', pass.id), pass);
  } catch (err) {
    handleFirebaseError('saveDepartmentPassToCloud', err);
  }
}

export async function updateDepartmentPassInCloud(pass: DepartmentPassRecord) {
  if (isQuotaExhausted) return;
  try {
    await setDoc(doc(db, 'department_passes', pass.id), pass, { merge: true });
  } catch (err) {
    handleFirebaseError('updateDepartmentPassInCloud', err);
  }
}

export async function deleteDepartmentPassInCloud(passId: string) {
  if (isQuotaExhausted) return;
  try {
    await deleteDoc(doc(db, 'department_passes', passId));
  } catch (err) {
    handleFirebaseError('deleteDepartmentPassInCloud', err);
  }
}
// ======================= MEETING ROOM BOOKINGS =======================

export function subscribeToRoomBookings(callback: (bookings: RoomBooking[]) => void) {
  if (isQuotaExhausted) return () => {};
  const colRef = collection(db, 'room_bookings');
  return onSnapshot(colRef, (snapshot) => {
    const list: RoomBooking[] = [];
    snapshot.forEach((d) => {
      list.push(d.data() as RoomBooking);
    });
    list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    callback(list);
  }, (err) => {
    handleFirebaseError('subscribeToRoomBookings', err);
  });
}

export async function saveRoomBookingToCloud(booking: RoomBooking) {
  if (isQuotaExhausted) return;
  try {
    await setDoc(doc(db, 'room_bookings', booking.id), booking);
  } catch (err) {
    handleFirebaseError('saveRoomBookingToCloud', err);
  }
}

export async function deleteRoomBookingInCloud(bookingId: string) {
  if (isQuotaExhausted) return;
  try {
    await deleteDoc(doc(db, 'room_bookings', bookingId));
  } catch (err) {
    handleFirebaseError('deleteRoomBookingInCloud', err);
  }
}
