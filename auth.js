import { initializeApp } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/11.3.0/firebase-auth.js";

// Firebaseの設定
const firebaseConfig = {
    apiKey: "AIzaSyAJRoEA5FmZuzVbVTYsjDZdd4hbZSnzr5A",
    authDomain: "ai-sleep-consultant.firebaseapp.com",
    projectId: "ai-sleep-consultant",
    storageBucket: "ai-sleep-consultant.firebasestorage.app",
    messagingSenderId: "48632759539",
    appId: "1:48632759539:web:1e087f751048a5fba16386",
    measurementId: "G-VXCMH47EV2"
};

// Firebase初期化
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// DOM Elements
const signupForm = document.querySelector('#signupForm');
const loginForm = document.querySelector('#loginForm');
const authTabs = document.querySelectorAll('.auth-tab');

// 認証状態の監視を修正
onAuthStateChanged(auth, (user) => {
    if (user) {
        // 認証済みの場合は赤ちゃん選択画面へ
        window.location.href = 'baby-select.html';
    }
});

// タブ切り替えの処理
authTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const targetId = tab.dataset.tab;
        
        // タブの切り替え
        authTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // フォームの切り替え
        document.querySelectorAll('.auth-form').forEach(form => {
            form.classList.remove('active');
        });
        document.getElementById(`${targetId}Form`).classList.add('active');
    });
});

// サインアップフォームの処理
signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.querySelector('#signupEmail').value;
    const password = document.querySelector('#signupPassword').value;
    const passwordConfirm = document.querySelector('#signupPasswordConfirm').value;

    try {
        if (password !== passwordConfirm) {
            throw new Error('パスワードが一致しません');
        }

        await createUserWithEmailAndPassword(auth, email, password);
        // 認証成功時は自動的にonAuthStateChangedで遷移
    } catch (error) {
        console.error('サインアップエラー:', error);
        showError(signupForm, getAuthErrorMessage(error.code || error.message));
    }
});

// ログインフォームの処理
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.querySelector('#loginEmail').value;
    const password = document.querySelector('#loginPassword').value;

    try {
        await signInWithEmailAndPassword(auth, email, password);
        // 認証成功時は自動的にonAuthStateChangedで遷移
    } catch (error) {
        console.error('ログインエラー:', error);
        showError(loginForm, getAuthErrorMessage(error.code));
    }
});

// エラーメッセージ表示
function showError(form, message) {
    let errorDiv = form.querySelector('.error-message');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        form.appendChild(errorDiv);
    }
    errorDiv.textContent = message;
}

// 認証エラーメッセージの日本語化
function getAuthErrorMessage(code) {
    const messages = {
        'auth/email-already-in-use': 'このメールアドレスは既に使用されています',
        'auth/invalid-email': 'メールアドレスの形式が正しくありません',
        'auth/operation-not-allowed': 'この操作は許可されていません',
        'auth/weak-password': 'パスワードが弱すぎます',
        'auth/user-disabled': 'このアカウントは無効になっています',
        'auth/user-not-found': 'ユーザーが見つかりません',
        'auth/wrong-password': 'パスワードが間違っています',
        'パスワードが一致しません': 'パスワードが一致しません'
    };
    return messages[code] || 'エラーが発生しました';
}

// パスワード表示切り替えボタンの設定
document.querySelectorAll('.toggle-password').forEach(button => {
    button.addEventListener('click', function(e) {
        e.preventDefault();
        const input = this.closest('.password-input-wrapper').querySelector('input');
        if (input) {
            input.type = input.type === 'password' ? 'text' : 'password';
            this.textContent = input.type === 'password' ? '👁' : '🔒';
        }
    });
}); 