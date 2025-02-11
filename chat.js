import { initializeApp } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    query, 
    orderBy, 
    getDocs, 
    limit,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js";

// 定数をより明確に定義
const CONFIG = {
    DIFY_API_URL: 'https://api.dify.ai/v1',
    API_KEY: 'app-44DggXgrSQI9FcLCDzLeApHq',
    CHAT_HISTORY_LIMIT: 50,
    SCROLL_DELAY: 100,
    SCROLL_OFFSET_RATIO: 0.3,
    MIN_SCROLL_OFFSET: 100
};

// Firebase初期化
const app = initializeApp({
    apiKey: "AIzaSyAJRoEA5FmZuzVbVTYsjDZdd4hbZSnzr5A",
    authDomain: "ai-sleep-consultant.firebaseapp.com",
    projectId: "ai-sleep-consultant",
    storageBucket: "ai-sleep-consultant.firebasestorage.app",
    messagingSenderId: "48632759539",
    appId: "1:48632759539:web:1e087f751048a5fba16386",
    measurementId: "G-VXCMH47EV2"
});

const auth = getAuth(app);
const db = getFirestore(app);

// DOM要素の取得をより堅牢に
const elements = {
    chatMessages: document.querySelector('.chat-messages'),
    messageForm: document.querySelector('.message-form'),
    messageInput: document.querySelector('textarea'),
    selectedBabyName: document.querySelector('.selected-baby-name')
};

// 状態管理をよりシンプルに
const state = {
    user: null,
    babyId: null,
    conversationId: null
};

// メッセージ関連の関数
function createMessageElement(content, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}-message`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = content;
    
    messageDiv.appendChild(contentDiv);
    return messageDiv;
}

async function saveMessage(content, type) {
    if (!state.user || !state.babyId) {
        throw new Error('User or baby ID not set');
    }

    const messageData = {
        content,
        type,
        timestamp: serverTimestamp()
    };

    return await addDoc(
        collection(db, `users/${state.user.uid}/babyInfo/${state.babyId}/chats`),
        messageData
    );
}

// 月齢計算をより効率的に
function calculateAge(birthday) {
    if (!birthday) return 0;
    const birth = new Date(birthday);
    const today = new Date();
    const monthDiff = today.getMonth() - birth.getMonth() + 
        (12 * (today.getFullYear() - birth.getFullYear()));
    return Math.max(0, monthDiff);
}

// 会話の初期化処理を修正
async function initializeConversation() {
    if (!state.user || !state.babyId) return null;

    try {
        // Firestoreから既存の会話IDを取得
        const conversationRef = collection(db, `users/${state.user.uid}/babyInfo/${state.babyId}/conversations`);
        const conversationDoc = await getDocs(query(conversationRef, orderBy('createdAt', 'desc'), limit(1)));
        
        if (!conversationDoc.empty) {
            const existingId = conversationDoc.docs[0].data().conversationId;
            if (existingId) return existingId;
        }

        // 月齢を計算
        const birthday = sessionStorage.getItem('selectedBabyBirthday');
        const ageInMonths = calculateAge(birthday);

        // 新しい会話を作成（エンドポイントとメソッドを修正）
        const response = await fetch(`${CONFIG.DIFY_API_URL}/chat-messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CONFIG.API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: "会話を開始します",
                user: state.user.uid,
                inputs: {
                    birthday: birthday,
                    age_months: ageInMonths,
                    language: "日本語",
                    name: sessionStorage.getItem('selectedBabyName')
                }
            })
        });

        if (!response.ok) {
            throw new Error('会話の作成に失敗しました');
        }

        const data = await response.json();
        
        // 会話IDをFirestoreに保存
        await addDoc(conversationRef, {
            conversationId: data.conversation_id,
            createdAt: serverTimestamp()
        });

        return data.conversation_id;
    } catch (error) {
        console.error('会話の初期化エラー:', error);
        return null;
    }
}

// スクロール制御関数を追加
function scrollToMessage(messageElement, offset = 0) {
    const container = elements.chatMessages;
    const messageTop = messageElement.offsetTop;
    container.scrollTop = messageTop - offset;
}

// メッセージ送信処理の最適化
async function sendMessage(message) {
    if (!message.trim() || !state.user || !state.babyId) return;

    const userDiv = document.createElement('div');
    const loadingDiv = document.createElement('div');
    
    try {
        // 会話IDの確認
        if (!state.conversationId) {
            state.conversationId = await initializeConversation();
            if (!state.conversationId) throw new Error('会話の初期化に失敗しました');
        }

        // ユーザーメッセージの表示と保存を同時に実行
        const [messageElement] = await Promise.all([
            displayUserMessage(message, userDiv),
            saveMessage(message, 'user')
        ]);

        // ローディング表示
        displayLoadingMessage(loadingDiv);

        // AI応答の取得と表示
        const answer = await getAIResponse(message);
        
        // ローディング表示を削除
        loadingDiv.remove();

        // 応答の表示と保存を同時に実行
        await Promise.all([
            displayAIMessage(answer),
            saveMessage(answer, 'ai')
        ]);

        // スクロール位置の調整
        adjustScrollPosition(userDiv);

    } catch (error) {
        handleError(error, loadingDiv);
    }
}

// ユーティリティ関数
function scrollToBottom() {
    if (elements.chatMessages) {
        elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
    }
}

function showError(message) {
    if (elements.chatMessages) {
        const errorElement = createMessageElement(message, 'error');
        elements.chatMessages.appendChild(errorElement);
        scrollToBottom();
    }
    console.error(message);
}

// チャット履歴の読み込み
async function loadChatHistory() {
    if (!state.user || !state.babyId) return;

    try {
        const chatQuery = query(
            collection(db, `users/${state.user.uid}/babyInfo/${state.babyId}/chats`),
            orderBy('timestamp', 'desc'),
            limit(CONFIG.CHAT_HISTORY_LIMIT)
        );
        
        const querySnapshot = await getDocs(chatQuery);
        if (!elements.chatMessages) return;
        
        elements.chatMessages.innerHTML = '';
        const messages = [];
        querySnapshot.forEach(doc => messages.push(doc.data()));
        
        messages.reverse().forEach(msg => {
            const messageElement = createMessageElement(msg.content, msg.type);
            elements.chatMessages.appendChild(messageElement);
        });
        
        scrollToBottom();
    } catch (error) {
        showError('チャット履歴の読み込みに失敗しました');
    }
}

// イベントリスナーの設定
if (elements.messageForm && elements.messageInput) {
    elements.messageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const message = elements.messageInput.value.trim();
        if (!message) return;

        elements.messageInput.value = '';
        elements.messageInput.style.height = 'auto';
        await sendMessage(message);
    });

    elements.messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 150) + 'px';
    });
}

// 認証状態の監視と初期化
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    state.user = user;
    state.babyId = sessionStorage.getItem('selectedBabyId');
    const babyName = sessionStorage.getItem('selectedBabyName');

    if (!state.babyId || !babyName) {
        showError('赤ちゃんが選択されていません');
        setTimeout(() => window.location.href = 'baby-select.html', 2000);
        return;
    }

    if (elements.selectedBabyName) {
        elements.selectedBabyName.textContent = `${babyName} の相談`;
    }

    // 会話を初期化
    state.conversationId = await initializeConversation();
    
    await loadChatHistory();
}); 