# 📖 DarkVenus Portal 設定ファイル(.set) 追加・更新マニュアル

このマニュアルは、新しい設定ファイルのバックテスト検証が完了した際に、サイト（`setfiles.html`）へ新しい設定カードを追加・更新するための**完全手順書**です。

---

## 💡 サイトの基本仕様（最新順・ページ分割）
* **自動で最新順表示**: `data/setfiles.json` の**一番末尾に追記した最新データが、サイトの最上部（1番目）に自動的に表示**されます。
* **1ページ5件表示（ページネーション）**: 設定カードが6件以上になると、自動的に下部に `[1] [2] [次へ ❯]` などのページ切り替えボタンが出現します。

---

## 📁 1. 保存するファイル配置のルール

新しい検証結果を追加する際は、以下の**3つの場所**にファイルを配置・指定します。
（例として、新しく追加する設定IDを `SET-002` とします）

### ① `.set` ファイルの配置
* **保存先**: `downloads/` フォルダ
* **ファイル名例**: `downloads/SET-002.set`
* ⚠️ **重要**: `setfiles.json` に記載する `"fileUrl"` のパス（文字列）と、実際のファイル名を**1文字もズレなく完全一致**させてください！

### ② バックテスト詳細レポート（HTMデータ）の配置
* **保存先**: `report/ID名/年度/` フォルダ
* **配置ルール**: MT4から出力された `.htm` ファイルと `.gif` 画像をそのまま年度フォルダに入れます。
  ```text
  report/
  └── SET-002/
      ├── 2023/
      │   ├── StrategyTester.htm
      │   └── StrategyTester.gif
      ├── 2024/
      │   ├── StrategyTester.htm
      │   └── StrategyTester.gif
      └── 2025/
          ├── StrategyTester.htm
          └── StrategyTester.gif
  ```

#### ⚡【推奨】HTMレポート保存時の「文字化け解消」手順
MT4が出力する `.htm` ファイルは日本語文字コード（Shift-JIS）のため、そのままではブラウザで文字化けします。
レポート（StrategyTester.htm）をフォルダに配置した後は、**ツールを1回ダブルクリックするだけ**で全自動で修復・UTF-8変換されます！

1. `report/` フォルダ内に新しいレポート（StrategyTester.htm）を配置する。
2. **`tools/レポート文字化け一括変換.bat`** をダブルクリックして実行する。
   * ※未変換のファイルだけを自動検知して一瞬でUTF-8化します。（変換済みのファイルは自動でスキップされます）

* ⚠️ **パスの注意点**: Windowsでは大文字・小文字が区別されませんが、GitHub（Webサーバー）では厳格に区別されます。`StrategyTester.htm`（`.htm` なのか `.html` なのか含め）のファイル名・拡張子は `setfiles.json` の `"reportUrl"` と**完全一致**させてください。

---

## 📝 2. `data/setfiles.json` へのデータ追記手順

`data/setfiles.json` をメモ帳やコードエディタで開き、**一番最後の要素の直後にカンマ（ `,` ）を打ってから** 新しいデータブロックを追記します。

### ⚠️【超重要】カンマ（ `,` ）の打ち方ルール

JSON形式データでは、**データとデータの繋ぎ目に半角カンマ（ `,` ）を入れる**約束があります。

#### ⭕ 正しい書き方（繋ぎ目に `,` がある）

```json
[
  {
    "id": "SET-001",
    "title": "#SET-001 | EURUSD M15",
    ...
  },  👈 1つ目の末尾に「,（カンマ）」を入れて繋ぐ！
  {
    "id": "SET-002",
    "title": "#SET-002 | GBPUSD M15",
    ...
  }   👈 ※一番最後の要素の末尾には「,（カンマ）」を入れない！
]
```

---

## 📋 3. コピペ用テンプレート

新しいファイルを追加する際は、以下のコードブロックをコピーして `data/setfiles.json` の末尾（`]` の直前）に追記してください。

```json
  {
    "id": "SET-002",
    "title": "#SET-002 | GBPUSD M15",
    "platform": "MT4",
    "pair": "GBPUSD",
    "timeframe": "M15",
    "startLot": "0.01 (単利)",
    "deposit": "1,000,000円",
    "spread": "30 point (固定)",
    "fileUrl": "downloads/SET-002.set",
    "uploadedDate": "2026-08-04",
    "specs": {
      "bbStrategy": "BB Strategy 1",
      "nanpinType": "Lots Sum",
      "maxOrders": 30,
      "allowBuySell": "Buy & Sell (片建て)",
      "timeFilter": "あり",
      "hasSL": "なし (Disabled)",
      "closeMode": "Average Point Weighted",
      "exitStrategy": "Target Point (TP)"
    },
    "notes": "特記事項やカスタマイズポイントがあればここに記載します。",
    "yearlyStats": [
      {
        "year": "2023年",
        "profit": "+12,500円",
        "pf": "1.52",
        "maxDrawdown": "-14,200円",
        "unrealizedLoss": "-10,000円",
        "status": "生還",
        "survived": true,
        "reportUrl": "report/SET-002/2023/StrategyTester.htm"
      },
      {
        "year": "2024年",
        "profit": "+8,300円",
        "pf": "1.40",
        "maxDrawdown": "-7,100円",
        "unrealizedLoss": "-5,500円",
        "status": "生還",
        "survived": true,
        "reportUrl": "report/SET-002/2024/StrategyTester.htm"
      },
      {
        "year": "2025年",
        "profit": "+9,100円",
        "pf": "1.48",
        "maxDrawdown": "-8,000円",
        "unrealizedLoss": "-6,200円",
        "status": "生還",
        "survived": true,
        "reportUrl": "report/SET-002/2025/StrategyTester.htm"
      }
    ]
  }
```

---

## 🔑 項目別の記述ルール早見表

| 項目名 | 説明・入力例 | 注意点 |
| :--- | :--- | :--- |
| `id` | 連番ID（例: `SET-002`） | 重複しないユニークなID |
| `title` | タイトル表示（例: `#SET-002 \| GBPUSD M15`） | 機械的表記 |
| `platform` | プラットフォーム（`MT4` または `MT5`） | バッジに自動反映 |
| `pair` | 通貨ペア（例: `GBPUSD`） | |
| `timeframe` | 時間足（例: `M15`, `H1`） | |
| `spread` | スプレッド（例: `30 point (固定)`） | |
| `fileUrl` | ダウンロードパス（例: `downloads/SET-002.set`） | **実際のファイル名と完全一致させる** |
| `reportUrl` | HTMレポートパス（例: `report/SET-002/2023/StrategyTester.htm`） | |
| `survived` | 生還判定（`true` または `false`） | `true`で緑色文字、`false`で赤色文字 |

---

## 💻 4. 自分のパソコンで変更結果をリアルタイム確認・テストする方法

`setfiles.json` を編集した際、ブラウザのセキュリティ制限（CORS制限）により、HTMLファイルを直接ダブルクリックで開くだけでは変更が反映されない場合があります。

以下の手順で**「簡易テストサーバー」**を起動することで、パソコン上でもリアルタイムに変更結果を確認できます。

### 🚀 テストサーバーの起動手順（簡単3ステップ）

1. **PowerShell（またはコマンドプロンプト）を開く**
2. **以下のワンライナーコマンドを貼り付けて Enter を押す**
   ```powershell
   cd C:\Users\batab\.gemini\antigravity\MyProjects\darkvenus-lab ; python -m http.server 8000
   ```
3. **ブラウザで以下のURLを開く**
   * 👉 **`http://localhost:8000/setfiles.html`**

以後は、`data/setfiles.json` を編集して保存し、ブラウザで **F5キー（再読み込み）** を押すだけで一瞬で変更内容が反映されます！
※ テストが終わったら、PowerShell画面で `Ctrl` + `C` を押すとサーバーが停止します。

---

## 🚀 5. GitHubへのアップロード（本番反映）

ファイルの配置、`setfiles.json` の追記、およびローカルテストが終わったら、プロジェクト全体の変更をコミットして GitHub に push するだけで、Webサイトへ全自動で反映されます！
