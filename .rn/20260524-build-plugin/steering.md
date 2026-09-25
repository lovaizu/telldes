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
| Ph-10 | 状態8種（hover / focus / disabled 等）の受け口 | Ph-9 完了 | 描かれた状態バリアントが `spec.json` に出て、CC が推測せずに実装できること |

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

→ **設計書 4.3.9**（変数構成・複製方式を採らない理由・代償・`scopes: []`）、**4.7.4.4**（書き出し手順）、**4.10**（Free の制約との対応）。D-3 で反映済み。

ここに残すのはセッション上の経緯だけ。

* 発端は別セッション（ccpm/webplan）からの申し送り（2026-09-19）。ダークモード対応が必須要件だと確認されたことで、トークンの源泉の見直しがチェック体系そのものの再設計に波及した
* プラン制限の内訳（Starter はモードを作れない／Professional 10／Organization 20）は設計書には書いていない。設計書が持つのは「コレクション数に制限は無い」という結論だけでよいため
* トグル方式の代償のうち「キャンバス上で light/dark を並べて比較できない」件は、必要になれば複製生成を**レビュー用の使い捨て**として後から足せる（恒久管理しないのでドリフトは起きない）。現時点では要らないので設計書に書いていない

### 確定: チェックは体系として設計する（2026-09-20）

→ **設計書 4.7.2**（原則3つ・発火の表・ゲートの表・起動時 dark の扱い）。D-3 で反映済み。

ここに残すのはセッション上の経緯だけ。

* **判定軸の訂正（2026-09-21）**: 当初は「Dark コレクションの有無」を判定軸にしていたが、D-1 未決2 で Setup が3コレクションを一式生成すると決めたため、Setup を実行した全ファイルに Dark コレクションが入る。有無では判定できず、ダーク対応が不要なファイルでテーマ整合 error が出続ける。ユーザー指摘で発覚（この矛盾を抱えたまま設計書に書き写す寸前だった）。判定軸を Export 設定の明示的な宣言に移した
* 原則2 の集約は、U-1 で削除した `variableChecks.ts` が持っていた形（同じ色が3箇所以上、等）と同じ。**位置づけ（提案）が誤りだっただけで集約の形自体は正しかった**ので作り直す
* 原則3 が直すのは現行実装の欠陥。Export 時に全チェックは既に走っている（`src/code.ts`）が、UI に戻るのは `"N error(s) must be fixed before export"` という件数だけで場所を教えていない

### 確定: 判断は原則から導く（2026-09-21）

未決を1件ずつ個別に決めていくと判断の一貫性が担保されない、というユーザー指摘で置いた2つの原則。**以降の未決はこの原則から結論を導き、結論と根拠を並べて提示する。**設計書 4.3 と 4.5 の冒頭に移す（D-4 の作業内容）。

**原則A — Figma の制作ルール**: Figma 公式のベストプラクティスをそのまま土台にし、telldes 固有の約束は「公式の作法では表せないこと」だけに限って足す。根拠 — デザイナーは telldes のために新しい作法を覚えるのではなく、普段の作法のまま精度が上がるべき。独自の約束が増えるほど守られず忘れられる。

**原則B — 出力（CC が読むもの）**: LLM が迷わない形にする。「LLM なら推測できる」で済ませない。推測が要る時点で出力の設計が足りていない。

| | 意味 |
|---|---|
| 形が揃っている | 同じ種類のものは同じ構造で出る。特別扱いを作らない |
| 1箇所にだけある | 同じ事実を2箇所に書かない。片方だけ古くなる形を作らない |
| 欠けていると分かる | 黙って落とさない。落としたなら落としたと書く |
| 推測させない | 宣言されていないことは出力に存在しない。値から意図を当てにいかない |

既存の確定はこの原則と矛盾しない（`tokens.json` の light/dark ペア＝形が揃っている、`radius/full` の宣言と 4.9 の「描かれていない幅は推測しない」＝推測させない、設定4群の権威記述を1箇所に置く＝1箇所にだけある）。

### 確定: Export は実装への依頼書（2026-09-21）

→ **設計書 4.7.4.1**（依頼書5要素・切り分けの基準）、**4.7.4.2**（設定4群・専用欄と共通ルールの線引き）、**4.7.4.3**（保存先とタブの並び）、**4.5.2.1 settings**（JSON 上の形）、**4.8.1**（CC の読み方）、**4.5.3**（favicon / OG 画像）、**4.9**（レスポンシブ設定が解く問題）、**4.3.6**（角丸 `full`）。D-3 で反映済み。

ここに残すのは調査の出典と、設計書に落とさなかった素材だけ。

#### 調査の出典（2026-09-21、Web 検索）

* ブレークポイントは「デバイス一覧を写す」のではなくレイアウトが崩れた幅に置く。mobile-first の `min-width` で書く。フレーム幅とブレークポイント値は一致させない（1440px デザインは 1024〜1280px から適用するのが標準）
* コンテナクエリが 2025-08 から Baseline（92.6%）。ページ全体はメディアクエリ、コンポーネント内部はコンテナクエリ、という住み分け
* Figma Dev Mode が自動で拾うのは余白・タイポグラフィ・色・コンポーネントのプロパティ。**拾えない＝デザイナーが書くしかない**のはインタラクションの挙動・条件表示のロジック・アニメーションの仕様・コンテンツのルール
* ハンドオフで最も抜けやすいのは**状態8種**（default / hover / focus / active / disabled / loading / empty / error）。説明ではなく描くもの
* モーションは形容詞でなく値で（変化するプロパティ / duration(ms) / easing / トリガーの4点）
* `<head>` を読む相手が増えている（8つの SNS・4つのメッセージアプリ・AI クローラーが OG を構造化データの代わりに読む）。favicon は SVG / ICO / apple-touch-icon 180×180 の3点、OG 画像は 1200×630

### 未決（この順に決める）

未決1〜6（源泉・プリセット・命名・Color Style・エイリアス・3コレクション）は D-1 / D-2 で全件決着し `docs/design.md` に反映済み。以下は 2026-09-21 の Export 設定の設計と D-3 の実装で新たに出たもの。**決着は D-4 で1件ずつ出す。**

1. ~~**Notes タブの一覧を残すか、Export に一本化するか**~~ → **決着（2026-09-21）: 両方に置く。ただし中身を別物にする。** Notes タブ＝ページ全体・編集用（4.7.3 のまま）。Export タブ＝書き出し対象範囲だけ・読み取り専用（4.7.4.3 のまま）
   - **根拠（原則B「欠けていると分かる」）**: Export タブの一覧をページ全体にすると、`spec.json` に載らない note（対象外レイヤーに付いたもの）まで「これから渡すもの」として並ぶ。4.7.2 の除外物告知が塞いだ黙殺を UI 側で作り直すことになる
   - **未決13 と揃う**: Review も書き出し対象フレーム配下だけを見る。Export タブの一覧も同じ範囲で、`isExportedFrame` を共有する
   - **原則B「1箇所にだけある」には触れない**: 事実が2つある（書いた全部 / 渡る分）ので重複ではない。二重実装を避けるため、行の組み立ては**走査範囲を引数に取る1つの純関数**にして両者が同じコードを通るようにする
   - **原則A**: 編集を Export タブに寄せると note を直すのに「これから渡す確認画面」を開くことになり、4.7.4.3 が置いた「確かめる場所」と「編集する場所」の分担が崩れる
   - **U-2 への影響**: 残タスク（N-1〜N-5・N-10〜N-12）は前提が変わらず、そのまま生きる。Export 側の一覧は Ph-9 の実装タスク (d) に含める
   - **2026-09-21 追記: この結論は D-5 で再検討する。** 「Notes タブ」「Export タブ」という器そのものが D-5 で無くなりうるため。走査範囲を分ける判断（編集用＝ページ全体／渡す分＝書き出し対象）は器によらず生きるが、**置き場所の結論は保留**
2. ~~**状態8種（default / hover / focus / active / disabled / loading / empty / error）の受け口を Ph-9 に入れるか**~~ → **決着（2026-09-21）: Ph-9 には入れない。Ph-10 として独立させる**（下の Ph-10 節に起票済み）
   - **受け口が要ること自体は原則B「推測させない」から確定**: hover / focus / disabled 等がどこにも宣言されていない以上、CC は推測で作る。これは出力の設計不足
   - **ただし今もゼロではない**: 4.7.4.2 の共通ルールが「状態の方針」を受けると既に書いてある。文章では届く
   - **Ph-9 に混ぜない理由**: 本式にやると「バリアントで描く → telldes がバリアント一式を `spec.json` に出す」形になり、スキーマ変更＋Review チェック＋README 制作ルール追加という Ph-9 と同規模の仕事になる。Ph-9 はダーク対応とチェック体系だけで実装タスク6群を抱えており、混ぜると両方終わらない
   - **原則A**: 状態はバリアント（Figma 公式の作法）で表せるので telldes 固有の印は足さない。Ph-10 でも「画面でないものは別ページへ」（未決10）の上に乗る
3. ~~**Setup が生成するトークンは32個か、Dark の8色を足した40個か**~~（D-3 で発覚）→ **決着（2026-09-21）: Dark の8色も一緒に作る。合計40個 ＝ 変数32個 ＋ Style 8個。**
   - 内訳: Color Light 8 / Color Dark 8 / Spacing 8 / Radius 5 / Font-family 3（＝変数32）＋ Text Style 6 / Effect Style 2（＝Style 8）。**未決5 で Text Style が8個になったので、最終的な合計は 変数32 ＋ Style 10 ＝ 42個**
   - **根拠**: ダーク用は `scopes: []` でカラーピッカーから隠れる（4.3.9）ので、ダークを使わない人のファイルでも邪魔にならない。ダークを始めるときは Export 設定を ON にして色を入れるだけで済み、作られるタイミングが1つで済む。4.7.2 原則1 の判定軸の訂正（Setup を実行した全ファイルに Dark がある）の根拠もこれで実在する
   - **あわせて直す数の食い違い**: Setup 完了時メッセージ（D-1 未決2）の `Created 25 variables and 8 styles` は誤り。正しくは **32 variables and 8 styles**
   - **あわせて直す 4.3.9 の Base 行**（レビュー #12 の未決に無かった分）: 現在「余白・角丸・書体・文字サイズ」だが、**文字サイズは Text Style であって変数ではない**（D-1 未決1）ので Base には入らない。書体は STRING 変数で、扱いは未決4 の結論に従う
4. ~~**Font family（Variables STRING、3）を除外物告知から外すか**~~（D-3 で発覚）→ **決着（2026-09-21）: 書体も `tokens.json` に出す**（`$type: "fontFamily"`）。除外物告知から外れる
   - **根拠（原則B「形が揃っている」）**: 色・余白・角丸・文字サイズ・影はどれも「値＋`*Token`」で出て CC は `var(--…)` で書けるのに、書体だけ生の文字列になる。これは揃いを崩す特別扱い。telldes が自分で作ったものを自分で「拾えませんでした」と報告する形にもなっていた
   - **根拠（原則A）**: Figma 公式は String Variable の適用先に fontFamily を挙げており、W3C DTCG にも `fontFamily` 型がある。公式の作法どおり
   - デザイナーが独自に作った STRING/BOOLEAN Variable のうち、BOOLEAN と fontFamily 以外の String は引き続き対象外・除外物告知の対象。4.3.4 の源泉表と 4.7.2 の告知リストを書き換える
5. ~~**Typography の段階は6個か8個か**~~（D-3 で発覚）→ **決着（2026-09-21）: 8個。** `display` / `heading-lg` / `heading-md` / `heading-sm` / `lead` / `body` / `label` / `caption`。4.3.4 を6個から8個に直す（4.5.1 が既に8個なので、そちらが正しかった）
   - **根拠**: D-1 の実データ検証で、実際の LP の 18 / 20px が段階から外れていた。`lead`（本文より少し大きい導入文）がそこを受ける。`label`（フォーム・ボタンの文字）は Web でほぼ必ず出る
   - **数の再計算**: Text Style が 6 → 8 になるので、未決3 で決めた合計は **変数32個 ＋ Style 10個 ＝ 42個**。Setup 完了時メッセージは `Created 32 variables and 10 styles` にする

以下は D-4 の設計レビューで出たもの。**未決7 が最も重く、他の前提になる。**

7. ~~**テーマ付け替えは何を対象にするのか**~~（レビュー #2 / #3 / #8）→ **決着（2026-09-21）**
   - **結論A: 暗くなるのはページ全体**（選択フレームだけではない）。根拠は目的側 — ダークはサイト全体にかかる振る舞いであり、フレームごとに明暗が混在する状態は実物に無い。書き出しは全フレームを撮る（4.7.4）ので、ページ全体を揃えて初めて `screenshots-dark/` が全フレーム分そろう。ファイル単位の状態フラグ（4.3.9）とも粒度が一致する。4.3.9 の「選択フレーム配下のバインドを差し替え」を書き換える
   - **結論B: 影とグラデーションの色もダークで変わる。** 根拠 — 明るい背景用の影は暗い背景では見えず、グラデーションは浮く。変わらないと `screenshots-dark/` が実物と食い違い、出力の正確性が崩れる。また 4.7.2 が「影の色を変数に」と要求しておきながら反映しないのは、デザイナーにとって最悪の体験（言われたとおりにしても直らない）
   - **実現手段（こちらの判断。ユーザー指示: 手段は任せる）**: 付け替え対象を「ページ上の全書き出し対象フレーム配下のノード」＋「ファイル共有の `PaintStyle` / `EffectStyle` オブジェクト自体」の2つにする。スタイルはファイル全体で共有されるので、ファイル単位の状態とだけ整合する。グラデーションと影は `ColorStop.boundVariables` が `readonly`・`setBoundVariableForPaint` が `SolidPaint` のみのため、Paint / Effect の配列を作り直して再代入する
   - **併せて決まること**: レビュー #8（グラデーション stop 未バインドの扱いが影と非対称）は影と同じ扱いに揃える — ダークモード対応 ON のとき、グラデーション stop の色の未バインドも error。4.3.4 の「されていなければ解決済みの値をそのまま出力する」に ON/OFF の条件を付ける
8. ~~**Export 開始時が dark だったらどうするか**~~（レビュー #1）→ **決着（2026-09-21）: Export の先頭で自動的に light に戻してから撮る。** 書き出し後は light のまま残し、押す前のダーク表示には戻さない。根拠 — Export はどうせ手順の中でライト⇄ダークを行き来するので、先頭で戻すのは同じ動作の延長であり、デザイナーに手間を課す理由がない。error にしてゲートで止めるのは、直すべき違反ではなく単なる状態に対して「直してから来い」と言うことになり、4.7.2 が「起動時に dark のまま残っている」を error にしなかったのと同じ理由で合わない。4.7.4.4 の手順の先頭に1ステップ足す形で書く
9. ~~**発火表が README に送っている3項目をどうするか**~~（レビュー #4）→ **決着（2026-09-21）: 「付け忘れ」だけ知らせる。**
    - 表の3行（色の未バインド OFF時 / font-size 生数値 / padding・gap 生数値）は**落とす**。生値でも spec.json には実値が入り CC は正しく作れる。4.7.2 が定義する除外物（ツールが構造上捨てたもの）ではないし、全部並べると LP 1枚で数十〜数百行になり本当に届かなかった事実が埋もれる（U-1 が削除した提案チェックと同じ形）。「4の倍数」の基準も設計書に定義が無いまま消える
    - 代わりに **「既にあるトークンと同じ値なのに、そのトークンを指していない箇所」だけ**を知らせる。値の照合は機械的にできる。デザイナーにとって明らかな付け忘れだけに絞られ、ノイズが桁違いに減る。**error にはしない**（直さなくても出力は正しい）
    - **telldes が自動で置き換えることはしない。** 4.3.4 の「telldes は値をどのスロットに割り当てるかを自動判定しない」を守る。値が一致しても、デザイナーがそのトークンを意図したとは限らない
    - **置き場所は Export タブ（プラグイン UI）。zip の README ではない。** 根拠は 4.7.4.1 の切り分け — 付け忘れを直すのはデザインの判断であり、telldes が Figma 上で受けるもの。zip を開くのは CC で、デザイナーには届かない。Export タブは「今から何を渡すか」を確かめる場所（4.7.4.3）なので、note 一覧と同じ並びに置く
10. ~~**favicon / OG 画像に指定したフレームを書き出し対象から外すか**~~（レビュー #5）→ **決着（2026-09-21）: 画面でないものは別ページに置いてもらう。** 未決13 から併合した「部品置き場の見分け」も同じ結論で解く
    - **対象**: 部品置き場（コンポーネント定義とそれをまとめたフレーム）、favicon 用フレーム、OG 画像用フレーム。これらは画面を置くページとは別の Figma ページに置く。telldes は現在のページだけを見るので、ルールを守れば自然に外れる。**telldes 側に新しい約束（印・除外リスト）を増やさずに済む**
    - **根拠**: Figma 公式のベストプラクティスがそもそも「ページとフレームを入れ物にしてコンポーネントを整理する」を推奨しており（`file > page > frame` の階層がそのまま Assets パネルの並びになる）、デザイナーにとって新しい作法ではない。出典: [Components, styles, and shared library best practices](https://www.figma.com/best-practices/components-styles-and-shared-libraries/) / [Name and organize components](https://help.figma.com/hc/en-us/articles/360038663994-Name-and-organize-components)（2026-09-21 確認）
    - **Free の制約を 4.10 に追記する**: Starter **チーム**のファイルは**1ファイル3ページまで**、**Drafts は無制限**（ただし共同編集不可）。出典: [Starter plan overview](https://help.figma.com/hc/en-us/articles/13838684089751-Starter-plan-overview)。現行 4.10 は「デザインファイル3つまで → 1ファイル内でページ分割」で LP/HP 数を稼ぐ前提だが、チームだと画面ページを分けた時点で部品ページの余地が無い。**Free で成立するのは実質 Drafts 運用のとき**、という条件を明記する
    - **実装上の確認済み事項**: `manifest.json` に `documentAccess: "dynamic-page"` が無いため全ページに同期アクセスできる。別ページに置いた favicon / OG フレームを設定のピッカーに出すのに `loadAllPagesAsync` は要らない
    - README の制作ルールに「画面でないものは別ページへ」を追記する（実装タスク）
11. ~~**ダーク用の `assets/` を出すか**~~（レビュー #6）→ **決着（2026-09-21）: ダーク用も書き出す。** 根拠 — 色を抜いて CSS に塗らせる案は telldes がデザイナーの描いた色を捨てる変換であり、4.3.4 の「ツールが無視・変換するものは必ず告知する」姿勢に反するうえ、多色ロゴには使えない。「変えない前提」は、影とグラデーションを変えると決めた未決7 と揃わない
    - **実現手段（こちらの判断）**: ライトとダークで見た目が実際に変わるアセットだけ2枚目を出す。全アセットを機械的に倍にすると、色を持たない線画まで同一ファイルが2つ並び、CC が「別物が2つある」と誤読する余地を作る。出力先は `screenshots-dark/` と揃えて `assets-dark/`（`images/` `icons/` の内訳は同じ）
12. ~~**`radius/full` の名前を守る仕組みを置くか**~~（レビュー #9）→ **決着（2026-09-21）: 名前のまま。効いていないときに知らせる。**
    - `radius/full` へのバインドを「常に丸める」の宣言として読むのは変えない（4.3.6）
    - 加えて、**丸い形（角丸が短辺の半分に達している）なのに `radius/full` を指していない箇所**を Export タブで知らせる。未決9 で決めた「トークンの付け忘れ」と同じ場所・同じ性質（error にしない。直さなくても出力は正しく、px 値のまま出るだけ）
    - **根拠**: 名前で宣言させる形自体は、デザイナーが Figma の中だけで完結できて手間が最小。壊れ方は「改名すると黙って効かなくなる」という点だけなので、黙らせなければよい。4.3.4 の「ツールが無視・変換するものは必ず利用者に告知する」姿勢とも揃う
    - 4.3.4 の「命名規約は自由」と 4.3.6 の「この名前だけは意味を持つ」の関係を設計書に明記する（自由だが、この名前を外すと宣言が効かなくなること、そのとき知らせること）
13. ~~**Review の走査範囲を書き出し対象フレーム配下に絞るか**~~（レビュー #11）→ **決着（2026-09-21）: 書き出されるものだけを見る。** 根拠 — 原則1 の判定軸は「出力が壊れるか」。zip に入らないものが壊れていても出力は壊れない。渡さないものを直さないと渡せない、という状態はゲートの趣旨と逆
    - 4.7.2 冒頭の「ページ内の全ノードを走査して」を書き出し対象の範囲に書き換える。Review が書き出しと**同じ関数**（`src/export/exportScope.ts` の `isExportedFrame`）を使えば定義上ズレない。除外物告知は既に同じ範囲に絞ってあるので、両者がここで揃う
    - 関連: `isExportedFrame` が `specBuilder.ts` に独立して二重定義されている件は U-5 に起票済み。片方だけ直すと Review・spec・zip フォルダの対象が黙ってズレるので、Ph-9 の実装より先か同時に潰す
    - **当初「見分け方は既に決まっている（ページ直下の `FRAME` / `SECTION`）」と書いたのは誤り。** ユーザー指摘で発覚 — 部品を**まとめたフレーム**をページ直下に置くと種類は `FRAME` なので画面と区別がつかない（D-1 の実データ検証に使ったファイルがまさに `top` / `components` の2フレーム構成で、`components` が1ページとして書き出されていた）。区別できるのは部品を**単体の** `COMPONENT` / `COMPONENT_SET` として裸で置いた場合だけ。見分けの決着は未決10 に併合した

#### D-3 で実装者が決めた点（D-4 で承認または差し替える）

ステアリングに無く、設計書を書く上で決めざるを得なかったもの。すでに `docs/design.md` に入っているので、D-4 で1件ずつ承認か差し替えかを決める。

1. dark スクリーンショットの出力先を `screenshots-dark/`（light と同名で並べ、先頭フォルダの差し替えで導ける形）
2. favicon / OG 画像の置き場所を zip ルートの `site/`。設定の有無に関わらずフォルダ名を予約する（予約を設定に依存させると、favicon の指定を外しただけでフレームのフォルダ名が変わるため）
3. `spec.json` の `settings` のキー名・フィールド名（`responsive` / `darkMode` / `site` / `rules`、`minWidth` / `frame` / `contentWidth` 等）と、全フレームの spec.json に同じ `settings` を載せること → **2026-09-22: キー名・フィールド名は承認、置き場所は差し替え。zip ルートの `settings.json` に1つだけ置く（設計書 4.5.4）**
4. `settings.rules`（全体）と note（個別）が食い違ったら note を採る
5. テーマの現在状態も `figma.root.setPluginData` に持つ（起動時の復旧の促しが成立するために必要）
6. 4.7.1 を4タブ（Setup 追加）に更新。D-1 の結論だが設計書に未反映だった
7. 4.3.4 に Effect Style のフィールド単位 Variable バインドの段落を追加。D-2 未決4 の結論のうち Effect Style 分が設計書に未反映で、原則1の表からの参照先が実在しなかった
8. 4.7.2 除外物告知の「Color Style を使用」を「単色の Color Style」に限定（D-2 の結論との矛盾解消）

### 要検証

すべて D-4 で割り当て先を決めた（2026-09-21）。

* **Figma が短辺の半分を超える radius をどう扱うか**（クランプして描くか、値を保持するか）。Setup が生成する `radius/full` の Variable 値を `9999` にできるかがこれに依存する → **W-1**
* **新規 Variable の `scopes` の既定値が `["ALL_SCOPES"]` か**（D-4 の修正ラウンドで発覚）。書体 Variable の判別（設計書 4.3.4）が「`FONT_FAMILY` を含み `ALL_SCOPES` を含まない」という規則になり、この既定値に読み方が依存する。`@figma/plugin-typings` の `Variable.scopes` の doc comment には既定値の記載が無い。**規則の正しさ自体は既定値によらず成り立つ**（明示的に絞ったものだけを拾うため）が、デザイナーが自作した書体変数がどれだけ拾われるかがこれで決まる → **W-1**
* **ICO の生成手段**（D-3 で発覚）。Plugin API の書き出し形式は PNG / JPG / SVG / PDF のみで ICO が無い（`ExportSettings` を確認済み）。設計書 4.5.3 は「PNG を ICO コンテナに収める」とだけ書いており、**判断事項ではなく実装手段**（ICO のヘッダは自前で組める）→ **実装タスク (e)（favicon / OG 書き出し）の中で決める**
* ~~**テーマ切り替えトグルの UI 配置**~~ → D-4 で決着（下の D-4 の作業内容を参照）

---

### W-1: Ph-9 の実装前提2件を Figma 実機で検証する

**目的**: 設計書 4.3.4 / 4.3.6 の記述が実機の挙動と合うかを、Setup の実装に入る前に白黒つける。どちらも私の環境からは確認できない。

**前提**: D-4 完了

**作業内容**:
- [x] `radius/full` の Variable 値を `9999` にして、短辺がそれより小さい矩形にバインドする。Figma がクランプして丸く描くか、描画が壊れるかを確認する。壊れる場合は Setup が生成する `radius/full` の値を決め直す（設計書 4.3.4 の生成値に反映）
- [x] STRING Variable を Figma の変数パネルで新規作成し、`scopes` の既定値を Plugin API で読む。`["ALL_SCOPES"]` かどうかを確認する
- [x] 結果を本節に記録する。設計書の記述と食い違う場合はその場でユーザーにエスカレーションする

**完了条件**:
- 2件それぞれについて、実機で確認した結果が本節に記録されていること
- 設計書 4.3.4 の `radius/full` の生成値と書体判別の記述が、実機の結果と矛盾しない状態になっていること

**結果（2026-09-25、ユーザーが Figma 実機で確認）**:
- `radius/full`=9999 を 200×80 の矩形の四隅にバインド → 両端が半円のピルに描かれた（Figma がクランプする）。Setup の生成値は `9999` で確定し、設計書 4.3.4 の推奨トークン体系に `full=9999` と明記した（それまで値が未記載だった）
- 変数パネルで手作りした STRING Variable の `scopes` = `["ALL_SCOPES"]`。プラグインが作った直後も `["ALL_SCOPES"]`。設計書 4.3.4 の「新規作成した Variable は既定で `ALL_SCOPES`」と一致し、書体判別の記述は変更不要
- 検証は Telldes に一時的に組み込んだボタンで行い（コミットせず）、確認後に取り除いた。次から実機での検証は Telldes に組み込む — 利用者はすでに読み込み済みで、別のプラグインを読み込む手間が要らない

### タスク定義の状態

Ph-9 の**設計書を最新化する段は D-5 まで完了**（2026-09-22）。D-0〜D-5 で未決を潰し、D-5 の設計レビュー（判定 fail・22件）を全件反映したうえで、実装タスクを I-1〜I-9 として定義した。残る順は **W-1（完了）→ I-1 → I-2 →（I-3・I-4 は並行可）→ I-5 → I-6 → I-7 → I-8 → I-9**。D-4 と D-5 の4軸レビューはここまでの設計書をまとめて1回で当てる。

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
- [x] 未決2 **プリセット生成モードを新設するか** を決める — 検証・書き出しに並ぶ3機能目。押すとコレクション・変数・Text Style・Effect Style を一式作る。最小セット案は変数25＋スタイル8＝33個。`setVariableCodeSyntax('WEB', 'var(--space-md)')` の全変数設定・スコープの初期設定・冪等な生成が必須項目
  - **結論: 新設する（Yes）。** Figma のチームライブラリ機能（ファイルをまたいでStyle/Variablesを共有する仕組み）は publish が有料プラン（Professional/Organization/Enterprise/Education）専用で、D-0 が前提とする Figma Free では使えない（実機で未検証、Figma Learn ヘルプセンターの記載で確認: Manage and share styles / Publish a library / Guide to variables in Figma）。Free 前提では他にファイルをまたいで揃える手段がなく、揃わないと制作ルールのチェック（Variable束縛前提）が機能せず CC への出力精度も落ちるため、プラグイン自身が生成する必要がある
  - **実装時の制約（ユーザー指示、2026-09-20）**: 生成する33個の定義（変数・Style の名前・値・スコープ・codeSyntax）はコードにハードコードせず、専用の定義ファイル（例: `src/presets/tokenDefinitions.ts`）に持たせる。未決3で確定する最小セットがそのまま定義ファイルの内容になる
  - **UIの名称**: 4つ目のタブ名は **Setup**（既存の Review / Notes / Export と並ぶ英語ラベル。「このファイルにトークン一式を用意する」という一度きりの準備作業であることが一目で伝わる common word）
  - **完了時メッセージ（実装はD-4以降。Review/Notes/Exportの実装に合わせて2026-09-20に先取り確定した「押した結果の benefit + 次にやること」を伝える方針を Setup にも適用）**: `Created 25 variables and 8 styles in this file's Assets panel. Rename or adjust values there anytime.`（できたこと＋次にやること＝Figma純正パネルで編集）。実装時に README.md の用語（変数名・Style名は未決3で確定する最小セット）と整合させ、README にも Setup 節を追記すること
- [x] 未決3 **最小セット・命名規則で設計書 4.3.4 を書き換える** — 命名は値を名前に入れない（色・書体は役割名、余白・角丸・文字サイズは段階名）
  - **実データ検証（2026-09-20）**: ユーザーが実際にFigmaで作成・書き出した1件のLP（ポートフォリオサイト、`top`/`components`の2フレーム）のspec.json/tokens.jsonで33個の申し送り案を照合。Color/Spacing/Radius/Font-familyで実測値の半分前後が段階から外れることを確認した。漏れを3種に分類して個別に対処: (a) 原理的にVariable化不可能なもの（装飾用グラデーション4色。Variableは単色しか持てない。未決4送り）、(b) 別の仕組みの話だったもの（340pxのpaddingは「間隔」ではなく1440px幅の中身を760pxに中央寄せするコーディングパターンであり、spacingトークンの対象ではない）、(c) 本当に段階が足りなかったもの（radius 10/12/20、spacing 12/20/40/56、font-size 18/20/72/128）。(c)のみ段階を調整し、(a)(b)はトークン数を増やしても解決しないため対象外のまま
  - **2026-09-25 訂正**: 上の「(c)のみ段階を調整」は誤り。確定した段階（spacing 4/8/16/24/32/48/64/96、radius 4/8/16/24/full）には (c) の値が1つも入っていない。これを受けて I-1 着手時にユーザーと見直し、**名前（種類と役割）は共通・値はデザインごと**と整理し直した。値は仮置き（違いが目で分かれば足りる）。種類は Zenn の技術記事ページ（`/gopher/articles/adk-vs-genkit-design-philosophy`、幅1440/375の実測）で確かめ、link / code/bg / code/fg / notice/bg / notice/fg / shadow と font/mono・Text Style code を追加、font/accent を廃止。変数44＋Style 11＝55個。設計書 4.3.4 に反映済み
  - **Primitives/Semantic 2層構成は不採用**: Figma公式ガイド（`figma-generate-library`スキル、ゴールドスタンダードとされるSimple Design System参照。https://github.com/figma/mcp-server-guide/blob/main/skills/figma-generate-library/references/token-creation.md）の目安で「50個未満は1コレクション、Primitives分離不要」とあり、この規模（32個）はその範囲内。各変数が直接値を持つ1層構成に確定
  - **命名は `/` 区切りの階層名**（Figma変数パネルが自動でグループ化する。実データの`fg/default`と同じ形式に統一。デザイナー側の認知負荷はFigma純正のフォルダ機能で下げる）
  - **結論（最終セット、32個）**: 詳細は `docs/design.md` 4.3.4 に反映済み。内訳は Color(8) / Spacing(8) / Radius(5) / Font-family(3) / Text Style(6) / Effect Style(2)
  - **100%網羅は目標にしない**ことを明言: いずれの段階にも無い一回限りの値は生値のままでよい。段階を無理に増やすと隣接差が数pxまで縮み「トークン」としての意味を失う
  - Variableのscope設定（GAP/CORNER_RADIUS/TEXT_FILL等、Figma公式の対応表通り）は判断不要の機械的な実装項目としてD-4以降の実装タスク定義に含める。Dark対応での`scopes: []`（誤操作防止、確定済み）とは別目的なので混同しない
- [x] 決まった内容を `docs/design.md` に反映する

**完了条件**:
- 未決1〜3それぞれに結論と根拠が記録され、`docs/design.md` 4.3.4 が新しい源泉・最小セット・命名規則で書き換えられていること
- 現行実装（G-2 の Text Style 由来 `typographyToken`）との差分が、実装タスクとして起こせる粒度で書かれていること

---

### D-2: 未決4〜6を決めて設計書に反映する

**目的**: Color Style の位置づけと `tokens.json` の出力形を確定させる。

**前提**: D-1 完了（源泉の結論に依存する）

**作業内容**:
- [x] 未決4 **Color Style の位置づけ** — 現行設計書は非推奨・除外通知だが、グラデーションと複数 fill は Variables で表現できないため、使っただけで除外通知が出る
  - **結論**: 単色はVariablesに一本化する方針を維持。**グラデーション・複数fillのように単色に展開できないColor Styleに限り**、正式な源泉として認め`tokens.json`にnamed tokenとして出力する。単色なのにColor Styleを使っている場合は引き続き除外物としてREADMEに告知する（変更なし）
  - **根拠**: `@figma/plugin-typings`で実装を確認（`node_modules/@figma/plugin-typings/plugin-api.d.ts`）。`GradientPaint.gradientStops: ColorStop[]`の各`ColorStop.boundVariables?: { color?: VariableAlias }`で、各stopの色を個別にVariableへバインドできる。これはFigma公式の立場「値の組み合わせはStyle、Styleの中身はVariablesを指す」の実装そのもので、未決1でText Styleに適用した論理（複合的な見た目はStyle、個々の単一値プロパティはVariable参照可）と同じ形。stopの色がVariableにバインドされていればそのトークン名を、されていなければ解決済み値をそのまま出力する
  - **Effect Style（影）も同じ扱いに揃える**（D-3の原則1の表がこの結論に依存するため、ここで一緒に決める）: `VariableBindableEffectField`で`color`/`radius`/`spread`/`offsetX`/`offsetY`が個別にVariableバインド可能なことを確認済み。Effect Styleは複合的な見た目としての源泉のまま、個々のフィールドがVariableを指していればそのトークン名を出力する
  - `docs/design.md` 4.3.4に反映済み。G-3・U-1の「Color Style使用」検出ロジックの作り直し（単色/複合の判定分岐）は実装タスクとしてD-4以降に定義する
- [x] 未決5 **tokens.json でのエイリアス表現** — **結論: 現行の記載「エイリアスは解決済みの値に展開する」を維持し、変更なし。** 未決3で1層構成（Primitives/Semanticの参照関係を作らない）に決めたため、telldesが生成する32個のトークンにエイリアスは存在せず、論点の前提が消えている。デザイナーが独自にVariable同士のエイリアスを作った場合も、既存の解決済み値展開（循環参照ガード実装済み）で対応でき、CCへの出力精度に影響しない。design.mdへの変更は不要
- [x] 未決6 **tokens.json での3コレクションの出し方** — **結論: コレクション名でグループ化しない。トークン名を最上位キーにし、色トークンは`$value`にlight/darkのペアを持たせる**（`{"bg": {"$type":"color","$value":{"light":"#FFFFFF","dark":"#1A1A1A"}}}`）。Base（間隔・角丸・書体等）はテーマで値が変わらないので単一値のまま
  - **根拠**: コレクション名でグループ化すると（`{"Light":{"bg":...},"Dark":{"bg":...}}`）、CCが「Light.bgとDark.bgは同じトークンの2つの値」と認識できず、無関係な2つの変数として誤って出力しかねない。出力精度が最優先という基本方針に反する。トークン名を最上位キーにすれば、CCは`$value`がlight/darkのオブジェクトかどうかだけを見て機械的に`:root`/`[data-theme="dark"]`の出し分けを判断できる
  - `docs/design.md` 4.5.1に反映済み
- [x] 決まった内容を `docs/design.md` に反映する

**完了条件**:
- 未決4〜6それぞれに結論と根拠が記録され、設計書に反映されていること
- `tokens.json` の出力例（3コレクション・エイリアス込み）が設計書に載っており、CC がそれを読んで `:root` と `[data-theme="dark"]` を機械的に作れる形になっていること

---

### D-3: 確定済みのダーク対応・チェック体系・Export 設定を設計書に反映する

**目的**: 2026-09-19〜21 に確定した方針（「1フレーム＋トグル」方式・3コレクション、チェック体系の原則3つ、Export は実装への依頼書と設定4群）は本ステアリングにしかない。設計書に移す。

**前提**: D-2 完了

**作業内容**:
- [x] 「1フレーム＋トグル」方式と3コレクション構成（Light / Dark / Base、変数名にテーマを入れない、対を持つのは色だけ、`scopes: []` による誤操作防止）を設計書に記載する
- [x] チェック体系の原則3つを設計書に記載する — 原則1（error はデザイナーが選んだやり方に対する整合性だけを見る／**Export 設定の「ダークモード対応」が判定軸**。Dark コレクションの有無ではない。訂正の経緯はステアリング「確定: チェックは体系として設計する」の判定軸の訂正を参照）、原則2（Review の1行 = 1判断。原因単位で集約する）、原則3（Review は行為の前に自動で走るゲート。結果は必ず Review タブに出す）
- [x] 原則1 の表に **Effect Style の影の色が Variables を指しているか** の行を足す。未決4で解決済み: Effect Styleは複合的な見た目としての源泉のまま、`color`/`radius`/`spread`/`offsetX`/`offsetY`が個別にVariableを指していればそのトークン名を出力する。影の色はテーマで変わりうる（ダーク対応ファイルなら出力が壊れる側）ので、色が変数にバインドされていない件と同じ扱いで表に追加する
- [x] 書き出し手順（light 撮影 → 付け替え → dark 撮影 → light に戻す。失敗時にも必ず戻す）を設計書に記載する
- [x] 「起動時に dark のまま残っている」の扱い（error ではなく復旧の促し）を記載する
- [x] **4.7 に「Export は実装への依頼書」の節を新設する** — 依頼書の5要素の表、「デザインの判断は telldes / 実装の判断は zip 同梱 `steering.md`」の切り分けとその基準（誰が答えられるか）、LLM を持たないので項目を事前に洗い出して固定する、を記載する
- [x] **設定4群の仕様を記載する** — レスポンシブ（適用開始幅 / 使うフレーム / コンテンツ幅（固定px または %）・複数行）／ダークモード対応（ON/OFF）／サイト情報（タイトル・説明文・言語・favicon・テーマカラー・OG 画像・OG タイトル・OG 説明）／共通ルール（複数行・自由記述）。専用欄と共通ルールの線引き（CC が値としてそのまま使うものだけ専用欄）と、共通ルール（全体）と note（個別）が対になることを明記する
- [x] **設定値の保存先と Export タブの並びを記載する** — `figma.root.setPluginData` にファイル単位で保存し次回の既定値にする。Export タブは上から 設定 → 共通ルール → note 一覧（読み取り専用）→ Export ボタン
- [x] **favicon と OG 画像の書き出し仕様を 4.5 に追記する** — フレーム指定で favicon（SVG / ICO / apple-touch-icon 180×180）と OG 画像（1200×630）を書き出す。既存の `screenshotExporter.ts` / `assetExporter.ts` の仕組みに乗る
- [x] **設定値が `spec.json` のどこに載り、`prompt.md` で CC がどう読むかを記載する**
- [x] **4.9 を書き換える** — レスポンシブの扱いを「フレームを分ける」だけでなく「ブレークポイントとコンテンツ幅を設定で宣言する」に更新する。**描かれていない幅の振る舞いはデザインに存在しない情報であり、ツールが推測してはならない**ことを明記する（`padding: 0 340px` と `max-width` + `margin-inline: auto` は 1440px で完全に同一の描画になるため、データからは区別できない）。コンテンツ幅の宣言によってその padding が「コンテナを作っていたもの」だと確定する、という導出を書く
- [x] **角丸の `full` を 4.3.6 に記載する** — `radius/full` トークンへのバインドを宣言とみなし、バインドされていれば `border-radius: 9999px`、されていなければ px 値のまま出す。px 値の大小から円・ピルを当てにいかない（コンテナ中央寄せと同じ理由）
- [x] `src/templates/steering.md` の確認項目からレスポンシブ（#3）・OGP/meta（#9）・言語（#10）を外し、telldes の設定へ移ったことを 4.8.2 に反映する

**完了条件**:
- 上記の各点が `docs/design.md` に記載され、ステアリングの「確定:」3節が設計書を指すだけの状態になっていること
- チェック体系の各チェックについて、ダーク対応ファイル／ライトのみファイルでの発火有無が表として設計書にあること。発火の判定軸が Export 設定であり Dark コレクションの有無でないことが明記されていること
- 設定4群それぞれについて、入力欄の形・保存先・`spec.json` への載り方・CC の読み方が設計書から追えること
- 4.9 に「描かれていない幅の振る舞いは推測しない」という原則と、その根拠（同一描画になるため区別不能）が記載されていること
- `steering.md` テンプレートの確認項目と telldes の設定項目に重複が無いこと

**進行メモ**:
- 元の作業項目にあった「コンテナ中央寄せパターンを 4.3.6 に追記する（変換の判定条件も決める）」は**落とした**。判定条件は値の大小から意図を当てる推測にしかならず、設定でコンテンツ幅を宣言させることで問題自体が消えたため（2026-09-21）
- 角丸 `full` の **要検証**（Figma が短辺の半分を超える radius をどう扱うか）は `radius/full` の Variable 値を決めるために残っている。D-3 の記載自体はバインドの有無で決まるので要検証を待たずに書ける

---

### D-4: Ph-9 の設計レビュー（実装前）

**目的**: 設計書の文面そのものを対象に設計レビューを1回かける。実装後ではなく実装前に当てる（作業ルール「レビューの配置」）。

**前提**: D-3 完了

**作業内容**:
- [x] Design エキスパートレビュー（subagent）— D-1〜D-3 で書き換えた設計書の該当節を対象に、内部矛盾・未処理の帰結・既存節との不整合を洗う。**U-2 では 4.7.3 の追記自体が自己矛盾していた（「現在のページの全レイヤー」vs「更新は起動時と保存時だけ」）のを実装後に発見しており、同じ取りこぼしを防ぐのがこのタスクの主目的**
- [x] 指摘を triage する（下の「設計レビューの指摘と triage」）
- [x] **原則A/B を設計書に置く**（`789d577`） — 4.3 の冒頭に原則A（Figma 公式を土台に、独自の約束は最小）、4.5 の冒頭に原則B（形が揃っている／1箇所にだけある／欠けていると分かる／推測させない）。以降の設計判断がここを根拠にできる状態にする
- [x] Valid の分と、決着した未決3〜5・7〜13 を設計書に反映する（`789d577`）。コーディネーターのレビューで1件 Valid（書体 Variable の判別が `ALL_SCOPES` 既定のため誤検知する）→ 修正ラウンド1 `ffc73b1` で「`FONT_FAMILY` を含み `ALL_SCOPES` を含まない」に。**4軸レビューは未実施**（D-5 で UI の節が書き換わるため、そこまで済ませてから1回で当てる）
- [x] Ph-9 の実装タスクを定義する（ここで初めて定義できる。2026-09-22、D-5 の後に I-1〜I-9 として定義）。**D-1 未決3・D-2 未決4 の決定により、実装タスクに必ず含めるもの**: (a) Setup が生成する変数への `scopes` 設定（GAP / CORNER_RADIUS / TEXT_FILL / FONT_FAMILY 等、Figma 公式の対応表通り。Dark コレクションの `scopes: []` とは別目的）、(b) G-3・U-1 の「Color Style 使用」検出を単色／複合（グラデーション・複数fill）で分岐する形に作り直す、(c) **README.md の Color Style 行の更新**（現在「使わない。使うと除外物として記録される」とあるが、未決4でグラデーションは正式な源泉になった。実装と同時に直さないと README と design.md が食い違う＝作業ルール上の不具合になる）、(d) **Export 設定 UI の実装**（設定4群・複数行の追加削除・`figma.root.setPluginData` への保存・note 一覧の最下段表示）と、それに伴う `spec.json` / `prompt.md` / zip 同梱 `steering.md` の更新、(e) **favicon / OG 画像の書き出し**（フレーム指定 → SVG / ICO / 180×180 / 1200×630）、(f) **テーマ整合チェックの発火判定を Export 設定のダークモード対応に繋ぐ**（Dark コレクションの有無で判定しない）、(g) **`figma.showUI()` に `themeColors: true` を付け、渡される CSS 変数で UI をライト/ダークに追従させる**（D-5 の調査で発覚。`src/code.ts:25` に無い。Figma 公式が具体項目として唯一「強く推奨」しているもので、ダークモード対応を作るプラグイン自身が Figma のダークテーマで白く光っている。D-5 の結論によらず要る）
  - **UI に関わる (d) と (g) は D-5 の後でないと定義できない。** D-5 が画面の形そのものを決め直すため

- [x] **未決3〜5・7〜13 を決着させた**（2026-09-21）。各未決の節に結論と根拠を記録済み。あわせて「確定: 判断は原則から導く」を新設
- [x] **未決1・2 を原則A/B から導いて結論を提示する**（ユーザー指示: 1件ずつ聞くのではなく結論と根拠を並べ、違うところだけ指摘してもらう）→ 2026-09-21 にユーザー承認。各未決の節に結論と根拠を記録
  - 未決1（Notes タブの一覧を残すか Export に一本化するか）→ 両方に置く・中身は別物。**U-2 の残タスクは定義し直さない**（前提が変わらない）
  - 未決2（状態8種の受け口）→ Ph-9 に入れず **Ph-10** として起票済み
- [x] **「D-3 で実装者が決めた点」8件をユーザーと確認し、承認か差し替えかを決める**。すでに設計書に入っているので、差し替えになった分は設計書を直す
  - **2026-09-21 に8件とも提示済み。ユーザーの回答待ち**（回答前に UI の議論へ移ったため未決着）。提示内容: #1・#2・#4〜#8 は承認推奨、**#3 のうち「全フレームの `spec.json` に同じ `settings` を複製する」だけ差し替え推奨**（キー名・フィールド名は承認）
  - **#3 の差し替え案: `settings` は zip ルートに1つだけ置く。** 根拠は 4.7.4.1 — Export は実装への依頼書であり、依頼書の全体条件は1枚目に1回書くもので、ページごとに繰り返す依頼書は無い。`tokens.json` が既にルート共通（R-1）なのとも揃う。CC が5ページ目で設定を取り違える懸念は `prompt.md` の手順に「各ページを作る前にルートの settings を読む」と書けば解ける — **手順で解ける問題を出力の形を歪めて解かない**
  - 一度 A（複製のまま）を推奨しかけたが、その根拠が `prompt.md` の現在の文面（"All paths below are relative to a frame folder"）＝既存ありきだったため取り下げた
  - **2026-09-22 にユーザー承認（推奨どおり）。** #1・#2・#4〜#8 は承認。#3 は「キー名・フィールド名」を承認し、「全フレームの `spec.json` に複製」だけ差し替え。設計書に反映済み: 4.5.2.1 の `settings` 段落を削除し、**4.5.4 `settings.json`（zip ルートに1つ）を新設**。zip ツリー・フォルダ名の予約リスト・4.7.4.2・4.8.1 の参照もあわせて更新した
- [x] 要検証3件の決着先を割り当てた（2026-09-21。上の「要検証」節）。`radius/full` の値と `scopes` の既定値 → **W-1**（実機検証、新規起票）／ICO の生成手段 → 実装タスク (e)／テーマ切り替えトグルの配置 → **D-5**（下記。常設が要ることは決着済み）

#### 設計レビューの指摘と triage（2026-09-21）

判定 **fail**。12件。うち Escalation（ユーザーが決める）7件、Valid（直す。決着後に機械的に反映できる）5件、Invalid 0件。**重いものから並べた順に未決7〜13 として起票し、1件ずつ決める。**

| # | 指摘 | triage | 起票先 |
|---|---|---|---|
| 1 | Export 開始時のテーマ状態が誰にもチェックされず、「light 撮影」が dark のまま撮られうる。4.7.4.4 は開始時ライトを暗黙の前提にしているが、4.7.2 は dark 残りをゲートから明示的に外している | Escalation | 未決8 |
| 2 | 付け替えの範囲が**選択フレーム配下**（4.3.9）、状態は**ファイル単位**（4.3.9）、書き出しは**全フレーム**（4.7.4）で3つの粒度が揃っていない。HP・レスポンシブでは必ず複数フレームになる | Escalation | 未決7 |
| 3 | Effect Style / グラデーション Color Style のバインドは**スタイルオブジェクト側**に載るため、フレーム配下のノード走査では付け替え対象が見つからない。にもかかわらず 4.7.2 は影の色の未バインドを error（修正必須）にしている＝**telldes が付け替えられない場所へのバインドを強制している**。API も裏付け: `setBoundVariableForPaint` は `SolidPaint` のみ、`ColorStop.boundVariables` は `readonly`（実機の型定義で確認済み） | Escalation | 未決7 |
| 4 | 4.7.2 の発火表が README に送っている3項目（色の未バインド OFF時 / font-size 生数値 / padding・gap 生数値）は、同節が定義する除外物（ツールが構造上捨てるもの）に当てはまらない。4.3.4 は「出力の正しさは変わらない」「ツールは促さない」と明言しており、全書き出しの README に並べるのは促している。「4の倍数」の基準も設計書のどこにも定義が無い | Escalation | 未決9 |
| 5 | favicon / OG 画像に指定したフレームが、4.7.4 の書き出し範囲に丸ごと該当し、`favicon/spec.json` というページとしても出る。prompt.md は各フレームフォルダを1ページとして読ませるので **CC が favicon をページとして実装する** | Escalation | 未決10 |
| 6 | ダーク対応ファイルでも `assets/`（SVG アイコン等）はライト1組しか出ない。SVG は色が焼き込まれるため、黒背景に黒アイコンになる。#3 と同型で「バインドしたのに反映されない」 | Escalation | 未決11 |
| 7 | README が3タブのまま（`src/App.tsx` も3タブ）。設計書は「各タブの挙動は README が正」と権威を預けているのに参照先に節が無い。Review の表にテーマ整合4種が無い、zip ツリーに `site/` と `screenshots-dark/` が無い、**Color Style 行が「使わない」のままで 4.3.4 の結論と正面から矛盾**、Export 設定4群がどこにも無い | Valid | D-4 実装タスク (c) を拡張 |
| 8 | グラデーション stop が未バインドのときの扱いが影と非対称。4.3.4 はグラデーションを条件なしで許容し、直後の Effect Style 段落には「ダーク対応ファイルでは破綻」と但し書きがある。4.7.2 の「色が変数にバインドされていない → error」がグラデーション stop を含むか決まらない | Escalation | 未決7 に併合（#3 の決着に従属） |
| 9 | `radius/full` はフルパス文字列の一致が意味を持つのに、4.3.4 は「命名規約は自由」「プラグインは促さない」と言っている。改名・自作命名で宣言が静かに効かなくなり、検出も告知も無い（4.3.4 の「無視・変換するものは必ず告知する」に反する） | Escalation | 未決12 |
| 10 | ダーク対応の成果物が `prompt.md` / zip 同梱 `steering.md` に届いていない。「入力データの読み方」に `screenshots-dark/` が無く、`settings.darkMode` の読み方も dark 画像との突き合わせを指示していない。**撮影コストを払った dark 画像を CC が読む契約がどこにも無い** | Valid | D-4 実装タスク (d) を拡張 |
| 11 | Review の走査範囲が「ページ内の全ノード」（4.7.2 冒頭）なのに、除外物告知側は「書き出し対象フレーム配下のみ」に絞ってある。別エリアの裸 Component のベタ色で、出力に影響が無いのに Export がブロックされる（原則1 の趣旨と逆） | Escalation | 未決13 |
| 12 | 未決3〜5（Setup の32個と Dark / Typography 6 vs 8 / Font family）の所在を設計書側で確認。**加えて未決に無い1件**: 4.3.9 の Base 行は「余白・角丸・書体・文字サイズ」だが、4.3.4 では書体は STRING Variable（トークン対象外）、**文字サイズは Text Style であって Variable ではない**。Text Style はコレクションに入らないので Base に「文字サイズ」は存在しえない | Valid（未決3 の決着に従属） | 未決3 に併合 |

補足（軽微、実装が一意に決まるので指摘に数えない）: `spec.json` の `screenshot` はフレームフォルダ相対、`settings.site.favicon` / `ogImage` は zip ルート相対で基準が混在する。`prompt.md` の記載で潰せる。→ D-4 実装タスク (d) に含める

**完了条件**:
- 設計レビューの指摘がすべて triage され、Valid の分が設計書に反映されていること
- 未決1〜5 それぞれに結論と根拠が記録され、設計書に反映されていること
- 「D-3 で実装者が決めた点」8件それぞれに、承認／差し替えの判断が記録されていること
- 要検証3件それぞれに、どのタスクで決着させるかが書かれていること
- Ph-9 の実装タスクが、作業内容と完了条件つきでステアリングに定義されていること
- 上記 (a)(b)(c) が、いずれかの実装タスクの作業内容に含まれていること
- **未決1（note 一覧の置き場所）とテーマ切り替えトグルの配置は D-5 に送る。** 器（タブ）そのものが D-5 で変わるため、ここで置き場所を決めても無駄になる

---

### D-5: プラグイン UI を設計し直す

**目的**: 画面の形を「telldes ができることの並び」から「デザイナーの仕事の流れ」に組み直し、`docs/design.md` 4.7 に書く。Ph-9 の実装タスク (d)(g) はこれが終わらないと定義できない。

**前提**: D-4 の設計書反映まで完了

**なぜ要るか**: Ph-9 でテーマ切り替えトグルの置き場所が決まらなかった。原因は選択肢ではなく器のほうで、同じ症状が既に4つ出ている — note 一覧が2箇所に要る（未決1）／付け忘れの知らせは Export タブに置いたが直す作業は Review 側／Export を押すと Review タブへ飛ばされる／トグルの置き場所が無い。**そして今が最後のタイミング**で、Ph-9 は Setup タブ追加・Export 設定UI・テーマ切り替え・付け忘れの知らせ・note 一覧と UI をほぼ作り直す。ここで組み直さないと、置き場所の問いが実装タスクごとに1つずつ出る。

**調べた結果（2026-09-21、Web 調査）**: タブは telldes の構造に対して**誤用**である。私の感覚ではなく、NN/g の条件に照らして外れている。

* in-page タブの定義は「**同じ情報の別の見方**を素早く切り替えるもの」。Setup / Review / Notes / Export は別の情報の別の仕事で、同じ対象の別ビューではない
* NN/g「in-page タブと navigation タブを1つのタブ列に混ぜると利用者は迷う」— telldes のタブは実質ナビゲーションなのに in-page タブの形をしている
* NN/g「利用者がタブを行き来して参照・比較する必要があるならタブは使うべきでない」— 上記4症状がまさにこれ
* NN/g「**はっきりしたグルーピングが見つからないなら、タブはおそらく間違った部品。見出しつきの1ページレイアウトのほうが適切**」
* この代替（見出しつきの縦1画面）は Figma 公式の「**縦に長く、スクロール前提、最小幅 300px で最適化**」（Dev Mode 向け助言）と一致する。別々の出典が同じ形を指している
* テーマ状態は**常設が必須**。NN/g ヒューリスティック#1 が「システムは常に今何が起きているかを知らせ続けよ」「**利用者に影響のある動作を知らせずに行ってはならない**」と要求する。テーマ切り替えはファイルの状態を変える＝影響がある。よって「どのタブに入れるか」という問いは成立しない
* **全部アコーディオンにするのは違う**。NN/g のアコーディオンを避ける条件に「利用者が中身の大半または全部を必要とする場合」「比較が要る場合」があり、Export は「今から何を渡すか」を全部見る場所。一方「一度書いたら次回は既定値として残る」設定群（4.7.4.3）は "step-by-step process" に当たるので畳める。**混ぜるのが正解**で、どこを畳むかがこのタスクで決めること
* 事実上の標準部品集 `@create-figma-plugin/ui` の中身が「Figma で普通にある形」の目録になる: `banner` / `button` / `checkbox` / `disclosure` / `divider` / `dropdown` / `file-upload` / `icon-button` / `icon-toggle-button` / `layer` / `loading-indicator` / `modal` / `radio-buttons` / `range-slider` / `search-textbox` / `segmented-control` / `selectable-item` / `tabs` / `text` / `textbox` / `toggle`。note 一覧は `layer`、付け忘れの知らせは `banner`、テーマ状態は `toggle` か `segmented-control` が素で当たる
* 寸法: `showUI` の既定は 300×200、最小幅70。`figma.ui.resize()` で後から変えられる。現行は 360×480（`src/code.ts:25`）
* 出典: [Tabs, Used Right](https://www.nngroup.com/articles/tabs-used-right/) / [Accordions on Desktop](https://www.nngroup.com/articles/accordions-on-desktop/) / [Visibility of System Status](https://www.nngroup.com/articles/visibility-system-status/) / [Intranet IA Trends](https://www.nngroup.com/articles/intranet-information-architecture-ia/)（タスクベースIA が機能ベースより学習しやすく長持ちする） / [Working in Dev Mode](https://figma.com/plugin-docs/working-in-dev-mode) / [Plugin and widget review guidelines](https://help.figma.com/hc/en-us/articles/360039958914-Plugin-and-widget-review-guidelines)（公式の唯一の指針は「Figma の UI に合わせろ」の1行） / [figma.showUI](https://developers.figma.com/docs/plugins/api/properties/figma-showui/) / [@create-figma-plugin/ui](https://github.com/yuanqing/create-figma-plugin/tree/main/packages/ui/src/components)

**作業仮説（このタスクで検証して確定させる。ユーザーには 2026-09-21 に提示済み・回答待ち）**:

```
┌ Telldes ─────────────────────────┐
│ [Light | Dark]      ● 3 errors   │ ← 常設（状態）
├──────────────────────────────────┤
│ Review        3 errors   [Run]   │ ← 見出し
│   …違反の一覧                    │
│ Notes                            │
│   選択中の入力欄 / ページの一覧  │
│ Export                           │
│   ▸ 設定（既に書いてあるので畳む）│ ← ここだけ disclosure
│   付け忘れの知らせ               │
│   渡すもの                       │
│   [Export]                       │
│ ▸ Setup（準備済み）              │ ← 済んだら畳む
└──────────────────────────────────┘
```

**作業内容**:
- [x] 縦1画面＋見出し か、タブを残すか を決める（上の作業仮説の検証。Setup は1回きり、Review / Notes / Export は行き来する、という非対称の扱いを含む）
- [x] 常に見えているものを決める（テーマの現在状態、error 件数）。`figma.notify()` に出すものとの線引きも決める — Figma の作法では結果の知らせは UI に領域を作らず notify に出す
- [x] ウィンドウの寸法を決める（300px 幅で成立する形にするか、現行360を保つか）
- [x] 未決1（note 一覧の置き場所）とテーマ切り替えトグルの配置を、決まった器の上で結論づける
- [x] 決まった内容を `docs/design.md` 4.7 に反映する（4.7.1 の「4つのタブ」以下が書き換わる）
- [x] 設計レビュー（実装前、設計書の文面を対象）→ **判定 fail、22件。全件を `97e2cc6` で設計書または実装タスクに反映した**（下の「D-5 設計レビューの指摘と triage」）

**結論（2026-09-22。ユーザー承認済み。`61b0470` で `docs/design.md` 4.7 に反映、`97e2cc6` で改訂）**

作業仮説（縦1画面＋見出し）は**破棄した**。ユーザー指摘「OOUI に従っていますか」で、仮説が箱をタブから見出しに変えただけで**並びの軸はタスク指向（Review / Notes / Export ＝ 動詞）のまま**だと分かったため。NN/g のタブ誤用だけを見て、IA の根本（何を軸に並べるか）を問い直していなかった。

* **オブジェクトは「画面」と「レイヤー」の2つだけ。** 違反・付け忘れの知らせ・note は**レイヤーのプロパティ**であってオブジェクトではないので、ビューに昇格させない。**旧4タブがタスク指向になった正体はこの昇格**で、同じレイヤーのプロパティが別の箱に入ったから4症状（note 一覧の二重化／知らせと直す場所が別／Export を押すと Review へ飛ぶ／トグルの置き場所が無い）が出ていた
* **画面のコレクションビューが主役**で、それがそのまま「渡すものの明細」になる。Export 専用ビューは持たない。末尾に「渡されないもの」の行を置き、README にしか出ていなかった除外物告知を Figma 上にも出す
* **レイヤーのシングルビューは選択追従。** Figma ではキャンバスの選択がそのままオブジェクト選択なので直接操作が素で成立する
* **Setup だけタスク指向のままで正しい** — OOUI の例外条件「オブジェクトが限定的で選択する必要がない」（対象はファイル1つ。ATM と同じ）に当たる
* **未決1（note 一覧を2箇所に置く）は不要になった。** 一覧は1つで、画面ごとのグループと「渡されないもの」で渡る/渡らないが同じ一覧の上で分かる
* 常設はテーマ状態と error 件数の2つ。`figma.notify()` との線引きは**消えてよいか**（状態は UI／出来事は notify）
* 寸法 360×640、`themeColors: true`
* **密度・アイコン・展開の既定は実機で使って決める**（ユーザー指示「あとは実際に使って判断しましょう」）。設計書にもそう書いた
* 出典: [ソシオメディア『オブジェクト指向UIデザイン』](https://www.sociomedia.co.jp/10046) / [Object-oriented user interface (Wikipedia)](https://en.wikipedia.org/wiki/Object-oriented_user_interface) / [ニジボックス OOUI 解説](https://blog.nijibox.jp/article/ooui/)（例外条件・ATM の例）

#### D-5 設計レビューの指摘と triage（2026-09-22）

判定 **fail**、22件（high 11 / medium 8 / low 3）。**全件を設計書または実装タスクに反映済み**（`97e2cc6`）。ユーザーへのエスカレーションは行わず、いずれも既に合意済みの枠組み（4.7.4.1 の依頼書の表、原則A/B、原則1〜3）から結論を導けたため。

**本質的だったのは2件で、どちらも同じ原因** — オブジェクトの抽出が1系統足りなかった。

* **#1**: 原則2 は「同じ `#333333` が30箇所なら1行に集約」と言うのに、改稿した 4.7.1 は「違反を持つレイヤーが並ぶ」＝30行と書いていた。正反対
* **#9**: 「Light / Dark のペアが崩れている」「トークン名衝突」は**どのレイヤーのプロパティでもない**ので、「すべてレイヤーのプロパティ」で組んだ 4.7.1 に置き場所が無かった

**解決**: **トークン**を2つ目のオブジェクト系統にした。根拠は 4.7.4.1「Export は実装への依頼書」の表で、「何を作るか＝描いたもの」と並んで「**語彙＝tokens.json**」が既に立っている。どちらのプロパティになるかは「デザイナーが下す1つの判断の対象が何か」で決まる（原則2 そのもの）。これで #1・#8・#9・#22 が同時に解けた。

| # | 指摘 | 対処 |
|---|---|---|
| 1 | 原則2 の集約とレイヤー単位の展開が正反対。集約行がどの画面に属するかも決まらない | トークンをオブジェクトに。テーマ整合5種と知らせ2種はトークンのプロパティ、構造4種＋サイジング1種はレイヤーのプロパティ |
| 2 | 付け忘れの知らせが確認ビューとコレクションビューの2箇所に出る（4.7.4.3 自身の理屈に反する） | 確認ビューは**件数と戻る導線だけ**。明細はトークンコレクションが持つ |
| 3 | 「Export 専用ビューを持たない」と「確認ビューに入る」が矛盾。4.7.1 のビュー一覧に確認ビューが無い | 4.7.1 を「ビューは3つ＋確認ビュー（アクションのモード）」に明記 |
| 4 | **error があると Export 設定を開けないデッドロック**（設定4群の入力欄は確認ビューにしかなく、入口にゲートが掛かっていた）。ダーク整合 error → 設定を OFF にしたいのに入れない | ゲートを確認ビューの**「実行」**に移した。入口には掛けない |
| 5 | ゲート表の宛先が「Review に結果表示」のまま。手動 Review ボタンが 4.7.1 のアクション表に無い | 宛先を「コレクションビュー」に。手動 Review をアクション表に追加（対象＝両コレクション、置き場所＝ヘッダ） |
| 6 | 4.7.3 が「入力欄の下に一覧」と旧 Notes タブの配置を残しており、note 一覧が2箇所に要ると読める | 4.7.3 から位置関係の記述を削り、置き場所は 4.7.1 に一本化 |
| 7 | 更新タイミングが3系統バラバラ。**チェックはゲートでしか走らないのに error 件数を常設**＝起動直後の値が未定義 | 更新トリガ表を 4.7.1 に新設。**起動時ゲートを追加**（常設すると決めた以上、初期値が要る）。未計算を 0 と出さない |
| 8 | 「渡されないもの」の定義が3通り。単色 Color Style 等は画面内にあるので「渡されない」は嘘になる | 「どの画面にも属さないもの」に一本化（裸 Component と対象外 note）。画面内の除外物はトークン側へ |
| 9 | ペア崩れ・トークン名衝突の置き場所が構造上無い | #1 と同じ。トークンのコレクションビュー |
| 10 | 未処理の帰結4件（ページ切り替え／画面0個／未選択時／画面のシングルビュー） | すべて 4.7.1 に規定。画面のシングルビューは**行の展開が兼ねる**（固有プロパティは Export 設定側にあり別ビューを起こす中身が無い） |
| 11 | README が旧構成のまま、design.md と6箇所衝突。I-8 に未記載の項目あり | I-8 に4項目追加（Review 走査範囲／レスポンシブ設定／ダークモードの制作ルール／font-family 行） |
| 12 | 常設が本文「2つ」・表「3つ」で食い違う | 3つに統一（テーマ状態・error 件数・付け忘れの件数） |
| 13 | 走査失敗が notify と UI 状態の両方に規定されている | **知らせ**は notify、**結果を持っていない状態**は UI、と二段であることを明記 |
| 14 | 「前回の結果を消す」の対象が決まらない（note を巻き込むと一覧が消える） | 消す対象を違反・知らせの件数と行に限定 |
| 15 | API 表に `selectionchange` が無い。`currentpagechange` の用途が旧構成のまま | 両方を追加・修正 |
| 16 | 4.3.9 がテーマ状態の保存先を 4.7.4.3 に預けているのに、4.7.4.3 に記述が無い（参照の空振り） | 4.7.4.3 に追記 |
| 17 | 設定が参照するフレームを id で持つか名前で持つかが未定義。`-N` 付与でフォルダ名とズレる | **node id で保存**し、出力時に 4.5.2 の命名規約でフォルダ名へ解決。参照先が消えたら黙って落とさず知らせる |
| 18 | zip のダウンロードリンクの置き場所が無い（D-5 完了条件の「全機能の置き場所が追える」に唯一穴） | 確認ビューの実行後に残す。**完了は出来事だがリンクは持続する状態** |
| 19 | 実装タスクが「テーマ整合4種」で設計書の5種と1つずれ、黙って1種落ちる | I-4・I-8 を5種に修正 |
| 20 | 縦の積み順が 4.7.1 と 4.7.3 で逆 | #6 で同時解消 |
| 21 | 復旧の促しの規定所在が3節を巡る循環参照 | 4.7.1 の参照先を 4.7.2 に直した |
| 22 | 展開行の並び順の規定が note のみを想定 | 集約行はトークン側に出るので、レイヤーツリー順は画面側にだけ掛かると明記 |

**レビューの主目的だった「追記自体の自己矛盾」（U-2 で実装後に発見した型）は再発していなかった。** ただし**同型の取りこぼしが別の節に移っていた** — 4.7.3 が note について「未着／失敗／受信済み」まで詰めた保護が、同じ行に同居する違反・知らせ側に無かった（#7）。次に節を書き足すときは、**隣に並ぶ別系統の事実が同じ保護を持っているか**を必ず突き合わせる。

---

**完了条件**:
- 画面の分け方・常設するもの・寸法それぞれに結論と根拠が記録され、`docs/design.md` 4.7 に反映されていること
- 未決1 とテーマ切り替えトグルの配置に結論が書かれていること
- telldes が提供する全機能（トークン一式の生成／違反の検出と修正導線／テーマ切り替え／note の記入と一覧／Export 設定／付け忘れの知らせ／zip の手渡し）それぞれについて、どこに置かれるかが設計書から追えること
- README「プラグインの使い方」が何を書き換えることになるかが、実装タスクとして起こせる粒度で書かれていること

---

### Ph-9 実装タスク（2026-09-22 定義）

D-5 完了により UI の形が決まったので定義できるようになった。順は I-1 → I-2 →（I-3・I-4 は並行可）→ I-5 → I-6 → I-7 → I-8 → I-9。W-1（実機検証）は I-1 より先に済ませる。

D-4 で「実装タスクに必ず含める」とした (a)〜(g) の行き先: (a)→I-1 / (b)→I-4 / (c)→I-8 / (d)→I-5 / (e)→I-6 / (f)→I-4 / (g)→I-2。

---

### I-1: Setup（トークン一式の生成）

**目的**: 3コレクション（Light / Dark / Base）と変数44個＋Style 11個を、現在のファイルに冪等に生成する。

**前提**: W-1 完了（`radius/full` の値と `scopes` の既定値が実機で確定していること）

**作業内容**:
- [ ] `src/setup/tokenFactory.ts` に、設計書 4.3.4 の一覧（Color Light 14 / Color Dark 14 / Spacing 8 / Radius 5 / Font family 3 ＝ 変数44、Text Style 9 / Effect Style 2 ＝ Style 11）を定数として持つ。値は仮置きで、隣り合う段階・役割どうしの違いが目で分かることだけを満たす（4.3.4）
- [ ] `createTokens()` を実装する。`figma.variables.createVariableCollection()` で3コレクションを作り、`variable.setValueForMode()` で値を入れる
- [ ] 各変数に `scopes` を設定する（**D-4 (a)**）。Figma 公式の対応表どおり — 余白は `GAP`、角丸は `CORNER_RADIUS`、色は用途別、書体は `["FONT_FAMILY"]`（4.3.4）。**Dark コレクションの全変数は `scopes: []`**（4.3.9。デザイナーのピッカーから消すためで、目的が別）
- [ ] 全変数に `setVariableCodeSyntax('WEB', 'var(--<token-name>)')` を設定する
- [ ] **冪等にする**: 同名のコレクション・変数・Style が既にあれば作り直さず、欠けているものだけ足す。2回押しても55個のままであること
- [ ] Text Style 9個（`display` / `heading-lg` / `heading-md` / `heading-sm` / `lead` / `body` / `label` / `caption` / `code`）と Effect Style 2個を生成する。Text Style の書体は `font/*` に、Effect Style の影の色は `shadow` につなぐ
- [ ] セルフチェック（完了条件ごとに OK/NG。チェック結果: `.rn/20260524-build-plugin/checks/I-1.md`）
- [ ] Figma 実機で試す（実機でしか出ない不具合はここでしか見つからない）

**完了条件**:
- Setup を1回実行したファイルに、変数44個と Style 11個がちょうど存在すること
- 2回目の実行後も変数44個・Style 11個のままで、値も変わっていないこと
- Light / Base の各変数の `scopes` が 4.3.4 の対応表どおりで、Dark の全変数が `[]` であること
- 全変数の `codeSyntax.WEB` が `var(--<変数名>)` 形式で入っていること
- Figma 実機で Setup を実行し、変数パネルに3コレクションが出ることが確認できていること

---

### I-2: UI を OOUI で作り直す

**目的**: 設計書 4.7.1 の構成（画面のコレクションビュー＋レイヤーのシングルビュー＋常設ヘッダ）に `src/App.tsx` を組み直す。

**前提**: なし（I-1 と並行可）

**作業内容**:
- [ ] `src/code.ts` の `figma.showUI()` に `themeColors: true` を足し、寸法を 360×640 にする（**D-4 (g)**）
- [ ] Figma が注入する CSS 変数（`--figma-color-bg` 等）で UI をライト/ダークに追従させる。自前の色指定を残さない
- [ ] 常設ヘッダを作る: `Light | Dark` の segmented-control、error 件数、付け忘れの件数、手動 Review ボタン、Setup。スクロールしても消えない位置に固定する
- [ ] **件数が「まだ計算していない」状態を 0 と表示しない**（4.7.1 の未着／失敗／受信済み）。起動時にチェックを走らせて初期値を作る
- [ ] `figma.on('currentpagechange')` で両コレクションビューを丸ごと作り直す（4.7.1）
- [ ] **トークンのコレクションビュー**を作る。各行＝1トークン、または「トークンになっていない値」1つ。行は原因単位で集約する（`#333333` が30箇所なら1行）。テーマ整合の error と付け忘れの知らせはここに出る（4.7.1）
- [ ] 画面のコレクションビューを作る。各行＝書き出し対象フレーム1つ（`isExportedFrame` を使う）、違反・知らせ・note の件数を持つ。末尾に「渡されないもの」の行を置く
- [ ] 行の展開で、その画面の「telldes が言うことのあるレイヤー」を並べる。Figma のレイヤーツリーは作り直さない
- [ ] レイヤーのシングルビューを作り、`figma.on('selectionchange')` で選択に追従させる。中身は違反・知らせ・note 入力欄
- [ ] 一覧の行クリックで選択を変える（4.7.3 の既存挙動を引き継ぐ）
- [ ] 旧 `Review` / `Notes` / `Export` のタブ切り替えを削除する
- [ ] 画面が0個のとき Export を実行できないようにし、その旨をコレクションビューに出す（4.7.1）
- [ ] セルフチェック（完了条件ごとに OK/NG。チェック結果: `.rn/20260524-build-plugin/checks/I-2.md`）
- [ ] Figma 実機で試す（実機でしか出ない不具合はここでしか見つからない）

**完了条件**:
- `src/App.tsx` にタブの切り替え状態が存在しないこと
- トークンのコレクションビューがあり、同じ色が30箇所で使われていても行が1つであること
- 起動直後に error 件数が「未計算」ではなく実際の値を出していること
- 画面のコレクションビューと、選択に追従するレイヤーのシングルビューが動くこと
- Figma のテーマをダークにしたとき、プラグイン UI もダークになること
- ヘッダのテーマ表示と error 件数が、スクロールしても見えていること
- 「渡されないもの」の行に、書き出し対象外のレイヤーに付いた note が入ること

---

### I-3: テーマ切り替え（Light ⇄ Dark の付け替え）

**目的**: ヘッダのトグルで、ページ全体のバインドを Light ⇄ Dark に付け替える（設計書 4.3.9）。

**前提**: I-1 完了（Dark コレクションが存在すること）、I-2 完了（トグルの置き場所）

**作業内容**:
- [ ] `src/theme/swap.ts` に付け替えを実装する。対象は (1) ページ配下のノードのバインド、(2) ローカルの Paint / Effect Style（`getLocalPaintStylesAsync` / `getLocalEffectStylesAsync`）
- [ ] `setBoundVariable()` / `setBoundVariableForPaint()` / `setBoundVariableForEffect()` を使い、戻り値で配列を作り直して再代入する
- [ ] グラデーション stop と影の色も付け替える（未決7 の決着）
- [ ] 現在のテーマ状態を `figma.root.setPluginData` に持つ（D-3 #5）
- [ ] 起動時に dark のまま残っていたら、error ではなく**復旧の促し**をヘッダに出す
- [ ] セルフチェック（完了条件ごとに OK/NG。チェック結果: `.rn/20260524-build-plugin/checks/I-3.md`）
- [ ] Figma 実機で試す（実機でしか出ない不具合はここでしか見つからない）

**完了条件**:
- トグルを Dark にするとページの見た目がダークになり、Light に戻すと元に戻ること
- 戻したあと、バインド先が付け替え前と一致していること（往復で壊れないこと）
- Dark のまま閉じて開き直したとき、ヘッダに復旧の促しが出ること
- グラデーション stop と影の色も付け替わること

---

### I-4: チェック体系を 4.7.2 に作り直す

**目的**: チェックを設計書 4.7.2 の原則1〜3 の体系に作り直し、テーマ整合を加える。

**前提**: なし（I-2 と並行可）

**作業内容**:
- [ ] **走査範囲を書き出し対象フレーム配下に絞る**（未決13）。Review と除外物告知が `src/export/exportScope.ts` の `isExportedFrame` という**同じ関数**を通る形にする。`specBuilder.ts` の二重定義を先に潰す（U-5 起票分）
- [ ] 原則2 に従い、Review の1行＝1判断になるよう原因単位で集約する
- [ ] テーマ整合チェック5種を足す（色の未バインド／影の色／グラデーション stop の色／ペア崩れ／light に Dark 混入）。**発火判定は Export 設定の「ダークモード対応」に繋ぐ。Dark コレクションの有無で判定しない**（**D-4 (f)**）
- [ ] **「Color Style 使用」の検出を単色／複合（グラデーション・複数fill）で分岐する**（**D-4 (b)**）。単色は除外物告知のまま、複合は正式な源泉として扱う（未決4）
- [ ] ダークモード対応が ON のとき、グラデーション stop の色の未バインドを error にする（4.3.4）
- [ ] 原則3 に従い、Export とテーマ切り替えの前に自動で走らせる。結果はコレクションビューに出す（別ビューへ飛ばさない）
- [ ] セルフチェック（完了条件ごとに OK/NG。チェック結果: `.rn/20260524-build-plugin/checks/I-4.md`）
- [ ] Figma 実機で試す（実機でしか出ない不具合はここでしか見つからない）

**完了条件**:
- `isExportedFrame` の定義がリポジトリに1つしかなく、Review・spec・zip フォルダがそれを通ること
- 書き出し対象外のレイヤーの違反で Export がブロックされないこと
- ダークモード対応 OFF のファイルでテーマ整合チェックが発火しないこと（Dark コレクションが存在しても）
- 単色の Color Style は除外物告知に出て、グラデーションの Color Style は出ないこと
- 4.7.2 の全ルールに対応するテストがあり、全パスすること

---

### I-5: Export 設定と確認ビュー

**目的**: 設定4群の入力 UI・保存・`settings.json` 出力・prompt.md への反映を作る（**D-4 (d)**）。

**前提**: I-2 完了

**作業内容**:
- [ ] 設定4群の入力 UI を Export 確認ビューに作る（4.7.4.2）。レスポンシブと共通ルールは複数行の追加・削除ができること
- [ ] `figma.root.setPluginData` に保存し、次回の既定値として出す（4.7.4.3）。**フレーム参照は node id で持ち、`settings.json` 出力時に 4.5.2 の命名規約でフォルダ名へ解決する**
- [ ] **チェックのゲートは確認ビューの「実行」に掛ける。Export ボタン（確認ビューへの入口）には掛けない**（4.7.4）。入口に掛けるとダーク整合 error で設定を開けなくなるデッドロックが起きる
- [ ] 確認ビューには付け忘れの**件数**だけを出し、明細はトークンコレクションビューに戻す導線にする（4.7.4.3）
- [ ] 実行後の zip ダウンロードリンクを確認ビューに残す（4.7.4.3）
- [ ] **`settings.json` を zip ルートに1つだけ出力する**（4.5.4）。フレームフォルダに複製しない。設定が空でも必ず出す
- [ ] フォルダ名の予約リストに `settings.json` を足す（4.5.2.1）
- [ ] `prompt.md` に設定の読み方を書く（4.8.1）。「各ページを作る前にルートの `settings.json` を読む」ことと、`settings.site` のパスは zip ルート相対・`spec.json` の `screenshot` はフレームフォルダ相対であることを明記する
- [ ] `prompt.md` の「入力データの読み方」に `screenshots-dark/` と `assets-dark/` を足し、`settings.darkMode` と dark 画像の突き合わせを指示する（設計レビュー #10）
- [ ] zip 同梱 `src/templates/steering.md` の確認項目からレスポンシブ・OGP/meta・言語を外す（4.8.2）
- [ ] セルフチェック（完了条件ごとに OK/NG。チェック結果: `.rn/20260524-build-plugin/checks/I-5.md`）
- [ ] Figma 実機で試す（実機でしか出ない不具合はここでしか見つからない）

**完了条件**:
- zip に `settings.json` がルートに1つだけあり、どのフレームフォルダにも `settings` が無いこと
- 設定を入力せずに Export しても `settings.json` が出ること
- プラグインを閉じて開き直したとき、前回の設定値が入力欄に入っていること
- error が1件以上ある状態でも確認ビューを開いて設定を編集できること
- 参照先フレームをリネームしても設定の指定が切れないこと
- `prompt.md` に `settings.json` の読み順とパス基準の説明があること

---

### I-6: favicon / OG 画像の書き出し

**目的**: 設定で指定したフレームから `site/` を書き出す（**D-4 (e)**、設計書 4.5.3）。

**前提**: I-5 完了（フレーム指定の入力欄があること）

**作業内容**:
- [ ] `src/export/siteExporter.ts` を作る。`exportAsync` に実寸指定（`constraint: { type: 'WIDTH', value: 180 | 1200 }`）
- [ ] `site/favicon.svg`（SVG）・`site/apple-touch-icon.png`（180）・`site/og-image.png`（1200）を出す
- [ ] **ICO の生成手段を決めて実装する**（要検証から回ってきた項目）。Plugin API に ICO が無いため、32×32 の PNG を ICO コンテナに自前で収める
- [ ] 切り抜きも余白の追加もしない（4.5.3）。比率が合わないフレームはそのまま等比縮小する
- [ ] favicon / OG 用フレームが画面として書き出されないこと（別ページに置く運用。未決10）を確認する
- [ ] セルフチェック（完了条件ごとに OK/NG。チェック結果: `.rn/20260524-build-plugin/checks/I-6.md`）
- [ ] Figma 実機で試す（実機でしか出ない不具合はここでしか見つからない）

**完了条件**:
- 指定したフレームから4ファイルが `site/` に出ること
- 出た `.ico` がブラウザで favicon として表示できること
- favicon 用フレームが `favicon/spec.json` というページとして出ていないこと
- 設定で指定しなかった場合、`site/` が出ないこと（ただしフォルダ名の予約は残ること）

---

### I-7: 付け忘れの知らせ

**目的**: 出力は壊れていないがデザイナーが宣言し忘れたと機械的に分かる箇所を、レイヤーのプロパティとして出す（4.7.2 の(3)）。

**前提**: I-2 完了、I-4 完了

**作業内容**:
- [ ] トークンの付け忘れ（生値のまま＝トークンにバインドされていない箇所）を検出する（未決9）
- [ ] **丸い形（角丸が短辺の半分に達している）なのに `radius/full` を指していない箇所**を検出する（未決12）
- [ ] 知らせをレイヤーのシングルビューとコレクションビューの件数に出す。error にしない・Export をブロックしない
- [ ] Export 確認ビューの実行直前にも件数を出す（4.7.4.3）
- [ ] セルフチェック（完了条件ごとに OK/NG。チェック結果: `.rn/20260524-build-plugin/checks/I-7.md`）
- [ ] Figma 実機で試す（実機でしか出ない不具合はここでしか見つからない）

**完了条件**:
- 知らせが1件以上あっても Export が実行できること
- 知らせが出ているレイヤーを選ぶと、シングルビューにその内容が出ること
- `radius/full` を指していない丸い矩形が検出されること

---

### I-8: README の書き換え

**目的**: README「プラグインの使い方」と制作ルールを、Ph-9 の設計に合わせて書き直す（**D-4 (c)**、設計レビュー #7）。

**前提**: I-2〜I-7 完了（UI と挙動が確定していること）

**作業内容**:
- [ ] 「タブは3つ」以下を、OOUI の画面構成（4.7.1）に書き換える。Review / Notes / Export の節を廃し、画面の一覧・レイヤーの詳細・Export の手順で書き直す
- [ ] **Color Style の行を直す**（現在「使わない。使うと除外物として記録される」）。単色は Variables に一本化、グラデーション・複数fillは正式な源泉（未決4）
- [ ] Review の表にテーマ整合5種を足す
- [ ] zip ツリーに `site/` `screenshots-dark/` `assets-dark/` `settings.json` を足す
- [ ] Export 設定4群の説明を足す
- [ ] 制作ルールに「画面でないものは別ページへ」を足す（未決10）
- [ ] **Review の走査範囲を「ページ内の全レイヤー」から「書き出し対象の範囲」に直す**（現 README L177。設計レビュー #11-b）
- [ ] **レスポンシブの記述を直す**（現 README L169「対応関係はフレーム名で表す」）。ブレークポイントとコンテンツ幅は Export 設定で宣言するものに変わった（4.9）。フレーム名から対応を導くと読める記述は 4.9「描かれていない幅の振る舞いをツールが推測してはならない」と衝突する
- [ ] **ダークモードの制作ルールを新設する**（現 README に1行も無い）。Dark コレクションに色を入れるのはデザイナーの作業（4.3.9）なのに手順がどこにも書かれていない
- [ ] **トークン表に font-family の行を足す**（書体用にスコープを絞った STRING Variable。4.3.4。設計レビュー #11-d）
- [ ] Setup の使い方（1回きりの準備）を足す
- [ ] 設計書と食い違う記述が残っていないか、4.3 / 4.5 / 4.7 と突き合わせる
- [ ] セルフチェック（完了条件ごとに OK/NG。チェック結果: `.rn/20260524-build-plugin/checks/I-8.md`）

**完了条件**:
- README に「タブ」という語が残っていないこと
- Color Style の記述が設計書 4.3.4 と一致すること
- zip ツリーが実際の出力と一致すること
- README「プラグインの使い方」だけを読んで、Setup からExport まで一通り操作できること

---

### I-9: Ph-9 を実機で通して試す

**目的**: Setup から Export までを Figma 実機で一度通し、zip を CC に渡してコーディングできることを確かめる。

**前提**: I-1〜I-8 完了

**作業内容**:
- [ ] 新規ファイルで Setup を実行し、トークン一式ができることを確認する
- [ ] ダークモード対応 ON の LP を1本描き、テーマ切り替えで見た目が変わることを確認する
- [ ] Review を通し、error をすべて解消する
- [ ] Export して zip の中身を設計書 4.5 と突き合わせる（`settings.json` がルートに1つ、`screenshots-dark/`、`site/`）
- [ ] zip を CC に渡してコーディングさせ、ダークモードとレスポンシブが出力に反映されることを確認する
- [ ] 出た不具合をステアリングに起票する
- [ ] セルフチェック（完了条件ごとに OK/NG。チェック結果: `.rn/20260524-build-plugin/checks/I-9.md`）

**完了条件**:
- Setup → デザイン → Review → Export → CC が一度通っていること
- zip の全ファイルが設計書 4.5 のフォーマットと一致していること
- CC の出力にダークモードとレスポンシブが反映されていること
- 出た不具合がすべてステアリングに起票されていること

---

Ph-10: 状態8種の受け口
-----------------

Ph-9 の未決2（2026-09-21 決着）から分離したフェーズ。**Ph-9 が全部終わってから着手する。**

**解く問題**: default / hover / focus / active / disabled / loading / empty / error の8状態は、ハンドオフで最も抜けやすいと調査の出典が揃って指摘する項目（D-3 の調査メモ参照）。telldes には今、専用の受け口が無い。原則B「推測させない」に照らせば、宣言されていない以上 CC は推測で hover を作ることになり、出力の正確性が崩れる。

**当面の代替**: 4.7.4.2 の共通ルール（自由記述）が「状態の方針」を受けると既に書いてある。Ph-10 着手までは文章で届く。ゼロではない。

**方向（Ph-10 の設計段で詰める）**: 状態は設定でも note でもなく「描く」もの。Figma 公式の作法どおりコンポーネントのバリアントで表現してもらい、telldes はバリアント一式を `spec.json` に出す。telldes 固有の印は足さない（原則A）。したがって仕事は3つに及ぶ — `spec.json` のスキーマ拡張、Review チェック（宣言したのに描かれていない状態の検出）、README の制作ルール追加。

### V-1: Ph-10 の設計を決めて設計書に反映する

**目的**: 状態8種をどう受け取り、どう `spec.json` に出し、何を Review で見るかを決めて `docs/design.md` に書く。実装タスクはその後に定義する。

**前提**: Ph-9 完了

**作業内容**:
- [ ] バリアント一式を `spec.json` のどこに、どの形で載せるかを決める（現行の element / block とバリアントの関係、状態名の語彙）
- [ ] 8状態のうち「描くもの」と「共通ルールで足りるもの」の線引きを決める（`loading` / `empty` は画面そのものが別物になりうる）
- [ ] Review で何を見るかを決める（原則1「出力が壊れるか」に当てる）
- [ ] README の制作ルールに何を足すかを決める
- [ ] 決まった内容を `docs/design.md` に反映する
- [ ] 設計レビュー（実装前、設計書の文面を対象）
- [ ] Ph-10 の実装タスクを定義する

**完了条件**:
- 上記4点それぞれに結論と根拠が記録され、`docs/design.md` に反映されていること
- 状態が `spec.json` のどこにどう出るかが、CC が読んで実装できる粒度で設計書から追えること
- Ph-10 の実装タスクが、作業内容と完了条件つきでステアリングに定義されていること

---

State
-----

（`/rn:dn` が書き、`/rn:up` が読んでこのプレースホルダに戻す。`Status` は中断中のみ `paused`。）

* **Status**: -
* **Date**: -
* **Last completed**: -
* **Next**: -
* **Notes**: -

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
