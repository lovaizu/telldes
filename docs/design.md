# Telldes 設計書

利用者が「何をするか」は [README](../README.md) が正。本書は「なぜそうしたか」— 設計判断・意図・決定事項 — と、CC・実装に対する出力の契約（4.4〜4.6、4.8）を持つ。両者が食い違ったら不具合。

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

ページ／セクション／ブロック／エレメントの4階層。定義は README「用語」が正。この階層を Figma のレイヤーツリーでそのまま表現させる、という決定が spec.json の `type`（4.5.2）と紐付け（4.4）の前提になっている。

### 4.3 Figma制作ルール

ルールそのもの（デザイナーが従う手順）は README「Figma での作り方」が正。本節はルールを置いた理由と、ツール側の判断だけを持つ。

#### 4.3.1 ページ構造

ページ直下＝セクションと固定する。spec.json の第1階層がそのままセクション列になり、CC がページ構造を推測せずに済む。

#### 4.3.2 Auto Layout必須

理由: Auto LayoutのプロパティはCSS flexboxに1対1で対応するため、CCが機械的に変換できる（4.6）。

Group を例外にする判断: 装飾アイコンのように内部パーツを絶対配置するものは Auto Layout で表現できない。Review の「Auto Layout未適用」チェックは FRAME/COMPONENT 系のみを対象とし GROUP を外すことで、こうした要素を Group にまとめれば警告なく通る逃げ道を用意している。子を持つ Frame に Auto Layout が無い場合はエラー（Export もブロック）。

#### 4.3.3 サイジング

Hug / Fill / Fixed の3つに限定するのは、CSS への対応が一意に決まるものだけを許すため。

| Figma設定 | CSS出力 |
|---|---|
| Hug contents | サイズ指定なし |
| Fill container | `flex-grow: 1` / `width: 100%` |
| Fixed + 数値 | `width: Npx` / `height: Npx` |

minWidth/maxWidth/minHeight/maxHeight は同じく一意に対応するため許す（spec.json では `layout.sizing` に載る。4.5.2.1）。

#### 4.3.4 トークンの源泉（方針）

**基本姿勢**: ツールが無視・変換するものは必ず利用者に告知する（暗黙のドロップ/スキップ禁止）。利用者が「何がトークンになり、何が値展開されるか」を予測できる状態を保つ。

Figma現行のベストプラクティスに合わせ、トークンの源泉を以下に定める。

| Figmaの仕組み | 用途 | Telldesの扱い |
|---|---|---|
| **Variables（COLOR）** | カラー | `tokens.json` に named token として出力 |
| **Variables（FLOAT/number）** | スペーシング・サイズ等の数値 | `tokens.json` に named token として出力 |
| **Text Style** | タイポグラフィ（font-family/size/weight/line-height） | named typography token として出力し、spec から参照 |
| **Color Style** | カラー | 非推奨。トークン源泉として扱わず、使用時は書き出し時のREADMEに除外物として記録（Figma本体もVariables推奨） |
| Variables（STRING/BOOLEAN） | — | トークン対象外。使用時は書き出し時のREADMEに除外物として記録 |

カラーは **Variables に一本化**する。Color Style はトークン源泉として扱わず、使用していた場合は書き出し時にREADMEで告知する（4.7.2）。

Variablesの使用そのものは必須ではない。使わない場合、CCはspec.jsonの解決済み値（`resolvedValue`）から直接CSSを生成する（同じ値が複数箇所でも個別値として出力）。出力の正しさは変わらないため、Variable化はデザイナーの判断に委ね、ツールは促さない。

命名規約は自由。ただし意味の一貫性のため、以下の**推奨トークン体系**を本ドキュメント上の指針として示す（プラグインが命名を促すことはしない）。**telldesは値をどのスロットに割り当てるかを自動判定しない**（誤検知を避けるため）。「トークン化する値の命名はこの体系から選ぶ」という共通語彙の提示までが本書の役割で、トークン化の要否と具体的なスロット選択はデザイナーが行う。

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

Elevation（ドロップシャドウ）の命名指針も本体系に含めるが、プラグインが命名を促すことはしない。影の実値は `spec.json` の `effects`（4.5.2.1）に出力されるため、Effect Style にまとめなくても CC には届く。この体系は命名の共通語彙として、デザイナーとCCが同じ言葉を使うための指針である（Effect Style を named token として tokens.json に出す対応は Text Style トークンと同じく別途）。

#### 4.3.5 背景の扱い

背景をフレームの fill に限定する理由: 子要素がすべてコンテンツになり、CCはAuto Layoutの子要素＝HTMLの子要素と機械的に対応付けできる。背景専用の子レイヤーを許すと、CC は画像から「これは背景か中身か」を推測することになる（2. ペイン）。

#### 4.3.6 命名規約

「同じ親の中でユニークであればよい」とする理由: 階層情報は Figma のレイヤーツリーが持っているので、名前に親を繰り返させる必要がない。ユニーク性の単位を親に限ることで、spec.json の `path` とファイル名の一意化（4.5.2「path / ファイル名の一意性」）が親ごとの `-N` 付与だけで済む。

**CCが解釈する特別な名前**（`header` / `footer` / `nav` / `heading` / `cta` / `button`）の一覧は README「レイヤー名」が正。`prompt.md`（4.8.1 の「HTML導出ルール」）はそれを転記する。名前から HTML 要素を導くのは、デザイナーに HTML を意識させずに見出しレベルとランドマークを決めるため。

#### 4.3.7 note（補足情報）

Figmaの標準プロパティでは伝えられない情報（動き・インタラクション・意図・リンク先・アクセシビリティ）の受け皿。Free 版にはアノテーション機能が無い（4.10）ため、プラグイン側で `setPluginData` に持つ。内容を自由記述にしているのは、構造化するとデザイナーが書けることを狭めるから — 解釈は CC に委ねる。

#### 4.3.8 画像アセット

画像を含むノードは書き出し時に自動でアセットになる（形式と出力先は README「画像」）。ファイル名はレイヤーパスを `--` で結合したもので、スクリーンショット（4.4.2）と同じ規則。同じ規則にしておくと spec.json の `path` からファイル名が機械的に導ける。

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
├── tokens.json        ← デザイントークン（対応Variables（COLOR/FLOAT）またはText Styleが定義されている場合のみ）
├── README.md          ← zip内容の説明＋今回の書き出しの除外物（4.7.2）
├── {フレーム名}/       ← トップレベルフレームごとにフォルダ
│   ├── spec.json      ← デザインスペック
│   ├── screenshots/   ← セクション＋ブロック画像
│   └── assets/
│       ├── images/    ← ラスター画像
│       └── icons/     ← ベクターアセット
```

LPの場合はフレーム1つ（例: `lp/`）、HPの場合はページごとにフレームを作成し、それぞれがフォルダとして出力される（例: `top/`, `about/`, `contact/`）。

#### 4.5.1 tokens.json

対応Variables（COLOR/FLOAT。STRING/BOOLEANはトークン化対象外）またはText Styleのいずれかが定義されている場合のみ出力。どちらも未定義の場合は`tokens.json`自体を出力しない。W3C Design Tokens Community Groupの仕様に準拠。

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
  },
  "typography": {
    "heading-md": {
      "$type": "typography",
      "$value": {
        "fontFamily": "Inter",
        "fontSize": 28,
        "fontWeight": 700,
        "lineHeight": "36px",
        "letterSpacing": "0em"
      }
    }
  }
}
```

Variablesの構造をそのままJSON化する。デザイナーの命名がそのままトークン名になる。

`typography` グループは Text Style から出力する（4.3.4「Text Style は named typography token として出力し、spec から参照」）。Variables ではなく Text Style が源泉である点が color/spacing と異なるが、`tokens.json` 上のトークンとしての扱いは同じ。`$type` は `"typography"`、`$value` は `fontFamily` / `fontSize` / `fontWeight` / `lineHeight` / `letterSpacing` を持つ複合値（W3C DTCG の composite token 形式）とする。トークン名（上記例の `heading-md`）は Text Style 名をそのまま用いる。命名は自由だが、4.3.4 の推奨トークン体系（`display` / `heading-lg` / `heading-md` / `heading-sm` / `body` / `lead` / `caption` / `label`）に従うことを推奨する。

`$value` は Text Style の canonical な定義値であり、個々のノードに対する解決済みメトリクスではない。そのため 4.5.2.1 の `text.*` フィールドで採用している「既定値は省略」という間引き規約はここには適用されず、各値が既定的かどうかに関わらず `fontFamily` / `fontSize` / `fontWeight` / `lineHeight` / `letterSpacing` の 5 キーを常にすべて含める（例の `"letterSpacing": "0em"` はこの規約により省略しない）。`lineHeight` が Text Style 上 AUTO 設定の場合も同様に省略や `"AUTO"` という文字列での出力はせず、CSS の `line-height: normal` に相当するキーワード文字列 `"normal"` を `$value.lineHeight` に出力する（Figma Plugin API は AUTO 設定の描画後 line-height をpx値として提供しないため、CSS 側の意味的な等価表現を用いる）。これは mixed 値を先頭文字の値で解決する他フィールドの方針と同じく、`$value` が常に具体的な解決値を持つようにするためである。

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

**effects（影・ぼかし）**

可視の effect を `effects` 配列として出力する（描画に効くため暗黙に捨てない。4.3.4 の基本姿勢）。各要素は `type` で種類を表す。

| type | フィールド | CSS 対応 |
|---|---|---|
| `DROP_SHADOW` | `color`（#RRGGBB/#RRGGBBAA）, `offsetX`, `offsetY`, `blur`, `spread?` | `box-shadow: offsetX offsetY blur spread color` |
| `INNER_SHADOW` | 同上 ＋ `inset: true` | `box-shadow: inset ...` |
| `LAYER_BLUR` | `blur` | `filter: blur(blur px)` |
| `BACKGROUND_BLUR` | `blur` | `backdrop-filter: blur(blur px)` |

- `blur` は Figma の `effect.radius`。`spread` は 0 のとき省略。非可視 effect は出力しない。
- Effect Style を named token として `tokens.json` に出す対応は未実装（Text Style トークンと同様の別途対応）。現状は解決済みの実値のみ出力する。

**text（タイポグラフィのメトリクス）**

`text` には `characters` / `fontSize` / `fontFamily` / `fontWeight` に加え、描画に効くメトリクスを CSS 相当で出力する（該当時のみ）。`figma.mixed` の場合は先頭文字の値で解決する。

| フィールド | 値の例 | 備考 |
|---|---|---|
| `lineHeight` | `"24px"` / `"150%"` | AUTO（既定）は省略 |
| `letterSpacing` | `"0.5px"` / `"0.02em"` | PERCENT はフォントサイズ比＝em に変換。0 は省略 |
| `textAlign` | `center` / `right` / `justify` | LEFT（既定）は省略 |
| `textCase` | `uppercase` / `lowercase` / `capitalize` / `small-caps` | ORIGINAL（既定）は省略 |
| `textDecoration` | `underline` / `line-through` | NONE（既定）は省略 |

- `typographyToken`: ノードの `textStyleId` が単一の Text Style を指している場合のみ付与する文字列（例 `"typography/heading-md"`。命名は `tokens.json` の `typography` トークン名（4.5.1）と対応する）。`textStyleId` が `figma.mixed`（複数の Text Style が混在）の場合、単一のトークン名で表せないため `typographyToken` は付与しない（他フィールドのような先頭文字での解決は行わない）。Text Style が適用されていないノードも同様に省略する。
- `typographyToken` と `fontSizeToken` / `fillToken` などのプロパティ単位のトークンは独立しており、併存しうる。`typographyToken` は適用された Text Style を表し、`fontSizeToken` / `fillToken` は個々のプロパティに直接バインドされた Variable を表すため、両者は排他的ではない。同一ノードがどちらか一方のみ、両方、またはいずれも持たない場合があり、各フィールドは加算的（additive）に付与される。

**opacity（ノード不透明度）**

ノード自身の不透明度が 1 未満の場合のみ `opacity`（0〜1）を出力する。塗り単位の `opacity`（fills 内）／テキスト色の `fillOpacity` とは別のノード全体の不透明度。

**layout.sizing**

- `width` / `height` はサイジングモード（`FILL` / `HUG` / `FIXED`）。`FIXED` の場合は実ピクセル値 `widthPx` / `heightPx` を併せて付与する。
- 4.3.3 で許可される最小/最大サイズが設定されている場合、`minWidth` / `maxWidth` / `minHeight` / `maxHeight`（数値）を付与する。
- Auto Layout コンテナ以外のノード（末端要素など）でも、Auto Layout の子であればサイジング情報を持つ。その場合 `layout` は `direction` 等を持たず `sizing` のみを含む。

**background（ページ背景）**

トップレベルフレーム自身の塗りはページ全体の背景（4.3.5）であり子ノードにはならないため、spec.json のトップレベルに `background`（`fills` と同じ形式の配列）として出力する。塗りがない場合はフィールドを省略する。

**path / ファイル名の一意性**

同一親内に同名の子（レイヤー順序で区別する同名インスタンス等、4.3.6）がある場合、2つ目以降の `path` セグメントとスクリーンショット/アセットのファイル名に `-2`, `-3` … の接尾辞を付けて一意化する。これにより spec.json の参照とファイル名が常に一致する。トップレベルフレーム名が重複する場合も、フォルダ名に同じ規則で接尾辞を付ける。

**フォルダ名（ページ直下のセグメント）の規約:** ページ直下のノード名は、そのままではフォルダ名・パス先頭セグメントとして使えないため、次の順で正規化する。

1. **パス区切り文字の無害化**: 名前に含まれる `/` と `\` を `-` に置換する。置換しないと `Desktop / Home` というフレーム名が zip 内で `Desktop/Home/` という入れ子フォルダを作ってしまい、READMEのパス表記とも食い違う
2. **前後空白の除去**: `.trim()` を適用する。`" Home "` と `"Home"` は読み手には区別がつかず、別フォルダとして並ぶと突き合わせ不能になる
3. **空名・ドットのみのフォールバック**: 1〜2の結果が空文字列になる場合、または `.` `..` `...` のようにドットだけになる場合は `frame` を用いる。空のセグメントはフォルダ名にもパス表記にもならず、`.` と `..` は名前ではなくパス操作である（`..` は展開先によっては書き出しルートの外にフォルダを作る）
4. **重複への `-N` 付与**: 上記を適用した結果が既出の名前と一致する場合、`-2`, `-3` … を付けて一意化する。「既出の名前」の集合には、zipルート直下に置くファイル名 `README.md` / `prompt.md` / `steering.md` / `tokens.json` をあらかじめ含める。含めないと `README.md` という名のフレームが、同名ファイルの隣に同名フォルダが並ぶzipを作ってしまう
5. **一致判定は大文字小文字を区別しない**: 4の「既出の名前と一致するか」は小文字化して照合する（予約ファイル名との照合も同様）。macOS（APFS既定）とWindowsは `Home` と `home` を同一パスに解決するため、別名として扱うと展開時に片方の `spec.json` がもう片方に黙って上書きされる。ただし**付与後に用いる綴りは元の名前のまま**とし（`Home` と `home` なら `Home` と `home-2`）、フォルダ名からFigma上のレイヤー名を辿れる状態を保つ

**ページ直下の兄弟は、フレームも非フレームも同一のパスで一度に命名する。** すなわち上記1〜5を、ページ直下の全ノードに対して単一の「使用済み名の集合」上で適用する。ただし**書き出し対象のフレーム（`FRAME`／`SECTION`）を先に命名する**。フレームはzipフォルダを所有するため接尾辞なしの名前を保持し、同名の非フレーム側が `-N` を取って譲る。これにより (a) フレームのセグメントはzipフォルダ名と常にバイト一致し、(b) 「フォルダ `Home/` が存在するのに README が `Home` は書き出されていないと述べる」「`A/B` のフレームと `A-B` という名の Component が同一文字列で表示される」といった自己矛盾が原理的に起こらない。これが成り立つのは命名対象がページ直下の全ノードである場合に限られるため、**書き出し対象フレームの決定とこの命名は、同じノード列から一度に解決した1つの値として扱う**（片方を別のノード集合から作れる形にすると、(b)は破れる）。この規約は 4.7.2 の除外物告知におけるレイヤーパス先頭セグメントにもそのまま適用される。

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

3つのタブ（Review / Notes / Export）。利用者から見た各タブの挙動は README「プラグインの使い方」が正。本節以下はその裏の判断。

#### 4.7.2 チェック

本節は2つの異なる出力を定める。(1) **Review（チェック）**: ページ内の全ノードを走査して制作ルール違反を検出し、各違反に改善方法を提示する。Reviewが報告するのはエラーのみで、すべて書き出しのブロッカーである。(2) **書き出し時の除外物告知**: ツールが構造上対象外にするもの ― 違反ではなく、したがって改善方法も持たないもの ― を書き出し時に検出し、zip内 `README.md` に事実として記録する。前者はデザイナーが直すためのもの、後者は直す義務のないものを黙って捨てないためのものであり、混ぜない。

**Review のチェック項目**（構造4種＋サイジング1種。利用者に見せる文言は README「Review」）:
- Auto Layout未適用のフレーム（GROUP は対象外。4.3.2）
- Figmaデフォルト名のレイヤー
- 同一親内での重複レイヤー名
- 背景を子レイヤーとして配置
- Hug/Fill/Fixed以外の曖昧なサイジング

Reviewが報告するのはエラーのみとする。エラーは書き出し前に解消必須であり、Reviewの結果はすべて書き出しのブロッカーである。「直せるものだけを出す」ことで、デザイナーは「エラーをゼロにして書き出す」という一本の流れに集中できる。

**実行失敗の扱い:** チェックの実行自体が例外で中断した場合は、その旨をUIに通知し「実行中…」表示を解除する（書き出しの失敗通知と同じ方針）。通知しないとタブが「実行中…」のまま固まり、デザイナーには原因も次の一手も分からない。あわせて**前回の実行結果の表示を消す**。Reviewタブが示すのは常に直近1回の実行の結果であり、失敗通知の下に前回の一覧が残っていると、それが今回の検出結果だと読めてしまう。

**書き出し時の除外物告知（README出力）:** 上記(2)。ツールが対象外にするもの（＝デザイナーに直す義務はないが、黙って捨ててはいけないもの）は、Reviewではなく書き出し時に検出し、zip内 `README.md` の「Not included in this export」セクションに**実際に検出された項目のみ**を対象レイヤーパス（トークン名の衝突はトークン名）付きで記録する。検出ゼロの項目は行を出さない。「予測できない動き」を防ぐ基本姿勢（4.3.4）を、Reviewのノイズではなく書き出し結果の事実記録として担保する。
- Color Styleを使用 → カラーはVariablesに一本化するためトークン化されない（4.3.4）。**Color Styleごとに1件**、使用レイヤー数と代表レイヤーパス（最大3件）を列挙する。1つのテキストノード内で複数のColor Styleが混在する場合（`fillStyleId === figma.mixed`）は単一のidに解決できないため、その旨を示す名前の1件にまとめる
- STRING/BOOLEAN Variableを使用 → トークン出力対象外（COLOR/FLOATのみ出力）。**Variableごとに1件**、Variable名・使用レイヤー数・代表レイヤーパス（最大3件）を列挙する
- ページ直下に裸で置かれたComponent/Component Set定義 → 書き出し対象外（4.7.4の範囲方針）。該当レイヤーと、画面フレーム内にインスタンスとして配置するか、ライブラリページへ移す旨を記録する
- Variableのフルパスが `typography/<name>` に一致し、同名のText Styleが存在（tokens.jsonの`typography`グループで衝突し、後に書き出されるText Style側が上書きする。4.5.1） → 衝突したトークン名の組を記録する
- 書き出し対象外のレイヤーに付いたnote → noteは `spec.json` の `note` としてしかCCに届かず（4.5.2）、`spec.json` は書き出し対象フレーム配下しか持たないため、対象外のレイヤーに付いたnoteはzipのどこにも現れない。一方、Notesタブの一覧はページ全体を走査するため（4.7.3）そのnoteは一覧には出る。「一覧に出ている＝CCに届く」と読めて届かない状態を防ぐため、対象レイヤーパスとnote本文を記録する

**除外物告知の走査範囲:** README に載る項目は、読み手がzipの中身と突き合わせられるものでなければならない。したがって走査範囲をカテゴリごとに次のとおり定める。
- Color Style使用／STRING・BOOLEAN Variable使用 → **書き出し対象のページ直下 `FRAME`／`SECTION` 配下のみ**を走査する（当該フレーム自身を含む）。ページ直下に裸で置かれた他のノードや、裸のComponent定義の内部は走査しない（前者はzipに現れず突き合わせ不能、後者は「裸のComponent」として既に1件記録済みで二重計上になるため）
- **インスタンス内部のノードも走査する**。インスタンス内部のノードは主コンポーネント由来の `fillStyleId` / `boundVariables` を保持しており、主コンポーネントを別ページ（ライブラリ）に置き画面ページにインスタンスを並べるという定石の構成（4.7.4）では、インスタンス内部を除外すると「Color Style使用ゼロ」というREADMEが出てしまう ― 実際には書き出したスクリーンショット上の全カードがColor Styleで着色されているのに、である。これは4.3.4の姿勢に反する黙殺であり、走査対象に含める
- 上記により同じ部品をN個配置すると同一内容のN行が出る問題は、**レイヤー単位ではなく「除外される物」単位でまとめる**ことで解決する。すなわちColor Style使用はColor Styleごと、STRING/BOOLEAN Variable使用はVariableごとに1件へ集約し、各件は対象レイヤー数と代表レイヤーパス（最大3件）を持つ。ノイズを抑えつつ、検出事実そのものは失われない
- ページ直下に裸で置かれたComponent/Component Set → ページ直下のノードを走査する（書き出し範囲の外にあるものを告知するための項目であるため）
- トークン名衝突 → ノードではなくVariables／Text Stylesを対象とするため走査範囲の影響を受けない
- 書き出し対象外のレイヤーに付いたnote → **書き出し対象のページ直下 `FRAME`／`SECTION` 配下に無いノード**（ページ直下に裸で置かれたComponent／Component Set定義の内部、ページ直下の裸の他のノードとその内部）を走査する。書き出し範囲の外にあるものを告知するための項目であるため、Color Style使用等とは逆に対象フレーム配下は走査しない（そこに付いたnoteは `spec.json` に載る）
- 同一カテゴリ内で内容が完全に一致する項目は1行にまとめる。レイヤーパスの**先頭セグメントは、4.5.2「フォルダ名（ページ直下のセグメント）の規約」をページ直下の全ノードに一度に適用した結果の文字列**とする。書き出し対象フレーム配下のレイヤーであれば、それはそのフレームのzipフォルダ名そのものになる。裸のComponent等の非フレームも同じ規約・同じ「使用済み名の集合」で命名されるため、フォルダ名と別ノードの表記が衝突することはない（フォルダ名とREADMEのパス先頭セグメントは同一の走査で一度だけ決定し、zipとREADMEの双方へ同じ値を渡す。等価な走査を別の場所でもう一度行わないことで、両者が食い違うことをあり得なくする）。先頭セグメント以外は4.5.2の `path` と同じく同名の兄弟を `-N` で区別する。画面フレーム名を含む点がspec.jsonの`path`と異なるのは、READMEがデザイナーにzip内のフォルダとFigmaのレイヤーツリーの両方を辿らせるための表記であるため

#### 4.7.3 note入力UI

note は `setPluginData('note', value)` に持つ（Free 版にアノテーションが無いため。4.10）。note があるノードに `setRelaunchData` で編集ボタンを出すのは、プラグインを開かなくても note の存在に気づけるようにするため。

**note一覧を置く理由:** 入力欄はノードを1つ選択して初めて1件のnoteを見せるため、それだけでは「このページのどこに何を書いたか」を確かめる手段がレイヤーを1つずつ選び直すことしかない。そこで入力欄の下に、現在のページでnoteが設定済みの全レイヤーを一覧表示する。

- **各項目にレイヤーパスと本文の両方を出す**: レイヤーパスだけではnoteの中身が分からず、note本文だけではどのレイヤーの話か分からない
- **パスは Figma 上の生のレイヤー名をそのまま並べる**（4.5.2のフォルダ名正規化も `-N` 付与も行わない）: 一覧はzipと突き合わせるための表記ではなく、Figmaのレイヤーツリーを辿るための表記であるため
- **走査範囲はページ全体**: noteはどのレイヤーにも付けられるため、書き出し対象外のノード（ページ直下に裸で置かれたComponent定義の内部など）に付いたnoteも一覧に出す。出さなければ、書いたはずのnoteが見当たらないという状態になる。ただし一覧に出ることは書き出されることを意味しない ― 書き出し対象外のレイヤーに付いたnoteは `spec.json` に載らないため、書き出し時に除外物として告知する（4.7.2）。並び順はレイヤーツリーの走査順
- **更新タイミングはプラグイン起動時・note 保存時（空文字保存＝削除を含む）・ページ切り替え時**: 一覧が「現在のページ」のものだと言えるのは、ページが変わるたびに作り直すからである。Figmaはプラグインを開いたままページを切り替えられるため、起動時と保存時だけでは切り替え後も前のページの一覧が残る。選択の変更では更新しない（一覧は選択に依存しない）
- **行が指すレイヤーが現在のページに無いときは、その旨をUIに通知し、一覧を作り直す**: 行の対象は削除されうるし、一覧が古いこともある。黙って無反応にすると、利用者にはクリックが効いていないのか対象が消えたのか分からない（4.3.4の基本姿勢）。通知と同時に作り直すのは、同じ行をもう一度クリックしても同じ結果になる状態を残さないため
- **一覧の走査が失敗したときも黙らない**: 失敗をUIに通知し、UIは「一覧が届いていない」状態と「0件」を区別して表示する。区別しないと、走査失敗が「このページにnoteは無い」という嘘の空状態として見える（4.3.4）。Reviewの実行失敗の扱い（4.7.2）と同じ方針
- **入力欄は一覧の上に残し、ノード未選択でも一覧は表示する**: 一覧の目的が「選択せずに全体を見る」ことだから
- **0件時はその旨のメッセージを出す**: 上記の区別の片側。空の一覧と「まだ届いていない一覧」を利用者が取り違えないように
- **行クリックで未保存の入力は捨てられ、確認は挟まない**: 入力欄は常に選択中ノードの保存済みnoteを映す単一の源泉であり、保存ボタンが明示的なコミットである。行クリックはキャンバス上での選択操作と同義であり、選択が変われば入力欄は選択先の保存済みnoteに置き換わる。編集中の入力欄のすぐ下に1クリックで捨てるコントロールが置かれる形にはなるが、確認ダイアログを挟むと一覧の「1クリックで辿る」用途が壊れるため、挙動は選択変更と揃える

#### 4.7.4 書き出し

エラーゼロの状態でのみ実行可能にするのは、Review の結果がすべて出力の正確さを損なうものだけに絞ってあるから（4.7.2）。

**書き出し範囲の方針**: 出力単位は「画面フレーム」とする。具体的にはページ直下の `FRAME` および `SECTION` を対象とし、各フレームを1ページ/ビューポートとして書き出す。再利用部品は、画面フレーム内に配置された**インスタンスを展開してspec/スクリーンショットに含める**（コード化の単一の真実はレンダリング結果）。ページ直下に裸で置かれたComponent/Component Set定義そのものは書き出し対象外で、書き出し時に `README.md` の除外物セクションへ記録する（4.7.2）。デザイナーの定石どおり、主コンポーネントはライブラリとして別ページ/別エリアにまとめ、画面はフレームで構成する運用を前提とする。

zip の構成は 4.5。

`README.md` の「Contents」節の各フレーム行は、**zip内のフォルダ名（4.5.2の正規化後）とFigma上の生のフレーム名の両方**を示す。正規化や `-N` 付与によって両者は食い違いうるため、フォルダ名だけではデザイナーはFigma上の当該フレームに辿り着けず（`Desktop - Home` という名のフレームはページ上に存在しない）、生名だけではzip内のどのフォルダを指すのか分からない。

`README.md` の「Contents」節は、**実際にzipへ書き込まれたものだけ**を列挙する。たとえば子を持たないフレームのフォルダには `spec.json` しか入らないため、その行でスクリーンショットやアセットに言及してはならない。READMEはzipと突き合わせるための文書であり（4.7.2）、存在しないものを約束する行は突き合わせを壊す。

zip生成にはJSZipライブラリを使用。プラグインUI内でBlobを生成しダウンロードリンクを表示する。

#### 4.7.5 プラグインAPI使用箇所

| 機能 | API |
|---|---|
| ノード走査 | `figma.currentPage`, `node.children` 再帰 |
| Auto Layoutプロパティ取得 | `node.layoutMode`, `node.itemSpacing`, `node.paddingTop` 等 |
| note読み書き | `node.setPluginData('note', value)`, `node.getPluginData('note')` |
| 再起動ボタン | `node.setRelaunchData({ editNote: '' })` |
| note一覧の更新 | `figma.on('currentpagechange')`（ページ切り替え時。4.7.3） |
| Variable取得 | `node.boundVariables`, `figma.variables.getLocalVariables()` |
| スクリーンショット | `node.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: 2 } })` |
| ベクターアセット | `node.exportAsync({ format: 'SVG' })`（`SVG_STRING` は不可 — 文字列をバイト列に戻す `TextEncoder` がプラグインサンドボックスに無い） |

#### 4.7.6 配布

Figma Community に公開する（現状は開発版プラグインとして読み込む。手順は README「インストール」）。Community 公開を選ぶのは、Free 版ではプライベートプラグインが使えず、組織内限定配布ができないため（4.10）。ソースコードはGitHubで管理。

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
5. **HTML導出ルール**（README「レイヤー名」の「CCが解釈する特別な名前」を転記）
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

デスクトップとモバイルを別フレームにする（README「レスポンシブ」）方式を採る理由: 他のフレームと同じ仕組み（フレーム名でフォルダ分け。4.5）に乗り、ブレークポイントという新しい概念を持ち込まずに済む。`tokens.json` は共通で、差異はレイアウト構造（spec.json）だけになる。デスクトップとモバイルの対応付けをフレーム名に委ねるのは、ツールが対応関係を推測して間違えるより、デザイナーが名前で示すほうが確実なため。

グリッドを Auto Layout の WRAP と子の minWidth/maxWidth で表現させるのは、Figma の Grid（Auto Layout の grid モード）を使わせず、4.6 の flexbox 対応表の範囲に収めるため。

### 4.10 Free版の制約と対応

| 制約 | 影響 | 対応 |
|---|---|---|
| Variable Modes不可 | ダークモード切り替え不可 | 必要時はCC側でメディアクエリ対応 |
| デザインファイル3つまで | LP/HP数の上限 | 1ファイル内でページ分割 |
| 共有ライブラリ不可 | ファイル間Variables共有不可 | 1ファイル内で完結 |
| アノテーション不可 | 標準UIで補足情報を付けられない | プラグインのnote入力UIで代替 |
| プライベートプラグイン不可 | 組織内限定配布不可 | Figma Communityに公開 |
