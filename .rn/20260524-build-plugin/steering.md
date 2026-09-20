Rn version: 0.8.0
Design: docs/design.md

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

設計書（`docs/design.md`）で定義した仕様を動くプラグインとして実装する。目的は2つ。

1. Figma 上で制作ルール違反を検出し、デザイナーにフィードバックする
2. CC が正確にコーディングできるデザインスペック一式を zip で出力する

「動く」だけでは不十分。「設計書の全仕様に対して実装が1対1で対応しており、カバー漏れゼロである」ことを目指す。

---

作業ルール（全作業共通）
------------

* **設計書が正**: 実装判断に迷ったら `docs/design.md` を参照する。設計書に記載のない動作を勝手に追加しない
* **README は「何を」、設計書は「なぜ」**: 利用者が従う手順・使い方は `README.md` が正、設計判断・意図・決定事項と CC への出力契約は `docs/design.md` が正。同じ事実を両方に書かない。食い違ったら不具合として扱う
* **進め方は「設計書を最新化 → 実装 → 試行」**: この順で回す。未決は設計書の最新化の中で潰し、決着してから実装に入る。実装が終わったら Figma 実機で試す
* **設計を決めるのはユーザー**: 未決を潰すとき、設計書の方針を変えるときは、案と根拠と推奨を出してユーザーに決めてもらう。私が決めて進めない。**未決を1件ずつ出す**（まとめて出さない）。根拠: 2026-09-20、Ph-8 と Ph-9 の優先順位を「未決」と書いたまま放置したため、`/rn:up` が機械的に上から拾って U-2 の設計書更新を確認なしで進めた。未決を残したまま次へ行くと、決めるべきことが決められないまま実装が積み上がる
* **ステアリングは常時最新**: レビュー結果・申し送り・保留した判断は、出たその場でステアリングに反映する。未決・要検証も「決める」「検証する」というタスクとして定義し、フェーズの説明文に散文で溜めない（タスク化されていない残作業は誰の作業キューにも乗らず放置される）
* **レビューの配置**: 4軸レビューをタスクごとに回さない。**設計レビューは実装前**（設計書を最新化する段で、その文面を対象に）、**QA / Craft / Verification はフェーズ完成時に1回**（PR 前）。試行中は セルフチェック＋テスト＋実機で回す。根拠: 変更が続いている的に4軸を当てても結果がすぐ陳腐化し、かつ実機でしか出ない不具合（レビュアーは全員 Node で走るため `TextEncoder` 不在のような差は原理的に捕まらない）は4軸では見つからない
* **全体整合確認**: ファイルを変更する際はパッチあてに留まらず、ファイル全体を見て不要・矛盾・重複がないか確認してから変更する
* **コミット単位**: ファイルを変更したら目的単位でコミット＆プッシュする
* **プッシュ必須**: ファイルを変更したらコミット後に必ずプッシュする
* **環境変更は事前確認必須**: ライブラリ追加・ツールインストール等、環境に対する変更が必要になった場合はユーザーに確認を取ってから実施する。勝手にインストール・追加しない
* **テストは Given / When / Then を明示する**: 各 `it` の中を `// given` / `// when` / `// then` の3ブロックに分け、空行で区切る。読んだ人が「何を用意し、何をして、何を確かめたか」を見出しだけで追える状態にする。`it` の名前は挙動を述べる文にする（既存どおり）。1行で済む単純なケースでも `// when` と `// then` は省かない。既存テストは U-7 で揃える。リポジトリを問わない共通ルールとしては rn（ccpm）の Issue https://github.com/lovaizu/ccpm/issues/27 に起票済み — rn の execute 手順がテストの形を指定しておらず、verify 手順だけが GWT を見ている、という手順の穴。そちらが入ったら本項は不要になる

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
- [ ] セルフチェック（完了条件ごとに OK/NG。チェック結果: `.rn/20260524-build-plugin/checks/{タスクID}.md`）
- [ ] Figma 実機で試す（実機でしか出ない不具合はここでしか見つからない）

**完了条件**:
- 完了を客観的に判定できる基準を1件ずつ箇条書きで記載する
- 「〜されていること」「〜が確認できること」など判定可能な表現で書く
- あいまいな表現（「適切に」「正しく」等）は使わない
```

**4軸レビューはタスクの作業内容に入れない。** 設計レビューは設計書を最新化するタスクの中で（実装前に）、QA / Craft / Verification はフェーズ完成時に1回まとめて回す。作業ルールの「レビューの配置」を参照。

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

チェック結果は `.rn/20260524-build-plugin/checks/{タスクID}.md` に出力する。

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

### Solid v2 利用に関する注意

* **既に v2 を使っている**。`bun.lock` で固定されているのは `solid-js` 2.0.0-beta.14 / `@solidjs/web` 2.0.0-beta.14 / `vite-plugin-solid` 3.0.0-next.5（2026-09-20 確認）
* npm の状況（同日確認）: `solid-js` は `latest` 1.9.15、`next` **2.0.0-rc.9**。`@solidjs/web` は `latest` 2.0.0-rc.0、`next` 2.0.0-rc.9。`vite-plugin-solid` は `latest` 2.11.14、`next` 3.0.0-next.27。**2.0 の安定版はまだ出ていない**。beta.14 → rc.9 は破壊的変更を含みうる
* 3パッケージは `next` タグで揃えること。更新は U-8 で行う（環境変更なのでユーザー確認のうえ）
* `bunx tsc --noEmit` の 97 件中 87 件が `App.tsx` の JSX 型解決（TS7026「JSX.IntrinsicElements が無い」、TS2875「solid-js/jsx-runtime が見つからない」）。ランタイムは動いているので型定義／`tsconfig` の `jsxImportSource` 側の問題。RC で変わる可能性があるため、U-5 の `tsc` ゲート化は U-8 の後に判断する
* **ビルドは Vite が公式の組み合わせ**（2026-09-20 確認）。Solid の quick start は `create-solid`（`npm init solid` / `bun create solid` …）で、生成されるテンプレートは Vite + `vite-plugin-solid`。Bun は**パッケージ管理と実行**（`bun install` / `bun run`）として使う位置づけで、Bun のバンドラで Solid を組む公式の道は無い — Solid の JSX は独自コンパイラ（`babel-preset-solid` → 2.0 では `@solidjs/compiler` を Babel から呼ぶ）を通す必要があり、`vite-plugin-solid` 3.x がそれを包んでいる。Bun / esbuild / Rolldown 単体にはこのコンパイラを差し込む口が無い。したがって現構成（Bun で管理、Vite でビルド）が公式の最新動向どおり
* 2.0.0-rc.9 の主な破壊的変更（GitHub Releases より）: `<Dynamic>` → `dynamic()` 関数、委譲イベントのキーが `$$<type>` → `_$$<type>`、内部 API が `solid-js/internal` 配下へ、`merge()` / `omit()` が lazy view を返す。本プロジェクトの `App.tsx` は `createSignal` / `For` / `Show` と `@solidjs/web` の `render` しか使っていないので影響は小さいはずだが、U-8 で実測する
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
| Ph-8 | 実使用フィードバック対応 | G-3, G-4, G-5 完了 | Review が error のみで構成され、note 設定済みレイヤーを一覧できること |
| Ph-9 | ダークモード対応とチェック体系の再設計 | 未決事項の決着 | Figma Free でダーク表示を確認でき、テーマ整合の破れが Review で検出されること |

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
- [x] セルフチェック（チェック結果: `.rn/20260524-build-plugin/checks/S-1.md`）
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
- [x] セルフチェック（チェック結果: `.rn/20260524-build-plugin/checks/C-1.md`）
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
- [x] セルフチェック（チェック結果: `.rn/20260524-build-plugin/checks/C-2.md`）
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
- [x] セルフチェック（チェック結果: `.rn/20260524-build-plugin/checks/C-3.md`）
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
- [x] セルフチェック（チェック結果: `.rn/20260524-build-plugin/checks/N-1.md`）
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
- [x] セルフチェック（チェック結果: `.rn/20260524-build-plugin/checks/E-1.md`）
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
- [x] セルフチェック（チェック結果: `.rn/20260524-build-plugin/checks/E-2.md`）
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
- [x] セルフチェック（チェック結果: `.rn/20260524-build-plugin/checks/E-3.md`）
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
- [x] セルフチェック（チェック結果: `.rn/20260524-build-plugin/checks/E-4.md`）
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
- [x] セルフチェック（チェック結果: `.rn/20260524-build-plugin/checks/P-1.md`）
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
- [x] セルフチェック（チェック結果: `.rn/20260524-build-plugin/checks/P-2.md`）
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
- [x] セルフチェック（チェック結果: `.rn/20260524-build-plugin/checks/R-1.md`）
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
- [ ] セルフチェック（完了条件ごとに OK/NG。チェック結果: `.rn/20260524-build-plugin/checks/T-1.md`）

**完了条件**:
- テスト用 LP に対する Review がエラー0件で終了している状態であること
- 出力 zip の全ファイル（spec.json / tokens.json / screenshots / assets / prompt.md / steering.md / README.md）が設計書 4.5 節のフォーマットに準拠している状態であること
- CC が zip のみからコーディングした結果が、デザインカンプとレイアウト・色・サイズ・間隔の各観点で一致している状態であること
- 新たな問題が持ち込まれていないこと — 具体的には、(a) 既存テストが全グリーンのままであること、(b) 修正によって既存の出力フィールド・チェックの挙動が退行していないこと、(c) 書き出し時にノード単位のエクスポートエラーが発生していないこと
- 手戻りが発生した場合、その原因と対策が `.rn/20260524-build-plugin/checks/T-1.md` に記録されている状態であること

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
- [x] セルフチェック（チェック結果: `.rn/20260524-build-plugin/checks/G-1.md`）
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
- [x] セルフチェック（チェック結果: `.rn/20260524-build-plugin/checks/G-2.md`）
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
- [x] `docs/design.md` 4.7.2 節に Variable/Text Style token 名衝突の告知チェック（suggestion）を追記（G-2 レビューで発見: Variable のフルパスが `typography/<name>` と一致し同名の Text Style が存在する場合、tokens.json 側は last-write-wins のまま・書き出しはブロックせず、デザイナーに事前警告する方針）
- [x] `structureChecks.ts`（または `variableChecks.ts`）に suggestion レベルの `result()` ヘルパーを追加（現状 `result()` は error 固定）
- [x] Color Style 使用チェック実装
- [x] STRING/BOOLEAN Variable 使用チェック実装
- [x] ルート直下の裸 Component/Component Set 定義チェック実装
- [x] Variable/Text Style token 名衝突チェック実装（`src/util/typography.ts` の共有プレフィックス定数を使用し、Variable フルパスと Text Style 名が同一 `typography/<name>` に解決するケースを検出）
- [x] テスト作成
- [x] セルフチェック（チェック結果: `.rn/20260524-build-plugin/checks/G-3.md`）
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
- [x] セルフチェック（チェック結果: `.rn/20260524-build-plugin/checks/G-4.md`）
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
- [x] セルフチェック（チェック結果: `.rn/20260524-build-plugin/checks/G-5.md`）
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
- [x] `docs/design.md` を更新: 4.7.2 節の「Variablesチェック（提案）」節を削除し、「源泉・範囲チェック（提案／告知）」を Review の一部ではなく Export README への出力として位置づけ直す。4.3.4 の「チェック時に繰り返し使われている値を検出し『Variableにしませんか？』と提案する」「Reviewの提案（4.7.2）はこの語彙で命名を促す」、4.7.4 の「Reviewで告知する」、4.7.2 末尾の「エラーは書き出し前に解消必須。提案・告知は無視してもよい」も整合させる
- [x] `src/checks/variableChecks.ts` と `src/checks/__tests__/variableChecks.test.ts` を削除し、`src/code.ts` の `runVariableChecks` 呼び出しと import を削除
- [x] `src/checks/types.ts` の `CheckLevel` を `"error"` のみに変更する（改善方法テキストである `CheckResult.suggestion` フィールドは削除しない）
- [x] `src/checks/scopeChecks.ts` の `runScopeChecks` / `checkTypographyTokenCollisions` を、`CheckResult[]` ではなく除外物レポート（項目種別・レイヤーパス／トークン名・件数）を返す形に変更する
- [x] `src/code.ts`: 除外物レポートを Review 実行時ではなく Export 時に生成し、`export-data` メッセージに含めて UI へ渡す
- [x] `src/App.tsx`: Review タブの Suggestions セクションと `suggestions()` シグナル・関連 CSS（`.suggestion-label` / `.suggestion-item`）を削除する。`.result-suggestion`（error の改善方法表示）は残す
- [x] `src/App.tsx`: README 生成の「Not included in this export」セクションを、除外物レポートの実検出データで埋める（検出ゼロの項目は行を出さない）
- [x] テスト更新（`scopeChecks.test.ts` を新シグネチャに追従、README 生成のテストがあれば更新）
- [x] セルフチェック（完了条件ごとに OK/NG。チェック結果: `.rn/20260524-build-plugin/checks/U-1.md`）
- [x] QA エキスパートレビュー（subagent）
- [x] Craft エキスパートレビュー（subagent、コーディング媒体）
- [x] Verification エキスパートレビュー（subagent、コーディング媒体）
- [x] Design エキスパートレビュー（subagent）

**進行メモ（2026-09-16 決着）**:
- 作業ステップ全完了。実装は3コミット＋修正3ラウンド（計7コミット、`3cf5307`…`20282da`）。テスト 151 → 217、両ビルド green
- 最終レビュー: 完了条件7項目を QA / Craft / Verification / Design の4名全員が OK と判定。Design のみ総合 FAIL だったが、その根拠となる指摘は完了条件の外にある
- 修正ラウンドは上限3回を使い切ったため、未解決の指摘6件は U-4 として独立タスク化した（rn の「上限超過分は記録して持ち越す」手順）。U-1 はここで確定

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
- [x] `docs/design.md` 4.7.3 節に note 一覧の仕様を追記する（一覧に出す情報＝レイヤーパス＋note 本文、クリックで該当ノードを選択、更新タイミング）
- [ ] `src/code.ts`: ページ内の全ノードを走査して `getPluginData("note")` が非空のノードを集め、`{ nodeId, layerPath, note }` の配列を `notes-list` メッセージで UI に送る関数を追加する。レイヤーパスは `src/export/layerPath.ts` の `buildLayerPath` を再利用する
- [ ] `src/code.ts`: プラグイン起動時・note 保存時（削除＝空文字保存を含む）に `notes-list` を再送する
- [ ] `src/App.tsx`: Notes タブに一覧セクションを追加する。各項目はレイヤーパスと note 本文を表示し、クリックで既存の `select-node` メッセージを送る。0件時は空状態メッセージを出す
- [ ] `src/App.tsx`: 選択中ノードのエディタは一覧の上に残し、ノード未選択時も一覧は表示されるようにする
- [ ] テスト作成（note 収集ロジックの単体テスト）
- [x] 実装ラウンド1（`56bef79`）— 上記6項目を実装。4軸レビューで **4軸とも fail**。以下が未解決（詳細と根拠: `.rn/20260524-build-plugin/checks/U-2.md` の「4軸レビューの triage」）

**残りは「設計書を最新化 → 実装 → 試行」の順で片付ける。** まず N-6〜N-8（設計書）、次に N-1〜N-5・N-10〜N-12（実装）、最後に N-9（実機）。
- [ ] N-1: `figma.on("currentpagechange", sendNotesList)` を購読する。ページを切り替えると一覧が前ページのまま残り、その行をクリックすると `figma.currentPage.selection = [node]` が throw するが `select-node` は async ハンドラ内で try が無く**未処理 rejection＝UI に何も届かない**。削除済みレイヤーなら `getNodeById` が null で素通り＝無反応。`select-node` を try/catch で囲み、対象が現在のページに無い／削除済みの場合の扱いを 4.7.3 に定める（4軸一致・完了条件3が破れる）
- [ ] N-2: `sendNotesList` の `catch {}` をやめて UI へ通知する。**起動時には「前回の一覧」が存在しない**（初期値 `[]`）ので、走査が失敗すると「No notes on this page yet」という嘘の空状態が出る — `code.ts:71` のコメントが避けると言っているまさにその状態。保存時は `onmessage` 代入済みで報告手段が生きているのに同じ沈黙が適用される。**推奨は起動時の `sendNotesList()` を `figma.ui.onmessage` 代入の後ろへ移すこと** — `catch` が要る理由（ハンドラ未設定）は順序の副作用にすぎず、順序を直せば封じ込め自体が不要になる。あわせて UI が「未受信」と「0件」を区別できるようにする（3軸一致・4.3.4 違反）
- [ ] N-3: 一覧の行データ組み立てと空状態の判定を純関数に切り出して固定する。現状は一覧ブロックを `<Show when={selectionNote()}>` で包む／`{item.layerPath}` を `{item.note}` にする／`onClick` を削る／空状態の条件を反転する、のいずれも 267 passed のまま生存する（＝**UI を丸ごと消してもテストが通る**）。既存方針「描画に載る値を純関数に切り出して固定する」が新規コードに適用されていない（3軸一致・完了条件1/2/5）
- [ ] N-4: `select-node` ハンドラに回帰テストを足す。`scrollAndZoomIntoView` の行を削除しても 267 passed。純粋な plugin 側ロジックでテスト可能
- [ ] N-5: notes-list のテストのレイヤー名を、正規化で綴りが変わる名前（`Hero / Top`、`見出し ブロック` 等）にする。現状は全部 ASCII なので、4.5.2 相当の正規化を混入させても検知できず、4.7.3 の「生のレイヤー名をそのまま」が固定されていない
- [x] N-6: 設計書 4.7.3 の自己矛盾を解消する（「現在のページの全レイヤー」と「更新は起動時と保存時だけ」が両立しない）。N-1 の結論を反映する
- [x] N-7: 設計書 4.7.2 に「書き出し対象外レイヤーに付いた note」を除外物の1項目として追記する。走査範囲をページ全体に広げた結果、その note は `spec.json` にも README 除外物にも載らないのに一覧にだけ出る（「一覧に出ている＝CC に届く」と読めて届かない＝4.3.4 違反）。**設計書のみここで決め、検出の実装は U-3 へ**
- [x] N-8: 一覧クリックが未保存の入力を無言で捨てる件を 4.7.3 に明記する（`selection-note` が `setNoteText` で上書き。挙動自体は従来どおりだが、編集中の入力欄のすぐ下に1クリックで捨てるコントロールが新設された）
- [x] 設計レビュー（実装前、設計書の文面を対象）: `35ba5ed` に対して fail（指摘8件、すべて Valid）→ 修正ラウンド1 `660759c` → 再レビュー **pass**（2026-09-20。詳細は `.rn/20260524-build-plugin/checks/U-2.md`「設計レビュー」節）。設計書 4.7.3 で決まった実装の根拠: 一覧は起動時・保存時・ページ切り替え時の3時点のスナップショット（`documentchange` は購読しない）／UI 状態は「未着」「失敗」「受信済み」の3つで0件メッセージは受信済みのみ／走査失敗時は通知して前回の一覧を消す／行の対象が現在のページに無ければ通知して一覧を作り直す／行クリックで選択が成立しても一覧は作り直さない
- [ ] N-10: `layerPathOf` を `src/export/layerPath.ts` から `src/util/` へ移す。非 export 機能の Notes タブが `src/export/` に依存する形になっている
- [ ] N-11: `"note"` のマジック文字列を定数化する（2→3箇所に増えた）／`layerPathOf` のコールバック引数名 `node` が外側をシャドウしているので `ancestor` に揃える／0件時に「Notes on this page (0)」と「No notes on this page yet」で同じ事実を2回言っている
- [ ] N-12: `save-note` に try/catch を足す（`run-checks` / `run-export` にはある）。`sendNotesList()` を足したことで、壊れたときの道連れが1つ増えた。あわせて対象ノードが消えている場合（`getNodeById` が null）も黙って無反応にせず UI に通知する（設計レビューで指摘。N-1 の「行の対象が無い」と同型の黙殺）
- [ ] N-9: **実機確認が必須** — 主コンポーネント内部のレイヤーに note を付けてインスタンスを2個置いたとき、一覧が何行になるか。重複するなら行に区別（インスタンス名の明示など）が要る。結果を 4.7.3 に書く
- [ ] セルフチェック（完了条件ごとに OK/NG。チェック結果: `.rn/20260524-build-plugin/checks/U-2.md`）
- [ ] Figma 実機で試す（実機でしか出ない不具合はここでしか見つからない）

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
- [ ] `docs/design.md` 4.7.2 に追加する検出カテゴリを追記する
- [ ] ページ直下に裸で置かれた `GROUP` / `INSTANCE` / `TEXT` / `RECTANGLE` 等（`FRAME`・`SECTION` 以外）が無記録で書き出しから落ちている件を検出・記録する
- [ ] `strokeStyleId` に束縛された Color Style を検出する（現状 `fillStyleId` のみ）
- [ ] インスタンスの component properties 経由（`instance.componentProperties[k].boundVariables.value`）で束縛された STRING Variable を検出する
- [ ] 同名 Variable が別コレクションに存在し `tokens.json` で相互に上書きされる件を検出する
- [ ] 書き出し対象外レイヤー（書き出し対象 `FRAME`/`SECTION` 配下に無いノード）に付いた note を検出し、レイヤーパスと note 本文を README の除外物に記録する（U-2 N-7 で設計書 4.7.2 に追記済み。Notes 一覧には出るのに CC に届かない黙殺を塞ぐ）
- [ ] テスト作成
- [ ] セルフチェック（完了条件ごとに OK/NG。チェック結果: `.rn/20260524-build-plugin/checks/U-3.md`）
- [ ] Figma 実機で試す（実機でしか出ない不具合はここでしか見つからない）

**完了条件**:
- ページ直下の `FRAME`・`SECTION` 以外のノードが書き出しから落ちる場合、`README.md` の除外物セクションに該当レイヤーが記録されること
- `strokeStyleId` に Color Style を束縛したレイヤーが Color Style 使用として記録されること
- 書き出し対象外レイヤーに付いた note が、レイヤーパスと本文つきで除外物に記録されること
- component properties 経由で束縛された STRING Variable が記録されること
- 別コレクションの同名 Variable が `tokens.json` で衝突する場合に記録されること
- 検出ゼロの項目については `README.md` に該当行が出力されないこと
- 新たな問題が持ち込まれていないこと — 具体的には、(a) 既存テストが全グリーンであること、(b) U-1 で確立した走査範囲・グルーピング規約が変わっていないこと

---

### U-4: U-1 持ち越し指摘の解消

**目的**: U-1 で修正ラウンド上限に達して持ち越した6件の指摘（出力精度2件・契約1件・UI1件・テスト1件・スタイル1件）を解消する。

**前提**: U-1 完了

**作業内容**:
- [x] `ExportFrame` にフレームの生名と zip フォルダ名の両方を載せ、README の Contents 行 `for frame "X"` が生名を出すようにする（現状フォルダ名を出すため `Desktop / Home` が存在しない `Desktop - Home` として現れる）
- [x] `zipBuilder` 側の `resolveFrameFolderNames` 呼び出しを廃し、フォルダ名は `code.ts` が載せた `ExportFrame.folderName` を使う形にして、フォルダ名と README パスの一致を暗黙の慣習でなく構造で保証する（設計書 4.7.2「同一の関数で生成」に実装を合わせる）
- [x] `src/messages.ts` の `CheckErrorMessage` を `code.ts` の post 箇所で型注釈として使う（現状どこからも参照されていない）
- [x] `src/App.tsx`: `check-error` 受信時に `results()` / `hasRun()` をクリアし、失敗バナーの下に前回の結果が残らないようにする。あわせて Review パネルの `<Show>` 二重ゲートのデッドパス（結果あり・エラー0件で空パネル）を解消する
- [x] テスト追加: 0フレーム書き出し、`typography/a/b` の多段サブパス衝突、DOCUMENT 終端のレイヤーパス
- [x] 新規モジュール（`src/export/exclusions.ts` / `readmeBuilder.ts` / `zipBuilder.ts` / `layerPath.ts`）のコメントを既存コードの密度（5〜13%）に揃える。過去の不具合の経緯を語る段落は削り、必要な背景は設計書側に置く
- [x] セルフチェック（完了条件ごとに OK/NG。チェック結果: `.rn/20260524-build-plugin/checks/U-4.md`）
- [x] QA エキスパートレビュー（subagent）
- [x] Craft エキスパートレビュー（subagent、コーディング媒体）
- [x] Verification エキスパートレビュー（subagent、コーディング媒体）
- [x] Design エキスパートレビュー（subagent）
- [x] 修正ラウンド2: 3軸一致・2軸一致の未解決4件を潰し、該当軸を再レビュー（2026-09-19 実施・triage 済み）
- [x] 修正ラウンド3: V-1（`messages.ts` コメント比率）・V-2（`noteSaved` fixture 空振り）・V-3（`ExportScope.frames` readonly）を潰し（実装済み `0bf40c5` `1ea315e` `8e84b72`）、QA / Craft / Verification / Design の4軸を再レビュー（2026-09-20 実施。**4軸とも pass**。新規指摘 R3-A〜R3-H はすべて完了条件の外と判定し U-5 へ。詳細は `.rn/20260524-build-plugin/checks/U-4.md`）


**進行メモ（2026-09-19 時点）**:
- 実装 `9daf778` → レビュー4軸 → 修正ラウンド1 `9544e2d` → 再レビュー4軸 → 修正ラウンド2 `9175683` `c569202` → 再レビュー4軸（2026-09-19、`ad80720..HEAD` 対象）→ triage → 修正ラウンド3 `0bf40c5` `1ea315e` `8e84b72`。テスト 217 → 243 → 257 → 257、両ビルド green、tsc エラーは修正ラウンド3の前後で完全一致（82件、diff 空。対象4ファイルには0件）
- 修正ラウンド2の再レビュー: QA **fail** / Craft **fail** / Design **fail** / Verification **pass**。**4軸一致で NG だったのは完了条件6（`messages.ts` のコメント比率、40〜55%の帯に残存）のみ**。①〜⑤⑦は変異テスト（のべ100件超投入、生存は数件）で裏づけ済み
- triage: Valid 3件（V-1〜V-3、下記）を修正ラウンド3で対応。Invalid 9件は完了条件の外と判定し、U-5 に統合・新規追加（詳細は `.rn/20260524-build-plugin/checks/U-4.md` の「修正ラウンド2 再レビューの triage」節）
- 修正ラウンド3のセルフチェックは実装者から回収済み（7項目 OK、`messages.ts` は 49.5%→21.5%）。**QA / Craft / Verification / Design の4軸再レビューは中断のため未実施 — 再開時にやり直す**

**修正ラウンド2で解消した4件（コーディネーターが実機確認済み）**:
1. `rootNames` 無検証（3軸一致）→ `src/export/exportScope.ts` に `ExportScope { frames, rootNames, pageRootNodes }` と `resolveExportScope(pageRootNodes)` を新設。`collectExclusions` は `{ scope, variables, textStyles }` を受け取る形になり、一致必須の2引数が消滅。例外方針は `folderNameOf(scope, frame)` の throw に一本化。`RESERVED_ROOT_NAMES` とページ直下命名一式も `layerPath.ts` から移設（D2）。**変異 `resolveExportScope(page.children.filter(isExportedFrame))` で `code.test.ts` 2件が落ちることを確認**（ラウンド1では同種の変異が全パスだった）
2. 大小文字の衝突（2軸一致）→ `claimUnique` の照合を `toLowerCase()` に。綴りは原名のまま（`Home` / `home-2`）。設計書 4.5.2 に規約5として追記
3. `App.tsx` の残りカス（2軸一致）→ `handlePluginMessage(msg, handlers)` を切り出し、`export-error` / `note-saved` / `selection-note` / `export-data` の全分岐を DOM なしでテスト。**変異「`applyReviewOutcome` の呼び出し行を丸ごと削除」で `App.test.ts` 2件が落ちることを確認**
4. tsc エラー2件（2軸一致）→ `messages.ts` に `PluginMessage` union を追加し、`applyReviewOutcome` / `handlePluginMessage` のパラメータ型に使用

**修正ラウンド3で解消した3件（triage の Valid 3件、実装者のセルフチェック済み・コーディネーター未実機確認）**:
1. V-1: `messages.ts` のコメント比率 49.5%→21.5%（コメント行は同一論旨の3箇所重複を冒頭1箇所に集約。型宣言・フィールド・union は無改変、`git diff -U0` の増減行がすべてコメント行であることを確認済み）
2. V-2: `App.test.ts` の `noteSaved` fixture 空振り → `selection-note` ケースの初期値を `true` にし、`handlers.setNoteSaved(false);` を削る変異で実際に1件落ちることを実装者が確認
3. V-3: `ExportScope.frames` に `readonly` を付与。`scope.frames.push(n)` が `tsc` で TS2339 拒否されることを確認

**残存リスク（今回は閉じない）**: 描画層の `<Show when={hasRun()}>` → `when={true}` の変異は生存する。jsdom 未導入で DOM テストが書けないため。jsdom の追加は環境変更にあたりユーザー確認が必要なので、`.rn/20260524-build-plugin/checks/U-4.md` に既知リスクとして記録するに留めた

**再開時の作業**: 修正ラウンド3の成果（`a2066df..8e84b72`）に対して QA / Craft / Verification / Design の4軸を再レビューし、triage して check off する。レビュー発注時は成果物の差分・完了条件の逐語コピー・各軸のチェックリストのみを渡し、セルフチェックファイルや実装者のサマリ、期待する判定は渡さないこと。**これが3回目＝上限の修正ラウンドなので、再レビューで NG が残った場合は追加の修正ラウンドを走らせず、その場でユーザーにエスカレーションする**（rn の手順どおり）

**修正指示の書き方（今回の反省）**: レビュアーが当てた変異そのものを指示に書き、それが落ちることを確認させる。修正ラウンド1では「命名パスを1回にしろ」とだけ指示し、引数化後の不整合をどう防ぐかまで書かなかったため、実装者のセルフチェックは自分が想定した変異（別の Map を渡す）しか当てず、レビュアーが当てた変異（Map の作り方を変える）を素通しした。

**完了条件**:
- `README.md` の Contents 行 `for frame "X"` の `X` が Figma 上の生のフレーム名と一致すること（フォルダ名にサニタイズや `-N` が入ったケースでも生名が出ること）
- `src/export/zipBuilder.ts` が `resolveFrameFolderNames` を呼ばず、zip のフォルダ名が `ExportFrame` に載った値そのものであること
- `src/messages.ts` の `CheckErrorMessage` が `src/code.ts` から参照されていること
- `check-error` を受信した直後の Review タブに、前回の実行結果が表示されていないこと
- 0フレーム書き出し・多段サブパスのトークン名衝突・DOCUMENT 終端のレイヤーパスを対象とするテストが存在し、パスすること
- 新規モジュールのコメント行比率が、同程度の規模の既存モジュールと同水準であること（U-1 時点の 40〜55% という既存の3〜8倍の状態が解消されていること）。**当初「5〜13%」と書いたが、既存の `src/checks/traversal.ts` が 17.2%、`src/checks/types.ts` が 52.9% で、この範囲自体が事実と違っていたため 2026-09-16 に改めた。行数の少ないモジュールでは1行の増減が比率を大きく動かすため、比率だけを基準にしない**
- 新たな問題が持ち込まれていないこと — 具体的には、(a) 既存テストが全グリーンであること、(b) 除外物の検出内容と README の除外物セクションの出力内容が変わっていないこと

---

### U-5: U-4 で範囲外とした指摘の解消

**目的**: U-4 のレビューで挙がったが完了条件の外にあった指摘を解消する。

**前提**: U-4 完了

**作業内容**:
- [ ] 裸 root Component の除外物行に Figma 上の生名を併記する（Design D3）。`A/B` という名の Component が README に `A-B` と出るが、フレームと違って Contents 行のような対応表がないため、デザイナーは README の指示を実行する対象を特定できない。`findBareRootComponents` の戻り値を `{ path, rawName }[]` にし、正規化後と生名が異なるときだけ併記する。設計書 4.7.2 に1文追記
- [ ] `tsc --noEmit` をゲートにする（Design F7）。現状82件のエラーで通らず、postMessage の型契約が build 時に一切検証されていない。`src/vite-env.d.ts` の追加（`*.md?raw` の宣言欠如）と solid-js の JSX 型解決を片付け、`package.json` の test スクリプトに `tsc --noEmit` を足す。あわせて `handlePluginMessage` を `switch` 化して末尾に `const _exhaustive: never = msg;` を置き、`PluginMessage` union に型を足したとき消費側が黙って捨てないようにする（U-4 再レビュー Craft 指摘。現状 union に1種足しても `tsc` に新規エラーが出ない）
- [ ] `RESERVED_ROOT_NAMES` と `zipBuilder` が実際に書くルートファイルの一致を固定するテスト（Craft C-4）。現状 `RESERVED_ROOT_NAMES` から `README.md` を削っても全グリーンで、zip ルートにファイルが増減しても誰も気づかない。`zipBuilder.test.ts` の0フレームケースが既にルートファイル一覧を取っているので、そこで突き合わせる
- [ ] `zipBuilder` の境界ガードを揃える（Craft C-5 / Design D6）。現状 `folderName` の重複だけ throw し、空文字（ルート直置き）と `/` を含む値（ルート外へ書き出し）は素通し。さらに重複判定が大小文字を区別するため `Home` と `home` を直接渡すと throw せず2フォルダを作る（`exportScope` 側は大小無視で一意化しているので `code.ts` 経由では到達不能だが、このガードは「code.ts が壊れたときの最後の砦」として置かれている以上、揃っていないと意味がない）。あわせて `data.exclusions` 欠落時、`zipBuilder` と `messages.ts` のコメントが「throw する」と明言しているのに実際には `readmeBuilder` の `TypeError` に依存している件も、意図を載せた明示ガードにする。3つ守るか0にするかを決める
- [ ] `baseSegment` の無害化を設計書 4.5.2 の規約1に揃える（Verification NG-3 / U-4 再レビュー Craft 指摘）。(a) バックスラッシュ置換のテストがなく、`raw.replace(/[/\\]/g, "-")` を `/[/]/` に変えても全グリーン（`\` を含むフレーム名の例が1件もない）。(b) 末尾ドットと Windows 禁止文字（`: * ? " < > |`）を無害化していないため、`Home.` と `Home` が Windows で同一パスに解決して片方の `spec.json` が黙って消え、`A:B` は展開自体が壊れる。大小文字と同じクラスの不具合でそちらだけ塞がれている状態。実装は `src/export/exportScope.ts`（U-4 修正ラウンド2で `layerPath.ts` から移設済み）。設計書 4.5.2 の規約1にも同じ根拠で追記が要る
- [ ] `isExportedFrame` の二重定義を解消する（U-4 再レビュー Design 指摘）。`src/export/exportScope.ts` が export しているのに `src/export/specBuilder.ts` が `(n) => n.type === "FRAME" || n.type === "SECTION"` を独立に持っており、「何が書き出し単位か」という 4.7.4 の事実が2箇所にある。片方だけ更新されれば spec.json の対象と zip フォルダの対象が黙ってズレる（U-4 が潰した `resolveFrameFolderNames` の二重実装と同じ形）
- [ ] 0フレーム書き出しの挙動を設計書 4.7.4 に明記する（U-4 再レビュー Design 指摘）。実装はエラーにせずテンプレート3点＋tokens.json だけの zip を落とすが、設計書は一言も触れていない。デザイナーには「Export complete」と出て中身にデザインのない zip が届き、理由がどこにも書かれない（4.3.4 の「黙って捨てない」姿勢と緊張する）。設計書に明記したうえで、README の Contents に「書き出し対象のフレームがページ上にありません」の1行を出す
- [ ] `reviewOutcome` / `applyReviewOutcome` / `handlePluginMessage` の三段を畳む（Design D5a。U-4 修正ラウンド2で二段→三段になった）。`ReviewOutcome` は3フィールドの中間構造体で、生成直後に3つの setter へ展開するだけ。加えて Review だけ「無条件呼び出し＋関数内で早期 return」で、他4分岐（`if` で直接分岐）と type ガードの置き場所が非対称。テストも3レベルで同じ2点を重複検証している
- [ ] `ExportScope` の不変条件を型で守る（U-4 再レビュー Design 指摘）。plain な structural interface なので `{ frames, rootNames: new Map(), pageRootNodes }` が型検査を通り（`code.test.ts` が実際にそう作っている）、`folderNameOf(scope, frame)` の `frame` も「`scope.frames` の要素」であることが縛られていない。守っているのは `resolveExportScope` 経由でしか作らないという規約と実行時 throw だけ。private brand か class 化で外部から組み立て不能にする。**U-4 ラウンド3 再レビューで4軸が再提起**: `frames` に付けた `readonly` は要素側だけで、プロパティ自体には付いていないため `scope.frames = []` の再代入は素通りする。しかも `tsc` がどのゲートでも走らないので `push` すら実際には止まらない（上の `tsc --noEmit` ゲート化とセットで初めて意味を持つ）
- [ ] `messages.ts` / `exportScope.ts` / `code.ts` に残る事実と違うコメントを直す（U-4 ラウンド3 再レビュー R3-B / R3-C / R3-D）。(a) `exportScope.ts:41`「a frame pushed in later would have no `rootNames` entry」は誤り — `resolvePageRootNames` はページ直下の**全**ノードに名前を付けるので、裸 Component を push しても `folderNameOf` は throw しない。readonly が実際に守るのは実行時バックストップが効かないこのケースだと書く。(b) `messages.ts:9` の `ExportFile.path`「zip-relative path」は誤り — 実体はフレームフォルダ相対（`folder.file()` で書く）。(c) `code.ts:163-165`「must be a type error」は `messages.ts:5`「the repo runs no `tsc` step」と矛盾するので撤回する（`tsc` ゲート化が済めば真になるため、上の `tsc --noEmit` 項目と同時に決める）。`code.ts:190-191` は `messages.ts:4-7` とほぼ逐語で重複しており削除
- [ ] `noteSaved` のクロスタブ空振りを塞ぐ（R3-A）。`App.test.ts:208`「leaves every other tab's signals alone for a Review message」が `noteSaved` を検証していないため、`handlePluginMessage` 冒頭に `handlers.setNoteSaved(false);` を足す変異が 257 全パスで生存する（＝ノートを保存した直後に Review を走らせると "Saved" 表示が消える実ユーザー不具合をテストが1件も捉えない）。当該テストを `{ noteSaved: true }` 開始にし `expect(state.noteSaved).toBe(true)` を足す。**この変異が実際に落ちることを確認するまで完了としない**
- [ ] `ExportFrame.spec` を `SpecJson` に寄せる（R3-E）。`messages.ts:21` の手書き部分型は本体（`specBuilder.ts` の `SpecJson`、`viewport`・`children` とも必須）の劣化コピーで、その嘘に合わせた到達不能な `?.` が `zipBuilder.ts:52,74` に入っている。`SpecJson` を export して `spec: SpecJson` にすれば重複も死んだガードも消える
- [ ] `dist/code.js` をサンドボックス非対応グローバル（`TextEncoder` 等）で走査する手順を `bun run test` のゲートに入れるか決める（`27ae8ce` のとき手作業でやった走査。推奨: 入れる。`tsc --noEmit` ゲート化と同枠）。ユーザー未回答
- [ ] README の Contents 行でフレーム名を Markdown エスケープする（R3-F）。`readmeBuilder.ts:42` はバッククォートや `"` を含むフレーム名をそのまま埋めるため、コードスパンと引用が壊れる。デザイナーの付けた名前が README の構造を壊さないこと
- [ ] セルフチェック（完了条件ごとに OK/NG。チェック結果: `.rn/20260524-build-plugin/checks/U-5.md`）
- [ ] Figma 実機で試す（実機でしか出ない不具合はここでしか見つからない）

**完了条件**:
- 正規化で綴りが変わった裸 root Component について、`README.md` の除外物行に Figma 上の生名が併記されていること
- `bun run test` が `tsc --noEmit` を含み、型エラー0で通ること
- `PluginMessage` union に1種類足したとき、消費側（`handlePluginMessage`）で型エラーになること
- `RESERVED_ROOT_NAMES` から1件削ったとき、または `zipBuilder` のルートファイルを1件増やしたときに落ちるテストが存在すること
- `zipBuilder` が受け取る `folderName` の不正値（空文字・パス区切りを含む・大小文字違いの重複）と `data.exclusions` の欠落について、throw するか型で防ぐかの方針が1つに揃っていること
- フレーム名に `\`・末尾ドット・Windows 禁止文字（`: * ? " < > |`）を含むケースのテストが存在し、パスすること。設計書 4.5.2 の規約1が同じ無害化対象を記載していること
- `isExportedFrame` と同じ判定がリポジトリ内に1箇所しか存在しないこと
- 書き出し対象フレームが0件のときの挙動が設計書 4.7.4 に記載され、`README.md` にその旨の1行が出力されること
- `resolveExportScope` を経由せずに `ExportScope` を組み立てるコードが型検査を通らないこと。`scope.frames.push(...)` だけでなく `scope.frames = []` の再代入も拒否されること
- `handlePluginMessage` の冒頭に `handlers.setNoteSaved(false);` を足す変異で、`App.test.ts` が少なくとも1件落ちること
- リポジトリ内のコメントに、`tsc` による型検査が効いていると読める記述が残っていないこと（`tsc` をゲート化した場合は、その記述が事実になっていること）
- `ExportFile.path` と `ExportFrame.spec` の型・コメントが実体と一致していること。`zipBuilder.ts` に型上到達不能な `?.` が残っていないこと
- バッククォートまたは `"` を含むフレーム名で `README.md` の Contents 行が壊れないことを示すテストが存在し、パスすること
- 新たな問題が持ち込まれていないこと — (a) 既存テストが全グリーンであること、(b) U-4 で確立したフォルダ名と README パスの一致が変わっていないこと

---

### U-7: 既存テストを Given / When / Then の形に揃える

**目的**: 267 件の既存テストに `// given` / `// when` / `// then` の区切りを入れ、読めば3段が分かる状態にする。現状は区切りのラベルが1つも無く、空行で分けてあるものと `expect` 1行だけのものが混在している。

**前提**: U-2 / U-3 / U-5 完了（テストが動いている間に揃えると二度手間になる）

**作業内容**:
- [ ] 全テストファイル（`src/**/__tests__/*.test.ts`、`src/__tests__/*.test.ts`）の各 `it` を `// given` / `// when` / `// then` の3ブロックに分ける。**アサーションと fixture は一切変えない** — ラベルと空行を入れる作業に限る
- [ ] 分けられない `it`（when と then が1式に溶けているもの）は、式を `const result = ...` に分けて when と then を切り離す。それでも分けられないものは一覧にして報告する
- [ ] `bun run test` が変更前後で同じ件数・同じ結果であること
- [ ] セルフチェック（完了条件ごとに OK/NG。チェック結果: `.rn/20260524-build-plugin/checks/U-7.md`）

**完了条件**:
- すべての `it` ブロックに `// when` と `// then` があり、前提が要るものには `// given` があること（`grep -c` で機械的に確認できること）
- 変更が `// given` / `// when` / `// then` の挿入・空行・`const result =` への分割のみであり、`git diff` にアサーションや fixture の値の変更が含まれないこと
- `bun run test` が 267 件（またはその時点の件数）すべてパスすること

---

### U-8: Solid 2.0 を RC に更新する

**目的**: 固定されている `solid-js` / `@solidjs/web` 2.0.0-beta.14 と `vite-plugin-solid` 3.0.0-next.5 を、`next` タグの最新（2026-09-20 時点で 2.0.0-rc.9 / 3.0.0-next.27）に上げる。安定版が出たら同じ手順で安定版へ。

**前提**: なし。ただし**環境変更なのでユーザー確認のうえで実施**（作業ルール）

**作業内容**:
- [ ] ユーザーに実施の確認を取る
- [ ] `bun update solid-js @solidjs/web vite-plugin-solid` で `next` の最新に上げ、`bun.lock` を更新する
- [ ] beta → rc の破壊的変更を Solid の changelog で確認し、`src/App.tsx` / `src/ui.tsx` の該当箇所を直す
- [ ] `bun run build` と `bun run test` を通す
- [ ] `bunx tsc --noEmit` の件数を更新前後で比べ、JSX 型解決エラー（TS7026 / TS2875）が消えたか・残ったかを記録する。残った場合は `tsconfig` の `jsxImportSource` を確認し、U-5 の `tsc` ゲート化に引き継ぐ
- [ ] Figma 実機で3タブが動くことを試す（ランタイムの差は実機でしか出ない）
- [ ] セルフチェック（完了条件ごとに OK/NG。チェック結果: `.rn/20260524-build-plugin/checks/U-8.md`）

**完了条件**:
- `bun.lock` の3パッケージが `next` タグの同一系列（2.0.0-rc.x / 3.0.0-next.x）で揃っていること
- `bun run build` が両バンドルとも成功し、`bun run test` が全パスすること
- Figma 実機で Review / Notes / Export の3タブが更新前と同じに動くこと
- `tsc --noEmit` の件数の変化と、残ったエラーの種類が本タスクのチェックファイルに記録されていること

---

### U-6: Ph-8 完成時の4軸レビュー

**目的**: Ph-8（U-2 / U-3 / U-5 / U-7 / U-8）が出揃ってから、QA / Craft / Verification の3軸を1回まとめて回す。タスクごとに回さないのは、変更が続いている的に当てても結果がすぐ陳腐化するため（作業ルール「レビューの配置」）。

**前提**: U-2 / U-3 / U-5 / U-7 / U-8 完了、かつ Figma 実機での試行が済んでいること

**作業内容**:
- [ ] QA エキスパートレビュー（subagent）— Ph-8 の累積差分を対象に
- [ ] Craft エキスパートレビュー（subagent、コーディング媒体）
- [ ] Verification エキスパートレビュー（subagent、コーディング媒体）
- [ ] 指摘を triage する。**レビュアーは全員 Node で走るため、実機でしか出ない不具合（`TextEncoder` 不在のような差）は原理的に見つからない**。実機側の確認は試行で済ませておくこと
- [ ] 各軸には隔離コピー（`git archive HEAD`）での変異テストを指示する。同一ワークツリーで並行させると変異が互いの読み取りを汚染する（U-2 のレビューで実際に起きた）

**完了条件**:
- 3軸の判定と指摘が `.rn/20260524-build-plugin/checks/U-6.md` に記録されていること
- すべての指摘が Valid / Invalid のいずれかに判定され、Valid の分が修正されているか、次フェーズのタスクとして定義されていること

---

Ph-9: ダークモード対応とチェック体系の再設計
----------------------

別セッション（ccpm/webplan）からの申し送り（2026-09-19）が発端。設計書 4.3.4（トークンの源泉）の見直しとして届いたが、ダークモード対応が必須要件だと確認されたことで、チェック体系そのものの設計に波及した。

申し送りの改善案7件（Style の中身が Variables を指すか検証／エイリアス展開をやめる／Variable Modes 対応／Color Style を役割ありに戻す／String Variable を拾う／4の倍数チェック／Variables 必須化は警告まで）と、プリセット生成・命名規則・Free の制約は、下の「確定」2節と未決1〜6に振り分け済み。申し送りが挙げた素材で D-1〜D-3 が要るもの:

* **出典**（Figma 公式）: [Tokens, variables and styles](https://help.figma.com/hc/en-us/articles/18490793776023-Update-1-Tokens-variables-and-styles) / [The difference between variables and styles](https://help.figma.com/hc/en-us/articles/15871097384471-The-difference-between-variables-and-styles) / [Overview of variables, collections and modes](https://help.figma.com/hc/en-us/articles/14506821864087-Overview-of-variables-collections-and-modes) / [Modes for variables](https://help.figma.com/hc/en-us/articles/15343816063383-Modes-for-variables) / [Plugin API: figma.variables](https://developers.figma.com/docs/plugins/api/figma-variables/)
* **Figma 公式の立場**: 「多くの場合、デザイントークンの実装は Styles と Variables の組み合わせになる」。値は Variables、値の組み合わせは Styles、Styles の中身は Variables を指す。公式の例: 既定の文字サイズの Number 変数（モバイル16 / デスクトップ18）を Text Style のプロパティに適用
* **Variables の型と適用先**（公式）: Color = 塗り・線・グラデーション各点・影の色・カラースタイル。Number = 角丸／幅高さ（min/max 含む）／余白と gap／線の太さ／不透明度／影とぼかしの X・Y・blur・spread／文字のサイズ・太さ・行送り・字間・段落字下げ・段落間／レイアウトグリッド／テキストスタイル。String = フォントファミリー・フォントのスタイル名・テキストの中身・テキストスタイル・プロトタイプのバリアント。Boolean = 表示非表示・true/false バリアント
* **プリセット生成の下敷き**: Figma 自身が同じことをするスキルを公開している — https://github.com/figma/mcp-server-guide/blob/main/skills/figma-generate-library/references/token-creation.md

### 確定: ダーク対応は「1フレーム＋トグル」方式（2026-09-19）

Figma のプラン制限は「1コレクションあたりのモード数」にかかる（Starter はモードを作れない／Professional 10／Organization 20）。**コレクションの数はどのプランでも制限されていない**ため、Variable Modes を使わずコレクションを分ければ Free でもダーク対応ができる。

変数は3コレクションに分ける。

| コレクション | 内容 | 対を持つか |
|---|---|---|
| Light | 色（bg / surface / border / text / text-muted / primary / primary-hover / on-primary） | Dark と対 |
| Dark | 同名の色 | Light と対 |
| Base | 余白・角丸・書体・文字サイズ | 持たない |

**変数名にテーマを入れない**（`bg-light` にしない）。tokens.json がその名前で出ると CSS 変数が `--bg-light` になり、`--bg` が `:root` と `[data-theme="dark"]` で値を変える形を CC 側が機械的に作れなくなるため。テーマ違いはコレクション名が持つ。

**対を持つのは色だけ**。余白・角丸・書体・文字サイズはテーマで値が変わらないので Base に置く。二重管理が発生せず、トグルも「バインド中の変数と同名の変数が対のコレクションにあれば付け替える、なければ触らない」で済み、Base を除外する特別扱いが要らない。

**フレームは複製しない**。telldes が選択フレーム配下のバインドを Light ⇄ Dark で付け替え、キャンバス上で実際にダークを描画する。

複製方式（dark フレームを生成する案）を採らない理由:

* dark フレームがトップレベルフレームとして出ると R-1 のフレーム別フォルダ出力に乗り、`Home/spec.json` と `Home-dark/spec.json` という**別ページ2つ**として CC に渡る。同じページのテーマ違いを別ページとして渡すことになり、出力構造が歪む
* light の構造変更が dark に伝わらないため、古さを検出する仕組みが別途必要になる。検出を怠れば古い dark がクライアントと CC に渡る
* 再生成は delete-insert になり、クライアントがレビュー中に付けたコメントが迷子になる（Figma のコメントは Plugin API から触れない）

トグル方式で受け入れる代償:

* ファイルが「今どちらのテーマか」という状態を持つ。書き出しは light 撮影 → 付け替え → dark 撮影 → light に戻す手順になり、失敗時にも必ず戻す処理が要る
* キャンバス上で light/dark を並べて比較できない。比較は書き出した screenshots で行う。ページ上に並べる必要が出たら、複製生成を**レビュー用の使い捨て**として後から足せる（恒久管理しないのでドリフトは起きない）

誤操作は、Dark コレクションの変数に `scopes: []` を設定してピッカーから隠すことで防ぐ。Plugin API からのバインドは scopes を無視するため、デザイナーは手で選べず telldes だけが付け替えられる。値の編集は開けておく（dark の色を決めるのはデザイナーの仕事であり、禁止したいのは手動バインドのみ）。

### 確定: チェックは体系として設計する（2026-09-20）

ダーク対応で必要になる検証を個別に足さない。U-1 で引いた「Review = 直さないと Export できないもの／README = ツールが黙って落としている事実」という線引きを維持したうえで、原則を3つ置く。

**原則1 — error はデザイナーが選んだやり方に対する整合性だけを見る。やり方自体は強制しない**

「Variables を使え」は error にしない。**Dark コレクションを作った時点でそのファイルは「ダーク対応する」と宣言した**ことになり、テーマ整合チェックが有効になる。Dark コレクションが無いファイルでは1件も発火しない。判定軸は「出力が壊れるか」の一点。

| チェック | ダーク対応ファイル | ライトのみ |
|---|---|---|
| 色が変数にバインドされていない | error（トグルで変わらない＝出力が壊れる） | README |
| Light / Dark のペアが崩れている | error | 発火しない |
| light 状態に Dark バインドが混入 | error | 発火しない |
| Text Style の font-size が生数値 | README | README |
| padding/gap が生数値・4の倍数でない | README | README |

font-size や padding はテーマで値が変わらないため、ダーク対応していても壊れない。だから error にしない。

**原則2 — Review の1行 = デザイナーが下す1判断。原因単位で集約する**

「色が変数にバインドされていない」は LP 1枚で数十〜数百箇所出る。ノード単位で並べれば U-1 が解消したノイズ問題が形を変えて再発する。同じ `#333333` が30箇所なら1行にまとめる。デザイナーの作業は「この色を変数にして割り当てる」という1つの判断であって、30回の判断ではない。

U-1 で削除した `variableChecks.ts` が持っていた集約（同じ色が3箇所以上、等）は、**位置づけ（提案）が誤りだっただけで集約の形自体は正しかった**。ここで作り直す。

**原則3 — Review は行為の前に自動で走るゲート。結果は必ず Review タブに出す**

現行実装は Export 時に既に全チェックを走らせ、error があれば中止している（`src/code.ts`）。欠陥は**結果を返していないこと**。UI に戻るのは `"N error(s) must be fixed before export"` という件数だけで、デザイナーは自分で Review タブへ移動してボタンを押し直す必要があり、同じチェックが2回走る。件数を見せて場所を教えていない。

| ゲート | 走らせるチェック | 失敗時 |
|---|---|---|
| Export | 出力が壊れるもの全部（構造5種＋テーマ整合） | Review に結果表示、Export 中止 |
| テーマ切り替え | テーマ整合のみ | Review に結果表示、切り替え中止 |
| 手動 Review ボタン | 全部 | Review に結果表示 |

テーマ切り替えで構造チェックを走らせないのは、Auto Layout 未適用やレイヤー名の重複がダーク表示の正しさに関係しないため。切り替えは見た目を確認するための操作なので、無関係な理由で止めない。

結果にはどのゲートで止まったかが分かる見出しを付ける（「Export できません」「ダーク表示に切り替えられません」）。Export を押して Review タブに飛んだ理由が分からないと混乱するため。

「起動時に dark のまま残っている」はこの体系に含めない。直すべき違反ではなく中断で残った状態なので、error ではなく「ライトに戻しますか？」という復旧の促しにする。

### 未決（この順に決める）

1. **タイポグラフィの源泉** — 現行実装（G-2）は Text Style から `typographyToken` を拾う。Text Style のままにするか、String（フォントファミリー）+ Number（サイズ・太さ・行送り・字間）の Variables に寄せるか。「String Variable を拾う」案とプリセット生成の Text Style 生成有無がこれに依存する
2. **プリセット生成モードを新設するか** — 検証・書き出しに並ぶ3機能目。押すとコレクション・変数・Text Style・Effect Style を一式作る。最小セット案は変数25＋スタイル8＝33個。`setVariableCodeSyntax('WEB', 'var(--space-md)')` の全変数設定・スコープの初期設定・冪等な生成が必須項目として挙がっている
3. **最小セット・命名規則で設計書 4.3.4 を書き換えるか** — 命名は値を名前に入れない（色・書体は役割名、余白・角丸・文字サイズは段階名）。「4の倍数」は名前ではなく値のルールとして扱い、検証で値を見る。1・2の結論で内容が変わるため最後に決める
4. **Color Style の位置づけ** — 現行設計書は非推奨・除外通知だが、グラデーションと複数 fill は Variables で表現できないため、使っただけで除外通知が出る。Paint / Effect / Text Style を正式な源泉に戻すなら、G-3・U-1 で作った「Color Style 使用」の検出を「Variables を束ねずに直接値を持つ Color Style」の検出に作り直す必要がある
5. **tokens.json でのエイリアス表現** — 設計書の「エイリアスは解決済みの値に展開する」をやめ、Semantic → Primitives の参照を残すか。残すなら DTCG のエイリアス構文をそのまま使うか独自形式か
6. **tokens.json での3コレクションの出し方** — 現行の E-2 はコレクション構造をそのまま JSON の階層にするため、素直に作ると `Light/` `Dark/` `Base/` の3グループが出る。CC に渡す形として `bg` に light/dark 両方の値を持たせるかを決める

### 要検証

* Figma Free で `figma.variables.createVariableCollection()` を2回叩いて2つ目が通ること。**この設計全体の前提**だが、現状は「ヘルプ・プラン比較表・Plugin API のいずれにもコレクション数の制限が書かれていない」という消極的な裏取りに留まる
* Variable に `scopes: []` を設定するとピッカーから消え、かつ Plugin API からのバインドは通ること

### タスク定義の状態

Ph-9 は「設計書を最新化 → 実装 → 試行」の**設計書を最新化する段**にある。未決は下の D-0〜D-4 で潰し、実装タスクはそれが終わってから定義する（内容が変わるため）。

**Ph-8 との優先順位（2026-09-20 決着）: Ph-9 の未決決めを先にやる。** Ph-9 はチェック体系そのものを作り直すため、Ph-8 の残り（U-2 の実装・U-3・U-5）を先に磨くと捨てることになりうる。Ph-8 の残りタスクは Ph-9 の設計が確定してから定義し直す。U-2 は設計書ステップ（N-6〜N-8）まで完了して中断中。

---

### D-0: Ph-9 の前提2件を Figma 実機で検証する

**目的**: ダーク対応の設計全体が立つかどうかを決める2件を、実機で白黒つける。どちらも私の環境からは確認できない。

**前提**: なし（Ph-9 で最初に潰す。ここが崩れると D-1 以降の前提が変わる）

**作業内容**:
- [x] Figma Free のファイルで `figma.variables.createVariableCollection()` を2回叩き、2つ目が通ることを確認する。**この設計全体の前提**。現状の裏取りは「ヘルプ・プラン比較表・Plugin API のいずれにもコレクション数の制限が書かれていない」という消極的なものに留まる
- [x] Variable に `scopes: []` を設定したとき、(a) デザイナーのピッカーから消えること、(b) それでも Plugin API からのバインドは通ることを確認する
- [x] 結果を本節に記録する。**2つ目のコレクションが作れない場合は「1フレーム＋トグル」方式そのものが成立しない**ので、その場でユーザーにエスカレーションして方式を決め直す

**完了条件**:
- 上記2件それぞれについて、実機で確認した結果（通った／通らない、および通らない場合の挙動）が本節に記録されていること
- コレクションを2つ作れない場合、代替方式の検討がユーザーとの間で開始されていること

**結果**:
- コレクション2件目の作成: **OK**（Figma Free で実機確認済み、2026-09-20。`figma.variables.createVariableCollection()` を2回実行し両方成功）
- `scopes: []` の挙動: `@figma/plugin-typings` の `Variable.scopes` の doc comment で確定済み（実機確認不要）。「(a) ピッカーから消える」「(b) Plugin API からのバインドは通る」の両方が公式ドキュメントで明記されている
- 結論: 「1フレーム＋トグル」方式（3コレクション: Light/Dark/Base）は成立する。D-1 以降に進める

---

### D-1: 未決1〜3を決めて設計書に反映する

**目的**: トークンの源泉と命名規則を確定させ、`docs/design.md` 4.3.4 を書き換える。1→2→3 の順で決める（後ろが前の結論に依存する）。

**前提**: D-0 完了

**作業内容**:
- [x] 未決1 **タイポグラフィの源泉** を決める — Text Style のままにするか、String（フォントファミリー）+ Number（サイズ・太さ・行送り・字間）の Variables に寄せるか。現行実装（G-2）は Text Style から `typographyToken` を拾っている。この結論に「String Variable を拾う」案とプリセット生成の Text Style 生成有無が依存する
  - **結論: Text Style のまま（現行どおり）。** 根拠は2つ。(1) タイポグラフィの値はライト/ダークで変わらない。Variables の存在理由（モードで値を切り替える）が適用対象にならない。(2) Figma の設計上の定石として、Variables は単一値（色・数値・文字列・真偽値を1つ）をモードで切り替えるためのもの、Style は複数プロパティを束ねた複合的な見た目を1つの名前に固定するためのもの。タイポグラフィ（フォント・サイズ・太さ・行間・字間の複合）は Style 側の役割であり、Variables に分解すると一部だけ設定漏れという不整合が起きやすく、CC への出力精度（最優先事項）を損なう。申し送りの「String Variable を拾う」案はブランド／ロケールでのフォント切替を想定したものと見られ、Ph-9（ダークモード）の目的の外にある
- [ ] 未決2 **プリセット生成モードを新設するか** を決める — 検証・書き出しに並ぶ3機能目。押すとコレクション・変数・Text Style・Effect Style を一式作る。最小セット案は変数25＋スタイル8＝33個。`setVariableCodeSyntax('WEB', 'var(--space-md)')` の全変数設定・スコープの初期設定・冪等な生成が必須項目
- [ ] 未決3 **最小セット・命名規則で設計書 4.3.4 を書き換える** — 命名は値を名前に入れない（色・書体は役割名、余白・角丸・文字サイズは段階名）。「4の倍数」は名前ではなく値のルールとして扱い、検証で値を見る。段階名にする根拠は2つ: (a) ダークとライトで値が変わっても名前が変わらない／16px を 20px に変えても名前が嘘にならない、(b) Tailwind の `p-4` は 16px（0.25rem 刻み）なので `space-16` と名付けると Tailwind 側の数字と食い違う。段階名なら衝突しない
  - **最小セット案（申し送り、33個）**: 色8 = bg / surface / border / text / text-muted / primary / primary-hover / on-primary、余白6 = space-xs / sm / md / lg / xl / 2xl、角丸3 = radius-sm / md / lg、書体2 = font-sans / font-mono、文字サイズ6 = size-display / h1 / h2 / h3 / body / small、Text Style 6 = display / heading-lg / heading-md / heading-sm / body / caption（中身は上の変数を指す）、Effect Style 2 = shadow-sm / shadow-md。変数25＋スタイル8
  - **任意セット（押したら足せる）**: 状態色8（success / warning / error / info × 背景と文字）、radius-full、shadow-lg、Text Style の lead / label
  - **Primitives 層を作らない根拠**: Figma 公式の規模目安は「50未満＝1コレクション、Light/Dark のモードのみ」「50〜200＝Primitives と Semantic を分ける」「200以上＝Semantic 複数・モード4〜8」。LP/HP は一番上の帯なので、意味のある名前の変数だけ並べる。現行 4.3.4 の推奨体系38個のうち状態色8個は LP/HP でほぼ使わないので任意へ。text-tertiary / secondary も落とす
  - ただし D-0 の結論（3コレクション方式）と整合させること。申し送りは Free で Variable Modes が使えない前提で書かれており、「Light/Dark のモードのみ」の部分は本ステアリングの「確定: ダーク対応」で3コレクションに置き換わっている
- [ ] 決まった内容を `docs/design.md` に反映する

**完了条件**:
- 未決1〜3それぞれに結論と根拠が記録され、`docs/design.md` 4.3.4 が新しい源泉・最小セット・命名規則で書き換えられていること
- 現行実装（G-2 の Text Style 由来 `typographyToken`）との差分が、実装タスクとして起こせる粒度で書かれていること

---

### D-2: 未決4〜6を決めて設計書に反映する

**目的**: Color Style の位置づけと `tokens.json` の出力形を確定させる。

**前提**: D-1 完了（源泉の結論に依存する）

**作業内容**:
- [ ] 未決4 **Color Style の位置づけ** — 現行設計書は非推奨・除外通知だが、グラデーションと複数 fill は Variables で表現できないため、使っただけで除外通知が出る。Paint / Effect / Text Style を正式な源泉に戻すなら、G-3・U-1 で作った「Color Style 使用」の検出を「Variables を束ねずに直接値を持つ Color Style」の検出に作り直す必要がある
- [ ] 未決5 **tokens.json でのエイリアス表現** — 設計書の「エイリアスは解決済みの値に展開する」をやめ、Semantic → Primitives の参照を残すか。残すなら DTCG のエイリアス構文をそのまま使うか独自形式か
- [ ] 未決6 **tokens.json での3コレクションの出し方** — 現行の E-2 はコレクション構造をそのまま JSON の階層にするため、素直に作ると `Light/` `Dark/` `Base/` の3グループが出る。CC に渡す形として `bg` に light/dark 両方の値を持たせるかを決める
- [ ] 決まった内容を `docs/design.md` に反映する

**完了条件**:
- 未決4〜6それぞれに結論と根拠が記録され、設計書に反映されていること
- `tokens.json` の出力例（3コレクション・エイリアス込み）が設計書に載っており、CC がそれを読んで `:root` と `[data-theme="dark"]` を機械的に作れる形になっていること

---

### D-3: 確定済みのダーク対応とチェック体系を設計書に反映する

**目的**: 2026-09-19〜20 に確定した方針（「1フレーム＋トグル」方式・3コレクション、チェック体系の原則3つ）は本ステアリングにしかない。設計書に移す。

**前提**: D-2 完了

**作業内容**:
- [ ] 「1フレーム＋トグル」方式と3コレクション構成（Light / Dark / Base、変数名にテーマを入れない、対を持つのは色だけ、`scopes: []` による誤操作防止）を設計書に記載する
- [ ] チェック体系の原則3つを設計書に記載する — 原則1（error はデザイナーが選んだやり方に対する整合性だけを見る／Dark コレクションの有無が判定軸）、原則2（Review の1行 = 1判断。原因単位で集約する）、原則3（Review は行為の前に自動で走るゲート。結果は必ず Review タブに出す）
- [ ] 原則1 の表に **Effect Style の影の色が Variables を指しているか** の行を足すか決める。申し送りの改善案1は「Text Style の font-size が生数値なら警告、Effect Style の影の色も同様」と両方を挙げているが、現行の表は Text Style と padding/gap しか持っていない。影の色はテーマで変わりうる（ダーク対応ファイルなら出力が壊れる側）ので、色が変数にバインドされていない件と同じ扱いになるはず。D-2 の未決4（Effect Style を正式な源泉にするか）の結論に依存する
- [ ] 書き出し手順（light 撮影 → 付け替え → dark 撮影 → light に戻す。失敗時にも必ず戻す）を設計書に記載する
- [ ] 「起動時に dark のまま残っている」の扱い（error ではなく復旧の促し）を記載する

**完了条件**:
- 上記4点が `docs/design.md` に記載され、ステアリングの「確定:」2節が設計書を指すだけの状態になっていること
- チェック体系の各チェックについて、ダーク対応ファイル／ライトのみファイルでの発火有無が表として設計書にあること

---

### D-4: Ph-9 の設計レビュー（実装前）

**目的**: 設計書の文面そのものを対象に設計レビューを1回かける。実装後ではなく実装前に当てる（作業ルール「レビューの配置」）。

**前提**: D-3 完了

**作業内容**:
- [ ] Design エキスパートレビュー（subagent）— D-1〜D-3 で書き換えた設計書の該当節を対象に、内部矛盾・未処理の帰結・既存節との不整合を洗う。**U-2 では 4.7.3 の追記自体が自己矛盾していた（「現在のページの全レイヤー」vs「更新は起動時と保存時だけ」）のを実装後に発見しており、同じ取りこぼしを防ぐのがこのタスクの主目的**
- [ ] 指摘を triage し、設計書に反映する
- [ ] Ph-9 の実装タスクを定義する（ここで初めて定義できる）

**完了条件**:
- 設計レビューの指摘がすべて triage され、Valid の分が設計書に反映されていること
- Ph-9 の実装タスクが、作業内容と完了条件つきでステアリングに定義されていること

---

State
-----

（`/rn:dn` が書き、`/rn:up` が読んでこのプレースホルダに戻す。`Status` は中断中のみ `paused`。）

* **Status**:
* **Date**:
* **Last completed**:
* **Next**:
* **Notes**:

---

現在の状態（2026-09-16時点）
-----

* **ブランチ**: `worktree-figma-plugins`
* **PR**: https://github.com/lovaizu/telldes/pull/1
* **次タスク**: ① Figma 実機で Export 再試行（`TextEncoder` 修正 `27ae8ce` の確認。まだ落ちる場合は `dist/code.js` をサンドボックス非対応グローバルで走査する手順を最初に当てる。ついでに U-2 N-9 と Ph-9 D-0 も見てもらえると片付く）→ ② U-2 の残り（N-6〜N-8 の設計書 → N-1〜N-5・N-10〜N-12 の実装 → N-9 の実機）→ U-3 → U-5 → U-7（テストを GWT に揃える）→ U-8（Solid 2.0 RC へ更新、ユーザー確認のうえ）→ U-6（Ph-8 完成時の3軸レビュー）。その後 Ph-9（D-0 の実機検証から）。T-1 は Ph-8 完了後
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
  - U-1: Variables 提案チェックの削除と源泉・範囲告知の README 移設 ✅
  - U-4: U-1 持ち越し指摘の解消 ✅（修正ラウンド3回＝上限を使い切り、4軸 pass。新規指摘 R3-A〜R3-H は U-5 へ）
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
