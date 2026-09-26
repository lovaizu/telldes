# Figma のデザインを、CC に渡す zip にする

Figma のファイルを用意してから、Claude Code（以下 CC）に渡す zip ができるまでの手順。用意するものは、Figma デスクトップアプリ（無償版でよい）と、Telldes を開ける状態（[README](../README.md) の「はじめる」）。

手順は9つある。4 は幅ごとに描くとき、7 はダーク対応するときだけ。2 と 6 はしなくても zip はできるが、すると CC に伝わることが増える。

プラグインの画面には、Frames と Tokens の2つのタブがある。Frames にはフレームとその中のレイヤー、Tokens にはトークン（CC が CSS の変数にする色・数値・書体・文字・影）が並ぶ。一覧の行を押すと、その行の詳細が開く。

## 1. 渡すフレームを置く Figma のページを決める

渡すフレームを置く Figma のページを1つ決め、部品置き場や下書きは別の Figma のページに移す。Telldes は、開いている Figma のページの直下と Section の直下にある、表示中のフレームをすべて渡す。

```
✅ ページ「Web」            ← 渡すフレームだけ
   ├── top
   └── about
   ページ「Parts」          ← 部品置き場・下書き

❌ ページ「Web」
   ├── top
   ├── Button（Component）  ← 渡らない
   └── 下書き               ← フレームなら渡ってしまう
```

プラグインを開くと、Frames タブに渡すフレームが並ぶ。次のものは渡らず、Frames タブに Not exported として並び、zip の `README.md` にも書かれる。

- 直下にあってもフレームでないもの（Component・Rectangle など）
- 非表示のレイヤー
- Section の中の Section

## 2. Setup でトークンをそろえる

Tokens タブの Setup を押すと、推奨の一式のうち、足りないものだけが作られて Tokens タブに並ぶ。2回押しても増えず、手で作った同じ名前のものは上書きされない。足りないものがあるあいだは、Tokens タブに印が出る。名前はそのまま使い、値はデザインに合わせて変えてよい。

作られるものは次のとおり。

- Light・Dark コレクション（テーマで変わる色）に、それぞれ14色: bg、surface、border、fg/default、fg/muted、primary/default、primary/hover、primary/on、link、code/bg、code/fg、notice/bg、notice/fg、shadow
- Base コレクション（テーマで変わらない値）に、余白・角丸・書体
  - spacing: xs=4、sm=8、md=16、lg=24、xl=32、2xl=48、3xl=64、4xl=96
  - radius: sm=4、md=8、lg=16、xl=24、full=9999
  - font: heading、body、mono
- Text Style: display、heading-lg、heading-md、heading-sm、lead、body、label、caption、code
- Effect Style: shadow-sm、shadow-md

## 3. デザインする

Figma のいつものやり方でデザインする。したことは、次のように CC に渡る。

| Figma でしたこと | CC に渡るもの |
|---|---|
| Auto Layout で並べた | 並び・間隔・伸び縮み |
| Auto Layout を使わずに置いた | 座標のまま（伸び縮みは伝わらない） |
| 変数・Text Style・Effect Style につないだ | トークンの名前 |
| つながずに値を入れた | 値のまま |
| 写真・ラスター画像 | PNG の画像 |
| アイコン・ロゴ（ベクター） | SVG の画像 |
| CSS で同じに描けないもの（特殊なグラデーション、破線など） | Figma が描いた画像 |

トークンになるのは、次のもの。

- 変数の Color と Number
- 変数の String のうち、使える場所（Scope）に Font family か Font style を含むもの
- Text Style と Effect Style

次のものはトークンにならず、Tokens タブに Not exported として並ぶ。使った所には値がそのまま渡る。

- Color Style。色は変数にする
- 変数の String のうち、文字の中身に使うもの（Scope が Text content）と、変数の Boolean

## 4. 幅ごとのフレームを Section で囲む

幅ごとに見た目を変える Web ページは、幅ごとに別のフレームで描き、Figma の Section で囲む。Section 名が Web ページ名（zip のフォルダ名）になる。1枚だけの Web ページは囲まなくてよく、フレーム名が Web ページ名になる。

```
Section「top」
   ├── top-1440（幅 1440）
   └── top-375（幅 375）
about（幅 1440）      ← 1枚だけなら囲まない
```

渡すフレームを置く Figma のページでは、Section は1つの Web ページをまとめるためだけに使う。別々の Web ページを1つの Section にまとめると、1つの Web ページの幅違いとして渡る。

Frames タブには Section 名の行が出て、その中に幅ごとのフレームが並ぶ。

## 5. 決めることを欄に入れる

Frames タブの行を押すと、詳細に Export settings の欄が出る。ファイル全体の欄は、上部のファイル名を押すと出る。入れたものはファイルに保存される。

| 欄 | 開く行 | 入れるもの |
|---|---|---|
| From width | フレーム | そのフレームを使い始める幅。一番狭いフレームは空のまま |
| Content width | フレーム | コンテンツの幅。空なら全幅 |
| Page title | Section（1枚だけの Web ページならそのフレーム） | ページの題名 |
| Dark support | ファイル | ダーク対応するか。はじめは OFF |
| Rules for every page | ファイル | すべての Web ページに効くこと（文章） |

## 6. note を書く

Figma のプロパティでは伝わらないことを、レイヤーの note に自由な文章で書いて Save する。Frames タブでフレームの行を開くとレイヤーが並び、レイヤーの行を押すと詳細に note の欄が出る。Figma のキャンバスでレイヤーを選んだときのプロパティパネルにも、note を開く入口が出る。note のあるレイヤーの行には ✎ が付く。

書くことの例:

- 動き: スクロールしても画面の上に固定する
- ホバー・操作: ホバーで背景を濃くする。押すと詳細ページへ
- リンク先: /signup?plan=pro
- 意図: このプランを一番目立たせたい
- アクセシビリティ: 読み上げ用のラベルは「会社ロゴ」

渡らないレイヤーに書いた note は、zip の `README.md` に「含まれなかったもの」として書かれる。

## 7. ダーク対応する

ダーク対応するなら、手順5で Dark support を ON にし、次の2つをそろえる。

- 色をすべて Light か Base の変数につなぐ
- Dark コレクションに、Light と同じ名前の変数を置く（Setup で作れる）

上部の `Light | Dark` を押すと、この Figma のページ全体の変数のつながりが Dark に付け替わり、キャンバスで Dark を確かめられる。もう一度押すと Light に戻る。Dark のまま閉じたファイルを開くと、Light に戻すよう促される。

## 8. Review で直す

プラグインを開くと Review が走り、上部に error と notice の件数が出る。error は直さないと Export できないもの、notice は知らせるだけのもの。Figma で直したあとは、上部の Review ボタンで走らせ直す。

error と notice は、それを直す判断の対象の行に付く。ファイル全体のことはファイル、色や数値のことは Tokens タブのトークンの行（どのトークンとも違う値は、Tokens タブに値の行として並ぶ）、それ以外はフレームやレイヤーの行。行を押すと、詳細に内容と使っている所が並び、使っている所を押すと Figma でそのレイヤーが選ばれる。同じ原因（同じ色の30か所など）は1行にまとまる。上部の件数を押すと、一覧がその行だけに絞られる。

| 種類 | 出るとき | 直し方 |
|---|---|---|
| error | Dark support ON で、Light か Base の変数につないでいない色 | 変数につなぐ |
| error | Dark support ON で、Light と同じ名前の変数が Dark に無い色 | Dark に同じ名前の変数を作る |
| error | Dark support ON で、Dark コレクションが無い | Setup を押すか、Dark support を OFF にする |
| error | Web ページ名が重なっている | Section 名かフレーム名を変える |
| error | 1つの Section に、同じ幅のフレームが2つ以上ある | 別の Web ページなら Section を分け、同じなら1つにする |
| notice | トークンと同じ値なのに、つないでいない（Dark support ON の色は上の error になる） | そのトークンにつなぐ |
| notice | Section の中の、一番狭い以外のフレームに From width が無い | From width を入れる |

## 9. Export して CC に渡す

上部の Export を押す。error が残っていると止まり、一覧が error の行だけに絞られる。error が 0 なら zip がダウンロードされる。Dark support ON なら Light と Dark の両方の画像が入り、終わると（失敗しても）Light に戻る。

zip には、CC への指示の `prompt.md` と、入っているものと含まれなかったものを書いた `README.md` が入る。zip をコードを作るフォルダに置き、CC に「この zip の `prompt.md` のとおりにページを作って」と伝える。

## できたかを確かめる

zip の `README.md` の「含まれなかったもの」が、思ったとおりかを見る。CC がページを作ったら、そのスクリーンショットを zip の中の画像と比べる。
