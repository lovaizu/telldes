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

例外: 装飾アイコンなど「レイアウトを持たない」要素（円＋矢印を重ねたサークルアロー等、内部パーツを絶対配置するもの）は、Frameではなく**Group**でまとめる。Reviewの「Auto Layout未適用のフレーム」チェックはFRAME/COMPONENT系のみを対象とし、GROUPは対象外とするため、Groupなら警告が出ない。子を持つFrameをAuto Layoutなしで使うとエラー（Exportもブロック）になる点に注意。

#### 4.3.3 サイジング

各フレーム・要素のサイズ指定は以下の3パターンのみ。

| パターン | Figma設定 | CSS出力 |
|---|---|---|
| コンテンツに合わせる | Hug contents | サイズ指定なし |
| 親を埋める | Fill container | `flex-grow: 1` / `width: 100%` |
| 固定値 | Fixed + 数値 | `width: Npx` / `height: Npx` |

minWidth/maxWidth/minHeight/maxHeight も使用可。

#### 4.3.4 トークンの源泉（方針）

**基本姿勢**: ツールが無視・変換するものは必ず利用者に告知する（暗黙のドロップ/スキップ禁止）。利用者が「何がトークンになり、何が値展開されるか」を予測できる状態を保つ。

Figma現行のベストプラクティスに合わせ、トークンの源泉を以下に定める。

| Figmaの仕組み | 用途 | Telldesの扱い |
|---|---|---|
| **Variables（COLOR）** | カラー | `tokens.json` に named token として出力 |
| **Variables（FLOAT/number）** | スペーシング・サイズ等の数値 | `tokens.json` に named token として出力 |
| **Text Style** | タイポグラフィ（font-family/size/weight/line-height） | named typography token として出力し、spec から参照 |
| **Color Style** | カラー | 非推奨。Reviewで「Variable化しませんか」と誘導（Figma本体もVariables推奨） |
| Variables（STRING/BOOLEAN） | — | トークン対象外。使用時はReviewで「未対応」を警告 |

カラーは **Variables に一本化**する。Color Style はトークン源泉として扱わず、Variableへの移行をReviewで促す。

Variablesの使用そのものは必須ではない。使わない場合、CCはspec.jsonの解決済み値（`resolvedValue`）から直接CSSを生成する（同じ値が複数箇所でも個別値として出力）。チェック時に繰り返し使われている値を検出し「Variableにしませんか？」と提案する。

命名規約は自由。ただし意味の一貫性のため、以下の**推奨トークン体系**を指針とする。Reviewの提案（4.7.2）はこの語彙で命名を促す。**telldesは値をどのスロットに割り当てるかを自動判定しない**（誤検知を避けるため）。「この値はトークン化を推奨。命名はこの体系から選ぶ」までを案内し、具体的なスロット選択はデザイナーが行う。

```
Color（Variables COLOR）
  brand:    primary / primary-hover / secondary
  neutral:  bg / surface / text-primary / text-secondary / text-tertiary / border
  status:   success / warning / error / info（各々 -bg と -text に分割）
Typography（Text Style名）
  display / heading-lg / heading-md / heading-sm / body / lead / caption / label
Spacing（Variables FLOAT）
  xs / sm / md / lg / xl / 2xl
Radius（Variables FLOAT）
  sm / md / lg / full
Elevation（Effect Style / drop shadow）
  shadow-sm / shadow-md / shadow-lg
```

Elevation（ドロップシャドウ）の命名指針はReviewで案内するが、現状 `spec.json` はeffectを出力しない（別途対応）。この体系は命名の共通語彙として、デザイナーとCCが同じ言葉を使うための指針である。

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
├── README.md          ← zip内容の説明
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

color トークンの `$value` は #RRGGBB（6桁）。アルファが 1 未満の場合のみ #RRGGBBAA（8桁）で表現する。エイリアス（他トークンの参照）は解決済みの値に展開する。

あるトークン名が、別のトークンのグループ接頭辞と一致する場合（例: `color` と `color/primary` が併存）、グループ自身の値は予約キー `$base` に格納する（例: `color.$base` と `color.primary` の両方を保持）。これにより同名の値が失われない。

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

#### 4.5.2.1 フィールド詳細

上記の基本例に加え、以下のフィールドを出力する。いずれも該当する値が存在する場合のみ付与する（存在しない場合はフィールド自体を省略する）。

**fills（背景・塗り）**

`fills` 配列の各要素は `type` で種類を表す。

| type | フィールド | 説明 |
|---|---|---|
| `SOLID` | `color`（#RRGGBB）, `colorToken?`, `opacity?` | 単色塗り |
| `IMAGE` | `scaleMode`（`FILL`/`FIT`/`CROP`/`TILE`）, `opacity?` | 画像塗り。画像実体は `assets/images/{レイヤーパス}.png` に書き出される（コンテナの背景画像は塗りのソース画像をそのまま書き出す） |
| `GRADIENT_LINEAR` / `GRADIENT_RADIAL` / `GRADIENT_ANGULAR` / `GRADIENT_DIAMOND` | `gradientStops`（`[{ position, color }]`）, `gradientTransform`, `opacity?` | グラデーション。`position` は 0〜1、`color` は #RRGGBB（アルファ < 1 の場合は #RRGGBBAA）。`gradientTransform` は 2x3 変換行列で角度/中心/スケールを表す |

- `opacity` は塗りの不透明度が 1 未満の場合のみ付与する数値（0〜1）。半透明オーバーレイ（4.3.5）の再現に使う。
- IMAGE / GRADIENT を含む全種類の塗りを `fills` に出力する（SOLID 以外を欠落させない）。

**text.fill**

テキスト色も塗りの不透明度が 1 未満の場合は `text.fillOpacity`（0〜1）を付与する。

**cornerRadius**

- 全角共通の場合: 数値（例 `8`）。Variable 適用時は `cornerRadiusToken`。
- 角ごとに異なる場合: オブジェクト `{ "topLeft": n, "topRight": n, "bottomRight": n, "bottomLeft": n }`。

**layout.sizing**

- `width` / `height` はサイジングモード（`FILL` / `HUG` / `FIXED`）。`FIXED` の場合は実ピクセル値 `widthPx` / `heightPx` を併せて付与する。
- 4.3.3 で許可される最小/最大サイズが設定されている場合、`minWidth` / `maxWidth` / `minHeight` / `maxHeight`（数値）を付与する。
- Auto Layout コンテナ以外のノード（末端要素など）でも、Auto Layout の子であればサイジング情報を持つ。その場合 `layout` は `direction` 等を持たず `sizing` のみを含む。

**background（ページ背景）**

トップレベルフレーム自身の塗りはページ全体の背景（4.3.5）であり子ノードにはならないため、spec.json のトップレベルに `background`（`fills` と同じ形式の配列）として出力する。塗りがない場合はフィールドを省略する。

**path / ファイル名の一意性**

同一親内に同名の子（レイヤー順序で区別する同名インスタンス等、4.3.6）がある場合、2つ目以降の `path` セグメントとスクリーンショット/アセットのファイル名に `-2`, `-3` … の接尾辞を付けて一意化する。これにより spec.json の参照とファイル名が常に一致する。トップレベルフレーム名が重複する場合も、フォルダ名に同じ規則で接尾辞を付ける。

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
- Auto Layout未適用のフレーム → 「Auto Layoutを適用してください」（装飾アイコン等はGroupにする。4.3.2の例外）
- Figmaデフォルト名のレイヤー → 「意味のある名前を付けてください」
- 同一親内での重複レイヤー名 → 「名前を変更して区別してください」
- 背景を子レイヤーとして配置 → 「フレームのfillに設定してください」

**サイジングチェック（エラー）:**
- Hug/Fill/Fixed以外の曖昧なサイジング → 「Hug/Fill/Fixedのいずれかに設定してください」

**Variablesチェック（提案）:** いずれも命名は推奨トークン体系（4.3.4）から選ぶよう案内する。値→スロットの自動判定はしない。
- 同じ色が3箇所以上使用 → 「この色をVariableに登録しませんか？（命名は color 体系: brand / neutral / status から）」
- 同じspacing/padding値が複数箇所 → 「この間隔をVariableに登録しませんか？（命名は spacing スケール: xs〜2xl から）」
- 同じfont-size値が複数箇所 → 「Text Style にまとめませんか？（命名は typography スケール: display〜label から）」
- 同じcorner radius値が複数箇所 → 「この角丸をVariableに登録しませんか？（命名は radius スケール: sm / md / lg / full から）」
- 同じdrop shadowが複数箇所 → 「この影を Effect Style にまとめませんか？（命名は elevation スケール: shadow-sm / md / lg から）」

**源泉・範囲チェック（提案／告知）:**「予測できない動き」を防ぐため、ツールが対象外にするものは黙って捨てずReviewで知らせる。
- Color Styleを使用 → 「Variableに移行しませんか？（カラーはVariablesに一本化）」（4.3.4）
- STRING/BOOLEAN Variableを使用 → 「これらはトークン出力対象外です」と告知
- ページ直下に裸で置かれたComponent/Component Set定義 → 「書き出し対象外です。画面フレーム内にインスタンスとして配置するか、ライブラリページへ」（4.7.4の範囲方針）

エラーは書き出し前に解消必須。提案・告知は無視してもよい。

#### 4.7.3 note入力UI

プラグインパネルにテキスト入力欄を表示。選択中ノードのnoteを読み書きする。

- ノード選択で既存noteを表示
- テキスト入力→保存で `setPluginData('note', value)` に保存
- noteが設定済みのノードには `setRelaunchData` でプロパティパネルに編集ボタンを表示

#### 4.7.4 書き出し

エラーゼロの状態でのみ実行可能（提案は無視可）。

**書き出し範囲の方針**: 出力単位は「画面フレーム」とする。具体的にはページ直下の `FRAME` および `SECTION` を対象とし、各フレームを1ページ/ビューポートとして書き出す。再利用部品は、画面フレーム内に配置された**インスタンスを展開してspec/スクリーンショットに含める**（コード化の単一の真実はレンダリング結果）。ページ直下に裸で置かれたComponent/Component Set定義そのものは書き出し対象外で、Reviewで告知する（4.7.2）。デザイナーの定石どおり、主コンポーネントはライブラリとして別ページ/別エリアにまとめ、画面はフレームで構成する運用を前提とする。

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
