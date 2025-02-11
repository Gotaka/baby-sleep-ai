// 新規作成：環境変数を管理するファイル
export const config = {
    firebase: {
        apiKey: process.env.FIREBASE_API_KEY || "AIzaSyAJRoEA5FmZuzVbVTYsjDZdd4hbZSnzr5A",
        authDomain: process.env.FIREBASE_AUTH_DOMAIN || "ai-sleep-consultant.firebaseapp.com",
        projectId: process.env.FIREBASE_PROJECT_ID || "ai-sleep-consultant",
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "ai-sleep-consultant.firebasestorage.app",
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "48632759539",
        appId: process.env.FIREBASE_APP_ID || "1:48632759539:web:1e087f751048a5fba16386",
        measurementId: process.env.FIREBASE_MEASUREMENT_ID || "G-VXCMH47EV2"
    },
    dify: {
        apiUrl: process.env.DIFY_API_URL || "https://api.dify.ai/v1",
        apiKey: process.env.DIFY_API_KEY || "app-44DggXgrSQI9FcLCDzLeApHq"
    }
}; 