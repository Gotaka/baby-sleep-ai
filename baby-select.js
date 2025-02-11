import { initializeApp } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-auth.js";
import { getFirestore, collection, query, orderBy, getDocs, limit } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js";

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
const babyList = document.querySelector('#babyList');
const addNewBaby = document.querySelector('#addNewBaby');
const signOutButton = document.querySelector('#signOutButton');

// 認証状態の監視
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    loadBabies(user.uid);
});

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
    
    return { years, months };
}

// 赤ちゃんの一覧を読み込む
async function loadBabies(userId) {
    try {
        const q = query(
            collection(db, `users/${userId}/babyInfo`),
            orderBy('timestamp', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        babyList.innerHTML = ''; // リストをクリア
        
        if (querySnapshot.empty) {
            // 登録済みの赤ちゃんがいない場合は直接登録ページへ
            window.location.href = 'baby-info.html';
            return;
        }

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const babyCard = createBabyCard(doc.id, data);
            babyList.appendChild(babyCard);
        });
    } catch (error) {
        console.error('赤ちゃんの情報読み込みエラー:', error);
        showError('情報の読み込みに失敗しました');
    }
}

// 赤ちゃんの会話履歴を取得する関数
async function loadBabyConversations(babyId) {
    try {
        const q = query(
            collection(db, `users/${currentUser.uid}/babyInfo/${babyId}/chats`),
            orderBy('timestamp', 'desc'),
            limit(10)
        );
        
        const querySnapshot = await getDocs(q);
        const conversations = [];
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            conversations.push({
                id: doc.id,
                ...data
            });
        });
        
        return conversations;
    } catch (error) {
        console.error('Failed to load conversations:', error);
        return [];
    }
}

// 赤ちゃんのカードを作成関数を修正
function createBabyCard(id, data) {
    const card = document.createElement('div');
    card.className = 'baby-card';
    
    const age = calculateAge(data.birthday);
    const ageText = age.years > 0 ? `${age.years}歳${age.months}ヶ月` : `${age.months}ヶ月`;
    
    // 誕生日のフォーマットを整形
    const birthDate = new Date(data.birthday);
    const formattedBirthday = birthDate.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    card.innerHTML = `
        <div class="baby-info">
            <div class="baby-details">
                <div class="baby-name">${data.name || '名前未設定'}</div>
            </div>
            <div class="baby-date-info">
                <div class="baby-birthday">${formattedBirthday}</div>
                <div class="baby-age">${ageText}</div>
            </div>
            <div class="baby-card-actions">
                <button class="edit-button" title="編集">
                    <span class="edit-icon">✎</span>
                </button>
            </div>
        </div>
    `;

    // チャット画面への遷移（カード全体のクリック）
    card.addEventListener('click', (e) => {
        if (e.target.closest('.edit-button')) {
            e.stopPropagation();
            return;
        }
        
        // 必要な情報をすべて保存
        sessionStorage.setItem('selectedBabyId', id);
        sessionStorage.setItem('selectedBabyName', data.name || '名前未設定');
        sessionStorage.setItem('selectedBabyAge', ageText);
        sessionStorage.setItem('selectedBabyBirthday', data.birthday);
        
        // chat.htmlの代わりにconversation-select.htmlに遷移
        window.location.href = 'conversation-select.html';
    });

    // 編集ボタンのクリックイベント
    const editButton = card.querySelector('.edit-button');
    editButton.addEventListener('click', () => {
        sessionStorage.setItem('editBabyId', id);
        sessionStorage.setItem('editBabyData', JSON.stringify(data));
        window.location.href = 'baby-info.html?mode=edit';
    });

    // 会話履歴の読み込みと表示
    loadBabyConversations(id).then(conversations => {
        const historyDiv = card.querySelector('.conversation-history');
        if (conversations.length > 0) {
            const recentConversations = conversations.slice(0, 3);
            recentConversations.forEach(conv => {
                const convElement = document.createElement('div');
                convElement.className = 'conversation-preview';
                convElement.textContent = conv.content.substring(0, 50) + '...';
                historyDiv.appendChild(convElement);
            });
        } else {
            historyDiv.innerHTML = '<p>まだ会話履歴がありません</p>';
        }
    });

    return card;
}

// 新規登録ボタンの処理
addNewBaby.addEventListener('click', () => {
    window.location.href = 'baby-info.html';
});

// サインアウトの処理
signOutButton.addEventListener('click', async () => {
    try {
        await signOut(auth);
        window.location.href = 'index.html';
    } catch (error) {
        console.error('サインアウトエラー:', error);
        showError('サインアウトに失敗しました');
    }
});

// エラーメッセージ表示
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    document.querySelector('.baby-select-container').appendChild(errorDiv);
} 