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
- [ ] セルフチェック（チェック結果: `docs/checks/{タスクID}.md`）
- [ ] ユーザーレビュー依頼・OK取得

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

---

Ph-1: プロジェクトセットアップ
------------------

### S-1: プロジェクト初期化

**目的**: Figma プラグインとして動作する TypeScript プロジェクトの骨格を作成する。

**前提**: なし

**作業内容**:
- [ ] `package.json` 作成（name: telldes, scripts: build/dev/test）
- [ ] TypeScript 設定（`tsconfig.json`）
- [ ] esbuild 設定（plugin code → `dist/code.js`, UI → `dist/ui.html`）
- [ ] `manifest.json`（Figma プラグインマニフェスト。editorType: figma, ui: true）
- [ ] `src/code.ts`（プラグインメインエントリ。`figma.showUI()` のみ）
- [ ] `src/ui.tsx`（UI エントリ。3モード切替タブ: チェック / note / 書き出し）
- [ ] Figma でローカルプラグインとして読み込み、UI 表示を確認
- [ ] セルフチェック（チェック結果: `docs/checks/S-1.md`）
- [ ] ユーザーレビュー依頼・OK取得

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
- [ ] `src/checks/traversal.ts` — ページ内全ノードの再帰走査関数
- [ ] `src/checks/structureChecks.ts` — 以下4つのチェック実装:
  - Auto Layout 未適用フレームの検出
  - Figma デフォルト名（"Frame 1", "Rectangle 3" 等）の検出
  - 同一親内の重複レイヤー名の検出
  - 背景を子レイヤーとして配置しているケースの検出
- [ ] 各チェックに改善方法メッセージを付与（設計書 4.7.2 節の文言通り）
- [ ] テスト作成（各チェックの正常系・違反検出系）
- [ ] セルフチェック（チェック結果: `docs/checks/C-1.md`）
- [ ] ユーザーレビュー依頼・OK取得

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
- [ ] `src/checks/sizingChecks.ts` — Hug/Fill/Fixed 以外のサイジング検出
- [ ] `src/checks/variableChecks.ts` — 以下3つの提案チェック:
  - 同じ色が3箇所以上使用されている場合の提案
  - 同じ spacing/padding 値が複数箇所の提案
  - 同じ font-size 値が複数箇所の提案
- [ ] エラーと提案を区別する型定義（`CheckResult { level: 'error' | 'suggestion', ... }`）
- [ ] テスト作成
- [ ] セルフチェック（チェック結果: `docs/checks/C-2.md`）
- [ ] ユーザーレビュー依頼・OK取得

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
- [ ] チェック実行ボタンの実装
- [ ] 結果一覧表示（ノード名、違反内容、改善方法）
- [ ] エラー（赤）と提案（青/グレー）の視覚的区別
- [ ] 結果クリックで対象ノードを選択＋ビューポート移動（`figma.viewport.scrollAndZoomIntoView`）
- [ ] エラーゼロ時のパス表示
- [ ] Figma 上で動作確認
- [ ] セルフチェック（チェック結果: `docs/checks/C-3.md`）
- [ ] ユーザーレビュー依頼・OK取得

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
- [ ] `src/note/noteHandler.ts` — `getPluginData('note')` / `setPluginData('note', value)` のラッパー
- [ ] UI: ノード選択時に既存 note をテキストエリアに表示
- [ ] UI: 保存ボタンで note を保存
- [ ] `setRelaunchData({ editNote: '' })` で note 設定済みノードにプロパティパネルボタン表示
- [ ] ノード選択変更イベント（`figma.on('selectionchange', ...)`）でUI更新
- [ ] Figma 上で動作確認
- [ ] セルフチェック（チェック結果: `docs/checks/N-1.md`）
- [ ] ユーザーレビュー依頼・OK取得

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
- [ ] `src/export/specBuilder.ts` — ノードツリー → spec.json オブジェクト生成
  - 階層分類ロジック: ページ直下 = section、子を持つ = block、末端 = element
  - `path` 生成（`>` 区切りのレイヤーパス）
  - `layout` プロパティ抽出（設計書 4.6 節の Auto Layout プロパティ全件）
  - `text` プロパティ抽出（characters, fontSize, fontFamily, fontWeight, fill）
  - `fills` プロパティ抽出
  - `note` 付与（`getPluginData('note')` が空でないノード）
  - `screenshot` パス付与（section + 子を持つ block）
  - Variable 参照時の `*Token` フィールド付与
- [ ] `viewport` の width をページフレームの幅から取得
- [ ] テスト作成（ノードモックで各プロパティの抽出を検証）
- [ ] セルフチェック（チェック結果: `docs/checks/E-1.md`）
- [ ] ユーザーレビュー依頼・OK取得

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
- [ ] `src/export/tokensBuilder.ts` — `figma.variables.getLocalVariables()` からトークン JSON 生成
  - Variable のコレクション/グループ構造を JSON の階層に変換
  - `$type` の決定（color, number）
  - `$value` の解決（resolvedValue）
- [ ] Variables 未定義時は tokens.json を出力しない制御
- [ ] テスト作成
- [ ] セルフチェック（チェック結果: `docs/checks/E-2.md`）
- [ ] ユーザーレビュー依頼・OK取得

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
- [ ] `src/export/screenshotExporter.ts`
  - セクション: 必須で書き出し
  - 子を持つブロック: 自動で書き出し
  - エレメント（末端）: 書き出さない
  - ファイル名: レイヤーパスを `--` で結合（例: `pricing--plans--plan-pro.png`）
  - フォーマット: PNG, scale 2x
- [ ] `src/export/assetExporter.ts`
  - ラスター画像: PNG 2x → `assets/images/{path}.png`
  - ベクターアセット: SVG → `assets/icons/{path}.svg`
  - ファイル名: レイヤーパスを `--` で結合
- [ ] テスト作成
- [ ] セルフチェック（チェック結果: `docs/checks/E-3.md`）
- [ ] ユーザーレビュー依頼・OK取得

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
- [ ] `src/export/zipPackager.ts` — JSZip で以下の構造を生成:
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
- [ ] エラーゼロの場合のみ書き出し実行可能（チェック結果との連携）
- [ ] UI: 書き出しボタン＋ダウンロードリンク表示
- [ ] Blob 生成→ダウンロード処理
- [ ] Figma 上で動作確認（実際に zip をダウンロードし内容を検証）
- [ ] セルフチェック（チェック結果: `docs/checks/E-4.md`）
- [ ] ユーザーレビュー依頼・OK取得

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
- [ ] `src/templates/prompt.md` テンプレート作成（設計書 4.8.1 節の7構成に準拠）:
  1. 概要
  2. 入力データの読み方
  3. 最初にやること（steering.md の確認フロー）
  4. コーディング手順
  5. HTML 導出ルール（設計書 4.3.6 節）
  6. Auto Layout → CSS flexbox 対応表（設計書 4.6 節）
  7. 完了時チェック
- [ ] テンプレート内の動的部分（viewport幅等）をプレースホルダー化
- [ ] セルフチェック（チェック結果: `docs/checks/P-1.md`）
- [ ] ユーザーレビュー依頼・OK取得

**完了条件**:
- prompt.md が設計書 4.8.1 節の7構成を全て含むこと
- HTML 導出ルールが設計書 4.3.6 節の全ルールを網羅すること
- Auto Layout → CSS 対応表が設計書 4.6 節の全行を含むこと

---

### P-2: steering.md テンプレート作成

**目的**: zip 同梱用の CC ステアリング（設計書 4.8.2 節）を作成する。

**前提**: P-1 完了

**作業内容**:
- [ ] `src/templates/steering.md` テンプレート作成（設計書 4.8.2 節に準拠）:
  - 確認項目（出力形式、CSS方針、レスポンシブ、画像パス、コンポーネント粒度、フォント、デプロイ先、OGP/meta）
  - タスクリスト（コーディングステップ＋完了チェック）
  - ルール（コーディング規約）
- [ ] spec.json / note から自動記入可能な項目の特定とマーキング
- [ ] セルフチェック（チェック結果: `docs/checks/P-2.md`）
- [ ] ユーザーレビュー依頼・OK取得

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
- [ ] ユーザーレビュー依頼・OK取得

**完了条件**:
- 各フレームがフレーム名のフォルダに出力されること
- tokens.json がルートに1つだけ出力されること

---

### T-1: 統合テスト（実デザインでのエンドツーエンド確認）

**目的**: 実際の LP デザインを使い、チェック→修正→書き出し→CC コーディングのフルフローを確認する。

**前提**: Ph-5, R-1 完了

**作業内容**:
- [ ] テスト用 LP デザインを Figma で作成（最低限: header, hero, features, pricing, footer）
- [ ] チェック実行→全エラー修正→パス確認
- [ ] zip 書き出し→ zip 内容の検証:
  - spec.json が全ノードを正しく含むこと
  - screenshots/ が正しい粒度で出力されること
  - assets/ が正しい形式で出力されること
  - prompt.md, steering.md が含まれること
- [ ] CC に zip を渡してコーディングさせ、デザインカンプとの一致度を確認
- [ ] 不一致があれば原因を特定し修正
- [ ] セルフチェック（チェック結果: `docs/checks/T-1.md`）
- [ ] ユーザーレビュー依頼・OK取得

**完了条件**:
- テスト用 LP のチェックが全パスすること
- 出力 zip の全ファイルが設計書準拠であること
- CC が zip からコーディングした結果がデザインカンプと一致すること（レイアウト・色・サイズ・間隔）
- 手戻りが発生した場合は原因と対策が記録されていること

---

State
-----

* **Status**: paused
* **Date**: 2026-06-23
* **ブランチ**: `worktree-figma-plugins`
* **PR**: https://github.com/lovaizu/telldes/pull/1
* **Last completed**: T-1 進行中。Figma 実機テストで発覚した不具合の修正と、トークン源泉の方針確定（設計書反映済み）まで。
* **Next**: 4.3.4/4.7.2/4.7.4 に確定した方針をコードに実装する（下記「未実装の確定方針」）。その後 T-1 のフルフロー（Review→Export→CC）を継続。

### このセッションの作業（2026-06-23）

Figma 実機での T-1 テスト中に発覚した問題を修正し、設計方針を1つ確定した。

**修正（コミット済みになる WIP 分）:**
1. **起動時 SyntaxError 修正** — `vite.config.code.ts` の `target` を `es2020`→`es2017` に変更。Figma のプラグイン VM（jsvm-cpp）が `?.`/`??` を解釈できず `Unexpected token ?` で起動失敗していた。esbuild にトランスパイルさせて解消。
2. **manifest に `id` 追加** — `manifest.json` に `"id": "telldes-dev-local"`。`getPluginData`/`setPluginData`（note 機能）が ID 無しで例外を投げ、起動直後の `sendSelectionNote()` で落ちていた。ローカル開発用の任意文字列。公開時は発行される数値 ID に差し替え。
3. **UI タブ並び順変更** — `src/App.tsx`。Notes → Review → Export の順に変更し、初期表示タブも `note` に（最頻用が Notes のため）。

**設計方針の確定（`docs/telldes-design.md` に反映済み・コードは未実装）:**
- 基本姿勢「ツールが無視・変換するものは必ず Review か README で告知（暗黙の drop/skip 禁止）」を 4.3.4 に明記。
- トークン源泉を Figma 定石に統一: 色=Variables 一本化、数値=Variables、タイポ=Text Style を named token 化。Color Style は廃し Review で Variable 化を誘導（**ユーザー決定: Variables 一本化**）。STRING/BOOLEAN Variable は対象外＋告知。
- 書き出し範囲＝画面フレーム（ルート直下の FRAME/SECTION）と 4.7.4 に明文化。裸 Component 定義は対象外で Review 告知。
- 装飾アイコン（サークルアロー等）は Frame でなく **Group** にする例外を 4.3.2 に追記（Review の AutoLayout チェックは GROUP 対象外。**ユーザー決定: Review は現状維持**）。

### 未実装の確定方針（Next の具体作業）

設計書 4.3.4/4.7.2/4.7.4 に記載済みだが、コード未反映。doc-first 方針（[[doc-first-accuracy]]）で設計→実装の順。告知チェックは error でなく **suggestion**（Export を止めない）で実装すること。

1. **Text Style → タイポトークン** / `src/export/tokensBuilder.ts` + `src/export/specBuilder.ts` / Text Style を named typography token として出力し spec から参照
2. **告知チェック3種**（Color Style 使用 / STRING・BOOLEAN Variable 使用 / ルート直下の裸 Component 定義）/ `src/checks/`（suggestion レベル。現状 `structureChecks.ts` の `result()` は error 固定なので suggestion 用ヘルパが必要）
3. **Export README に除外物を明記** / `src/App.tsx` の README 生成
4. **tokens.json 出力条件の更新** / `tokensBuilder.ts` / typography 追加に合わせる
5. 各変更にテスト追加

---

現在の状態（2026-05-29時点）
-----

* **ブランチ**: `worktree-figma-plugins`
* **PR**: https://github.com/lovaizu/telldes/pull/1
* **次タスク**: T-1（統合テスト）— ユーザーが Figma でテスト用デザインを作成し、フルフロー確認
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
* **テスト**: 101テスト全パス
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
