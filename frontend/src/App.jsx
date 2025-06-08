import React, { useState, useEffect, useRef } from 'react';
import { RealtimeAgent, RealtimeSession } from '@openai/agents-realtime';
import './App.css';

// カスタムツールの定義
const tools = [
  {
    name: 'get_weather',
    description: '指定された都市の天気を取得します',
    parameters: {
      type: 'object',
      properties: {
        city: { type: 'string', description: '都市名' },
      },
      required: ['city'],
    },
    execute: async (params) => {
      // バックエンドのツール実行エンドポイントを呼び出す
      const response = await fetch('/api/tools/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: 'get_weather', parameters: params }),
      });
      const data = await response.json();
      return `${params.city}の天気は${data.result.weather}、気温は${data.result.temperature}です。`;
    },
  },
  {
    name: 'calculate',
    description: '数式を計算します',
    parameters: {
      type: 'object',
      properties: {
        expression: { type: 'string', description: '計算式' },
      },
      required: ['expression'],
    },
    execute: async (params) => {
      const response = await fetch('/api/tools/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: 'calculate', parameters: params }),
      });
      const data = await response.json();
      if (data.result.error) {
        return `計算エラー: ${data.result.message}`;
      }
      return `${params.expression} = ${data.result.result}`;
    },
  },
];

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);
  const sessionRef = useRef(null);
  const agentRef = useRef(null);

  // エージェントの初期化
  useEffect(() => {
    // メインエージェント
    const mainAgent = new RealtimeAgent({
      name: 'Assistant',
      instructions: `あなたは親切で有能な日本語音声アシスタントです。
        ユーザーの質問に対して、分かりやすく丁寧に答えてください。
        音声で聞きやすいように、短く区切って話してください。
        
        以下のツールが利用可能です：
        - get_weather: 天気情報を取得
        - calculate: 数式を計算
        
        必要に応じて専門エージェントにハンドオフしてください。`,
      tools: tools,
    });

    // 天気専門エージェント
    const weatherAgent = new RealtimeAgent({
      name: 'WeatherExpert',
      instructions: '天気に関する詳細な情報を提供する専門家です。',
      tools: tools.filter(t => t.name === 'get_weather'),
    });

    // 計算専門エージェント
    const mathAgent = new RealtimeAgent({
      name: 'MathExpert',
      instructions: '数学や計算に関する専門的なサポートを提供します。',
      tools: tools.filter(t => t.name === 'calculate'),
    });

    // ハンドオフの設定
    mainAgent.handoffs = [weatherAgent, mathAgent];
    
    agentRef.current = mainAgent;
  }, []);

  // セッションに接続
  const connectToSession = async () => {
    try {
      setIsConnecting(true);
      setError(null);

      // バックエンドからエフェメラルキーを取得
      const response = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to get session key');
      }

      const { apiKey } = await response.json();

      // RealtimeSessionを作成
      const session = new RealtimeSession(agentRef.current, {
        model: 'gpt-4o-realtime-preview-2025-06-03',
        voice: 'alloy',
        instructions: 'あなたは日本語を話すアシスタントです。',
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
        },
      });

      // イベントリスナーの設定
      session.on('connected', () => {
        console.log('Connected to Realtime API');
        setIsConnected(true);
        setIsConnecting(false);
        addMessage('system', 'アシスタントに接続しました。話しかけてください。');
      });

      session.on('disconnected', () => {
        console.log('Disconnected from Realtime API');
        setIsConnected(false);
        addMessage('system', 'アシスタントから切断されました。');
      });

      session.on('error', (error) => {
        console.error('Session error:', error);
        setError(error.message);
        addMessage('error', `エラー: ${error.message}`);
      });

      // 音声認識結果
      session.on('conversation.item.input_audio_transcription.completed', (event) => {
        console.log('Transcription:', event.transcript);
        setTranscript(event.transcript);
        addMessage('user', event.transcript);
      });

      // アシスタントの応答
      session.on('response.text.delta', (event) => {
        console.log('Assistant text:', event.delta);
        updateLastAssistantMessage(event.delta);
      });

      // ツール呼び出し
      session.on('response.function_call_arguments.done', async (event) => {
        console.log('Tool call:', event.name, event.arguments);
        addMessage('tool', `ツール実行: ${event.name}`);
      });

      // セッションに接続（WebRTCを使用）
      await session.connect({ apiKey });
      
      sessionRef.current = session;
    } catch (err) {
      console.error('Connection error:', err);
      setError(err.message);
      setIsConnecting(false);
      addMessage('error', `接続エラー: ${err.message}`);
    }
  };

  // セッションから切断
  const disconnectSession = async () => {
    if (sessionRef.current) {
      await sessionRef.current.disconnect();
      sessionRef.current = null;
      setIsConnected(false);
      addMessage('system', 'アシスタントから切断しました。');
    }
  };

  // メッセージを追加
  const addMessage = (type, content) => {
    setMessages(prev => [...prev, { 
      id: Date.now(), 
      type, 
      content,
      timestamp: new Date().toLocaleTimeString('ja-JP')
    }]);
  };

  // 最後のアシスタントメッセージを更新
  const updateLastAssistantMessage = (delta) => {
    setMessages(prev => {
      const newMessages = [...prev];
      const lastMessage = newMessages[newMessages.length - 1];
      
      if (lastMessage && lastMessage.type === 'assistant') {
        lastMessage.content += delta;
      } else {
        newMessages.push({
          id: Date.now(),
          type: 'assistant',
          content: delta,
          timestamp: new Date().toLocaleTimeString('ja-JP')
        });
      }
      
      return newMessages;
    });
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>🎤 リアルタイム音声アシスタント</h1>
        <p>OpenAI Agents SDK + Realtime API</p>
      </header>

      <main className="app-main">
        <div className="connection-panel">
          {!isConnected ? (
            <button 
              className="connect-button"
              onClick={connectToSession}
              disabled={isConnecting}
            >
              {isConnecting ? '接続中...' : 'アシスタントに接続'}
            </button>
          ) : (
            <button 
              className="disconnect-button"
              onClick={disconnectSession}
            >
              切断
            </button>
          )}
          
          {isConnected && (
            <div className="status">
              <span className="status-indicator connected"></span>
              接続中
            </div>
          )}
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {transcript && (
          <div className="transcript">
            <h3>音声認識結果:</h3>
            <p>{transcript}</p>
          </div>
        )}

        <div className="messages-container">
          <h2>会話履歴</h2>
          <div className="messages">
            {messages.map(msg => (
              <div key={msg.id} className={`message ${msg.type}`}>
                <span className="message-type">
                  {msg.type === 'user' ? '👤 ユーザー' : 
                   msg.type === 'assistant' ? '🤖 アシスタント' :
                   msg.type === 'tool' ? '🔧 ツール' :
                   msg.type === 'system' ? '💻 システム' : '⚠️ エラー'}
                </span>
                <span className="message-time">{msg.timestamp}</span>
                <div className="message-content">{msg.content}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="features">
          <h3>利用可能な機能:</h3>
          <ul>
            <li>🌤️ 天気情報の取得（例：「東京の天気を教えて」）</li>
            <li>🧮 数式の計算（例：「100の平方根を計算して」）</li>
            <li>🤝 専門エージェントへのハンドオフ</li>
            <li>🎯 リアルタイム音声認識と応答</li>
          </ul>
        </div>
      </main>

      <footer className="app-footer">
        <p>Powered by OpenAI Realtime API & Agents SDK</p>
      </footer>
    </div>
  );
}

export default App; 