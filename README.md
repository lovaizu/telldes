# telldes

Figma plugin that exports design specs as AI-ready coding packages — design it, tell it, ship it.

Figma で LP / HP をデザインし、Claude Code（CC）にコーディングさせるためのプラグイン。デザイナーはこの README の作り方に従ってデザインし、プラグインで検証して zip を書き出し、その zip をそのまま CC に渡す。

```
デザイン → Review（検証） → Export（書き出し） → zip を CC に渡す
```

設計判断・意図・決定事項は [`docs/design.md`](docs/design.md)。ここには「何をするか」だけを書く。

## インストール

現状は開発版プラグインとして読み込む（Figma Community への公開は未実施）。

```
bun install
bun run build
```

Figma → Plugins → Development → Import plugin from manifest… → リポジトリの `manifest.json` を選ぶ。Free プランで動く。

## 用語

LP / HP の構造を4階層で扱う。この階層を Figma のレイヤーツリーでそのまま表現する。

| 階層 | 定義 | 例 |
|---|---|---|
| **ページ** | LP / HP 全体。1つの垂直 Auto Layout フレーム | LP 全体 |
| **セクション** | ページ直下の意味的なまとまり | header, hero, features, pricing, footer |
| **ブロック** | セクション内の意味のあるまとまり。入れ子にできる | plans, plan-pro, features, item |
| **エレメント** | 末端の要素。子を持たない | heading, price, icon, cta, description |

```
ページ
├── セクション: header
│   ├── ブロック: logo
│   │   └── エレメント: image
│   └── ブロック: nav
│       ├── エレメント: link
│       └── エレメント: link
├── セクション: hero
│   └── ブロック: content
│       ├── エレメント: heading
│       ├── エレメント: description
│       └── エレメント: cta
└── セクション: footer
```

## Figma での作り方

### ページ構造

ページ全体を1つの垂直 Auto Layout フレームにする。ページ直下の子はすべてセクション。

```
Page（VERTICAL Auto Layout）
├── header
├── hero
├── features
├── pricing
└── footer
```

LP はフレーム1つ。HP はページごとにフレームを作る（例: `top`, `about`, `contact`）。それぞれが zip 内のフォルダになる。

### Auto Layout 必須

すべてのフレームに Auto Layout を適用する。手動配置は禁止。子を持つフレームに Auto Layout が無いと Review でエラーになり、Export できない。

例外: 装飾アイコンなど「レイアウトを持たない」もの（円と矢印を重ねたサークルアローのように内部パーツを絶対配置するもの）は、Frame ではなく **Group** でまとめる。Group は Auto Layout チェックの対象外。

### サイジング

サイズ指定は次の3つだけ。

| パターン | Figma 設定 |
|---|---|
| コンテンツに合わせる | Hug contents |
| 親を埋める | Fill container |
| 固定値 | Fixed + 数値 |

minWidth / maxWidth / minHeight / maxHeight も使える。

### 色・数値・タイポグラフィのトークン化

トークンにしたい値は Figma の Variables（色は COLOR、余白やサイズは FLOAT）と Text Style で定義する。Variables を使うかどうかは自由 — 使わなくても出力の正しさは変わらない（値がそのまま出る）。

| Figma の仕組み | 用途 | 書き出し |
|---|---|---|
| Variables（COLOR） | 色 | `tokens.json` に出る |
| Variables（FLOAT） | 余白・サイズなどの数値 | `tokens.json` に出る |
| Text Style | タイポグラフィ | `tokens.json` に出る |
| Color Style | 色 | 使わない。使うと書き出し時の README に「含まれなかったもの」として記録される |
| Variables（STRING / BOOLEAN） | — | トークンにならない。同上 |

トークン名の付け方は自由。共通の語彙として、推奨体系を `docs/design.md` 4.3.4 に置いている。

### 背景

背景はフレームの **fill** にする。背景専用の子レイヤーを作らない。

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

### レイヤー名

同じ親の中でユニークであればよい。親の名前を繰り返さない。

```
✅ pricing > plans > plan-pro > features > item > icon
❌ pricing > pricing-plans > pricing-plan-pro > plan-pro-features > ...
```

- 同じ親の中で同名は禁止
- Figma のデフォルト名（"Frame 1", "Rectangle 3" など）は禁止
- 繰り返す要素は Figma Components でインスタンス化する。同名インスタンスはレイヤー順で区別される

**CC が解釈する特別な名前:** 次の名前を使うと、CC が対応する HTML 要素にする。使わなければ `<div>`（ブロック）または `<p>`（テキスト）になる。

| レイヤー名 | HTML |
|---|---|
| `header`（セクション） | `<header>` |
| `footer`（セクション） | `<footer>` |
| `nav` を含むブロック | `<nav>` |
| その他のセクション | `<section>` |
| `heading`（ページ内で最初） | `<h1>` |
| `heading`（セクション直下） | `<h2>` |
| `heading`（ブロック内） | `<h3>` |
| `heading` 以外のテキスト | `<p>` |
| `cta` または `button` を含むエレメント | `<button>` |

note にリンク先が書いてあれば `<a>` になる。

### note（補足情報）

Figma のプロパティでは伝わらないことを、プラグインの Notes タブで書く。必要なノードにだけ付ける。内容は自分の言葉で自由に書いてよい — CC が読んで実装を判断する。

| 用途 | 例 |
|---|---|
| 動きの仕様 | 「スクロールしても常に画面上部に固定表示」 |
| インタラクション | 「ホバーで背景色が濃くなる」「選択すると詳細ページへ遷移」 |
| デザイン意図 | 「このプランを最も目立たせたい」 |
| リンク先 | 「リンク先: /signup?plan=pro」 |
| アクセシビリティ | 「スクリーンリーダー用ラベル: 会社ロゴ」 |
| カルーセルなど | 「画像をループ表示。自動再生3秒間隔」 |

### 画像

画像を含むノードは書き出し時に自動でアセットになる。特別な準備は要らない。

| 種類 | 形式 | 出力先の例 |
|---|---|---|
| 写真・ラスター画像 | PNG（2x） | `assets/images/hero--content--image.png` |
| アイコン・ロゴ（ベクター） | SVG | `assets/icons/header--logo--icon.svg` |

### レスポンシブ

デスクトップ（1440px）とモバイル（375px）を別フレームで作る。対応関係はフレーム名で表す（例: `top-desktop` / `top-mobile`）。グリッドは Auto Layout の WRAP と子の minWidth / maxWidth で表現する。

## プラグインの使い方

タブは3つ。

### Review

ページ内の全レイヤーを検査し、違反と直し方を一覧する。出るのはエラーだけで、すべて直さないと Export できない。項目をクリックすると該当レイヤーが選択される。

| 検出 | 表示される直し方 |
|---|---|
| Auto Layout 未適用のフレーム | Auto Layout を適用してください |
| Figma デフォルト名のレイヤー | 意味のある名前を付けてください |
| 同じ親の中の重複レイヤー名 | 名前を変更して区別してください |
| 背景を子レイヤーとして配置 | フレームの fill に設定してください |
| Hug / Fill / Fixed 以外のサイジング | Hug / Fill / Fixed のいずれかに設定してください |

### Notes

選択中のレイヤーの note を読み書きする。note があるレイヤーには Figma のプロパティパネルに「Edit note」ボタンが出る。

入力欄の下に、このページで note が付いているレイヤーの一覧が出る（レイヤーパスと本文）。クリックするとそのレイヤーが選択され、画面がそこへ移動する。一覧はプラグイン起動時と note 保存時に更新される。

### Export

エラーがゼロのときだけ実行できる。zip がダウンロードされる。

```
telldes-export/
├── prompt.md          ← CC への作業指示（自動生成）
├── steering.md        ← CC との確認・タスク・ルール（テンプレート）
├── tokens.json        ← デザイントークン（Variables または Text Style がある場合のみ）
├── README.md          ← zip の内容と、今回の書き出しに含まれなかったもの
├── {フレーム名}/       ← ページ直下のフレームごと
│   ├── spec.json      ← デザインスペック
│   ├── screenshots/   ← セクション・ブロック単位の画像
│   └── assets/
│       ├── images/
│       └── icons/
```

**書き出されないもの** — 違反ではないので Review には出ない。代わりに zip 内の `README.md` に記録される。

- Color Style を使っている箇所（色は Variables から出す）
- STRING / BOOLEAN の Variables を使っている箇所
- ページ直下に裸で置いた Component / Component Set の定義（画面フレーム内にインスタンスとして配置するか、ライブラリページへ移す）
- Variable 名 `typography/〜` と同名の Text Style がある場合（`tokens.json` で衝突する）

## CC に渡す

zip を展開せずそのまま CC に渡す。`prompt.md` に作業指示が入っている。

## 開発

```
bun run build   # dist/ui.html と dist/code.js
bun run dev     # 監視ビルド
bun run test    # vitest
```

- 設計書: [`docs/design.md`](docs/design.md)
- 作業の進め方・タスク: [`.rn/20260524-build-plugin/steering.md`](.rn/20260524-build-plugin/steering.md)
