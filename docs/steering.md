Rn version: 0.8.0

Telldes Figma Plugin 実装フェーズ
======================

ブランチ: `main`

背景・品質要求
-------

Telldes は「Figma でデザイン → CC でコーディング」ワークフローの精度を最大化するための Figma プラグインである。デザイナーが制作ルールに従ってデザインするだけで、CC がデザインカンプと完全一致するコーディングを行える状態を目指す。

**プラグインの出力（spec.json, tokens.json, screenshots, prompt.md）が不正確であれば、CC のコーディング精度が直接損なわれる。出力の正確性が最優先。**

具体的には以下を意味する。

* spec.json は Figma ノードのプロパティを忠実に反映すること。推測や省略は許容しない
* チェック機能は設計書 4.7.2 節の全ルールを網羅し、偽陰性（見逃し）ゼロを目指す
* スクリーンショットとアセットの書き出しは、正しいノードが正しい形式・命名で出力されること
* zip 内の全ファイルが設計書 4.5 節のフォーマットに完全準拠すること

---

目的
--

設計書（`docs/telldes-design.md`）で定義した仕様を動くプラグインとして実装する。目的は2つ。

1. Figma 上で制作ルール違反を検出し、デザイナーにフィードバックする
2. CC が正確にコーディングできるデザインスペック一式を zip で出力する

「動く」だけでは不十分。「設計書の全仕様に対して実装が1対1で対応しており、カバー漏れゼロである」ことを目指す。

---

作業ルール（全作業共通）
------------

* **設計書が正**: 実装判断に迷ったら `docs/telldes-design.md` を参照する。設計書に記載のない動作を勝手に追加しない
* **全体整合確認**: ファイルを変更する際はパッチあてに留まらず、ファイル全体を見て不要・矛盾・重複がないか確認してから変更する
* **コミット単位**: ファイルを変更したら目的単位でコミット＆プッシュする
* **プッシュ必須**: ファイルを変更したらコミット後に必ずプッシュする
* **環境変更は事前確認必須**: ライブラリ追加・ツールインストール等、環境に対する変更が必要になった場合はユーザーに確認を取ってから実施する。勝手にインストール・追加しない

---

タスク定義ルール
--------

新しいタスクを定義・追加する際は以下のフォーマットと要件を守ること。

### タスクフォーマット

```
### {タスクID}: {タスク名}

**目的**: このタスクで何を達成するか、1〜2文で明記する。

**前提**: このタスクを開始するために完了していなければならない前提タスクを列挙する。前提なしの場合は「なし」と記載する。

**作業内容**:
- [ ] 具体的な作業ステップ1
- [ ] 具体的な作業ステップ2
- [ ] ...
- [ ] セルフチェック（完了条件ごとに OK/NG。チェック結果: `docs/checks/{タスクID}.md`）
- [ ] QA エキスパートレビュー（subagent）
- [ ] Craft エキスパートレビュー（subagent、タスクの媒体に応じて）
- [ ] Verification エキスパートレビュー（subagent、タスクの媒体に応じて）
- [ ] （構造・方針を作る／変えるタスクのみ）Design エキスパートレビュー（subagent）

**完了条件**:
- 完了を客観的に判定できる基準を1件ずつ箇条書きで記載する
- 「〜されていること」「〜が確認できること」など判定可能な表現で書く
- あいまいな表現（「適切に」「正しく」等）は使わない
```

### タスク定義の要件

* **目的を1文で言える粒度にする**: 作業が膨らみそうなら複数タスクに分割する
* **作業ステップは具体的にする**: 「実装する」ではなく「`ClassName` に `methodName()` を実装する」のように書く
* **完了条件は客観的にする**: 第三者が判定できる基準のみ記載する
* **前提タスクを明記する**: 依存関係が不明だと並行着手の可否が判断できない

---

タスク完了プロセス（全タスク共通）
-----------------

各タスクの作業内容の最後に以下のステップを実施する。

1. **セルフチェック**: 完了条件を1件ずつ確認し、判定（OK/NG）と根拠を記録する
2. **ユーザーレビュー**: セルフチェックがパスした後にユーザーへ確認依頼する。OKが出るまで改善を繰り返す

チェック結果は `docs/checks/{タスクID}.md` に出力する。

### チェックファイルフォーマット

```
# {タスクID} 完了条件チェック

## 完了条件チェックリスト

| 完了条件 | 判定 | 根拠 |
|---|---|---|
| （完了条件の文章） | OK / NG | （確認した内容・証跡） |

## 総合判定

- セルフチェック: OK / NG
- ユーザーレビュー可否: 可 / 不可（理由）
```

---

技術スタック
------

| 項目 | 選定 | 根拠 |
|---|---|---|
| パッケージマネージャ / ランタイム | Bun | install 高速、lock ファイル軽量、スクリプトランナーとしても使用 |
| 言語 | TypeScript | Figma Plugin API の型定義が充実。Bun がネイティブ実行 |
| バンドラー / dev server | Vite | Solid の JSX 変換に vite-plugin-solid が必要。Figma プラグイン向け Vite 利用の実績多数 |
| UI フレームワーク | Solid v2 (beta) | signals ベースのリアクティビティ。fine-grained updates でリスト描画が効率的。~7KB gzip |
| 単一ファイル化 | vite-plugin-singlefile | Figma プラグイン UI は単一 HTML 必須。Vite 出力をインライン化 |
| zip 生成 | JSZip | 設計書 4.7.4 節で指定。ブラウザ環境で動く zip ライブラリとして実績あり |
| テスト | Vitest | Vite config 共有で Solid JSX がそのまま動く。Solid v2 のテストに最適 |
| 型定義 | @figma/plugin-typings | Figma 公式。Plugin API の全型が手に入る |

### 依存パッケージ

```json
{
  "devDependencies": {
    "@figma/plugin-typings": "^1.x",
    "solid-js": "next",
    "@solidjs/web": "next",
    "vite": "^6.x",
    "vite-plugin-solid": "next",
    "vite-plugin-singlefile": "^2.x",
    "vitest": "^3.x"
  },
  "dependencies": {
    "jszip": "^3.x"
  }
}
```

### Bun の役割

* パッケージマネージャ（`bun install`, `bun add`）
* スクリプトランナー（`bun run dev`, `bun run build`, `bun run test`）
* ビルド・バンドルは Vite に委譲（Solid の JSX 変換が必要なため）

### Solid v2 Beta 利用に関する注意

* `solid-js`, `@solidjs/web`, `vite-plugin-solid` は全て `next` タグで揃えること
* 破壊的変更のリスクあり。`bun.lock` でバージョン固定し、安定版リリース時にアップデート
* Figma プラグイン UI は iframe 内の標準ブラウザ環境。Solid が動作しない技術的制約はない

---

フェーズ概要
------

| フェーズ | 目的 | 前提 | 完了条件 |
|---|---|---|---|
| Ph-1 | プロジェクトセットアップ＋プラグイン骨格 | なし | Figma にプラグインとして読み込め、UI が表示されること |
| Ph-2 | チェック機能の実装 | Ph-1 完了 | 設計書 4.7.2 節の全チェックルールが動作すること |
| Ph-3 | note 入力 UI の実装 | Ph-1 完了 | ノードへの note 読み書きが動作すること |
| Ph-4 | 書き出し機能の実装 | Ph-2, Ph-3 完了 | 設計書 4.5 節のフォーマットで zip が出力されること |
| Ph-5 | CC プロンプト＋ステアリングテンプレート | Ph-4 完了 | prompt.md, steering.md が zip に同梱され、CC が正しく動作すること |
| Ph-6 | レスポンシブ対応＋統合テスト | Ph-5 完了 | desktop/mobile 2フレーム構成で正しく出力されること |
| Ph-7 | doc-first ギャップ解消（タイポトークン・告知チェック等） | R-1 完了 | 設計書 4.3.4/4.7.2/4.7.4 確定方針が実装・テストに反映されていること |

---

Ph-1: プロジェクトセットアップ
------------------

### S-1: プロジェクト初期化

**目的**: Figma プラグインとして動作する TypeScript プロジェクトの骨格を作成する。

**前提**: なし

**作業内容**:
- [x] `package.json` 作成（name: telldes, scripts: build/dev/test）
- [x] TypeScript 設定（`tsconfig.json`）
- [x] esbuild 設定（plugin code → `dist/code.js`, UI → `dist/ui.html`）
- [x] `manifest.json`（Figma プラグインマニフェスト。editorType: figma, ui: true）
- [x] `src/code.ts`（プラグインメインエントリ。`figma.showUI()` のみ）
- [x] `src/ui.tsx`（UI エントリ。3モード切替タブ: チェック / note / 書き出し）
- [x] Figma でローカルプラグインとして読み込み、UI 表示を確認
- [x] セルフチェック（チェック結果: `docs/checks/S-1.md`）
- [x] ユーザーレビュー依頼・OK取得

**完了条件**:
- `npm run build` でエラーなくビルドが完了すること
- `dist/code.js` と `dist/ui.html` が生成されること
- Figma にプラグインとして読み込め、UIパネルが表示されること
- UIに3つのタブ（チェック / note / 書き出し）が表示されること

---

Ph-2: チェック機能
-----------

### C-1: ノード走査＋構造チェック実装

**目的**: ページ内の全ノードを再帰走査し、構造チェック（設計書 4.7.2 節のエラー4件）を検出する。

**前提**: S-1 完了

**作業内容**:
- [x] `src/checks/traversal.ts` — ページ内全ノードの再帰走査関数
- [x] `src/checks/structureChecks.ts` — 以下4つのチェック実装:
  - Auto Layout 未適用フレームの検出
  - Figma デフォルト名（"Frame 1", "Rectangle 3" 等）の検出
  - 同一親内の重複レイヤー名の検出
  - 背景を子レイヤーとして配置しているケースの検出
- [x] 各チェックに改善方法メッセージを付与（設計書 4.7.2 節の文言通り）
- [x] テスト作成（各チェックの正常系・違反検出系）
- [x] セルフチェック（チェック結果: `docs/checks/C-1.md`）
- [x] ユーザーレビュー依頼・OK取得

**完了条件**:
- 4つの構造チェックそれぞれについて、違反があるノードが正しく検出されること
- 違反がないノードが誤検出されないこと
- 各違反に設計書 4.7.2 節記載の改善方法メッセージが付与されていること
- テストが全グリーンであること

---

### C-2: サイジングチェック＋Variables提案チェック実装

**目的**: サイジングチェック（エラー）と Variables 提案チェック（提案）を実装する。

**前提**: C-1 完了

**作業内容**:
- [x] `src/checks/sizingChecks.ts` — Hug/Fill/Fixed 以外のサイジング検出
- [x] `src/checks/variableChecks.ts` — 以下3つの提案チェック:
  - 同じ色が3箇所以上使用されている場合の提案
  - 同じ spacing/padding 値が複数箇所の提案
  - 同じ font-size 値が複数箇所の提案
- [x] エラーと提案を区別する型定義（`CheckResult { level: 'error' | 'suggestion', ... }`）
- [x] テスト作成
- [x] セルフチェック（チェック結果: `docs/checks/C-2.md`）
- [x] ユーザーレビュー依頼・OK取得

**完了条件**:
- サイジングチェックが Hug/Fill/Fixed 以外を正しく検出すること
- Variables 提案が閾値（色: 3箇所以上、spacing/font-size: 複数箇所）で正しく発火すること
- エラーと提案が型レベルで区別されていること
- テストが全グリーンであること

---

### C-3: チェック結果 UI 表示

**目的**: チェック結果をプラグイン UI に一覧表示し、エラー/提案を視覚的に区別する。

**前提**: C-1, C-2 完了

**作業内容**:
- [x] チェック実行ボタンの実装
- [x] 結果一覧表示（ノード名、違反内容、改善方法）
- [x] エラー（赤）と提案（青/グレー）の視覚的区別
- [x] 結果クリックで対象ノードを選択＋ビューポート移動（`figma.viewport.scrollAndZoomIntoView`）
- [x] エラーゼロ時のパス表示
- [x] Figma 上で動作確認
- [x] セルフチェック（チェック結果: `docs/checks/C-3.md`）
- [x] ユーザーレビュー依頼・OK取得

**完了条件**:
- チェック実行後に結果一覧が表示されること
- エラーと提案が視覚的に区別されていること
- 結果クリックで対象ノードが選択され画面が移動すること
- エラーゼロ時に「パス」表示がされること

---

Ph-3: note 入力 UI
----------------

### N-1: note 読み書き機能

**目的**: 選択中ノードに対して note を読み書きする UI を実装する（設計書 4.7.3 節）。

**前提**: S-1 完了

**作業内容**:
- [x] `src/note/noteHandler.ts` — `getPluginData('note')` / `setPluginData('note', value)` のラッパー
- [x] UI: ノード選択時に既存 note をテキストエリアに表示
- [x] UI: 保存ボタンで note を保存
- [x] `setRelaunchData({ editNote: '' })` で note 設定済みノードにプロパティパネルボタン表示
- [x] ノード選択変更イベント（`figma.on('selectionchange', ...)`）でUI更新
- [x] Figma 上で動作確認
- [x] セルフチェック（チェック結果: `docs/checks/N-1.md`）
- [x] ユーザーレビュー依頼・OK取得

**完了条件**:
- ノード選択時に既存 note が表示されること
- テキスト入力→保存で `pluginData` に保存されること
- 保存後にノードのプロパティパネルに relaunch ボタンが表示されること
- 別ノード選択時に UI が切り替わること（前ノードの note が残らないこと）

---

Ph-4: 書き出し機能
-----------

### E-1: spec.json 生成

**目的**: ページのノードツリーを設計書 4.5.2 節のフォーマットで JSON 化する。

**前提**: S-1 完了

**作業内容**:
- [x] `src/export/specBuilder.ts` — ノードツリー → spec.json オブジェクト生成
  - 階層分類ロジック: ページ直下 = section、子を持つ = block、末端 = element
  - `path` 生成（`>` 区切りのレイヤーパス）
  - `layout` プロパティ抽出（設計書 4.6 節の Auto Layout プロパティ全件）
  - `text` プロパティ抽出（characters, fontSize, fontFamily, fontWeight, fill）
  - `fills` プロパティ抽出
  - `note` 付与（`getPluginData('note')` が空でないノード）
  - `screenshot` パス付与（section + 子を持つ block）
  - Variable 参照時の `*Token` フィールド付与
- [x] `viewport` の width をページフレームの幅から取得
- [x] テスト作成（ノードモックで各プロパティの抽出を検証）
- [x] セルフチェック（チェック結果: `docs/checks/E-1.md`）
- [x] ユーザーレビュー依頼・OK取得

**完了条件**:
- 出力 JSON が設計書 4.5.2 節のスキーマに準拠すること
- type フィールドが階層に応じて section/block/element に正しく設定されること
- path が `>` 区切りで正しく生成されること
- Variable が適用されているプロパティに `*Token` フィールドが付与されること
- note が設定されたノードにのみ `note` フィールドが存在すること
- テストが全グリーンであること

---

### E-2: tokens.json 生成

**目的**: Figma Variables を W3C Design Tokens Community Group 仕様に準拠した JSON として出力する。

**前提**: S-1 完了

**作業内容**:
- [x] `src/export/tokensBuilder.ts` — `figma.variables.getLocalVariables()` からトークン JSON 生成
  - Variable のコレクション/グループ構造を JSON の階層に変換
  - `$type` の決定（color, number）
  - `$value` の解決（resolvedValue）
- [x] Variables 未定義時は tokens.json を出力しない制御
- [x] テスト作成
- [x] セルフチェック（チェック結果: `docs/checks/E-2.md`）
- [x] ユーザーレビュー依頼・OK取得

**完了条件**:
- 出力 JSON が設計書 4.5.1 節のフォーマットに準拠すること
- Variable のグループ構造が JSON の階層として正しく表現されていること
- Variables 未定義のファイルでは tokens.json が生成されないこと
- テストが全グリーンであること

---

### E-3: スクリーンショット＋アセット書き出し

**目的**: セクション＋子を持つブロックのスクリーンショットと、画像アセットを正しい形式・命名で書き出す。

**前提**: E-1 完了

**作業内容**:
- [x] `src/export/screenshotExporter.ts`
  - セクション: 必須で書き出し
  - 子を持つブロック: 自動で書き出し
  - エレメント（末端）: 書き出さない
  - ファイル名: レイヤーパスを `--` で結合（例: `pricing--plans--plan-pro.png`）
  - フォーマット: PNG, scale 2x
- [x] `src/export/assetExporter.ts`
  - ラスター画像: PNG 2x → `assets/images/{path}.png`
  - ベクターアセット: SVG → `assets/icons/{path}.svg`
  - ファイル名: レイヤーパスを `--` で結合
- [x] テスト作成
- [x] セルフチェック（チェック結果: `docs/checks/E-3.md`）
- [x] ユーザーレビュー依頼・OK取得

**完了条件**:
- セクションのスクリーンショットが必ず書き出されること
- 子を持つブロックのスクリーンショットが書き出されること
- 末端エレメントのスクリーンショットが書き出されないこと
- ファイル名がレイヤーパスの `--` 結合で正しく生成されること
- ラスター画像は PNG 2x、ベクターは SVG で出力されること

---

### E-4: zip パッケージング

**目的**: 全出力物を JSZip でまとめて zip ダウンロードする。

**前提**: E-1, E-2, E-3 完了

**作業内容**:
- [x] `src/export/zipPackager.ts` — JSZip で以下の構造を生成:
  ```
  telldes-export/
  ├── prompt.md
  ├── steering.md
  ├── tokens.json（Variables定義時のみ）
  ├── spec.json
  ├── screenshots/
  ├── assets/images/
  ├── assets/icons/
  └── README.md
  ```
- [x] エラーゼロの場合のみ書き出し実行可能（チェック結果との連携）
- [x] UI: 書き出しボタン＋ダウンロードリンク表示
- [x] Blob 生成→ダウンロード処理
- [x] Figma 上で動作確認（実際に zip をダウンロードし内容を検証）
- [x] セルフチェック（チェック結果: `docs/checks/E-4.md`）
- [x] ユーザーレビュー依頼・OK取得

**完了条件**:
- チェックエラーがある状態では書き出しボタンが無効化されること
- エラーゼロ時に zip がダウンロードできること
- zip 内のディレクトリ構造が設計書 4.5 節に準拠すること
- tokens.json が Variables 定義時のみ含まれること

---

Ph-5: CC プロンプト＋ステアリングテンプレート
----------------------------

### P-1: prompt.md テンプレート作成

**目的**: zip 同梱用の CC プロンプト（設計書 4.8.1 節）を作成する。

**前提**: E-4 完了

**作業内容**:
- [x] `src/templates/prompt.md` テンプレート作成（設計書 4.8.1 節の7構成に準拠）:
  1. 概要
  2. 入力データの読み方
  3. 最初にやること（steering.md の確認フロー）
  4. コーディング手順
  5. HTML 導出ルール（設計書 4.3.6 節）
  6. Auto Layout → CSS flexbox 対応表（設計書 4.6 節）
  7. 完了時チェック
- [x] テンプレート内の動的部分（viewport幅等）をプレースホルダー化
- [x] セルフチェック（チェック結果: `docs/checks/P-1.md`）
- [x] ユーザーレビュー依頼・OK取得

**完了条件**:
- prompt.md が設計書 4.8.1 節の7構成を全て含むこと
- HTML 導出ルールが設計書 4.3.6 節の全ルールを網羅すること
- Auto Layout → CSS 対応表が設計書 4.6 節の全行を含むこと

---

### P-2: steering.md テンプレート作成

**目的**: zip 同梱用の CC ステアリング（設計書 4.8.2 節）を作成する。

**前提**: P-1 完了

**作業内容**:
- [x] `src/templates/steering.md` テンプレート作成（設計書 4.8.2 節に準拠）:
  - 確認項目（出力形式、CSS方針、レスポンシブ、画像パス、コンポーネント粒度、フォント、デプロイ先、OGP/meta）
  - タスクリスト（コーディングステップ＋完了チェック）
  - ルール（コーディング規約）
- [x] spec.json / note から自動記入可能な項目の特定とマーキング
- [x] セルフチェック（チェック結果: `docs/checks/P-2.md`）
- [x] ユーザーレビュー依頼・OK取得

**完了条件**:
- steering.md が確認項目・タスクリスト・ルールの3セクションを含むこと
- 設計書 4.8.2 節に列挙された確認項目が全て含まれること
- CC が spec.json から自動記入できる項目が明示されていること

---

Ph-6: レスポンシブ対応＋統合テスト
--------------------

### R-1: 全フレーム個別出力

**目的**: トップレベルフレームごとにフォルダ分けして出力する。LP（1フレーム）でも HP（複数フレーム）でも同じ構造。

**前提**: E-4 完了

**作業内容**:
- [x] トップレベルフレームごとに spec.json + screenshots/ + assets/ をフレーム名フォルダに出力
- [x] tokens.json はルート（共通）に配置
- [x] セルフチェック（チェック結果: `docs/checks/R-1.md`）
- [x] ユーザーレビュー依頼・OK取得

**完了条件**:
- 各フレームがフレーム名のフォルダに出力されること
- tokens.json がルートに1つだけ出力されること

---

### T-1: 統合テスト（実デザインでのエンドツーエンド確認）

**目的**: 実際の LP デザインを使い、チェック→修正→書き出し→CC コーディングのフルフローを確認する。

**前提**: Ph-5, R-1, Ph-7, Ph-8 完了

**作業内容**:
- [x] テスト用 LP デザインを Figma で作成（最低限: header, hero, features, pricing, footer）
- [ ] チェック実行→全エラー修正→パス確認
- [ ] zip 書き出し→ zip 内容の検証:
  - spec.json が全ノードを正しく含むこと
  - screenshots/ が正しい粒度で出力されること
  - assets/ が正しい形式で出力されること
  - prompt.md, steering.md が含まれること
- [ ] CC に zip を渡してコーディングさせ、デザインカンプとの一致度を確認
- [ ] 不一致があれば原因を特定し修正
- [ ] セルフチェック（完了条件ごとに OK/NG。チェック結果: `docs/checks/T-1.md`）
- [ ] QA エキスパートレビュー（subagent）
- [ ] Craft エキスパートレビュー（subagent、コーディング媒体）
- [ ] Verification エキスパートレビュー（subagent、コーディング媒体）

**完了条件**:
- テスト用 LP に対する Review がエラー0件で終了している状態であること
- 出力 zip の全ファイル（spec.json / tokens.json / screenshots / assets / prompt.md / steering.md / README.md）が設計書 4.5 節のフォーマットに準拠している状態であること
- CC が zip のみからコーディングした結果が、デザインカンプとレイアウト・色・サイズ・間隔の各観点で一致している状態であること
- 新たな問題が持ち込まれていないこと — 具体的には、(a) 既存テストが全グリーンのままであること、(b) 修正によって既存の出力フィールド・チェックの挙動が退行していないこと、(c) 書き出し時にノード単位のエクスポートエラーが発生していないこと
- 手戻りが発生した場合、その原因と対策が `docs/checks/T-1.md` に記録されている状態であること

**進行メモ**:
- T-1 は Figma 実機が必須のため自律実行不可。ユーザーが Figma で Review 実行 → エラー内容を貼る → 仕様どおりの検出かチェック側のバグ／誤検知かを判定、という往復で進める。エラーが 0 件になったら Export し、zip を渡してもらって 4.5 節と照合、その後 CC コーディング再現テストへ。
- 判定実績: 子レイヤー `bg` に対する「背景を子レイヤーとして配置」エラーは設計書 4.3.5 どおりの正しい検出（誤検知ではない）。`structureChecks.ts` の背景チェックはレイヤー名のみで判定するため、背景以外の用途で `bg`/`overlay` 等を名付けた場合は誤検知になり得る点は未検証。

---

Ph-7: doc-first ギャップ解消
------------------

設計書 4.3.4/4.7.2/4.7.4 に方針は確定済みだが、コード未反映の5項目。doc-first 方針（[[doc-first-accuracy]]）に従い設計書側のギャップ（G-1）を先に埋めてから実装する。告知チェック（G-3）は error でなく **suggestion**（Export を止めない）で実装する。

### G-1: tokens.json typography トークンスキーマの設計書追記

**目的**: 設計書 4.5.1 に typography トークンの JSON スキーマ例を追記し、4.5.2.1 text 節に spec 側の参照フィールド名を追記する（doc-first ギャップ解消）。

**前提**: R-1 完了

**作業内容**:
- [x] 4.5.1 に W3C DTCG composite 形式（`$type: "typography"`, `$value: { fontFamily, fontSize, fontWeight, lineHeight, letterSpacing }`）の JSON 例を追記。推奨命名（`display / heading-lg / heading-md / heading-sm / body / lead / caption / label`）にも触れる
- [x] 4.5.2.1 の「text（タイポグラフィのメトリクス）」節に `typographyToken` フィールドを追記。付与条件（`textStyleId` が単一 ID の場合のみ。`figma.mixed` は除外）を明記
- [x] セルフチェック（チェック結果: `docs/checks/G-1.md`）
- [x] ユーザーレビュー依頼・OK取得

**完了条件**:
- 4.5.1 に typography トークンの `$type`/`$value` 構造例が記載されていること
- 4.5.2.1 に `typographyToken` フィールドの付与条件が明記されていること

---

### G-2: Text Style → typography トークン実装

**目的**: `tokensBuilder.ts` で Text Style を named typography token として `tokens.json` に出力し、`specBuilder.ts` の text 抽出で `typographyToken` を参照させる。

**前提**: G-1 完了

**作業内容**:
- [x] `tokensBuilder.ts`: `figma.getLocalTextStylesAsync()`（または同等API）から typography トークンを生成し、G-1 で追記したスキーマで出力。既存の `setNested`（`$base` 衝突退避）を再利用
- [x] `specBuilder.ts`: text ノードの `textStyleId` が単一 ID の場合に `typographyToken` を付与（`figma.mixed` は除外）
- [x] テスト作成
- [x] セルフチェック（チェック結果: `docs/checks/G-2.md`）
- [x] ユーザーレビュー依頼・OK取得

**完了条件**:
- `tokens.json` に typography トークンが G-1 のスキーマ準拠で出力されること
- Text Style 適用ノードの `spec.json` text に `typographyToken` が付与されること
- `textStyleId` が mixed のノードには付与されないこと
- テストが全グリーンであること

---

### G-3: 告知チェック4種（suggestion）実装

**目的**: Color Style 使用／STRING・BOOLEAN Variable 使用／ルート直下の裸 Component 定義／Variable-Text Style token 名衝突を suggestion レベルで検出する（設計書 4.7.2 節「源泉・範囲チェック」）。

**前提**: G-1, G-2 完了（衝突チェックが G-2 で centralize される `typography/` プレフィックス定数に依存するため、G-2 完了を前提とする）

**作業内容**:
- [x] `docs/telldes-design.md` 4.7.2 節に Variable/Text Style token 名衝突の告知チェック（suggestion）を追記（G-2 レビューで発見: Variable のフルパスが `typography/<name>` と一致し同名の Text Style が存在する場合、tokens.json 側は last-write-wins のまま・書き出しはブロックせず、デザイナーに事前警告する方針）
- [x] `structureChecks.ts`（または `variableChecks.ts`）に suggestion レベルの `result()` ヘルパーを追加（現状 `result()` は error 固定）
- [x] Color Style 使用チェック実装
- [x] STRING/BOOLEAN Variable 使用チェック実装
- [x] ルート直下の裸 Component/Component Set 定義チェック実装
- [x] Variable/Text Style token 名衝突チェック実装（`src/util/typography.ts` の共有プレフィックス定数を使用し、Variable フルパスと Text Style 名が同一 `typography/<name>` に解決するケースを検出）
- [x] テスト作成
- [x] セルフチェック（チェック結果: `docs/checks/G-3.md`）
- [x] ユーザーレビュー依頼・OK取得

**完了条件**:
- 4チェックとも suggestion レベルで検出され、書き出しをブロックしないこと
- 各チェックの改善方法メッセージが設計書 4.7.2 節の文言と一致すること
- Variable/Text Style 衝突チェックが、Variable フルパスと Text Style 名が同一 `typography/<name>` に解決するケースを正しく検出すること
- テストが全グリーンであること

---

### G-4: Export README 除外物明記

**目的**: 書き出し zip の `README.md` に書き出し対象外のもの（`App.tsx` 等の非デザインノード由来ファイル、G-3 で告知対象となる裸 Component 等）を明記する。

**前提**: G-1 完了

**作業内容**:
- [x] `src/App.tsx` の README 生成箇所に除外物セクションを追加
- [x] テスト作成（該当箇所があれば）
- [x] セルフチェック（チェック結果: `docs/checks/G-4.md`）
- [x] ユーザーレビュー依頼・OK取得

**完了条件**:
- `README.md` に除外物が明記されること

---

### G-5: tokens.json 出力条件の更新

**目的**: typography トークン追加に合わせ、`tokens.json` の出力条件（Variables 未定義時は出力しない）を Text Style の有無も含めた判定に更新する。

**前提**: G-2 完了

**作業内容**:
- [x] `tokensBuilder.ts` の出力条件を「Variables または Text Style のいずれかが存在する場合に出力」に変更
- [x] テスト更新
- [x] セルフチェック（チェック結果: `docs/checks/G-5.md`）
- [x] ユーザーレビュー依頼・OK取得

**完了条件**:
- Variables 未定義でも Text Style 定義済みなら `tokens.json` が出力されること
- どちらも未定義なら `tokens.json` が出力されないこと
- テストが全グリーンであること

---

Ph-8: 実使用フィードバック対応
------------------

ユーザーが Telldes を実際に Figma で使用した結果のフィードバック（2026-09-12）。2点。

1. **Review の suggestion がノイズ**: Export をブロックしない助言が Review パネルに並び、本来の「error 0 にして Export する」という導線を埋もれさせている
2. **Notes でどこに何を書いたか分からない**: Notes タブは選択中の単一ノードの note しか表示しないため、既に note が入っているレイヤーを一覧できない

方針（ユーザー確認済み 2026-09-12）: Variables 提案5種は削除する。源泉・範囲の告知4種は Review からは外すが、これは助言ではなく「ツールが黙って落としている事実の通知」であり出力の正確性に直結するため、Export の README「除外物」セクションに実検出データとして移設して情報を保持する。

### U-1: Variables 提案チェックの削除と源泉・範囲告知の README 移設

**目的**: Review を error のみの構成にし、Variables 提案5種を削除したうえで、源泉・範囲の告知4種を Export の README「除外物」セクションに実検出データとして出力する。

**前提**: G-3, G-4, G-5 完了

**作業内容**:
- [x] `docs/telldes-design.md` を更新: 4.7.2 節の「Variablesチェック（提案）」節を削除し、「源泉・範囲チェック（提案／告知）」を Review の一部ではなく Export README への出力として位置づけ直す。4.3.4 の「チェック時に繰り返し使われている値を検出し『Variableにしませんか？』と提案する」「Reviewの提案（4.7.2）はこの語彙で命名を促す」、4.7.4 の「Reviewで告知する」、4.7.2 末尾の「エラーは書き出し前に解消必須。提案・告知は無視してもよい」も整合させる
- [x] `src/checks/variableChecks.ts` と `src/checks/__tests__/variableChecks.test.ts` を削除し、`src/code.ts` の `runVariableChecks` 呼び出しと import を削除
- [x] `src/checks/types.ts` の `CheckLevel` を `"error"` のみに変更する（改善方法テキストである `CheckResult.suggestion` フィールドは削除しない）
- [x] `src/checks/scopeChecks.ts` の `runScopeChecks` / `checkTypographyTokenCollisions` を、`CheckResult[]` ではなく除外物レポート（項目種別・レイヤーパス／トークン名・件数）を返す形に変更する
- [x] `src/code.ts`: 除外物レポートを Review 実行時ではなく Export 時に生成し、`export-data` メッセージに含めて UI へ渡す
- [x] `src/App.tsx`: Review タブの Suggestions セクションと `suggestions()` シグナル・関連 CSS（`.suggestion-label` / `.suggestion-item`）を削除する。`.result-suggestion`（error の改善方法表示）は残す
- [x] `src/App.tsx`: README 生成の「Not included in this export」セクションを、除外物レポートの実検出データで埋める（検出ゼロの項目は行を出さない）
- [x] テスト更新（`scopeChecks.test.ts` を新シグネチャに追従、README 生成のテストがあれば更新）
- [x] セルフチェック（完了条件ごとに OK/NG。チェック結果: `docs/checks/U-1.md`）
- [x] QA エキスパートレビュー（subagent）
- [x] Craft エキスパートレビュー（subagent、コーディング媒体）
- [x] Verification エキスパートレビュー（subagent、コーディング媒体）
- [x] Design エキスパートレビュー（subagent）

**進行メモ（2026-09-13 時点）**:
- 作業ステップは全完了。実装は3コミット＋修正3ラウンド（計7コミット、`3cf5307`…`20282da`）。テスト 151 → 217、両ビルド green
- 最終レビュー: QA / Craft / Verification **PASS**、Design のみ **FAIL**。完了条件7項目は4名全員 OK。修正ラウンドは rn の上限3回を使い切っている
- **未解決の指摘**（いずれも小さく局所的。U-1 の完了条件は満たしている）:
  1. 出力精度: README の Contents 行 `for frame "X"` にフォルダ名を入れているため、`Desktop / Home` が `for frame "Desktop - Home"` になる。Figma に該当名のフレームは存在しない。`ExportFrame` に生名を併せて載せれば解消
  2. 堅牢性: フォルダ名と README パスの一致が「同一関数」ではなく、`code.ts` がページ順・生名でフレームを積むという明文化されていない慣習＋テストで担保されている（設計書 4.7.2 は「同一の関数で生成」と記載）。`ExportFrame` に `folderName` を載せ `zipBuilder` 側の `resolveFrameFolderNames` 呼び出しを廃すれば構造的に保証される
  3. 契約: `src/messages.ts` の `CheckErrorMessage` がどこからも参照されていない（`code.ts` は型注釈なしのリテラルを post している）
  4. UI: `check-error` 受信時に `results()` / `hasRun()` を消さないため、失敗バナーの下に前回の結果が残る。また `<Show>` 二重ゲートが「結果あり・エラー0件」で空パネルを描く（現状到達不能のデッドパス）
  5. テスト: 0フレーム書き出し、`typography/a/b` の多段サブパス衝突、DOCUMENT 終端のレイヤーパスが未カバー
  6. スタイル: 新規モジュールのコメント密度が既存の3〜8倍（40〜55% 対 5〜13%）。過去の不具合の経緯を語る段落が複数あり、コミットメッセージと設計書に寄せるべき
- **ユーザー判断待ち**: もう1ラウンド回して上記を潰すか、U-1 をここで確定して U-2 / T-1 へ進み残りを U-3 とまとめるか

**完了条件**:
- `CheckLevel` 型が `"error"` のみであり、`level: "suggestion"` を生成するコードがリポジトリに存在しないこと
- `src/checks/variableChecks.ts` とそのテストファイルが存在しないこと
- Review タブの描画結果に Suggestions セクションが含まれないこと
- 設計書 4.7.2 節に「Variablesチェック（提案）」節が存在せず、源泉・範囲の4項目が Export README への出力として記載されていること
- 書き出した `README.md` の「Not included in this export」セクションに、Color Style 使用／STRING・BOOLEAN Variable 使用／ルート直下の裸 Component・Component Set／Variable-Text Style トークン名衝突のうち、実際に検出された項目のみが対象レイヤーパス（衝突はトークン名）付きで列挙されていること
- 検出ゼロの項目については `README.md` に該当行が出力されないこと
- 新たな問題が持ち込まれていないこと — 具体的には、(a) 残る既存テストが全グリーンであること、(b) error レベルのチェック（構造4種・サイジング1種）の検出挙動と改善方法メッセージが変わっていないこと、(c) Export のブロック条件（error 1件以上で中止）が変わっていないこと

---

### U-2: Notes 一覧表示

**目的**: ページ内で note が設定済みの全レイヤーを Notes タブに一覧表示し、レイヤーを1つずつ選択しなくても「どこに何を書いたか」を把握できるようにする。

**前提**: N-1 完了

**作業内容**:
- [ ] `docs/telldes-design.md` 4.7.3 節に note 一覧の仕様を追記する（一覧に出す情報＝レイヤーパス＋note 本文、クリックで該当ノードを選択、更新タイミング）
- [ ] `src/code.ts`: ページ内の全ノードを走査して `getPluginData("note")` が非空のノードを集め、`{ nodeId, layerPath, note }` の配列を `notes-list` メッセージで UI に送る関数を追加する。レイヤーパスは `src/export/layerPath.ts` の `buildLayerPath` を再利用する
- [ ] `src/code.ts`: プラグイン起動時・note 保存時（削除＝空文字保存を含む）に `notes-list` を再送する
- [ ] `src/App.tsx`: Notes タブに一覧セクションを追加する。各項目はレイヤーパスと note 本文を表示し、クリックで既存の `select-node` メッセージを送る。0件時は空状態メッセージを出す
- [ ] `src/App.tsx`: 選択中ノードのエディタは一覧の上に残し、ノード未選択時も一覧は表示されるようにする
- [ ] テスト作成（note 収集ロジックの単体テスト）
- [ ] セルフチェック（完了条件ごとに OK/NG。チェック結果: `docs/checks/U-2.md`）
- [ ] QA エキスパートレビュー（subagent）
- [ ] Craft エキスパートレビュー（subagent、コーディング媒体）
- [ ] Verification エキスパートレビュー（subagent、コーディング媒体）
- [ ] Design エキスパートレビュー（subagent）

**完了条件**:
- ノードを1つも選択していない状態で Notes タブを開いたとき、note 設定済みレイヤーの一覧が表示されること
- 一覧の各項目に、ルートからのレイヤーパスと note 本文の両方が表示されること
- 一覧項目をクリックすると該当ノードが選択され、ビューポートがそのノードへスクロールすること
- note を保存したあと一覧が再描画され、追加・変更・削除（空文字保存）が反映されること
- note が1件も設定されていないページでは、空状態メッセージが表示されること
- 新たな問題が持ち込まれていないこと — 具体的には、(a) 既存テストが全グリーンであること、(b) 選択中ノードの note 編集・保存の挙動が変わっていないこと

---

### U-3: 書き出し除外物の検出漏れ解消

**目的**: README の「除外物」セクションが書き出し対象外を網羅すると謳っている以上、現在検出できていない除外物を検出対象に加える。

**前提**: U-1 完了

**作業内容**:
- [ ] `docs/telldes-design.md` 4.7.2 に追加する検出カテゴリを追記する
- [ ] ページ直下に裸で置かれた `GROUP` / `INSTANCE` / `TEXT` / `RECTANGLE` 等（`FRAME`・`SECTION` 以外）が無記録で書き出しから落ちている件を検出・記録する
- [ ] `strokeStyleId` に束縛された Color Style を検出する（現状 `fillStyleId` のみ）
- [ ] インスタンスの component properties 経由（`instance.componentProperties[k].boundVariables.value`）で束縛された STRING Variable を検出する
- [ ] 同名 Variable が別コレクションに存在し `tokens.json` で相互に上書きされる件を検出する
- [ ] テスト作成
- [ ] セルフチェック（完了条件ごとに OK/NG。チェック結果: `docs/checks/U-3.md`）
- [ ] QA エキスパートレビュー（subagent）
- [ ] Craft エキスパートレビュー（subagent、コーディング媒体）
- [ ] Verification エキスパートレビュー（subagent、コーディング媒体）
- [ ] Design エキスパートレビュー（subagent）

**完了条件**:
- ページ直下の `FRAME`・`SECTION` 以外のノードが書き出しから落ちる場合、`README.md` の除外物セクションに該当レイヤーが記録されること
- `strokeStyleId` に Color Style を束縛したレイヤーが Color Style 使用として記録されること
- component properties 経由で束縛された STRING Variable が記録されること
- 別コレクションの同名 Variable が `tokens.json` で衝突する場合に記録されること
- 検出ゼロの項目については `README.md` に該当行が出力されないこと
- 新たな問題が持ち込まれていないこと — 具体的には、(a) 既存テストが全グリーンであること、(b) U-1 で確立した走査範囲・グルーピング規約が変わっていないこと

---

State
-----

* **Status**: not suspended
* **Date**: 2026-09-13
* **Last completed**: #N description
* **Next**: #N description
* **Notes**: ブランチ `worktree-figma-plugins` / PR https://github.com/lovaizu/telldes/pull/1。U-1 は作業ステップ全完了だが未解決指摘6件（U-1「進行メモ」参照）の扱いがユーザー判断待ちで未チェック。T-1 は Ph-8 完了後、かつ Figma 実機が要るため自律実行不可。ユーザー指示（永続メモリ `feedback-skip-per-task-review-gate`）: タスクごとのレビュー承認で止まらず、最後に PR でまとめてレビュー。

---

現在の状態（2026-09-12時点）
-----

* **ブランチ**: `worktree-figma-plugins`
* **PR**: https://github.com/lovaizu/telldes/pull/1
* **次タスク**: U-1（Ph-8: 実使用フィードバック対応）— suggestion 廃止と告知の README 移設。T-1 は Ph-8 完了後に再開
* **完了済み**:
  - S-1: プロジェクト初期化 ✅
  - C-1: ノード走査＋構造チェック（4チェック） ✅
  - C-2: サイジングチェック＋Variables提案チェック ✅
  - C-3: チェック結果 UI 表示 ✅
  - N-1: note 読み書き機能 ✅
  - E-1: spec.json 生成 ✅
  - E-2: tokens.json 生成 ✅
  - E-3: スクリーンショット＋アセット書き出し ✅
  - E-4: zip パッケージング ✅
  - P-1: prompt.md テンプレート ✅
  - P-2: steering.md テンプレート ✅
  - R-1: 全フレーム個別出力（LP/HP 両対応） ✅
  - 設計書 vs 実装の整合性監査＋9件修正 ✅
  - マルチエージェント・エキスパートレビュー 6ラウンド（収束まで反復）＋確定指摘の準拠修正 ✅（2026-05-29）
  - G-1: tokens.json typography トークンスキーマの設計書追記 ✅
  - G-2: Text Style → typography トークン実装 ✅
  - G-3: 告知チェック4種（suggestion）実装 ✅
  - G-4: Export README 除外物明記 ✅
  - G-5: tokens.json 出力条件の更新 ✅
* **テスト**: 217テスト全パス
* **UI ラベル**: Review / Notes / Export（英語、デザイナー向け）
* **出力構造**: フレーム名ごとにフォルダ分け（LP 1フレームでも HP 複数フレームでも同じ構造）
* **設計書との整合**: 確認済み（2026-05-29）

### エキスパートレビュー（6ラウンド、収束まで反復）の成果（2026-05-29）

各ラウンドで6観点を並列レビュー→敵対的検証→確定指摘のみ設計書準拠で修正。本質的指摘数の推移: **33 → 18 → 7 → 3 → 1 → 0**（ラウンド6で本質的FBゼロ＝収束）。

* **チェック偽陰性/誤検知の解消**: 背景チェック名前駆動化（`bg-image`/`overlay`）、手動配置 COMPONENT/COMPONENT_SET 検出、`Vector`/`Image` 検出、INHERIT 誤検知除去、インスタンス内部ノードの除外、色のノード単位重複排除、fill の per-index 束縛・padding 各辺の per-field 束縛を尊重、mixed fontSize の解決
* **出力精度（spec.json/tokens.json）**: Variable エイリアス解決（循環ガード）、STRING/BOOLEAN 除外、`$base`（leaf/group 名衝突保持）、#RRGGBBAA、IMAGE/GRADIENT fills・gradientTransform・per-stop alpha・opacity・fillOpacity、min/max サイジング・FIXED の widthPx/heightPx・非コンテナ AL 子のサイジング、per-corner cornerRadius、cornerRadiusToken（topLeftRadius 束縛）、ページ background、parseFontWeight（ExtraBold→800）、mixed fontName 解決
* **エクスポート/整合**: フレーム名フォルダの重複解消＋サニタイズ、同名兄弟の `-N` 一意化（spec パス↔ファイル名一致）、背景画像を getImageByHash でソース書き出し（拡張子判定）、Uint8Array 転送、ノード単位エクスポートエラー報告、prompt.md をフレームフォルダ構造に整合
* **設計書改訂**: 4.5.2.1 節新設＋4.5.1/4.3.3 拡張（出力フィールドの権威記述を実装に先行して更新）
* **品質**: `src/util/color.ts`・`src/export/layerPath.ts` で共有化、`as any` 除去・デッドコード削除、manifest `relaunchButtons.editNote`
* **保留なし**: 確定分はすべて反映済み（[[doc-first-accuracy]] 方針で設計書改訂が必要な項目も実装）

### 再開手順

1. `git status` でクリーン状態を確認
2. `bun run build` でビルド確認
3. `bun run test` でテスト確認
4. T-1 に着手: ユーザーが Figma でテスト用 LP デザインを作成済みか確認
   - 未作成なら作成を依頼（header, hero, features, pricing, footer 程度）
   - 全フレームに Auto Layout 適用、レイヤー名は意味のある名前
5. テスト用デザインで Review → 全パス → Export → zip 内容検証
6. zip を CC に渡してコーディングテスト
