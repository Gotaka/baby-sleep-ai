// Firebase関連のインポート
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-analytics.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut,
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/11.3.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, orderBy, getDocs, limit } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js";

// DOM Elements
const chatMessages = document.querySelector('.chat-messages');
const messageForm = document.querySelector('.message-form');
const messageInput = document.querySelector('.message-form textarea');
const authSection = document.querySelector('#auth');
const chatSection = document.querySelector('#chat');
const loginForm = document.querySelector('#loginForm');
const signupForm = document.querySelector('#signupForm');
const authTabs = document.querySelectorAll('.auth-tab');
const babyInfoForm = document.querySelector('#babyInfoForm');
const babyBirthday = document.querySelector('#babyBirthday');
const babyAge = document.querySelector('#babyAge');
const homeSection = document.querySelector('#home');
const aboutSection = document.querySelector('#about');
const featuresSection = document.querySelector('#features');
const contactSection = document.querySelector('#contact');

// DOM Elements の取得確認
console.log('DOM Elements:', {
    signupForm: signupForm,
    authTabs: authTabs,
    loginForm: loginForm,
    babyInfoForm: babyInfoForm,
    babyBirthday: babyBirthday,
    babyAge: babyAge
});

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

// Firebaseの初期化を修正
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const analytics = getAnalytics(app);
const db = getFirestore(app);

// 初期化確認のログを追加
console.log('Firebase initialized:', {
    app: app,
    auth: auth,
    analytics: analytics,
    db: db
});

// Dify APIの設定
const DIFY_API_URL = 'https://api.dify.ai/v1';
const API_KEY = 'Bearer app-44DggXgrSQI9FcLCDzLeApHq';

// フォームの初期値を設定
const userInputs = {
    birthday: '',
    sleepTime: '',
    wakeTime: '',
    napSchedule: '',
    currentIssues: ''
};

let currentUser = null;

// 初期化処理
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const signupForm = document.querySelector('#signupForm');
    const loginForm = document.querySelector('#loginForm');
    const authTabs = document.querySelectorAll('.auth-tab');
    
    console.log('Elements initialized:', { signupForm, loginForm, authTabs });
    
    // Setup event listeners
    setupFormListeners({ signupForm, loginForm });
    setupTabListeners(authTabs);
    setupTimeInputs();
});

function setupFormListeners({ signupForm, loginForm }) {
    if (!signupForm || !loginForm) {
        console.error('Form elements not found');
        return;
    }
    // サインアップフォーム
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.querySelector('#signupEmail').value;
        const password = document.querySelector('#signupPassword').value;
        const passwordConfirm = document.querySelector('#signupPasswordConfirm').value;

        try {
            console.log('サインアップ試行:', {
                email,
                passwordLength: password.length,
                isPasswordMatch: password === passwordConfirm
            });

            const validationError = validatePassword(password);
            if (validationError) {
                console.log('バリデーションエラー:', validationError);
                showError(signupForm, validationError);
                return;
            }

            if (password !== passwordConfirm) {
                console.log('パスワード不一致エラー');
                showError(signupForm, 'パスワードが一致しません');
                return;
            }

            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            console.log('登録成功:', userCredential.user);
            
            signupForm.reset();
            showSuccess(signupForm, '登録が完了しました');
        } catch (error) {
            console.error('詳細なエラー情報:', {
                code: error.code,
                message: error.message,
                fullError: error
            });

            let errorMessage = getAuthErrorMessage(error.code);
            showError(signupForm, `${errorMessage} (${error.code})`);
        }
    });

    // ログインフォーム
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.querySelector('#loginEmail').value;
        const password = document.querySelector('#loginPassword').value;

        try {
            await signInWithEmailAndPassword(auth, email, password);
            loginForm.reset();
        } catch (error) {
            console.error('ログインエラー:', error);
            showError(loginForm, getAuthErrorMessage(error.code));
        }
    });
}

// 認証状態の監視を更新
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        // 赤ちゃんの情報があるか確認
        const babyInfo = await loadBabyInfo();
        if (babyInfo) {
            // 情報がある場合はチャットページへ
            window.location.href = 'chat.html';
        } else {
            // 情報がない場合は情報入力ページへ
            window.location.href = 'baby-info.html';
        }
    } else {
        currentUser = null;
        // 未認証時の表示設定
        authSection.classList.remove('hidden');
        homeSection.classList.remove('hidden');
        aboutSection.classList.remove('hidden');
        featuresSection.classList.remove('hidden');
        contactSection.classList.remove('hidden');
        chatSection.classList.add('hidden');
    }
});

// エラーメッセージ表示
function showError(form, message) {
    console.log('エラーメッセージを表示:', message); // エラーメッセージのログ
    
    let errorDiv = form.querySelector('.error-message');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        form.appendChild(errorDiv);
    }
    errorDiv.textContent = message;
    
    // エラーメッセージを目立たせる
    errorDiv.style.backgroundColor = '#ffe6e6';
    errorDiv.style.padding = '10px';
    errorDiv.style.marginTop = '10px';
    errorDiv.style.borderRadius = '5px';
}

// 成功メッセージ表示関数を追加
function showSuccess(form, message) {
    let successDiv = form.querySelector('.success-message');
    if (!successDiv) {
        successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        form.appendChild(successDiv);
    }
    successDiv.textContent = message;
    successDiv.style.color = '#4CAF50';
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

// チャット履歴の読み込み
async function loadChatHistory() {
    if (!currentUser) return;

    try {
        const q = query(
            collection(db, `users/${currentUser.uid}/messages`),
            orderBy('timestamp', 'asc')
        );
        
        const querySnapshot = await getDocs(q);
        chatMessages.innerHTML = ''; // チャット履歴をクリア
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            appendMessage(data.content, data.sender);
        });
    } catch (error) {
        console.error("チャット履歴の読み込みエラー:", error);
    }
}

// チャットメッセージの保存
async function saveMessage(content, sender) {
    if (!currentUser) return;

    try {
        await addDoc(collection(db, `users/${currentUser.uid}/messages`), {
            content,
            sender,
            timestamp: new Date(),
        });
    } catch (error) {
        console.error("メッセージの保存エラー:", error);
    }
}

// メッセージ送信時の処理を修正
messageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = messageInput.value.trim();
    if (!message) return;

    try {
        // ユーザーメッセージを表示と保存
        appendMessage(message, 'user');
        await saveMessage(message, 'user');
        messageInput.value = '';
        messageInput.style.height = 'auto';

        // APIリクエストの設定
        const response = await fetch(`${DIFY_API_URL}/chat-messages`, {
            method: 'POST',
            headers: {
                'Authorization': API_KEY,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                inputs: userInputs,
                query: message,
                response_mode: 'blocking',
                conversation_id: null,
                user: currentUser?.uid || 'anonymous'
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('API Error:', errorData);
            throw new Error(`API request failed: ${errorData.message || 'Unknown error'}`);
        }

        const data = await response.json();
        console.log('API Response:', data);

        if (data.answer) {
            appendMessage(data.answer, 'ai');
            await saveMessage(data.answer, 'ai');
        }

    } catch (error) {
        console.error('Error details:', error);
        appendMessage('申し訳ありません。エラーが発生しました。', 'ai');
    }
});

// appendMessage関数を修正
function appendMessage(content, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    messageDiv.innerHTML = `
        <div class="message-content">
            <p>${escapeHtml(content)}</p>
        </div>
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// HTMLエスケープ処理
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// テキストエリアの高さ自動調整を修正
messageInput.addEventListener('input', function() {
    this.style.height = 'auto';
    const maxHeight = 150;
    this.style.height = Math.min(this.scrollHeight, maxHeight) + 'px';
});

// フォーム送信時のデフォルト動作を防止
messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
});

function setupTabListeners(tabs) {
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetId = tab.dataset.tab;
            console.log('Switching to tab:', targetId);

            // タブの切り替え
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // フォームの切り替え
            document.querySelectorAll('.auth-form').forEach(form => {
                form.classList.remove('active');
            });
            
            const targetForm = document.getElementById(`${targetId}Form`);
            if (targetForm) {
                targetForm.classList.add('active');
                console.log('Activated form:', targetId);
            } else {
                console.error('Target form not found:', targetId);
            }
        });
    });
}

// パスワード表示切り替えボタンの設定を修正
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.toggle-password').forEach(button => {
        button.addEventListener('click', function(e) {
            // デフォルトのボタン動作を防止
            e.preventDefault();
            
            // 直接の親要素（password-input-wrapper）内のinput要素を取得
            const input = this.closest('.password-input-wrapper').querySelector('input');
            
            // 入力フィールドのtype属性を切り替え
            if (input) {
                if (input.type === 'password') {
                    input.type = 'text';
                    this.textContent = '🔒';
                } else {
                    input.type = 'password';
                    this.textContent = '👁';
                }
                
                // デバッグ用ログ
                console.log('パスワード表示切り替え:', {
                    inputType: input.type,
                    buttonText: this.textContent
                });
            }
        });
    });
});

// パスワードのバリデーション関数を追加
function validatePassword(password) {
    // より厳密なパスワード要件
    const hasNumber = /[0-9]/.test(password);
    const hasLetter = /[a-zA-Z]/.test(password);
    const isLongEnough = password.length >= 8; // 8文字以上に変更
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    if (!isLongEnough) {
        return 'パスワードは8文字以上である必要があります';
    }
    if (!hasNumber || !hasLetter) {
        return 'パスワードは英字と数字を組み合わせてください';
    }
    if (!hasSpecialChar) {
        return 'パスワードには特殊文字(!@#$%^&*等)を含めてください';
    }
    return null;
}

// 月齢計算関数を修正
function calculateAge(birthDate) {
    const today = new Date();
    const birth = new Date(birthDate);
    
    let months = (today.getFullYear() - birth.getFullYear()) * 12;
    months -= birth.getMonth();
    months += today.getMonth();
    
    // 日にちを考慮した調整
    if (today.getDate() < birth.getDate()) {
        months--;
    }
    
    return {
        months: months,
        today: today.toISOString().split('T')[0] // YYYY-MM-DD形式
    };
}

// 誕生日入力時の処理を修正
babyBirthday.addEventListener('change', function() {
    const ageInfo = calculateAge(this.value);
    babyAge.textContent = `${ageInfo.months}ヶ月`;
    userInputs.birthday = this.value;
    userInputs.currentDate = ageInfo.today; // 今日の日付を追加
});

// 時間選択の設定
function setupTimeInputs() {
    // 時間のオプションを生成
    const hourSelects = document.querySelectorAll('select[id$="Hour"]');
    const minuteSelects = document.querySelectorAll('select[id$="Minute"]');

    // 時間のオプションを追加（0-23時）
    hourSelects.forEach(select => {
        for (let i = 0; i < 24; i++) {
            const option = document.createElement('option');
            option.value = i.toString().padStart(2, '0');
            option.textContent = i.toString().padStart(2, '0');
            select.appendChild(option);
        }
    });

    // 分のオプションを追加（15分単位）
    minuteSelects.forEach(select => {
        [0, 15, 30, 45].forEach(minute => {
            const option = document.createElement('option');
            option.value = minute.toString().padStart(2, '0');
            option.textContent = minute.toString().padStart(2, '0');
            select.appendChild(option);
        });
    });
}

// フォーム送信時の処理を修正
babyInfoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const sleepTimeHour = document.querySelector('#babySleepTimeHour').value;
    const sleepTimeMinute = document.querySelector('#babySleepTimeMinute').value;
    const wakeTimeHour = document.querySelector('#babyWakeTimeHour').value;
    const wakeTimeMinute = document.querySelector('#babyWakeTimeMinute').value;
    
    // 時間の検証
    if (sleepTimeHour && sleepTimeMinute && wakeTimeHour && wakeTimeMinute) {
        const sleepTime = `${sleepTimeHour}:${sleepTimeMinute}`;
        const wakeTime = `${wakeTimeHour}:${wakeTimeMinute}`;
        
        // フォームの値を取得してuserInputsを更新
        userInputs.birthday = babyBirthday.value;
        userInputs.currentDate = new Date().toISOString().split('T')[0]; // 今日の日付を追加
        userInputs.sleepTime = sleepTime;
        userInputs.wakeTime = wakeTime;
        userInputs.napSchedule = document.querySelector('#babyNapSchedule').value;
        userInputs.currentIssues = document.querySelector('#babyCurrentIssues').value;
        
        try {
            await addDoc(collection(db, `users/${currentUser.uid}/babyInfo`), {
                ...userInputs,
                timestamp: new Date()
            });
            
            showSuccess(babyInfoForm, '赤ちゃんの情報を保存しました');
            
            // AIへのメッセージに今日の日付を含める
            const message = `赤ちゃんの情報が登録されました。誕生日は${userInputs.birthday}で、現在の日付は${userInputs.currentDate}です。睡眠についての具体的な悩みを教えてください。`;
            appendMessage(message, 'ai');
        } catch (error) {
            console.error('情報保存エラー:', error);
            showError(babyInfoForm, 'エラーが発生しました');
        }
    } else {
        showError(babyInfoForm, '就寝時間と起床時間を入力してください');
    }
});

// 保存された情報の読み込みも修正
async function loadBabyInfo() {
    if (!currentUser) return;
    
    try {
        const q = query(
            collection(db, `users/${currentUser.uid}/babyInfo`),
            orderBy('timestamp', 'desc'),
            limit(1)
        );
        
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            const data = querySnapshot.docs[0].data();
            
            // フォームに値を設定
            babyBirthday.value = data.birthday;
            
            // 時間の設定
            if (data.sleepTime) {
                const [sleepHour, sleepMinute] = data.sleepTime.split(':');
                document.querySelector('#babySleepTimeHour').value = sleepHour;
                document.querySelector('#babySleepTimeMinute').value = sleepMinute;
            }
            if (data.wakeTime) {
                const [wakeHour, wakeMinute] = data.wakeTime.split(':');
                document.querySelector('#babyWakeTimeHour').value = wakeHour;
                document.querySelector('#babyWakeTimeMinute').value = wakeMinute;
            }
            
            document.querySelector('#babyNapSchedule').value = data.napSchedule;
            document.querySelector('#babyCurrentIssues').value = data.currentIssues;
            
            // 月齢を表示
            const ageInfo = calculateAge(data.birthday);
            babyAge.textContent = `${ageInfo.months}ヶ月`;
            
            // userInputsを更新
            Object.assign(userInputs, data);
            return true;
        }
    } catch (error) {
        console.error('情報読み込みエラー:', error);
    }
    return false;
}
