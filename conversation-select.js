import { initializeApp } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-auth.js";
import { getFirestore, collection, query, orderBy, getDocs, addDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js";

// Firebase設定を正しく設定
const firebaseConfig = {
    apiKey: "AIzaSyAJRoEA5FmZuzVbVTYsjDZdd4hbZSnzr5A",
    authDomain: "ai-sleep-consultant.firebaseapp.com",
    projectId: "ai-sleep-consultant",
    storageBucket: "ai-sleep-consultant.firebasestorage.app",
    messagingSenderId: "48632759539",
    appId: "1:48632759539:web:1e087f751048a5fba16386",
    measurementId: "G-VXCMH47EV2"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const conversationList = document.querySelector('#conversationList');
const startNewConversation = document.querySelector('#startNewConversation');

// 認証状態の確認
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    const babyId = sessionStorage.getItem('selectedBabyId');
    if (!babyId) {
        window.location.href = 'baby-select.html';
        return;
    }

    loadConversations(user.uid, babyId);
});

// 会話一覧を読み込む
async function loadConversations(userId, babyId) {
    try {
        const q = query(
            collection(db, `users/${userId}/babyInfo/${babyId}/conversations`),
            orderBy('createdAt', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        conversationList.innerHTML = '';
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const card = createConversationCard(doc.id, data);
            conversationList.appendChild(card);
        });
    } catch (error) {
        console.error('会話一覧の読み込みエラー:', error);
        showError('会話一覧の読み込みに失敗しました');
    }
}

// 会話カードを作成
function createConversationCard(id, data) {
    const card = document.createElement('div');
    card.className = 'conversation-card';
    
    const date = new Date(data.createdAt.toDate());
    const formattedDate = date.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    card.innerHTML = `
        <div class="conversation-info">
            <div class="conversation-title-container">
                <span class="conversation-title">${data.title || `会話 ${formattedDate}`}</span>
                <button class="edit-title-button">✎</button>
            </div>
            <div class="conversation-date">${formattedDate}</div>
        </div>
    `;

    // タイトル編集機能
    const editButton = card.querySelector('.edit-title-button');
    const titleSpan = card.querySelector('.conversation-title');
    
    editButton.addEventListener('click', async (e) => {
        e.stopPropagation();
        const newTitle = prompt('会話のタイトルを入力してください', titleSpan.textContent);
        if (newTitle && newTitle.trim()) {
            try {
                await updateDoc(doc(db, `users/${auth.currentUser.uid}/babyInfo/${currentBabyId}/conversations/${id}`), {
                    title: newTitle.trim()
                });
                titleSpan.textContent = newTitle.trim();
            } catch (error) {
                console.error('タイトル更新エラー:', error);
                showError('タイトルの更新に失敗しました');
            }
        }
    });

    card.addEventListener('click', () => {
        sessionStorage.setItem('selectedConversationId', id);
        sessionStorage.setItem('difyConversationId', data.difyConversationId);
        sessionStorage.setItem('conversationTitle', data.title || `会話 ${formattedDate}`);
        window.location.href = 'chat.html';
    });

    return card;
}

// 新しい会話を開始する処理を修正
startNewConversation.addEventListener('click', () => {
    try {
        console.log('Starting new conversation...'); // デバッグ用
        // セッションストレージをクリア
        sessionStorage.removeItem('selectedConversationId');
        sessionStorage.removeItem('difyConversationId');
        
        // chat.htmlに遷移
        window.location.href = 'chat.html';
    } catch (error) {
        console.error('Error starting new conversation:', error);
        showError('新しい会話の開始に失敗しました');
    }
});

// デバッグ用のコンソールログを追加
document.addEventListener('DOMContentLoaded', () => {
    console.log('Conversation select page loaded');
    console.log('Selected baby ID:', sessionStorage.getItem('selectedBabyId'));
    
    // 新規会話ボタンの存在確認
    const button = document.querySelector('#startNewConversation');
    if (button) {
        console.log('New conversation button found');
    } else {
        console.error('New conversation button not found');
    }

    // 赤ちゃんの名前を表示
    const babyName = sessionStorage.getItem('selectedBabyName');
    const babyNameElement = document.getElementById('selectedBabyName');
    if (babyName && babyNameElement) {
        babyNameElement.textContent = `${babyName}の会話一覧`;
    }
});

// エラー表示関数
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    document.querySelector('.conversation-select-container').appendChild(errorDiv);
} 