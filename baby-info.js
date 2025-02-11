import { initializeApp } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-auth.js";
import { getFirestore, collection, addDoc, updateDoc, doc } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js";

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
const db = getFirestore(app);

// DOM Elements
const babyInfoForm = document.querySelector('#babyInfoForm');
const babyBirthday = document.querySelector('#babyBirthday');
const babyAge = document.querySelector('#babyAge');

let currentUser = null;

// 編集モードの判定とデータの読み込み
let isEditMode = false;
let editBabyId = null;

// 認証状態の確認を修正
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    currentUser = user;
    
    // URLパラメータから編集モードを判定
    const urlParams = new URLSearchParams(window.location.search);
    isEditMode = urlParams.get('mode') === 'edit';
    
    if (isEditMode) {
        // 編集モードの場合、既存のデータを読み込む
        const editData = JSON.parse(sessionStorage.getItem('editBabyData'));
        editBabyId = sessionStorage.getItem('editBabyId');
        
        if (editData) {
            // フォームに既存のデータを設定
            document.querySelector('#babyName').value = editData.name || '';
            document.querySelector('#babyBirthday').value = editData.birthday;
            
            // 就寝時間の設定
            const [sleepHour, sleepMinute] = editData.sleepTime.split(':');
            document.querySelector('#babySleepTimeHour').value = sleepHour;
            document.querySelector('#babySleepTimeMinute').value = sleepMinute;
            
            // 起床時間の設定
            const [wakeHour, wakeMinute] = editData.wakeTime.split(':');
            document.querySelector('#babyWakeTimeHour').value = wakeHour;
            document.querySelector('#babyWakeTimeMinute').value = wakeMinute;
            
            document.querySelector('#babyNapSchedule').value = editData.napSchedule || '';
            document.querySelector('#babyCurrentIssues').value = editData.currentIssues || '';
            
            // 月齢を表示
            const ageText = calculateAge(editData.birthday);
            babyAge.textContent = ageText;
            
            // タイトルと送信ボタンのテキストを変更
            document.querySelector('h2').textContent = '赤ちゃんの情報を編集';
            document.querySelector('.submit-button').textContent = '更新';
        }
    }
    
    setupTimeInputs();
});

// フォーム送信処理を修正
babyInfoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
        const formData = {
            name: document.querySelector('#babyName').value,
            birthday: babyBirthday.value,
            napSchedule: document.querySelector('#babyNapSchedule').value,
            currentIssues: document.querySelector('#babyCurrentIssues').value,
            timestamp: new Date()
        };

        if (isEditMode && editBabyId) {
            await updateDoc(doc(db, `users/${currentUser.uid}/babyInfo`, editBabyId), formData);
        } else {
            await addDoc(collection(db, `users/${currentUser.uid}/babyInfo`), formData);
        }

        sessionStorage.removeItem('editBabyData');
        sessionStorage.removeItem('editBabyId');
        
        window.location.href = 'baby-select.html';
    } catch (error) {
        console.error('Error:', error);
        showError(isEditMode ? '情報の更新に失敗しました' : '情報の保存に失敗しました');
    }
});

// エラー表示関数
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    babyInfoForm.appendChild(errorDiv);
}

// 年齢計算関数を追加
function calculateAge(birthDate) {
    const today = new Date();
    const birth = new Date(birthDate);
    
    let years = today.getFullYear() - birth.getFullYear();
    let months = today.getMonth() - birth.getMonth();
    
    // 日にちを考慮した調整
    if (today.getDate() < birth.getDate()) {
        months--;
    }
    
    // 月がマイナスの場合の調整
    if (months < 0) {
        years--;
        months += 12;
    }
    
    // 年齢表示テキストを生成
    let ageText = '';
    if (years > 0) {
        ageText = `${years}歳${months}ヶ月`;
    } else {
        ageText = `${months}ヶ月`;
    }
    
    return ageText;
}

// 誕生日入力時の処理を修正
babyBirthday.addEventListener('change', function() {
    const ageText = calculateAge(this.value);
    babyAge.textContent = ageText;
}); 