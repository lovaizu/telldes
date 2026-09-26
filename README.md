# Telldes

Figma で作った LP / HP を、Claude Code（以下 CC）がカンプと同じ見た目に組めるかたちで渡せる Figma プラグイン。

## Who it is for

- デザイナーは、Figma のデザインを、CC がカンプと同じ見た目に組めるかたちに整えられる。色・間隔・動きを言葉で説明し直さなくてよい
- デザイナーは、渡す前に直すところと渡らないものを知り、zip にして CC に渡せる。CC が作ってから外れに気づかなくてよい

## Getting started

1. bun（JavaScript の実行環境）を https://bun.sh から入れる
2. リポジトリを取り、ビルドする

   ```
   git clone https://github.com/lovaizu/telldes.git
   cd telldes
   bun install && bun run build
   ```

3. Figma デスクトップアプリでファイルを開き、Plugins → Development → Import plugin from manifest… で、このリポジトリの `manifest.json` を選ぶ
4. Plugins → Development → Telldes で開く。無償版（Starter）の Drafts で動く

## Usage

### Figma のデザインを、CC に渡せるかたちに整える

1. 1つの Figma のページに、渡すフレームだけを置く。プラグインは開いているページを読む（Section の中のフレームは渡る。手順4）。部品置き場や下書きは別の Figma のページに置く。非表示のレイヤーとフレーム以外（裸の Component、Rectangle など）は渡らず、Frames の一覧に Not exported として並び、zip の `README.md` にも書かれる
2. プラグインを開き、Tokens タブの Setup を押す。トークン（CC が CSS の変数にする色・数値・書体・文字・影）のうち次の推奨一式に足りないものだけが、Light・Dark・Base のコレクション（Light・Dark はテーマで変わる色、Base は変わらない値）と Text Style・Effect Style に作られ、Tokens の一覧に出る。足りないトークンがあるあいだは Tokens タブに印が出る。2回押しても増えず、手で作った同名のものは上書きされない。名前は共通の語彙で、値はデザインごとに変えてよい

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

3. デザインする。Auto Layout の無いフレームの子は座標のまま渡り、同じ親の中の同名のレイヤーや Figma のデフォルト名（Frame 1 など）もそのまま渡る。デザインしたあと Tokens タブに、トークンとして出るもの（変数のうち Color・Number と、使える場所（Scope）に Font family か Font style を含む String、それに Text Style と Effect Style）が並び、出ないもの（Color Style、文字の中身に使う String（Scope が Text content）、Boolean）は Not exported として並び、値はそのまま `spec.json`（zip の中の、フレームの中身の記述）に載る。変数につないでいない色や数値も、値のまま `spec.json` に出る
4. 幅ごとに見た目を変える Web ページ（zip のフォルダ1つ。HP なら top・about など）は、幅ごとに別のフレームで描き（例: 1440 と 375）、Figma の Section で囲む。Section 名が Web ページ名になり、Frames タブに Section 名の行が出て、その中に幅ごとのフレームが並ぶ。囲まないフレームはフレーム名が Web ページ名になり、1枚だけの Web ページは囲まなくてよい。Section の中の Section は渡らず、手順1と同じく Not exported に並ぶ
5. Frames タブでフレームを開き、Export settings に From width（どの幅からそのフレームを使うか）と Content width（コンテンツ幅）を入れる。一番狭いフレームは From width を空のままにする。Content width が空なら全幅。Web ページの題名は、Frames タブで Web ページ（1枚だけならそのフレーム）を開き、Page title に入れる。設定はファイルに保存され、開き直しても残る
6. Figma のプロパティで伝わらないこと（動き、ホバー、リンク先、意図、アクセシビリティ）は、レイヤーの詳細の note に自由な文章で書いて Save する。note は、レイヤーを選んだときの Figma のプロパティパネルからも開ける。note のある行に ✎ が付く。すべての Web ページに効くことは、上部のファイル名を押して Rules for every page に書く
7. ダーク対応するなら、ファイルの Export settings で Dark support を ON にし、色をすべて Light か Base の変数につなぐ。Dark には Light と同じ名前の変数を置く。上部の Light | Dark を押すと、この Figma のページ全体の変数のつながりが付け替わり、キャンバスで確かめられる。Dark のまま閉じたファイルを開くと、Light に戻すよう促される

### Review して Export し、CC に渡す

1. プラグインを開くと Review が走り、上部に「● n errors ○ n notices」が出る。error は直さないと Export できないもの、notice は知らせるだけのもの。設定を変えたとき・Export の前にも自動で走る。Figma で直したあとは Review ボタンで走らせ直す
2. error と notice は、持ち主（ファイル・トークン・トークンにつないでいない値（Tokens タブに並ぶ）・フレーム・レイヤー）の行に ● ○ で付き、詳細に内容と直し方、使っている所が並ぶ。使っている所を押すと Figma でそのレイヤーが選ばれる。同じ原因（同じ色30か所など）は1行にまとまる。上部の件数を押すと、一覧がその行だけに絞られる
3. error を直す。error になるのは、Dark support ON で Light か Base の変数につないでいない色、Light の変数と同じ名前の変数が Dark に無い色、Dark support ON で Dark コレクションが無い、Web ページ名の重複。notice になるのは、トークンと同じ値（色や数値）なのにつないでいないもの（Dark support ON では色は上の error になり、notice は出ない）、Section の中の一番狭い以外のフレームに From width が無いこと
4. Export を押す。error が残っていると Export は止まり、一覧が error の行だけに絞られる。error が 0 なら zip がダウンロードされる。Dark support ON なら Light と Dark の両方の画像が入り、終わると（失敗しても）Light に戻る
5. zip には次が入る
   - `prompt.md`: CC への作業指示
   - `tokens.json`: トークン
   - `README.md`: 入っているものと、含まれなかったもの。渡らないレイヤーに書いた note もここに書かれる
   - Web ページごとのフォルダ: 幅ごとのフレームの `spec.json`、フレーム全体とその中のまとまりごとの画像、画像アセット（写真は PNG、アイコン・ロゴは SVG）、CSS で描けないものの画像
6. zip をコードを作るフォルダに置き、CC に「この zip の `prompt.md` のとおりにページを作って」と伝える。読み方は `prompt.md` に入っている

## Develop

```
bun run build       # 型検査とビルド（dist/ui.html と dist/code.js）
bun run typecheck   # 型検査だけ
```

## License

MIT
