# Telldes

Figma plugin that exports design specs as AI-ready coding packages — design it, tell it, ship it.

Figma で作った LP / HP のデザインを、Claude Code（以下 CC）がカンプと同じ見た目のコードにできる zip として書き出す Figma プラグイン。

この README は、Telldes を初めて使うデザイナーが、これだけを読んで、Figma のデザインを CC に渡せる zip にするまでを迷わず進められるように書いてある。なぜこの形なのかは [`docs/design.md`](docs/design.md) にある。

流れは次のとおり。

```
Setup → デザイン → Review → note → Export → zip を CC に渡す
```

## インストール

bun（JavaScript の実行環境。https://bun.sh から入れる）を入れてから、次を実行する。

```
bun install
bun run build
```

Figma デスクトップアプリ → Plugins → Development → Import plugin from manifest… で、このリポジトリの `manifest.json` を選ぶ（manifest からの読み込みはデスクトップ版だけ）。無償版（Starter）の Drafts で動く。今は開発版として読み込む（Community への公開は未実施）。

## Figma での作り方

### トークン

Figma の変数のうち色（Color）・数値（Number）と、書体につないだ文字列（String）、それに Text Style と Effect Style が、トークンとして zip の `tokens.json` に出る。使うかは自由で、使わなくても値がそのまま出て、正しさは変わらない。文字の中身につないだ String と Boolean はトークンにならず、値は `spec.json`（zip の中の、フレームの中身の記述）にそのまま載る。Color Style もトークンにならない。どちらも、使った所は zip の `README.md` に「含まれなかったもの」として書かれる。

変数のコレクションは Light・Dark・Base の3つに分ける（Light・Dark はテーマで変わる色、Base はテーマで変わらない値）。プラグインの Setup ボタンを押すと、この3つのコレクションと Text Style・Effect Style に、次の推奨一式のうち足りないものだけが、使える場所の絞り込み（Scope）と CSS の変数名（Code syntax）つきで作られる。2回押しても増えず、手で作った同名のものは上書きされない。名前は共通の語彙で、値はデザインごとに変えてよい。

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

### 渡すフレーム

1つの Figma のページに、渡すフレームだけを置く。ページの直下、またはページ直下の Section の直下にある、表示中のフレームが渡る。部品置き場や下書きは別の Figma のページに置く。

渡らないもの:

- 非表示のレイヤー
- フレーム以外（裸の Component / Component Set、Rectangle など）
- Section の中の Section と、その中身

渡らないものは、Frames の一覧（プラグインの画面の Frames タブ）に Not exported として並び、zip の `README.md` にも書かれる。

### Web ページと幅

zip の書き出しの単位を「Web ページ」と呼ぶ（HP なら top・about など。zip のフォルダ1つ）。幅ごとに見た目を変えるときは、1つの Web ページを幅ごとに別のフレームで描き（例: 1440 と 375）、Figma の Section で囲む。Section で囲んだフレームは、枚数に関わらず Section 名が Web ページ名（zip のフォルダ名）になる。囲まないフレームはフレーム名が Web ページ名になる。1枚だけの Web ページは囲まなくてよい。

どの幅からそのフレームを使うか（From width）と、コンテンツ幅（Content width）は、そのフレームの Export 設定（プラグインにある書き出しの設定欄。「プラグインの画面」の節）に入れる。一番狭いフレームは From width を空のままにする（幅 0 から使われる）。1枚だけの Web ページに From width は要らない。Content width は空なら全幅。

### ダーク対応

ダーク対応するときは、ファイルの Export 設定で Dark support を ON にする。ON のあいだは色をすべて Light の変数につなぐ。つないでいない色は Review（プラグインの検査。「プラグインの画面」の節）で error（直さないと Export できない違反）になる。上部の Light | Dark でキャンバスの見た目を切り替えて確かめる。OFF なら error にならず、トークンと同じ値なのにつないでいない色だけが notice（知らせるだけ）になる。

### 作り方のコツ

error にはならないが、渡り方が変わる。

- Auto Layout で組むと、伸び縮み（Hug / Fill / Fixed、min / max）がそのまま伝わる。Auto Layout の無いフレームの子は、座標のまま渡る
- 背景はフレームの fill にする。子レイヤーにすると、そのまま子として渡る
- 繰り返す要素は Component にする
- レイヤー名は CC がそのまま読む。役割が分かる名前（header / nav / heading / cta など）が伝わりやすい。Figma のデフォルト名（Frame 1 など）や、同じ親の中の同名もそのまま渡る

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
- Web ページ名（Section 名・フレーム名）が重複している

notice になるもの:

- トークンと同じ値なのに、つないでいない
- Section の中の、一番狭い以外のフレームに From width が無い

### note

レイヤーの詳細で書いて Save。note のある行に ✎ が付く。Figma のプロパティパネルからも開ける。渡らないレイヤーの note は渡らず、zip の `README.md` に書かれる。

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

error があると Export は止まり、一覧が error の行だけに絞られる。error が 0 なら zip がダウンロードされる。

## zip の中身と CC への渡し方

- `prompt.md`: CC への作業指示
- `tokens.json`: トークン
- `README.md`: 入っているものと、含まれなかったもの
- Web ページごとのフォルダ: 幅ごとのフレームの `spec.json`、フレーム全体とその中のまとまりごとの画像、画像アセット（写真は PNG、アイコン・ロゴは SVG）、CSS で描けないものの画像

zip をコードを作るフォルダに置き、CC に「この zip の `prompt.md` のとおりにページを作って」と伝える。展開してもよい。読み方は `prompt.md` に入っている。

## 開発

```
bun run build       # 型検査とビルド（dist/ui.html と dist/code.js）
bun run typecheck   # 型検査だけ
```
