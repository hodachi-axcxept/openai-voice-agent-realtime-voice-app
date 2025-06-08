# リアルタイム音声アシスタント

OpenAI Agents SDK（JavaScript/TypeScript）を使用したブラウザベースのリアルタイム音声アシスタントアプリケーションです。

## 機能

- 🎤 **リアルタイム音声認識**: ブラウザのマイクを使用した音声入力
- 🔊 **音声合成**: 自然な音声での応答
- 🤖 **マルチエージェント**: 専門的なタスクに応じたエージェント間のハンドオフ
- 🛠️ **カスタムツール**: 天気情報、計算機能など
- 🌐 **WebRTC/WebSocket**: 低遅延のリアルタイム通信

## アーキテクチャ

```
┌─────────────────────────┐     ┌─────────────────────────┐
│   フロントエンド (React) │     │  バックエンド (Node.js)  │
│                         │     │                         │
│  - RealtimeAgent       │────▶│  - エフェメラルキー生成  │
│  - RealtimeSession     │     │  - ツール実行API        │
│  - WebRTC接続          │     │  - エージェント設定     │
└─────────────────────────┘     └─────────────────────────┘
           │                                 │
           └────────────┬────────────────────┘
                        ▼
              ┌─────────────────────┐
              │  OpenAI Realtime API │
              │                     │
              │  - 音声認識 (STT)    │
              │  - 音声合成 (TTS)    │
              │  - GPT-4o処理       │
              └─────────────────────┘
```

## セットアップ

### 前提条件

- Node.js 18以上
- OpenAI APIキー
- モダンブラウザ（Chrome、Firefox、Safari、Edge）

### インストール

1. **リポジトリのクローン**
   ```bash
   git clone <repository-url>
   cd realtime-voice-app
   ```

2. **バックエンドのセットアップ**
   ```bash
   cd backend
   npm install
   ```

3. **フロントエンドのセットアップ**
   ```bash
   cd ../frontend
   npm install
   ```

4. **環境変数の設定**
   
   `backend/.env`ファイルを作成:
   ```env
   OPENAI_API_KEY=sk-your-api-key-here
   PORT=3001
   ```

## 起動方法

### 1. バックエンドサーバーの起動

```bash
cd backend
npm start
```

サーバーは`http://localhost:3001`で起動します。

### 2. フロントエンドの起動

新しいターミナルで:

```bash
cd frontend
npm run dev
```

アプリケーションは`http://localhost:3000`で起動します。

## 使い方

1. ブラウザで`http://localhost:3000`にアクセス
2. 「アシスタントに接続」ボタンをクリック
3. マイクへのアクセスを許可
4. 話しかけて音声アシスタントと対話

### 利用可能なコマンド例

- 「東京の天気を教えて」
- 「100の平方根を計算して」
- 「最新のAIニュースを検索して」
- 「天気の専門家に聞きたい」（ハンドオフの例）

## プロジェクト構造

```
realtime-voice-app/
├── backend/
│   ├── server.js          # Expressサーバー
│   ├── package.json
│   └── .env              # 環境変数
├── frontend/
│   ├── src/
│   │   ├── App.jsx       # メインコンポーネント
│   │   ├── App.css       # スタイル
│   │   ├── main.jsx      # エントリーポイント
│   │   └── index.css     # グローバルスタイル
│   ├── index.html
│   ├── vite.config.js    # Vite設定
│   └── package.json
└── README.md
```

## API エンドポイント

### バックエンド API

- `POST /api/session` - エフェメラルキーの生成
- `GET /api/agent-config` - エージェント設定の取得
- `POST /api/tools/execute` - ツールの実行
- `GET /health` - ヘルスチェック

## カスタマイズ

### 新しいツールの追加

`frontend/src/App.jsx`の`tools`配列に新しいツールを追加:

```javascript
const tools = [
  // ... 既存のツール
  {
    name: 'new_tool',
    description: '新しいツールの説明',
    parameters: {
      type: 'object',
      properties: {
        param: { type: 'string' }
      }
    },
    execute: async (params) => {
      // ツールの実装
    }
  }
];
```

### 新しいエージェントの追加

```javascript
const newAgent = new RealtimeAgent({
  name: 'NewExpert',
  instructions: '新しい専門エージェントの指示',
  tools: [/* 関連ツール */],
});

// メインエージェントのハンドオフに追加
mainAgent.handoffs = [...mainAgent.handoffs, newAgent];
```

## トラブルシューティング

### マイクが動作しない
- ブラウザの設定でマイクへのアクセスが許可されているか確認
- HTTPSまたはlocalhostでアクセスしているか確認

### 接続エラー
- OpenAI APIキーが正しく設定されているか確認
- バックエンドサーバーが起動しているか確認
- ネットワーク接続を確認

### 音声が聞こえない
- ブラウザの音量設定を確認
- スピーカー/ヘッドフォンが正しく接続されているか確認

## セキュリティ上の注意

- 本番環境では、エフェメラルキーの生成に適切な認証を実装してください
- APIキーは環境変数で管理し、フロントエンドに露出させないでください
- CORSの設定を本番環境に合わせて調整してください

## ライセンス

MIT License

## 参考資料

- [OpenAI Agents SDK Documentation](https://openai.github.io/openai-agents-js/)
- [OpenAI Realtime API](https://platform.openai.com/docs/api-reference/realtime)
- [Voice Agents Quickstart](https://openai.github.io/openai-agents-js/guides/voice-agents/quickstart/) 