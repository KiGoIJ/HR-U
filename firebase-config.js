/**
 * Firebase Config & Security Configuration
 * Вставьте параметры своего проекта из Firebase Console (Project Settings -> General -> Your apps -> Web app)
 */
export const firebaseConfig = {
  apiKey: "AIzaSyA2RxdMUGwhXBe-rpZjQQfDYG1T9UMmaV0",
  authDomain: "aculs-a5fe1.firebaseapp.com",
  databaseURL: "https://aculs-a5fe1-default-rtdb.firebaseio.com",
  projectId: "aculs-a5fe1",
  storageBucket: "aculs-a5fe1.firebasestorage.app",
  messagingSenderId: "176811002068",
  appId: "1:176811002068:web:293b1d5bd7b14895c5d341",
  measurementId: "G-CRB4N5BZV0",
};

/**
 * SHA-256 хеш мастер-пароля для доступа кадровиков и администрации.
 * По умолчанию хеш для пароля "123456"
 * Для смены сгенерируйте SHA-256 от вашего нового мастер-пароля.
 */
export const MASTER_HASH = "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92";
