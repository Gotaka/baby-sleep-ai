import { initializeApp } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, orderBy, getDocs, limit } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js";

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
const chatMessages = document.querySelector('.chat-messages');
const messageForm = document.querySelector('.message-form');
const messageInput = messageForm.querySelector('textarea');
const selectedBabyName = document.querySelector('.selected-baby-name');

let currentUser = null;
let currentBabyId = null;
let currentConversationId = null;

// Dify APIの設定を修正
const DIFY_API_URL = 'https://api.dify.ai/v1';
const API_KEY = 'app-44DggXgrSQI9FcLCDzLeApHq';

// グローバル変数を追加
let isProcessingMessage = false;
let messageQueue = [];
let lastScrollPosition = 0;

// メッセージキャッシュの実装
const messageCache = {
    messages: new Map(),
    maxSize: 100,
    
    add(id, content) {
        if (this.messages.size >= this.maxSize) {
            const firstKey = this.messages.keys().next().value;
            this.messages.delete(firstKey);
        }
        this.messages.set(id, content);
    },
    
    get(id) {
        return this.messages.get(id);
    },
    
    clear() {
        this.messages.clear();
    }
};

// Markdownパース処理の最適化
const markdownCache = new Map();

// メッセージの一時保存機能を追加
const draftManager = {
    storageKey: 'chatDraft',
    saveTimeout: null,
    
    // 下書きを保存
    saveDraft(babyId, text) {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        
        this.saveTimeout = setTimeout(() => {
            const draft = {
                babyId,
                text,
                timestamp: new Date().getTime()
            };
            localStorage.setItem(this.storageKey, JSON.stringify(draft));
        }, 1000); // 1秒後に保存
    },
    
    // 下書きを読み込み
    loadDraft(babyId) {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (!saved) return null;
            
            const draft = JSON.parse(saved);
            // 24時間以上経過した下書きは削除
            if (new Date().getTime() - draft.timestamp > 24 * 60 * 60 * 1000) {
                this.clearDraft();
                return null;
            }
            
            // 現在の赤ちゃんの下書きのみ復元
            return draft.babyId === babyId ? draft.text : null;
        } catch (e) {
            console.error('Error loading draft:', e);
            return null;
        }
    },
    
    // 下書きを削除
    clearDraft() {
        localStorage.removeItem(this.storageKey);
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
    }
};

// API接続テストのヘッダーを修正
async function testApiConnection() {
    try {
        const testBirthday = sessionStorage.getItem('selectedBabyBirthday');
        const testName = sessionStorage.getItem('selectedBabyName');
        const today = new Date().toISOString().split('T')[0];

        const response = await fetch(`${DIFY_API_URL}/chat-messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                inputs: {
                    birthday: testBirthday,
                    language: "日本語",
                    name: testName,
                    gender: null,
                    today: today
                },
                query: "テスト",
                user: currentUser?.uid || "test-user",
                response_mode: "blocking",
                conversation_id: null
            })
        });
        
        // デバッグ用にレスポンスの詳細を出力
        console.log('API Test Response:', {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries())
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('API Test Failed:', {
                status: response.status,
                statusText: response.statusText,
                error: errorData
            });
            return false;
        }

        const data = await response.json();
        console.log('API Test Success:', data);
        return true;
    } catch (error) {
        console.error('API Connection Test Error:', error);
        return false;
    }
}

// 会話IDを取得または新規作成する関数
async function getOrCreateConversation() {
    try {
        // 現在の日付を取得（YYYY-MM-DD形式）
        const today = new Date().toISOString().split('T')[0];
        
        // 今日の会話を検索
        const conversationsRef = collection(db, `users/${currentUser.uid}/babyInfo/${currentBabyId}/conversations`);
        const q = query(
            conversationsRef,
            orderBy('createdAt', 'desc'),
            limit(1)
        );
        
        const querySnapshot = await getDocs(q);
        let conversation = null;
        
        if (!querySnapshot.empty) {
            const doc = querySnapshot.docs[0];
            const data = doc.data();
            // 同じ日の会話であれば、その会話IDを使用
            if (data.date === today) {
                conversation = {
                    id: doc.id,
                    difyConversationId: data.difyConversationId
                };
            }
        }
        
        // 会話が存在しない、または新しい日の場合、新しい会話を作成
        if (!conversation) {
            // 新しい会話用のテストメッセージを送信
            const initResponse = await fetch(`${DIFY_API_URL}/chat-messages`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    inputs: {
                        birthday: sessionStorage.getItem('selectedBabyBirthday'),
                        language: "日本語",
                        name: sessionStorage.getItem('selectedBabyName'),
                        gender: null,
                        today: today
                    },
                    query: "会話を開始します",
                    user: currentUser.uid,
                    response_mode: "blocking"
                })
            });

            if (!initResponse.ok) {
                throw new Error('Failed to initialize conversation');
            }

            const initData = await initResponse.json();
            
            // 新しい会話情報をFirestoreに保存
            const newConversationRef = await addDoc(conversationsRef, {
                difyConversationId: initData.conversation_id,
                date: today,
                createdAt: new Date(),
                lastUpdated: new Date()
            });
            
            conversation = {
                id: newConversationRef.id,
                difyConversationId: initData.conversation_id
            };
        }
        
        return conversation;
    } catch (error) {
        console.error('Error in getOrCreateConversation:', error);
        throw error;
    }
}

// 認証状態とデータの確認を更新
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    currentUser = user;

    // API接続テストを実行
    const isApiConnected = await testApiConnection();
    if (!isApiConnected) {
        showError('APIサーバーへの接続に失敗しました');
        return;
    }

    // 選択された赤ちゃんの情報を確認
    currentBabyId = sessionStorage.getItem('selectedBabyId');
    const babyName = sessionStorage.getItem('selectedBabyName');
    
    if (!currentBabyId || !babyName) {
        showError('赤ちゃんが選択されていません。赤ちゃんを選択または登録してください。');
        setTimeout(() => {
            window.location.href = 'baby-select.html';
        }, 2000);
        return;
    }

    try {
        // 会話IDを取得
        const conversation = await getOrCreateConversation();
        currentConversationId = conversation.difyConversationId;
        
        // 赤ちゃんの名前を表示
        selectedBabyName.textContent = `${babyName} の相談`;
        
        // チャット履歴を読み込む
        await loadChatHistory();
    } catch (error) {
        console.error('Initialization error:', error);
        showError('初期化に失敗しました');
    }
});

// チャット履歴の読み込みを最適化
async function loadChatHistory() {
    try {
        const q = query(
            collection(db, `users/${currentUser.uid}/babyInfo/${currentBabyId}/chats`),
            orderBy('timestamp', 'desc'),
            limit(50) // 最新50件に制限
        );
        
        const querySnapshot = await getDocs(q);
        chatMessages.innerHTML = '';
        
        const messages = [];
        querySnapshot.forEach(doc => {
            const data = doc.data();
            messages.push(data);
            messageCache.add(doc.id, data);
        });
        
        // 古い順に表示
        messages.reverse().forEach(data => {
            appendMessage(data.content, data.type, false);
        });
        
        setTimeout(() => scrollToBottom(), 100);
    } catch (error) {
        handleError(error, 'loadChatHistory');
    }
}

// スクロール処理の最適化
function scrollToBottom(smooth = false) {
    // スクロールの必要性をチェック
    const chatContainer = chatMessages;
    const currentScroll = chatContainer.scrollTop;
    const maxScroll = chatContainer.scrollHeight - chatContainer.clientHeight;
    
    // 最下部付近にいる場合のみスクロール
    if (maxScroll - currentScroll < 100 || smooth) {
        const lastMessage = chatMessages.lastElementChild;
        if (lastMessage) {
            lastMessage.scrollIntoView({ 
                behavior: smooth ? 'smooth' : 'auto',
                block: 'end'
            });
        }
    }
}

// 初期化時にタイトルを設定
document.addEventListener('DOMContentLoaded', () => {
    const babyName = sessionStorage.getItem('selectedBabyName');
    const conversationTitle = sessionStorage.getItem('conversationTitle');
    const babyId = sessionStorage.getItem('selectedBabyId');
    
    document.querySelector('.selected-baby-name').textContent = babyName;
    document.querySelector('.conversation-title').textContent = conversationTitle;

    // 保存された下書きを読み込む
    const savedDraft = draftManager.loadDraft(babyId);
    if (savedDraft) {
        messageInput.value = savedDraft;
        messageInput.style.height = 'auto';
        messageInput.style.height = Math.min(messageInput.scrollHeight, 150) + 'px';
    }
});

// メッセージ入力時の処理を更新
messageInput.addEventListener('input', function() {
    // 高さの自動調整（既存の処理）
    this.style.height = 'auto';
    const maxHeight = 150;
    this.style.height = Math.min(this.scrollHeight, maxHeight) + 'px';
    
    // 下書きを保存
    draftManager.saveDraft(currentBabyId, this.value);
});

// メッセージ送信の処理を更新
messageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = messageInput.value.trim();
    if (!message) return;

    try {
        // メッセージ送信が成功したら下書きをクリア
        draftManager.clearDraft();
        
        // ユーザーメッセージを保存
        await addDoc(collection(db, `users/${currentUser.uid}/babyInfo/${currentBabyId}/chats`), {
            content: message,
            type: 'user',
            timestamp: new Date()
        });
        
        appendMessage(message, 'user');
        messageInput.value = '';
        messageInput.style.height = 'auto';

        // AIの応答用のメッセージ要素を事前に作成
        const aiMessageDiv = document.createElement('div');
        aiMessageDiv.className = 'message ai-message';
        const aiContentDiv = document.createElement('div');
        aiContentDiv.className = 'message-content';
        aiMessageDiv.appendChild(aiContentDiv);
        chatMessages.appendChild(aiMessageDiv);
        scrollToBottom();

        // Dify APIリクエスト
        const response = await fetch(`${DIFY_API_URL}/chat-messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream'
            },
            body: JSON.stringify({
                inputs: {
                    birthday: sessionStorage.getItem('selectedBabyBirthday'),
                    language: "日本語",
                    name: sessionStorage.getItem('selectedBabyName'),
                    gender: null,
                    today: new Date().toISOString().split('T')[0]
                },
                query: message,
                user: currentUser.uid,
                response_mode: 'streaming', // streamingモードに変更
                conversation_id: currentConversationId
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('API Error:', errorData);
            throw new Error(`API request failed: ${errorData.message || 'Unknown error'}`);
        }

        // ストリーミング処理部分を修正
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';

        try {
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                // 受信したチャンクをデコード
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.trim() && line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (data.event === 'message') {
                                // デバッグ用にDifyからの応答を確認
                                console.log('Raw Dify Response:', data.answer);
                                fullResponse = data.answer || '';
                                // Markdownを適切にフォーマット
                                const formattedText = formatMessageContent(fullResponse);
                                console.log('Formatted Text:', formattedText);
                                aiContentDiv.innerHTML = formattedText;
                                scrollToBottom(true);
                            }
                        } catch (e) {
                            console.error('Error parsing streaming data:', e);
                        }
                    }
                }
                await new Promise(resolve => setTimeout(resolve, 10));
            }

            // 完了したらFirestoreに保存
            if (fullResponse) {
                await addDoc(collection(db, `users/${currentUser.uid}/babyInfo/${currentBabyId}/chats`), {
                    content: fullResponse,
                    type: 'ai',
                    timestamp: new Date()
                });
            }

        } catch (error) {
            console.error('Streaming error:', error);
        }

    } catch (error) {
        console.error('Error details:', error);
        const errorMessage = '申し訳ありません。エラーが発生しました。';
        appendMessage(errorMessage, 'ai');
        
        // エラーメッセージも保存
        await addDoc(collection(db, `users/${currentUser.uid}/babyInfo/${currentBabyId}/chats`), {
            content: errorMessage,
            type: 'ai',
            timestamp: new Date()
        });
    }
});

// メッセージ表示関数を改善
function appendMessage(content, type, shouldScroll = true) {
    // DocumentFragment使用
    const fragment = document.createDocumentFragment();
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}-message`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.innerHTML = formatMessageContent(content);
    
    messageDiv.appendChild(contentDiv);
    fragment.appendChild(messageDiv);
    chatMessages.appendChild(fragment);
    
    if (shouldScroll) {
        requestAnimationFrame(() => scrollToBottom(true));
    }
}

// メッセージコンテンツのフォーマット関数を修正
function formatMessageContent(text) {
    if (!text) return '';
    
    // キャッシュをチェック
    const cached = markdownCache.get(text);
    if (cached) return cached;
    
    // 処理結果をキャッシュ
    const formatted = parseMarkdown(text);
    markdownCache.set(text, formatted);
    
    return formatted;
}

// テキストエリアの高さ自動調整
messageInput.addEventListener('input', function() {
    this.style.height = 'auto';
    const maxHeight = 150;
    this.style.height = Math.min(this.scrollHeight, maxHeight) + 'px';
});

// エラー表示関数
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    document.querySelector('.chat-container').prepend(errorDiv);
}

// テキストを徐々に表示する関数を追加
async function displayTextGradually(element, text) {
    const currentText = element.textContent;
    const newPart = text.slice(currentText.length);
    
    for (let i = 0; i < newPart.length; i++) {
        element.textContent = currentText + newPart.slice(0, i + 1);
        scrollToBottom();
        // 文字の表示間隔を調整（ミリ秒）
        await new Promise(resolve => setTimeout(resolve, 50));
    }
}

// メッセージ処理の最適化
async function processMessage(message) {
    if (isProcessingMessage) {
        messageQueue.push(message);
        return;
    }
    
    isProcessingMessage = true;
    try {
        await sendAndProcessMessage(message);
    } finally {
        isProcessingMessage = false;
        if (messageQueue.length > 0) {
            const nextMessage = messageQueue.shift();
            processMessage(nextMessage);
        }
    }
}

// エラー処理の集中管理
class ChatError extends Error {
    constructor(message, type = 'general') {
        super(message);
        this.type = type;
    }
}

function handleError(error, context = '') {
    console.error(`Error in ${context}:`, error);
    
    let userMessage = '申し訳ありません。エラーが発生しました。';
    if (error instanceof ChatError) {
        switch (error.type) {
            case 'api':
                userMessage = 'AIサーバーとの通信に失敗しました。';
                break;
            case 'auth':
                userMessage = '認証エラーが発生しました。再度ログインしてください。';
                window.location.href = 'index.html';
                break;
            case 'network':
                userMessage = 'ネットワークエラーが発生しました。接続を確認してください。';
                break;
        }
    }
    
    showError(userMessage);
    return null;
}

// ページ離脱時の警告（未送信の下書きがある場合）
window.addEventListener('beforeunload', (e) => {
    const draft = draftManager.loadDraft(currentBabyId);
    if (draft && draft.trim()) {
        e.preventDefault();
        e.returnValue = '未送信のメッセージがあります。ページを離れてもよろしいですか？';
        return e.returnValue;
    }
}); 