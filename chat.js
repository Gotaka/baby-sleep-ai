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
    serverTimestamp,
    where
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
    if (!state.user || !state.babyId || !state.conversationId) {
        throw new Error('User, baby ID, or conversation ID not set');
    }

    const messageData = {
        content,
        type,
        conversationId: state.conversationId,
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

// 会話管理関連の関数を修正
async function getLatestConversationId() {
    try {
        const conversationRef = collection(db, `users/${state.user.uid}/babyInfo/${state.babyId}/conversations`);
        const conversationDoc = await getDocs(
            query(conversationRef, orderBy('createdAt', 'desc'), limit(1))
        );

        if (!conversationDoc.empty) {
            return conversationDoc.docs[0].data().conversationId;
        }
        return null;
    } catch (error) {
        console.error('会話ID取得エラー:', error);
        return null;
    }
}

// 会話の初期化処理を修正
async function initializeConversation() {
    if (!state.user || !state.babyId) return null;

    try {
        // 既存の会話IDを確認（URLパラメータなどから特定の会話IDが指定されている場合）
        const urlParams = new URLSearchParams(window.location.search);
        const specifiedConversationId = urlParams.get('conversationId');
        
        if (specifiedConversationId) {
            // 指定された会話IDの履歴を読み込む
            await loadChatHistory(specifiedConversationId);
            return specifiedConversationId;
        }

        // 新規会話を作成
        const newId = await createNewConversation();
        if (!newId) {
            throw new Error('会話の作成に失敗しました');
        }

        // チャット履歴をクリア（新規会話なので）
        if (elements.chatMessages) {
            elements.chatMessages.innerHTML = '';
        }

        // 新しい会話IDをFirestoreに保存
        const conversationRef = collection(db, `users/${state.user.uid}/babyInfo/${state.babyId}/conversations`);
        await addDoc(conversationRef, {
            conversationId: newId,
            createdAt: serverTimestamp()
        });

        return newId;

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

// メッセージ表示関連の関数を追加
async function displayUserMessage(message, userDiv) {
    userDiv.className = 'message user-message';
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = message;
    userDiv.appendChild(contentDiv);
    elements.chatMessages.appendChild(userDiv);
    return userDiv;
}

function displayLoadingMessage(loadingDiv) {
    loadingDiv.className = 'message ai-message';
    const loadingContent = document.createElement('div');
    loadingContent.className = 'message-content';
    loadingContent.textContent = '回答を考えています...';
    loadingDiv.appendChild(loadingContent);
    elements.chatMessages.appendChild(loadingDiv);

    // ローディング表示を確実に見せるためのスクロール
    setTimeout(() => {
        elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
        const checkScroll = setInterval(() => {
            if (elements.chatMessages.scrollTop + elements.chatMessages.clientHeight < elements.chatMessages.scrollHeight) {
                elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
            } else {
                clearInterval(checkScroll);
            }
        }, 50);
        setTimeout(() => clearInterval(checkScroll), 500);
    }, 10);
}

async function displayAIMessage(answer) {
    const aiDiv = document.createElement('div');
    aiDiv.className = 'message ai-message';
    const aiContent = document.createElement('div');
    aiContent.className = 'message-content';
    aiContent.textContent = answer;
    aiDiv.appendChild(aiContent);
    elements.chatMessages.appendChild(aiDiv);
}

// メッセージ送信処理のAI応答取得部分を修正
async function getAIResponse(message) {
    const response = await fetch(`${CONFIG.DIFY_API_URL}/chat-messages`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${CONFIG.API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            query: message,
            conversation_id: state.conversationId,
            user: state.user.uid,
            inputs: {
                birthday: sessionStorage.getItem('selectedBabyBirthday'),
                age_months: calculateAge(sessionStorage.getItem('selectedBabyBirthday')),
                language: "日本語",
                name: sessionStorage.getItem('selectedBabyName')
            }
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API Error: ${errorData.message || response.statusText}`);
    }

    const data = await response.json();
    if (!data || !data.answer) {
        throw new Error('無効な応答フォーマット');
    }

    return data.answer;
}

function adjustScrollPosition(userDiv) {
    setTimeout(() => {
        const containerHeight = elements.chatMessages.clientHeight;
        const offset = Math.max(containerHeight * CONFIG.SCROLL_OFFSET_RATIO, CONFIG.MIN_SCROLL_OFFSET);
        scrollToMessage(userDiv, offset);
    }, CONFIG.SCROLL_DELAY);
}

function handleError(error, loadingDiv) {
    console.error('エラー:', error);
    
    // ローディング表示を削除
    if (loadingDiv && loadingDiv.parentNode) {
        loadingDiv.remove();
    }

    // エラーの種類に応じて処理
    if (error.message.includes('conversation not found')) {
        state.conversationId = null;
        showError('会話を再初期化します。もう一度送信してください。');
    } else {
        showError(`メッセージの送信に失敗しました: ${error.message}`);
    }
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

// チャット履歴の読み込みを修正
async function loadChatHistory(conversationId) {
    if (!state.user || !state.babyId || !conversationId) return;

    try {
        // 指定された会話IDのメッセージのみを取得
        const chatQuery = query(
            collection(db, `users/${state.user.uid}/babyInfo/${state.babyId}/chats`),
            where('conversationId', '==', conversationId)
        );
        
        const querySnapshot = await getDocs(chatQuery);
        if (!elements.chatMessages) return;
        
        elements.chatMessages.innerHTML = '';
        
        // 取得したメッセージをタイムスタンプでソート
        const messages = [];
        querySnapshot.forEach(doc => {
            const messageData = doc.data();
            // conversationIdが一致するメッセージのみを追加
            if (messageData.conversationId === conversationId) {
                messages.push({
                    content: messageData.content,
                    type: messageData.type,
                    timestamp: messageData.timestamp
                });
            }
        });

        // タイムスタンプで昇順ソート
        messages.sort((a, b) => {
            if (!a.timestamp || !b.timestamp) return 0;
            return a.timestamp.seconds - b.timestamp.seconds;
        });

        // メッセージを表示
        messages.forEach(msg => {
            const messageElement = createMessageElement(msg.content, msg.type);
            elements.chatMessages.appendChild(messageElement);
        });
        
        scrollToBottom();
    } catch (error) {
        console.error('チャット履歴の読み込みエラー:', error);
        showError('チャット履歴の読み込みに失敗しました');
    }
}

// createNewConversation関数を修正
async function createNewConversation() {
    try {
        // 新規会話作成時は初期メッセージを送信しない
        const response = await fetch(`${CONFIG.DIFY_API_URL}/chat-messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CONFIG.API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: "会話を開始します",
                conversation_id: null,
                user: state.user.uid,
                inputs: {
                    birthday: sessionStorage.getItem('selectedBabyBirthday'),
                    age_months: calculateAge(sessionStorage.getItem('selectedBabyBirthday')),
                    language: "日本語",
                    name: sessionStorage.getItem('selectedBabyName')
                }
            })
        });

        if (!response.ok) {
            throw new Error('会話の作成に失敗しました');
        }

        const data = await response.json();
        return data.conversation_id;
    } catch (error) {
        console.error('新規会話作成エラー:', error);
        return null;
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

// 認証状態の監視と初期化を修正
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

    // 会話を初期化して状態を設定
    state.conversationId = await initializeConversation();
    if (!state.conversationId) {
        showError('会話の初期化に失敗しました');
        return;
    }
}); 