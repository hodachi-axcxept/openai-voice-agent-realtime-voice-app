import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';

// 環境変数を読み込み
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// OpenAIクライアントの初期化
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ミドルウェア
app.use(cors());
app.use(express.json());

// ヘルスチェックエンドポイント
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// エフェメラルキー生成エンドポイント
app.post('/api/session', async (req, res) => {
  try {
    console.log('Creating ephemeral key for Realtime API...');
    
    // OpenAI Realtime APIのセッションを作成
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini-realtime-preview', // gpt-4o-miniのリアルタイム版
        voice: 'alloy', // 音声の種類
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json();
    
    // クライアントシークレットを返す
    res.json({
      apiKey: data.client_secret.value,
      sessionId: data.id,
      expiresAt: data.client_secret.expires_at,
    });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ 
      error: 'Failed to create session',
      message: error.message 
    });
  }
});

app.get('/api/agent-config', (req, res) => {
  // エージェントの設定を返す
  res.json({
    agents: [
      {
        name: 'Assistant',
        instructions: 'あなたは親切で有能な日本語アシスタントです。ユーザーの質問に対して、分かりやすく丁寧に答えてください。',
        tools: ['weather', 'calculator', 'web_search'],
      },
      {
        name: 'WeatherExpert',
        instructions: '天気に関する専門的な情報を提供します。',
        handoffDescription: '天気に関する詳細な質問',
      },
      {
        name: 'MathExpert',
        instructions: '数学や計算に関する専門的なサポートを提供します。',
        handoffDescription: '複雑な計算や数学の問題',
      },
    ],
    tools: [
      {
        name: 'get_weather',
        description: '指定された都市の天気を取得します',
        parameters: {
          type: 'object',
          properties: {
            city: {
              type: 'string',
              description: '都市名',
            },
          },
          required: ['city'],
        },
      },
      {
        name: 'calculate',
        description: '数式を計算します',
        parameters: {
          type: 'object',
          properties: {
            expression: {
              type: 'string',
              description: '計算式',
            },
          },
          required: ['expression'],
        },
      },
      {
        name: 'web_search',
        description: 'ウェブ検索を実行します',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: '検索クエリ',
            },
          },
          required: ['query'],
        },
      },
    ],
  });
});

// ツール実行エンドポイント（オプション）
app.post('/api/tools/execute', async (req, res) => {
  const { tool, parameters } = req.body;

  try {
    let result;
    
    switch (tool) {
      case 'get_weather':
        // 実際の天気APIを呼び出すか、ダミーデータを返す
        result = {
          city: parameters.city,
          weather: '晴れ',
          temperature: '22°C',
          humidity: '45%',
        };
        break;
        
      case 'calculate':
        // 安全な計算を実行
        try {
          // 簡単な評価（実際の実装では適切なパーサーを使用）
          const sanitized = parameters.expression.replace(/[^0-9+\-*/().\s]/g, '');
          result = {
            expression: parameters.expression,
            result: eval(sanitized), // 注意: 本番環境では適切なパーサーを使用
          };
        } catch (e) {
          result = {
            error: '計算エラー',
            message: e.message,
          };
        }
        break;
        
      case 'web_search':
        // 実際の検索APIを呼び出すか、ダミーデータを返す
        result = {
          query: parameters.query,
          results: [
            {
              title: 'サンプル検索結果1',
              snippet: 'これは検索結果のサンプルです。',
              url: 'https://example.com/1',
            },
            {
              title: 'サンプル検索結果2',
              snippet: 'もう一つの検索結果です。',
              url: 'https://example.com/2',
            },
          ],
        };
        break;
        
      default:
        result = { error: 'Unknown tool' };
    }
    
    res.json({ result });
  } catch (error) {
    console.error('Tool execution error:', error);
    res.status(500).json({ 
      error: 'Tool execution failed',
      message: error.message 
    });
  }
});

// エラーハンドリング
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: err.message 
  });
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log('Available endpoints:');
  console.log('  GET  /health');
  console.log('  POST /api/session');
  console.log('  GET  /api/agent-config');
  console.log('  POST /api/tools/execute');
}); 