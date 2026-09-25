# Telldes

Figma plugin that exports design specs as AI-ready coding packages — design it, tell it, ship it.

Figma で作った LP / HP のデザインを、Claude Code（以下 CC）がカンプと同じ見た目のコードにできる zip として書き出す Figma プラグイン。

この README は、Telldes を初めて使うデザイナーが、これだけを読んで、Figma のデザインを CC に渡せる zip にするまでを迷わず進められるように書いてある。なぜこの形なのかは [`docs/design.md`](docs/design.md) にある。

流れは次のとおり。Setup で推奨の変数・スタイル一式を作り、Figma でデザインし、Review で渡すと壊れるところを直し、note で Figma に描けないことを書き、Export で zip を書き出す。

```
Setup → デザイン → Review → note → Export → zip を CC に渡す
```

## インストール

```
bun install
bun run build
```

Figma → Plugins → Development → Import plugin from manifest… で、このリポジトリの `manifest.json` を選ぶ。無償版（Starter）の Drafts で動く。今は開発版として読み込む（Community への公開は未実施）。

## Figma での作り方

### 渡す画面

1つの Figma のページに、渡す画面だけを置く。そのページの直下にある表示中のフレームが、すべて画面として渡る。部品置き場や下書きは別の Figma のページに置く。

渡らないもの:

- 非表示のレイヤー
- ページ直下のフレーム以外（裸の Component / Component Set、Rectangle など）

渡らないものは、プラグインの Frames の一覧に「Not exported」として並び、zip の `README.md` にも書かれる。

### Web ページと幅

zip の書き出しの単位を「Web ページ」と呼ぶ（HP なら top・about など。zip のフォルダ1つ）。1つの Web ページを幅ごとに別のフレームで描く（例: 1440 と 375）。幅違いのフレームは Figma の Section で囲む。Section 名が Web ページ名（zip のフォルダ名）になる。1枚だけの Web ページは Section で囲まずフレームのままでよく、フレーム名がフォルダ名になる。

どの幅からそのフレームを使うか（From width）と、コンテンツ幅（Content width）は、プラグインでそのフレームの Export 設定（書き出しの設定欄。「プラグインの画面」の節）に入れる。

### トークン

Figma の Variables（COLOR・FLOAT）、Text Style、Effect Style がトークンとして `tokens.json` に出る。使うかは自由で、使わなくても値がそのまま出て、正しさは変わらない。Color Style と STRING / BOOLEAN の Variables はトークンにならず、使った所は zip の `README.md` に「含まれなかったもの」として書かれる。

変数のコレクションは Light・Dark・Base の3つに分ける（Light・Dark はテーマで変わる色、Base はテーマで変わらない値）。Setup を押すと、この3つのコレクションと Text Style・Effect Style に、次の推奨一式のうち足りないものだけが、使える欄の絞り込みと CSS 変数名つきで作られる。2回押しても増えず、手で作った同名のものは上書きされない。名前は共通の語彙で、値はデザインごとに変えてよい。

```
色（Light・Dark 各14）  bg / surface / border / fg/default / fg/muted
                        primary/default / primary/hover / primary/on / link
                        code/bg / code/fg / notice/bg / notice/fg / shadow
Base                    spacing/xs=4 sm=8 md=16 lg=24 xl=32 2xl=48 3xl=64 4xl=96
                        radius/sm=4 md=8 lg=16 xl=24 full=9999
                        font/heading body mono
Text Style              display / heading-lg / heading-md / heading-sm / lead / body / label / caption / code
Effect Style            shadow-sm / shadow-md
```

### ダーク対応

ダーク対応するときは、ファイルの Export 設定で Dark support を ON にする。ON のあいだは色をすべて Light の変数につなぐ。つないでいない色は Dark に付け替わらず、Review で error（直さないと Export できない違反）になる。上部の Light | Dark でキャンバスの見た目を切り替えて確かめる。OFF なら、変数につないでいなくても何も言われない。

### 作り方のコツ

error にはならないが、渡り方が変わる。

- Auto Layout で組むと、伸び縮み（Hug / Fill / Fixed、min / max）がそのまま伝わる。Auto Layout の無いフレームの子は、座標のまま渡る
- 背景はフレームの fill にする。子レイヤーにすると、そのまま子として渡る
- 繰り返す要素は Component にする
- レイヤー名は CC がそのまま読む。役割が分かる名前（header / nav / heading / cta など）が伝わりやすい。Figma のデフォルト名（Frame 1 など）や、同じ親の中の同名もそのまま渡る（zip の中では番号が付いて区別される）

### note

Figma のプロパティで伝わらないこと（動き、ホバー、リンク先、意図、アクセシビリティ）は、レイヤーごとにプラグインで note として書く。自由な文章でよい。すべての Web ページに効くことは、ファイルの Export 設定の Rules for every page に書く。

## プラグインの画面

- 左: Frames と Tokens の2つのタブの一覧
- 右: 一覧で開いたもの（ファイル・Web ページ・フレーム・レイヤー・トークン・トークンにしていない値）の詳細
- 上部: ファイル名（押すとファイルの設定）、Light | Dark、Review ボタンと「● n errors ○ n notices」、Export
- 下: 結果の1行

### Setup

Tokens の一覧の先頭にある。足りないトークンがあるとき、Tokens タブに「+n」の印が出る。

### Review

開いたとき・設定を変えたとき・Export の前に自動で走る。Figma で直したあとは Review ボタンで走らせ直す。

- error: 直さないと Export できない
- notice: 知らせるだけ

違反・知らせは、持ち主（ファイル・トークン・値・フレーム・レイヤー）の行に ● ○ で出る。詳細に内容と直し方、使っている所が並び、使っている所を押すと Figma でそのレイヤーが選ばれる。同じ原因（同じ色30か所など）は1行にまとまる。上部の「● n errors」「○ n notices」を押すと、一覧がその行だけに絞られる。

error になるもの:

- Dark support ON で、変数につないでいない色
- Dark support ON で、Dark コレクションが無い
- Web ページ名（Section 名・フレーム名）が空か重複している（zip のフォルダがぶつかる）

notice になるもの:

- トークンと同じ値なのに、つないでいない
- Section で組んだフレームに From width が無い

### note

レイヤーの詳細で書いて Save。note のある行に ✎ が付く。Figma のプロパティパネルからも開ける。画面の外（渡らない所）のレイヤーの note は渡らず、zip の `README.md` に書かれる。

### Export 設定

持ち主の詳細にある。ファイルに保存され、開き直しても残る。

| 持ち主 | 欄 |
|---|---|
| ファイル | Dark support、Rules for every page |
| Web ページ | Page title（1枚だけの Web ページでは、そのフレームの詳細） |
| フレーム | From width (px)、Content width (px) |

### Light | Dark

この Figma のページ全体の変数のつながりを、Light と Dark で付け替える（プラグイン自体の見た目ではない）。今どちらかが常に見える。Dark support ON なら Export は両方の画像を書き出し、終わると（失敗しても）Light に戻す。Dark のまま残ったファイルを開くと、戻すよう促される。

### Export

error が 0 のときだけ押せる。zip がダウンロードされる。

## zip の中身と CC への渡し方

- `prompt.md`: CC への作業指示
- `tokens.json`: トークン
- `README.md`: 入っているものと、含まれなかったもの
- Web ページごとのフォルダ: 幅ごとのフレームの `spec.json`、画面全体とその中のまとまりごとの画像、画像アセット（写真は PNG、アイコン・ロゴは SVG）、CSS で描けないものの画像

zip は展開せず、そのまま CC に渡す。読み方は `prompt.md` に入っている。

## 開発

```
bun run build       # 型検査とビルド（dist/ui.html と dist/code.js）
bun run typecheck   # 型検査だけ
```

設計の意図と決めたことは [`docs/design.md`](docs/design.md)。
