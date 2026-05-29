# Telldes 設計書

---

## 1. 状況

FigmaでLP/HPのデザインカンプを作り、Claude Code（CC）でコーディングするワークフロー。Figma Free版を使用し、コストをかけない。デザイナー（自分）がデザインし、CCに渡してコーディングさせる。

---

## 2. ペイン

CCにデザインカンプの画像だけを渡してもコーディングの精度が低い。

- 画像からは背景とコンテンツの区別がつかない場合がある
- 色・サイズ・間隔の正確な値がわからない
- 見出しレベル（h1/h2/h3）の判断が曖昧
- レイアウトの意図（flexなのかgridなのか）が推測になる
- 動きの仕様（sticky、スクロール、カルーセル等）が伝わらない

結果、手戻りが発生する。デザインした通りにならない。

---

## 3. ベネフィット

デザイナーは作業ステップに従ってデザインするだけで、CCがデザインカンプと完全一致するコーディングをしてくれる。

- デザインに集中できる。Figmaのルールや実装の知識を意識する必要がない
- エクスポートしたzipをそのままCCに渡すだけ。CCへのプロンプトもzip内に同梱
- 手戻りゼロ

---

## 4. 実現方法

### 4.1 全体フロー

```
デザイン → 検証（プラグイン） → エクスポート（プラグイン） → CCに渡す
```

1. **デザイン**: Figmaで作業ステップに従ってLP/HPをデザインする。動きの仕様など補足はプラグインのnote機能で入力
2. **検証**: Telldesプラグインのチェックモードを実行。違反があれば改善方法が表示される。パスするまで繰り返す
3. **エクスポート**: Telldesプラグインの書き出しモードを実行。zipがダウンロードされる
4. **CCに渡す**: zipをそのままCCに渡す。zip内にCCプロンプトが同梱されている

### 4.2 用語体系

LP/HPの構造を4階層で定義する。

| 階層 | 定義 | 例 |
|---|---|---|
| **ページ** | LP/HP全体。1つの垂直Auto Layoutフレーム | LP全体 |
| **セクション** | ページ直下の意味的なまとまり | header, hero, features, pricing, footer |
| **ブロック** | セクション内の意味のあるまとまり。ブロック内にブロックを入れ子にできる | plans, plan-pro, features, item |
| **エレメント** | 末端の要素。子を持たない | heading, price, icon, cta, description |

```
ページ
├── セクション: header
│   ├── ブロック: logo
│   │   └── エレメント: image
│   └── ブロック: nav
│       ├── エレメント: link
│       ├── エレメント: link
│       └── エレメント: link
├── セクション: hero
│   └── ブロック: content
│       ├── エレメント: heading
│       ├── エレメント: description
│       └── エレメント: cta
├── セクション: pricing
│   ├── エレメント: heading
│   └── ブロック: plans
│       └── ブロック: plan-pro
│           ├── エレメント: badge
│           ├── エレメント: name
│           ├── エレメント: price
│           ├── ブロック: features
│           │   └── ブロック: item
│           │       ├── エレメント: icon
│           │       └── エレメント: text
│           └── エレメント: cta
└── セクション: footer
    └── ...
```

この階層はFigmaのレイヤーツリーでそのまま表現する。

### 4.3 Figma制作ルール

#### 4.3.1 ページ構造

ページ全体を1つの垂直Auto Layoutフレームとして構成する。
ページ直下の子要素はすべてセクション。

```
Page（VERTICAL Auto Layout）
├── header
├── hero
├── features
├── pricing
└── footer
```

#### 4.3.2 Auto Layout必須

すべてのフレームにAuto Layoutを適用する。手動配置は禁止。

理由: Auto LayoutのプロパティはCSS flexboxに1対1で対応するため、CCが機械的に変換できる。

#### 4.3.3 サイジング

各フレーム・要素のサイズ指定は以下の3パターンのみ。

| パターン | Figma設定 | CSS出力 |
|---|---|---|
| コンテンツに合わせる | Hug contents | サイズ指定なし |
| 親を埋める | Fill container | `flex-grow: 1` / `width: 100%` |
| 固定値 | Fixed + 数値 | `width: Npx` / `height: Npx` |

minWidth/maxWidth/minHeight/maxHeight も使用可。

#### 4.3.4 Variables（トークン）

Variablesの使用は必須ではない。ただしチェック時に、繰り返し使われている値（同じ色が3箇所以上、同じ間隔が複数箇所等）を検出し、「Variableにしませんか？」とフィードバックする。

Variableを使うメリット:
- CCがCSS変数を自動生成できる（同じ値を1つの変数にまとめられる）
- デザインの一貫性が保たれる

Variableを使わない場合:
- CCはspec.jsonの解決済み値（`resolvedValue`）から直接CSSを生成する
- 同じ値が複数箇所にあっても、CCは個別の値として出力する

命名規約は自由。デザイナーが意味のわかる名前を付ければよい。

#### 4.3.5 背景の扱い

背景はフレームの**fill**として設定する。背景専用の子レイヤーを作らない。

```
✅ hero (fills: [背景画像, 半透明オーバーレイ])
   └── content
       ├── heading
       └── cta

❌ hero
   ├── bg-image
   ├── overlay
   └── content
```

理由: 子要素がすべてコンテンツになり、CCはAuto Layoutの子要素＝HTMLの子要素と機械的に対応付けできる。

#### 4.3.6 命名規約

**原則: 同じ親の中でユニークであればよい。**

レイヤー名はそのノードの意味を表す短い名前。親の名前を繰り返す必要はない。Figmaのレイヤーツリーが階層情報を持つ。

```
✅ pricing > plans > plan-pro > features > item > icon
❌ pricing > pricing-plans > pricing-plan-pro > plan-pro-features > ...
```

- 同じ親の中で同名禁止
- Figmaデフォルト名（"Frame 1", "Rectangle 3"等）禁止
- 繰り返し要素はFigma Componentsでインスタンス化。同名インスタンスはレイヤー順序で区別

**CCが解釈する特別な名前:**

以下の名前を使うと、CCが対応するHTML要素に変換する。

| レイヤー名 | CCの解釈 |
|---|---|
| `header`（セクション） | `<header>` |
| `footer`（セクション） | `<footer>` |
| `nav` を含むブロック | `<nav>` |
| その他のセクション | `<section>` |
| `heading`（ページ内最初の出現） | `<h1>` |
| `heading`（セクション直下） | `<h2>` |
| `heading`（ブロック内） | `<h3>` |
| `heading` 以外のテキスト | `<p>` |
| `cta` または `button` を含むエレメント | `<button>` |

noteにリンク先の記載がある場合は `<a>` に変換される。

これらの名前を使えばCCが正しくHTMLを組む。逆に、これらの名前を使わなかった場合、CCはデフォルトで `<div>`（ブロック）または `<p>`（テキスト）として出力する。

#### 4.3.7 note（補足情報）

Figmaの標準プロパティでは伝えられない情報を、プラグインのnote機能で入力する。**必要なノードにだけ付与する。**

| 用途 | 例 |
|---|---|
| 動きの仕様 | 「スクロールしても常に画面上部に固定表示」 |
| インタラクション | 「ホバーで背景色が濃くなる」「選択すると詳細ページへ遷移」 |
| デザイン意図の補足 | 「このプランを最も目立たせたい」 |
| リンク先 | 「リンク先: /signup?plan=pro」 |
| アクセシビリティ | 「スクリーンリーダー用ラベル: 会社ロゴ」 |
| カルーセル等 | 「画像をループ表示。自動再生3秒間隔」 |

noteの内容はデザイナーの言葉で自由に書く。CCが内容を読んで実装を判断する。

#### 4.3.8 画像アセット

画像を含むノードは書き出し時に自動でアセットファイルとして出力される。ファイル名はレイヤーパスベースで重複しない。

| 種類 | 書き出し形式 | 出力先の例 |
|---|---|---|
| 写真・ラスター画像 | PNG (2x) | `assets/images/hero--content--image.png` |
| アイコン・ロゴ（ベクター） | SVG | `assets/icons/header--logo--icon.svg` |

パスの `--` 区切りはスクリーンショットと同じ規則。

### 4.4 カンプとスペックの紐付け

CCがスペックの各ノードをカンプのどの部分に対応するか特定するための仕組み。

#### 4.4.1 紐付けの3つの情報源

1. **スクリーンショット** — セクション単位＋ブロック単位の画像
2. **レイヤーパス** — Figmaのレイヤーツリーから生成されるフルパス
3. **レイヤー順序** — Auto Layout内の子要素の並び順がカンプの視覚的配置と一致

#### 4.4.2 スクリーンショットの粒度

セクション画像に加えて、子を持つブロックの画像も書き出す。

```
screenshots/
├── header.png
├── hero.png
├── pricing.png
├── pricing--plans.png
├── pricing--plans--plan-pro.png
├── pricing--plans--plan-pro--features.png
└── footer.png
```

ファイル名はレイヤーパスを `--` で結合。

書き出し対象: セクション（必須）＋ 子を持つブロック（自動）。エレメント（末端）は書き出さない。

### 4.5 出力フォーマット

エクスポート時にzipとしてダウンロードされる内容:

```
telldes-export/
├── prompt.md          ← CCプロンプト（自動生成）
├── steering.md        ← 確認・タスク・ルール（テンプレート）
├── tokens.json        ← デザイントークン（Variablesが定義されている場合のみ）
├── {フレーム名}/       ← トップレベルフレームごとにフォルダ
│   ├── spec.json      ← デザインスペック
│   ├── screenshots/   ← セクション＋ブロック画像
│   └── assets/
│       ├── images/    ← ラスター画像
│       └── icons/     ← ベクターアセット
```

LPの場合はフレーム1つ（例: `lp/`）、HPの場合はページごとにフレームを作成し、それぞれがフォルダとして出力される（例: `top/`, `about/`, `contact/`）。

#### 4.5.1 tokens.json

Variablesが定義されている場合のみ出力。W3C Design Tokens Community Groupの仕様に準拠。

```json
{
  "color": {
    "bg-primary": {
      "$type": "color",
      "$value": "#3B82F6"
    },
    "text-primary": {
      "$type": "color",
      "$value": "#111827"
    }
  },
  "spacing": {
    "section-gap": {
      "$type": "number",
      "$value": 48
    },
    "content-gap": {
      "$type": "number",
      "$value": 16
    }
  }
}
```

Variablesの構造をそのままJSON化する。デザイナーの命名がそのままトークン名になる。

#### 4.5.2 spec.json（デザインスペック）

ページの階層構造を再帰的に表現。

```json
{
  "page": "LP - Product Name",
  "viewport": { "width": 1440 },
  "children": [
    {
      "name": "pricing",
      "type": "section",
      "path": "pricing",
      "screenshot": "screenshots/pricing.png",
      "layout": {
        "direction": "VERTICAL",
        "primaryAxisAlign": "MIN",
        "counterAxisAlign": "CENTER",
        "padding": { "top": 80, "right": 24, "bottom": 80, "left": 24 },
        "gap": 48,
        "sizing": { "width": "FILL", "height": "HUG" }
      },
      "children": [
        {
          "name": "heading",
          "type": "element",
          "path": "pricing > heading",
          "nodeType": "TEXT",
          "text": {
            "characters": "Pricing Plans",
            "fontSize": 28,
            "fontSizeToken": "font-size/heading",
            "fontFamily": "Inter",
            "fontWeight": 700,
            "fill": "#111827",
            "fillToken": "color/text-primary"
          }
        },
        {
          "name": "plans",
          "type": "block",
          "path": "pricing > plans",
          "screenshot": "screenshots/pricing--plans.png",
          "layout": {
            "direction": "HORIZONTAL",
            "counterAxisAlign": "MIN",
            "gap": 24,
            "sizing": { "width": "FILL", "height": "HUG" }
          },
          "children": [
            {
              "name": "plan-pro",
              "type": "block",
              "path": "pricing > plans > plan-pro",
              "screenshot": "screenshots/pricing--plans--plan-pro.png",
              "note": "このプランを最も目立たせたい。おすすめプラン。",
              "layout": {
                "direction": "VERTICAL",
                "padding": { "top": 32, "right": 24, "bottom": 32, "left": 24 },
                "gap": 16,
                "sizing": { "width": "FILL", "height": "HUG" }
              },
              "fills": [
                {
                  "type": "SOLID",
                  "color": "#3B82F6",
                  "colorToken": "color/bg-primary"
                }
              ],
              "cornerRadius": 8,
              "cornerRadiusToken": "radius/card",
              "children": [
                {
                  "name": "badge",
                  "type": "element",
                  "path": "pricing > plans > plan-pro > badge",
                  "nodeType": "TEXT",
                  "note": "おすすめであることを示すラベル",
                  "text": {
                    "characters": "おすすめ",
                    "fontSize": 14,
                    "fontFamily": "Inter",
                    "fontWeight": 600
                  }
                },
                {
                  "name": "cta",
                  "type": "element",
                  "path": "pricing > plans > plan-pro > cta",
                  "nodeType": "TEXT",
                  "note": "リンク先: /signup?plan=pro",
                  "text": {
                    "characters": "無料で始める",
                    "fontSize": 16,
                    "fontFamily": "Inter",
                    "fontWeight": 600
                  }
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

設計方針:
- `type` で用語体系（section / block / element）を明示
- `path` でレイヤーのフルパスを持つ（紐付け用）
- `screenshot` は子を持つノード（セクション、ブロック）に付与
- 値は常に解決済み値を持つ。Variableが適用されている場合は `*Token` フィールドにトークン名も付与
- `note` は付与されたノードにのみ存在

### 4.6 Auto Layout → CSS flexbox 対応表

| Figma Auto Layout | CSS flexbox |
|---|---|
| `layoutMode: "HORIZONTAL"` | `flex-direction: row` |
| `layoutMode: "VERTICAL"` | `flex-direction: column` |
| `layoutWrap: "WRAP"` | `flex-wrap: wrap` |
| `itemSpacing` | `gap` |
| `paddingTop/Right/Bottom/Left` | `padding` |
| `primaryAxisAlignItems: "MIN"` | `justify-content: flex-start` |
| `primaryAxisAlignItems: "CENTER"` | `justify-content: center` |
| `primaryAxisAlignItems: "MAX"` | `justify-content: flex-end` |
| `primaryAxisAlignItems: "SPACE_BETWEEN"` | `justify-content: space-between` |
| `counterAxisAlignItems: "MIN"` | `align-items: flex-start` |
| `counterAxisAlignItems: "CENTER"` | `align-items: center` |
| `counterAxisAlignItems: "MAX"` | `align-items: flex-end` |
| `primaryAxisSizingMode: "AUTO"` | `flex-basis: auto` |
| `primaryAxisSizingMode: "FIXED"` | 固定サイズ |
| `counterAxisSizingMode: "AUTO"` | コンテンツ依存 |
| `counterAxisSizingMode: "FIXED"` | 固定サイズ |
| 子の `layoutAlign: "STRETCH"` | `align-self: stretch` |
| 子の `layoutGrow: 1` | `flex-grow: 1` |
| `counterAxisAlignContent: "SPACE_BETWEEN"` (wrap時) | `align-content: space-between` |

### 4.7 プラグイン仕様

#### 4.7.1 概要

Telldesプラグインは以下の3つの機能を提供する。

1. **チェック**: 制作ルール違反の検出＋改善方法の提示
2. **note入力**: 選択中ノードにnoteを入力・編集するUI
3. **書き出し**: デザインスペック＋トークン＋スクリーンショット＋アセット＋CCプロンプトをzipで出力

#### 4.7.2 チェック

ページ内の全ノードを走査し、違反を検出する。各違反に改善方法を提示する。

**構造チェック（エラー）:**
- Auto Layout未適用のフレーム → 「Auto Layoutを適用してください」
- Figmaデフォルト名のレイヤー → 「意味のある名前を付けてください」
- 同一親内での重複レイヤー名 → 「名前を変更して区別してください」
- 背景を子レイヤーとして配置 → 「フレームのfillに設定してください」

**サイジングチェック（エラー）:**
- Hug/Fill/Fixed以外の曖昧なサイジング → 「Hug/Fill/Fixedのいずれかに設定してください」

**Variablesチェック（提案）:**
- 同じ色が3箇所以上使用 → 「この色をVariableに登録しませんか？」
- 同じspacing/padding値が複数箇所 → 「この間隔をVariableに登録しませんか？」
- 同じfont-size値が複数箇所 → 「このフォントサイズをVariableに登録しませんか？」

エラーは書き出し前に解消必須。提案は無視してもよい。

#### 4.7.3 note入力UI

プラグインパネルにテキスト入力欄を表示。選択中ノードのnoteを読み書きする。

- ノード選択で既存noteを表示
- テキスト入力→保存で `setPluginData('note', value)` に保存
- noteが設定済みのノードには `setRelaunchData` でプロパティパネルに編集ボタンを表示

#### 4.7.4 書き出し

エラーゼロの状態でのみ実行可能（提案は無視可）。

出力物をzipにまとめてダウンロード:
1. `prompt.md` — CCプロンプト
2. `steering.md` — 確認・タスク・ルール（テンプレート）
3. `tokens.json` — デザイントークン（Variablesが定義されている場合のみ）
4. `spec.json` — デザインスペック
5. `screenshots/` — セクション＋ブロック単位のPNG画像
6. `assets/images/` — ラスター画像（PNG 2x）
7. `assets/icons/` — ベクターアセット（SVG）
8. `README.md` — zip内容の説明

zip生成にはJSZipライブラリを使用。プラグインUI内でBlobを生成しダウンロードリンクを表示する。

#### 4.7.5 プラグインAPI使用箇所

| 機能 | API |
|---|---|
| ノード走査 | `figma.currentPage`, `node.children` 再帰 |
| Auto Layoutプロパティ取得 | `node.layoutMode`, `node.itemSpacing`, `node.paddingTop` 等 |
| note読み書き | `node.setPluginData('note', value)`, `node.getPluginData('note')` |
| 再起動ボタン | `node.setRelaunchData({ editNote: '' })` |
| Variable取得 | `node.boundVariables`, `figma.variables.getLocalVariables()` |
| スクリーンショット | `node.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: 2 } })` |
| ベクターアセット | `node.exportAsync({ format: 'SVG_STRING' })` |

#### 4.7.6 配布

Figma Communityに公開。Free版含むどのプランからでもインストール・利用可能。ソースコードはGitHubで管理。

### 4.8 CCプロンプト設計

zip内に同梱されるCC向けファイルは2つ。

#### 4.8.1 prompt.md（作業指示書）

CCへのコーディング指示。エクスポート時にプラグインが自動生成する。

**構成:**

1. **概要**: このzipの内容と使い方
2. **入力データの読み方**: tokens.json、spec.json、screenshots/、assets/ の説明
3. **最初にやること**: steering.mdを読み、spec.jsonとnoteから埋められる項目を埋める。不明点はユーザーにヒアリングする。steering.mdの合意が取れてからコーディングに入る
4. **コーディング手順**:
   - tokens.json → CSS変数定義を生成（ある場合）
   - spec.json → 階層構造からHTML DOM構造を構築
   - layout プロパティ → CSS flexboxスタイルを生成（対応表付き）
   - fills, text 等 → ビジュアルスタイルを生成
   - asset パス → `<img>` / インラインSVGを配置
   - screenshots/ → 見た目の妥当性を検証
   - note → 動き・インタラクション等の実装
5. **HTML導出ルール**（4.3.6節の「CCが解釈する特別な名前」）
6. **Auto Layout → CSS flexbox対応表**（4.6節の内容）
7. **完了時**: steering.mdのチェックリストで自己検証する

#### 4.8.2 steering.md（確認・タスク・ルール）

コーディング着手前の確認リスト、作業中のタスクリスト、守るべきルールをまとめたファイル。プラグインがテンプレートとして出力する。

CCはspec.jsonやnoteから埋められる項目を自動で埋め、不明点だけユーザーにヒアリングする。合意後はコーディングのチェックリストとしても使う。

**含まれる内容（詳細は実装時に決定）:**

- **確認項目**: 出力形式、CSS方針、レスポンシブ、画像パス構成、コンポーネント分割粒度、フォント読み込み、デプロイ先、OGP/meta情報 等
- **タスクリスト**: コーディング作業のステップと完了チェック
- **ルール**: コーディング時に守るべき規約

### 4.9 レスポンシブ対応

レスポンシブが必要な場合は、デスクトップ（1440px）とモバイル（375px）をそれぞれ別フレームとして作成する。他のフレームと同様にフレーム名でフォルダ分けされて出力される。

```
telldes-export/
├── prompt.md
├── steering.md
├── tokens.json          ← 共通（ある場合）
├── top-desktop/
│   ├── spec.json
│   ├── screenshots/
│   └── assets/
├── top-mobile/
│   ├── spec.json
│   ├── screenshots/
│   └── assets/
```

tokens.jsonは共通。差異はレイアウト構造（spec.json）のみ。デスクトップとモバイルの対応はフレーム名で表現する（命名はデザイナーに委ねる）。

グリッドレイアウトが必要な場合は、Auto LayoutのWRAP + 子要素のminWidth/maxWidthで表現する。

### 4.10 Free版の制約と対応

| 制約 | 影響 | 対応 |
|---|---|---|
| Variable Modes不可 | ダークモード切り替え不可 | 必要時はCC側でメディアクエリ対応 |
| デザインファイル3つまで | LP/HP数の上限 | 1ファイル内でページ分割 |
| 共有ライブラリ不可 | ファイル間Variables共有不可 | 1ファイル内で完結 |
| アノテーション不可 | 標準UIで補足情報を付けられない | プラグインのnote入力UIで代替 |
| プライベートプラグイン不可 | 組織内限定配布不可 | Figma Communityに公開 |
