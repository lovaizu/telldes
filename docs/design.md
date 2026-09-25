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

**原則A — Figma 公式のベストプラクティスをそのまま土台にし、telldes 固有の約束は「公式の作法では表せないこと」だけに限って足す。** デザイナーは telldes のために新しい作法を覚えるのではなく、普段の作法のまま精度が上がるべきだから。独自の約束は増えるほど守られず、忘れられる。本節以下の制作ルールはこの原則から導く。固有の約束を足すときは、公式の作法では表せないことだという根拠をその場に書く。出力の側を受け持つ原則Bは 4.5 の冒頭にある。

#### 4.3.1 ページ構造

ページ直下＝セクションと固定する。spec.json の第1階層がそのままセクション列になり、CC がページ構造を推測せずに済む。

#### 4.3.2 Auto Layout必須

理由: Auto LayoutのプロパティはCSS flexboxに1対1で対応するため、CCが機械的に変換できる（4.6）。

Group を例外にする判断: 装飾アイコンのように内部パーツを絶対配置するものは Auto Layout で表現できない。Review の「Auto Layout未適用」チェックは FRAME/COMPONENT 系のみを対象とし GROUP を外すことで、こうした要素を Group にまとめれば警告なく通る逃げ道を用意している。子を持つ Frame に Auto Layout が無い場合はエラー（Export もブロック）。

#### 4.3.3 サイジング

Hug / Fill / Fixed の3つに限定するのは、CSS への対応が一意に決まるものだけを許すため。CSS はその軸が親の並びの向き（主軸）か、それと直交する向き（交差軸）かで決まる。対応表は 4.5.2.1「layout.sizing」が正。

| Figma設定 | 主軸 | 交差軸 |
|---|---|---|
| Hug contents | サイズ指定なし＋`flex-shrink: 0` | サイズ指定なし |
| Fill container | `flex: 1 1 0` ＋ `min-width: 0`（縦並びは `min-height: 0`） | `align-self: stretch` |
| Fixed + 数値 | `width: Npx`（縦は `height`）＋`flex-shrink: 0` | `width: Npx` / `height: Npx` |

minWidth/maxWidth/minHeight/maxHeight は同じく一意に対応するため許す（spec.json では `layout.sizing` に載る。4.5.2.1）。

#### 4.3.4 トークンの源泉（方針）

**基本姿勢**: ツールが無視・変換するものは必ず利用者に告知する（暗黙のドロップ/スキップ禁止）。利用者が「何がトークンになり、何が値展開されるか」を予測できる状態を保つ。

原則A に従い、Figma 現行のベストプラクティスに合わせてトークンの源泉を以下に定める。

| Figmaの仕組み | 用途 | Telldesの扱い |
|---|---|---|
| **Variables（COLOR）** | カラー | `tokens.json` に named token として出力 |
| **Variables（FLOAT/number）** | スペーシング・サイズ等の数値 | `tokens.json` に named token として出力 |
| **Variables（STRING）のうち書体用にスコープを絞ったもの** | font-family | `tokens.json` に named token として出力（`$type: "fontFamily"`） |
| **Text Style** | タイポグラフィ（font-family/size/weight/line-height） | named typography token として出力し、spec から参照 |
| **Color Style（グラデーション・複数fill）** | カラー（単色に展開できないもの） | named token として `tokens.json` に出力し、spec から参照 |
| **Effect Style** | 影 | 影の部分を named shadow token として `tokens.json` に出力し、spec から参照 |
| Color Style（単色） | カラー | 非推奨。トークン源泉として扱わず、使用時は書き出し時のREADMEに除外物として記録（Figma本体もVariables推奨） |
| Variables（BOOLEAN）、それ以外の Variables（STRING） | — | トークン対象外。使用時は書き出し時のREADMEに除外物として記録 |

**書体も `tokens.json` に出す。** 色・余白・角丸・文字サイズ・影はどれも「解決済み値＋`*Token`」で出て CC は `var(--…)` で書けるのに、書体だけ生の文字列になるのは原則B「形が揃っている」を崩す特別扱いであり、telldes 自身が Setup で作ったもの（`font/heading` 等）を自分で「拾えませんでした」と告知する形にもなる。Figma 公式も String Variable の適用先に font-family を挙げており、W3C DTCG にも `fontFamily` 型があるので、公式の作法の範囲に収まる（原則A）。デザイナーが独自に作った STRING Variable のうち書体でないもの（テキストの中身・バリアント切り替え等）と BOOLEAN Variable は、対応する CSS の受け皿が無いため引き続き対象外・告知対象とする。

**書体かどうかは Variable の `scopes` で決める — `FONT_FAMILY` を含み、かつ `ALL_SCOPES` を含まないもの**、すなわちデザイナーが Figma の変数パネルで書体用だと絞ったものだけを書体として扱う。`scopes` は変数ピッカーにどのフィールドで出すかの絞り込みで、新規作成した Variable は既定で `ALL_SCOPES`（＝絞っていない）である。`ALL_SCOPES` を書体の印にすると、テキストの中身の差し替え用に作った STRING Variable まで書体として `tokens.json` に出てしまう。既定値のままは宣言ではない（原則B「推測させない」）。変数名から当てにいかないのも同じ理由。絞っていない STRING Variable は対象外のまま除外物として README に載る（4.7.2）ので、拾われなかったことは黙って落ちず、スコープを絞れば拾われるという手がかりが届く（原則B「欠けていると分かる」）。**Setup が生成する `font/heading` / `font/body` / `font/mono` には `scopes: ["FONT_FAMILY"]` を設定する。** 書体がトークンとして出ることはこのスコープ設定に依存する。

カラーは **単色は Variables に一本化**する。Color Style はグラデーション・複数fillのように単色に展開できないものに限り正式な源泉として扱う。Variable の COLOR 型は単色しか持てないため、グラデーションは Color Style 以外に表現手段がない（Figma本体も「値の組み合わせは Style、Style の中身は Variables を指す」という立場を取っており、実際 `GradientPaint.gradientStops[].boundVariables` で各stopの色を個別に Variable へバインドできる）。したがって、グラデーション・複数fillの Color Style は名前の付いたトークンとして `tokens.json` に出し（形は 4.5.1）、それを使うノードの `spec.json` はそのトークン名を指す（4.5.2.1）。stop の色は、`spec.json` では解決済みの値に加えてトークン名（Variable の名前。そのノードが Style を当てていれば Style の stop のトークン名。4.5.2.1）を持ち、`tokens.json` では stop ごとの色のトークンとして解決済みの値に展開する（4.5.1）。**ただしダークモード対応が ON のファイルでは、stop の色の未バインドは影の色と同じく error とする**（4.7.2）。telldes は stop の色も Light ⇄ Dark で差し替えるため（4.3.9）、バインドされていない stop だけがライトの色のまま取り残され、`screenshots-dark/` が実物と食い違う。単色なのに Color Style を使っている場合（Variables に一本化できるのにしていない場合）は、引き続き除外物としてREADMEで告知する（4.7.2）。

**Effect Style（影）も同じ扱いに揃える。** Figma は影の `color` / `radius` / `spread` / `offsetX` / `offsetY` を個別に Variable へバインドできる（`VariableBindableEffectField`）。したがって Effect Style は複合的な見た目としての源泉のままとし、各フィールドが Variable を指していればそのトークン名を、指していなければ解決済みの値を `spec.json` の `effects`（4.5.2.1）に出力する。影の色はテーマで変わりうるため、ダーク対応ファイルでは色のバインド漏れがそのまま出力の破綻になる（4.7.2 の原則1）。Effect Style そのものも、Text Style と同じく名前の付いたトークンとして `tokens.json` に出す（4.5.1）。Setup が `shadow-sm` / `shadow-md` を作る以上、影にも名前がある。Text Style は名前付きで出るのに影だけ値の羅列になるのは、原則B「形が揃っている」を崩す特別扱いになる。

Variablesの使用そのものは必須ではない。使わない場合、CCはspec.jsonの解決済み値（`resolvedValue`）から直接CSSを生成する（同じ値が複数箇所でも個別値として出力）。出力の正しさは変わらないため、Variable化はデザイナーの判断に委ね、ツールは促さない。例外は、既にあるトークンと同じ値なのにそれを指していない箇所 — 判断済みの語彙を使い損ねているだけなので、付け忘れとして知らせる（4.7.2）。

命名規約は自由（唯一の例外は `radius/full`。4.3.6）。ただし意味の一貫性のため、以下の**推奨トークン体系**を本ドキュメント上の指針として示す（プラグインが命名を促すことはしない）。**telldesは値をどのスロットに割り当てるかを自動判定しない**（誤検知を避けるため）。「トークン化する値の命名はこの体系から選ぶ」という共通語彙の提示までが本書の役割で、トークン化の要否と具体的なスロット選択はデザイナーが行う。

命名は Figma の変数パネルが自動でグループ化する `/` 区切りの階層名とする。値は各変数が直接持つ1層構成とし、原始値を別変数に分けるPrimitives/Semanticの2層構成は採らない（この規模のトークン数ではFigma公式ガイドも1層構成を推奨している）。この体系は「よく使われる値だけに名前を付ける」という位置づけであり、ここに無い一回限りの値（突出して大きい/小さいフォントサイズ、ページ端の大きな余白等）は生値のままでよい。全ての値をトークンに収めることは目標にしない。

```
Color（Variables COLOR、Light 14 ＋ Dark 14）
  bg / surface / border
  fg/default / fg/muted
  primary/default / primary/hover / primary/on
  link
  code/bg / code/fg
  notice/bg / notice/fg
  shadow
Spacing（Variables FLOAT、8）
  spacing/xs=4 / sm=8 / md=16 / lg=24 / xl=32 / 2xl=48 / 3xl=64 / 4xl=96
Radius（Variables FLOAT、5）
  radius/sm=4 / md=8 / lg=16 / xl=24 / full=9999
Font family（Variables STRING、3）
  font/heading / body / mono
Typography（Text Style名、9）
  display / heading-lg / heading-md / heading-sm / lead / body / label / caption / code
Elevation（Effect Style / drop shadow、2）
  shadow-sm / shadow-md
```

**共通にするのは名前（種類と役割）で、値はデザインごとに違ってよい。** 名前はデザイナーと CC が同じ言葉で話すための語彙であり、デザインを共通の値に合わせさせるものではない。実在のページ1件（ポートフォリオLP）ですら、余白・角丸の実測値は固定の段階にほとんど収まらなかった。したがって Setup が入れる値は仮置きであり、満たすのは「隣り合う段階・役割どうしの違いが目で分かる」ことだけとする。

種類と役割は、コード・箇条書き・表・注意書きを含む技術記事ページ（Zenn）の実測で確かめて決めた。リンク・コード（背景と文字）・注意書き（背景と文字）・等幅書体は Web の読み物でほぼ必ず出るのに受け皿が無かったので足した。コードの色分けの色は足さない ― CC 側では色分けの仕組み（ハイライタ）が持つもので、デザイナーが語彙として持つものではない。`shadow`（影の色）は、Setup が作る Effect Style の色を変数につなぐために要る。つながっていないと、ダークモード対応を ON にした時点で Setup 自身が作った影がテーマ整合 error になる（4.7.2）。

文字の大きさは変数にしない。実測では大きさ・太さ・行の高さが組で変わっており、その組をまとめる入れ物は Text Style である。大きさだけを変数にしても、デザイナーの判断は減らない。Typography が9段階なのは、ポートフォリオLPの 18 / 20px を受ける `lead`、Web でほぼ必ず出る `label`（フォーム・ボタンの文字）、技術記事のコードを受ける `code` を足したため。Font family の3役割で足りない書体（装飾用の一回限りの書体等）は、Variable を増やさず生値のまま使ってよい。同様に9段階に無い一回限りの大きさも生値のままでよい。

Setup は各 Variable の `scopes` を次のとおり設定する（Figma 公式の対応に従う。原則A）。値の種類に合わない欄のピッカーに出さないためで、書体だけは判別の印も兼ねる（上記）。

| 対象 | `scopes` |
|---|---|
| bg / surface / primary/default / primary/hover / code/bg / notice/bg | `FRAME_FILL`, `SHAPE_FILL` |
| fg/default / fg/muted / primary/on / link / code/fg / notice/fg | `TEXT_FILL` |
| border | `STROKE_COLOR` |
| shadow | `EFFECT_COLOR` |
| spacing/* | `GAP` |
| radius/* | `CORNER_RADIUS` |
| font/* | `FONT_FAMILY` |
| Dark コレクションの全変数 | `[]`（4.3.9） |

Setup は各 Variable の `codeSyntax.WEB` に、名前の `/` を `-` にした `var(--…)` を入れる（`fg/default` → `var(--fg-default)`）。Dev Mode でデザイナーが見る名前と、`tokens.json` で CC が使う CSS 変数名（4.5.1）を同じにするため。

この一式 ― **変数44個（Color Light 14 / Color Dark 14 / Spacing 8 / Radius 5 / Font family 3）＋ Style 11個（Text Style 9 / Effect Style 2）＝ 55個** ― を Setup（4.7.1）がファイルに生成する。Figma Free ではチームライブラリの publish が使えずファイルをまたいで Variables / Style を揃える手段が他に無いため（4.10）、揃えるにはプラグイン自身が作るしかない。生成後の改名・値変更は Figma 純正の Assets パネルで行う（telldes 側に編集UIを持たない）。

**ダーク用の14色も Setup が最初から作る。** Dark コレクションの変数は `scopes: []` でカラーピッカーから隠れるため（4.3.9）、ダーク対応しないファイルに存在してもデザイナーの邪魔にならない。ダークを始めるときは Export 設定を ON にして色を入れるだけで済み、生成のタイミングが1つで済む。4.7.2 原則1 が「Dark コレクションの有無を判定軸にしない」根拠（Setup を実行した全ファイルに Dark がある）も、これで実在する。

Elevation（ドロップシャドウ）の命名指針も本体系に含めるが、プラグインが命名を促すことはしない。影の実値は `spec.json` の `effects`（4.5.2.1）に出力されるため、Effect Style にまとめなくても CC には届く。この体系は命名の共通語彙として、デザイナーとCCが同じ言葉を使うための指針である。Effect Style にまとめた場合は、その名前で `tokens.json` にも出る（4.5.1）。

#### 4.3.5 背景の扱い

背景をフレームの fill に限定する理由: 子要素がすべてコンテンツになり、CCはAuto Layoutの子要素＝HTMLの子要素と機械的に対応付けできる。背景専用の子レイヤーを許すと、CC は画像から「これは背景か中身か」を推測することになる（2. ペイン）。

#### 4.3.6 命名規約

「同じ親の中でユニークであればよい」とする理由: 階層情報は Figma のレイヤーツリーが持っているので、名前に親を繰り返させる必要がない。ユニーク性の単位を親に限ることで、spec.json の `path` とファイル名の一意化（4.5.2「path / ファイル名の一意性」）が親ごとの `-N` 付与だけで済む。

**CCが解釈する特別な名前**（`header` / `footer` / `nav` / `heading` / `cta` / `button`）の一覧は README「レイヤー名」が正。`prompt.md`（4.8.1 の「HTML導出ルール」）はそれを転記する。名前から HTML 要素を導くのは、デザイナーに HTML を意識させずに見出しレベルとランドマークを決めるため。

**telldesが解釈する特別なトークン名 — `radius/full`**: 円・ピル形状は Figma 上では絶対px（短辺の半分）としてしか現れず、`border-radius: 9999px` と px 値のどちらが正しいかはデータから決まらない。そこで `radius/full`（4.3.4）へのバインドを「常に丸める」という宣言とみなし、バインドされていれば `border-radius: 9999px`、されていなければ px 値のまま出す。px 値の大小から円・ピルを当てにいかないのは、4.9 の「描かれていない振る舞いを推測しない」と同じ理由 — 描画結果は一致しており、値からは意図を区別できない。

**命名は自由だが、この名前だけは意味を持つ。** 4.3.4 が命名規約を自由にしているのは、telldes が値からスロットを当てにいかないためであり、その方針と `radius/full` は矛盾しない ― 名前は telldes が当てるのではなくデザイナーが宣言するものだから。ただし改名や自作の命名でこの名前を外すと、宣言は黙って効かなくなり、円・ピルは px 値のまま出る。黙らせないために、**丸い形（角丸が短辺の半分に達している）なのに `radius/full` を指していない箇所**を付け忘れの知らせとして出す（4.7.2）。error にはしない — px 値のまま出ても描画は一致しており、出力は壊れていない。名前で宣言させる形自体を変えないのは、デザイナーが Figma の中だけで完結でき、telldes 固有の印を足さずに済むため（原則A）。

#### 4.3.7 note（補足情報）

Figmaの標準プロパティでは伝えられない情報（動き・インタラクション・意図・リンク先・アクセシビリティ）の受け皿。Free 版にはアノテーション機能が無い（4.10）ため、プラグイン側で `setPluginData` に持つ。内容を自由記述にしているのは、構造化するとデザイナーが書けることを狭めるから — 解釈は CC に委ねる。

#### 4.3.8 画像アセット

画像を含むノードは書き出し時に自動でアセットになる（形式と出力先は README「画像」）。ファイル名はレイヤーパスを `--` で結合したもので、スクリーンショット（4.4.2）と同じ規則。同じ規則にしておくと spec.json の `path` からファイル名が機械的に導ける。塗りの画像・線の SVG はこれに `--fill-{番号}` / `--stroke` を足し、どれも `spec.json` にパスとして載る（4.5.2.1「アセット」）。非表示のノードはアセットにしない（4.5.2）。

#### 4.3.9 ダークモード（1フレーム＋トグル）

Figma のプラン制限がかかるのは「1コレクションあたりのモード数」であり（Free はモードを作れない）、**コレクションの数はどのプランでも制限されていない**。したがって Variable Modes を使わずコレクションを分ければ Free でもダーク対応ができる。変数は3コレクションに分ける。

| コレクション | 内容 | 対を持つか |
|---|---|---|
| Light | 色（4.3.4 の Color 14個） | Dark と対 |
| Dark | 同名の色 | Light と対 |
| Base | 余白・角丸・書体 | 持たない |

**変数名にテーマを入れない**（`bg-light` にしない）。`tokens.json` がその名前で出ると CSS 変数名（4.5.1）も `--bg-light` になり、`--bg` が `:root` と `[data-theme="dark"]` で値を変える形（4.5.1）を CC が機械的に作れなくなる。テーマ違いはコレクション名が持つ。

**対を持つのは色だけ**。余白・角丸・書体はテーマで値が変わらないので Base に置く。文字サイズは Text Style（4.3.4）が持つものでコレクションには入らない。二重管理が起きず、付け替えも「バインド中の変数と同名の変数が対のコレクションにあれば差し替える、無ければ触らない」で済み、Base を除外する特別扱いが要らない。

**フレームは複製しない。** telldes がバインドを Light ⇄ Dark で差し替え、キャンバス上で実際にダークを描画する。dark フレームを別に生成する方式を採らない理由:

- dark フレームはトップレベルフレームとして書き出し対象になり（4.7.4）、`Home/spec.json` と `Home-dark/spec.json` という**別ページ2つ**として CC に渡る。同じページのテーマ違いを別ページとして渡すことになり、出力構造が歪む
- light の構造変更が dark に伝わらない。古さを検出する仕組みが別途要り、怠れば古い dark が CC に渡る
- 再生成は delete-insert になり、レビュー中に付いた Figma のコメントが迷子になる（コメントは Plugin API から触れない）

**暗くなるのはページ全体。** 付け替えの対象は2つ — (1) ページ上の全書き出し対象フレーム配下のノード（4.7.4）、(2) ファイル共有の `PaintStyle` / `EffectStyle` オブジェクト自体。選択フレームだけを暗くしない理由は目的側にある。ダークはサイト全体にかかる振る舞いであり、フレームごとに明暗が混在する状態は実物に無い。書き出しは全フレームを撮る（4.7.4）ので、ページ全体を揃えて初めて `screenshots-dark/` が全フレーム分そろう。スタイルはファイル全体で共有されるものなので、下の状態フラグ（ファイル単位）とも粒度が一致する。非表示のノード（4.5.2）も付け替える。出力には出ないが、Dark のままデザイナーが表示に戻したとき、そこだけライトの色で現れるのを避けるため。

**影とグラデーションの色も変わる。** 明るい背景用の影は暗い背景では見えず、グラデーションは浮く。変わらなければ `screenshots-dark/` が実物と食い違い、出力の正確さが崩れる。4.7.2 が影やグラデーション stop の色を変数にすることを要求しておきながら付け替えないのは、言われたとおりにしても直らないという最悪の体験になる。Color Style / Effect Style を使っている場合、そのバインドはノードではなくスタイルオブジェクト側に載るため、(2) を対象に含めなければ届かない。実現手段は Paint / Effect の配列を作り直して再代入する形になる — `ColorStop.boundVariables` は `readonly`、`setBoundVariableForPaint` は `SolidPaint` しか受け取らず、1フィールドだけを差し替える API が無いため。再代入する配列（stop の `boundVariables` を含む Paint・Effect の並び、テキストは区間ごと）は②が読み取りデータから丸ごと作り、①はそれを代入するだけにする（4.7.6）。

**ノードが Style を当てている箇所は、ノード側では付け替えない。** `fillStyleId` / `strokeStyleId` / `effectStyleId`（テキストは区間の `fillStyleId`）が入っている塗り・線・影は、Style の中身がノードに写っているだけで、ノードに配列を再代入すると Style とのつながりが切れる（Figma は代入された配列をそのノード固有の値として持つ）。こうした箇所の色は (2) の Style 側を付け替えれば届く。

代償として、ファイルが「今どちらのテーマか」という状態を持つ。書き出しは light 撮影 → 付け替え → dark 撮影 → light に戻す手順になり（4.7.4.4）、中断で dark のまま残りうる（4.7.2）。状態はファイル単位なので、Export 設定と同じ `figma.root.setPluginData` に持つ（4.7.4.3）。また light/dark をキャンバス上に並べて比較できない — 比較は書き出した screenshots で行う。

**誤操作の防止**: Dark コレクションの変数には `scopes: []` を設定し、デザイナーのカラーピッカーから隠す。Plugin API からのバインドは `scopes` を無視するため、手では選べず telldes だけが差し替えられる状態になる。値の編集は開けておく — dark の色を決めるのはデザイナーの仕事であり、禁じたいのは手動バインドだけ。

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

書き出し対象: セクション（必須）＋ 子を持つブロック（自動）。エレメント（末端）は書き出さない。非表示のノードは撮らず、子を持つかどうかも表示されている子だけで数える（4.5.2）。

### 4.5 出力フォーマット

**原則B — 出力（CC が読むもの）は LLM が迷わない形にする。** 「LLM なら推測できる」で済ませない。推測が要る時点で出力の設計が足りていない。

| | 意味 |
|---|---|
| 形が揃っている | 同じ種類のものは同じ構造で出る。特別扱いを作らない |
| 1箇所にだけある | 同じ事実を2箇所に書かない。片方だけ古くなる形を作らない |
| 欠けていると分かる | 黙って落とさない。落としたなら落としたと書く |
| 推測させない | 宣言されていないことは出力に存在しない。値から意図を当てにいかない |

zip に入るもの（4.5〜4.6、4.8）と、CC に何を届けるかの判断はこの原則から導く。制作ルールの側を受け持つ原則Aは 4.3 の冒頭にある。

エクスポート時にzipとしてダウンロードされる内容:

```
telldes-export/
├── prompt.md          ← CCプロンプト（自動生成）
├── steering.md        ← 確認・タスク・ルール（テンプレート）
├── tokens.json        ← デザイントークン（トークンの源泉（4.3.4）が1つでも定義されている場合のみ）
├── settings.json      ← Export 設定（4群。4.5.4）
├── README.md          ← zip内容の説明＋今回の書き出しの除外物（4.7.2）
├── site/              ← favicon・OG画像（Export設定で指定された場合のみ。4.5.3）
├── {フレーム名}/       ← トップレベルフレームごとにフォルダ
│   ├── spec.json      ← デザインスペック
│   ├── screenshots/   ← セクション＋ブロック画像
│   ├── screenshots-dark/ ← 同上のダーク表示（ダークモード対応ONのときのみ。4.7.4.4）
│   ├── assets/
│   │   ├── images/    ← ラスター画像
│   │   └── icons/     ← ベクターアセット
│   └── assets-dark/   ← ライトと見た目が変わるアセットのみ（ダークモード対応ONのときのみ。4.7.4.4）
│       ├── images/
│       └── icons/
```

LPの場合はフレーム1つ（例: `lp/`）、HPの場合はページごとにフレームを作成し、それぞれがフォルダとして出力される（例: `top/`, `about/`, `contact/`）。

#### 4.5.1 tokens.json

トークンの源泉 — 対応Variables（COLOR / FLOAT / 書体の STRING。判別と対象外の範囲は 4.3.4）、Text Style、グラデーション・複数 fill の Color Style、影を含む Effect Style — のいずれかが定義されている場合のみ出力。どれも未定義の場合は`tokens.json`自体を出力しない。

**W3C Design Tokens Community Group（DTCG）の形式の骨組み — `$type` / `$value`、`/` の階層をそのまま入れ子にしたグループ、道具ごとの追加情報を入れる `$extensions`、グループ自身の値を持つ `$root` — を土台にする**（原則A）。ただし DTCG に準拠はしていない。値の書き方は、CC が CSS に写しやすい形を選んでおり、次の点で DTCG と違う。

| 点 | telldes | DTCG（2025.10） | 違える理由 |
|---|---|---|---|
| 色の `$value` | `#RRGGBB` / `#RRGGBBAA` の文字列 | `colorSpace`・`components` を持つオブジェクト | CSS にそのまま書け、`spec.json` の色と同じ書き方で照合できる |
| 数値の `$value` | 単位の無い数 | 寸法は `value`・`unit` を持つオブジェクト | Figma の変数は単位を持たない。単位は下の `cssValue` が持つ |
| テーマ違い | `$value` を `{ "light": …, "dark": … }` にする（下記） | 定めが無い | 同じ名前の2つの値を1つのトークンとして CC に渡すため |
| typography の `lineHeight` / `letterSpacing` | CSS の値の文字列（`"36px"` / `"150%"` / `"normal"`） | 数・寸法 | Figma の行の高さは px・%・AUTO の3通りで、CSS の書き方にしないと単位が落ちる |
| グラデーション | stop の色を1つずつ `color` のトークンにする（下記）。DTCG の `gradient` 型は使わない | stop の並びを1つの値にする | stop の位置はノードごとに違い、並びを1つの CSS 変数にしても使えない（下記） |

```json
{
  "color": {
    "bg-primary": {
      "$type": "color",
      "$value": "#3B82F6",
      "$extensions": { "com.github.lovaizu.telldes": { "cssVariable": "--color-bg-primary", "cssValue": "#3B82F6" } }
    }
  },
  "spacing": {
    "section-gap": {
      "$type": "number",
      "$value": 48,
      "$extensions": { "com.github.lovaizu.telldes": { "cssVariable": "--spacing-section-gap", "cssValue": "48px" } }
    }
  },
  "font": {
    "heading": {
      "$type": "fontFamily",
      "$value": "Noto Sans JP",
      "$extensions": { "com.github.lovaizu.telldes": { "cssVariable": "--font-heading", "cssValue": "\"Noto Sans JP\"" } }
    }
  },
  "typography": {
    "heading-md": {
      "$type": "typography",
      "$value": {
        "fontFamily": "Inter",
        "fontSize": 28,
        "fontWeight": 700,
        "fontStyle": "normal",
        "lineHeight": "36px",
        "letterSpacing": "0em"
      },
      "$extensions": {
        "com.github.lovaizu.telldes": {
          "cssVariable": {
            "fontFamily": "--typography-heading-md-font-family",
            "fontSize": "--typography-heading-md-font-size",
            "fontWeight": "--typography-heading-md-font-weight",
            "fontStyle": "--typography-heading-md-font-style",
            "lineHeight": "--typography-heading-md-line-height",
            "letterSpacing": "--typography-heading-md-letter-spacing"
          },
          "cssValue": {
            "fontFamily": "\"Inter\"",
            "fontSize": "28px",
            "fontWeight": "700",
            "fontStyle": "normal",
            "lineHeight": "36px",
            "letterSpacing": "0em"
          }
        }
      }
    }
  },
  "fills": {
    "brand-gradient": {
      "1": {
        "1": {
          "$type": "color",
          "$value": "#3B82F6",
          "$extensions": { "com.github.lovaizu.telldes": { "cssVariable": "--fills-brand-gradient-1-1", "cssValue": "#3B82F6" } }
        },
        "2": {
          "$type": "color",
          "$value": "#1E40AF",
          "$extensions": { "com.github.lovaizu.telldes": { "cssVariable": "--fills-brand-gradient-1-2", "cssValue": "#1E40AF" } }
        }
      }
    },
    "hero-overlay": {
      "1": {
        "$type": "color",
        "$value": "#111827",
        "$extensions": { "com.github.lovaizu.telldes": { "cssVariable": "--fills-hero-overlay-1", "cssValue": "#111827" } }
      },
      "3": {
        "$type": "color",
        "$value": "#00000099",
        "$extensions": { "com.github.lovaizu.telldes": { "cssVariable": "--fills-hero-overlay-3", "cssValue": "#00000099" } }
      }
    }
  },
  "effects": {
    "shadow-md": {
      "$type": "shadow",
      "$value": [
        { "color": "#0000001F", "offsetX": 0, "offsetY": 8, "blur": 24, "spread": -4 }
      ],
      "$extensions": {
        "com.github.lovaizu.telldes": {
          "cssVariable": { "boxShadow": "--effects-shadow-md-box-shadow" },
          "cssValue": { "boxShadow": "0 8px 24px -4px #0000001F" }
        }
      }
    }
  }
}
```

（`hero-overlay` の `2` は画像の塗りなのでトークンが無く、番号だけが飛ぶ。`shadow-md` は `spread` を持つので `textShadow` / `filter` の形が無い。どちらも下記）

Variablesの構造をそのままJSON化する。デザイナーの命名がそのままトークン名になる。`$type` は Variable の型から決まり、COLOR は `color`、FLOAT は `number`、書体の STRING は `fontFamily`（DTCG の型名）になる。書体も他と同じ「トークン名＋値」で出るので、CC は font-family も `var(--…)` で書ける（原則B「形が揃っている」）。

`typography` グループは Text Style から出力する（4.3.4「Text Style は named typography token として出力し、spec から参照」）。Variables ではなく Text Style が源泉である点が color/spacing と異なるが、`tokens.json` 上のトークンとしての扱いは同じ。`$type` は `"typography"`、`$value` は `fontFamily` / `fontSize` / `fontWeight` / `fontStyle` / `lineHeight` / `letterSpacing` を持つ複合値とする。トークン名（上記例の `heading-md`）は Text Style 名をそのまま用いる。命名は自由だが、4.3.4 の推奨トークン体系（`display` / `heading-lg` / `heading-md` / `heading-sm` / `lead` / `body` / `label` / `caption` / `code`）に従うことを推奨する。

`$value` は Text Style の canonical な定義値であり、個々のノードに対する解決済みメトリクスではない。そのため 4.5.2.1 の `text.*` フィールドで採用している「既定値は省略」という間引き規約はここには適用されず、各値が既定的かどうかに関わらず6つのキーを常にすべて含める（例の `"letterSpacing": "0em"` はこの規約により省略しない）。`lineHeight` が Text Style 上 AUTO 設定の場合も同様に省略や `"AUTO"` という文字列での出力はせず、CSS の `line-height: normal` に相当するキーワード文字列 `"normal"` を `$value.lineHeight` に出力する（Figma Plugin API は AUTO 設定の描画後 line-height をpx値として提供しないため、CSS 側の意味的な等価表現を用いる）。`$value` が常に具体的な解決値を持つようにするためである。

**太さと斜体は Text Style の書体名（`fontName.style`）から決める。** Text Style は API に太さの値を持たず、書体名（`Bold`・`Semi Bold Italic` など）しか持たないため。空白・`-`・`_` を除き、大文字小文字を区別せず、次の語を長いものから順に探して最初に当たったものを採る（`Bold` が `ExtraBold` の一部に当たらないようにするため）。

| 語 | `fontWeight` |
|---|---|
| `Thin` / `Hairline` | 100 |
| `ExtraLight` / `UltraLight` | 200 |
| `Light` | 300 |
| `Regular` / `Normal` / `Book` | 400 |
| `Medium` | 500 |
| `SemiBold` / `DemiBold` | 600 |
| `Bold` | 700 |
| `ExtraBold` / `UltraBold` | 800 |
| `Black` / `Heavy` | 900 |

どれにも当たらない書体名（`W6` など）は 400 とし、決められなかったことを告知する（4.7.2 の「決められない値」。黙って 400 にすると、太さの違いが消えたことに誰も気づかない）。書体名に `Italic` か `Oblique` を含めば `fontStyle` は `"italic"`、無ければ `"normal"`。テキストノードの `text.fontWeight` はノードの区間が持つ太さの値をそのまま使い、この規則は使わない（4.5.2.1）。

`fills` グループはグラデーション・複数 fill の Color Style から、`effects` グループは影を含む Effect Style から出力する（4.3.4）。トークン名は Style 名をそのまま用いる。グループを分けるのは `typography` と同じく、Variable と Style は別々に名付けられ、同じ名前が並びうるため。

- **Color Style は塗り1枚ごとに番号を付け、単色の塗りは1つの `color` トークン、グラデーションの塗りは stop 1つごとに `color` トークンにする。** 名前は `<Style 名>/<塗りの番号>`、グラデーションの stop は `<Style 名>/<塗りの番号>/<stop の番号>`。塗りの番号は Figma の塗りの並び（下の塗りから、1始まり）、stop の番号は stop の並び（1始まり）。グラデーション1つの Style も塗りが1枚の Style として同じ形にする（原則B「形が揃っている」）。番号にするのは、Figma の塗りと stop には名前が無く、並びだけが見分ける手がかりだから
- **グラデーションを1つのトークンにしない。** CSS の `linear-gradient` の stop の位置は、角度と箱の縦横比で決まるグラデーションの線の上の位置で、Figma の stop の位置（ハンドルの上の位置）とはノードごとにずれる（4.5.2.1）。stop の並びだけを1つの CSS 変数に入れて `linear-gradient(角度, var(--…))` と書かせると、位置がずれたまま描かれる。そこで種類・向き・stop の位置はノードごとに `spec.json` の `fills` が計算済みの値で持ち、トークンは stop の色だけを持つ
- 画像の塗りと非表示の塗り（`visible: false`）は CSS 変数に入れる値が無いのでトークンにしないが、番号は飛ばして並びを保つ。番号を詰めると、Style を直したときに別の塗りのトークンが同じ名前を引き継ぎ、古い CSS が黙って別の色になる
- Color Style のトークンの色には、塗りの不透明度を含める（単色はアルファ、グラデーションは各 stop のアルファに掛ける）。CSS の背景の重ねには1枚ごとの不透明度が無く、色のアルファに入れるのが同じ描画になる唯一の形だから
- **影を含む Effect Style** は DTCG の `shadow` 型にし、`$value` は表示されている影の並び（`color`・`offsetX`・`offsetY`・`blur`・`spread`（px）、内側の影は `inset: true`）とする。並びは Figma の effects の並びのまま。影が1つでも並びにする（原則B「形が揃っている」）。ぼかし（`LAYER_BLUR` / `BACKGROUND_BLUR`）は入れない。DTCG に型が無く、CSS でも影とは別のプロパティ（`filter` / `backdrop-filter`）になるからで、ぼかしは `spec.json` の `effects` の値から書く
- stop・影の色が Variable を指していても、他のトークンと同じく解決済みの値に展開する（下記のエイリアスの扱い）。どの色がどの Variable かは `spec.json` の `colorToken` が持つ

color トークンの `$value` は #RRGGBB（6桁）。アルファが 1 未満の場合のみ #RRGGBBAA（8桁）で表現する。エイリアス（他トークンの参照）は解決済みの値に展開する。

あるトークン名が、別のトークンのグループ接頭辞と一致する場合（例: `color` と `color/primary` が併存）、グループ自身の値は DTCG の予約キー `$root` に格納する（例: `color.$root` と `color.primary` の両方を保持）。これにより同名の値が失われない。

**CSS 変数名は telldes が決めて、各トークンの `$extensions["com.github.lovaizu.telldes"].cssVariable` に書く。** CC にトークン名から組み立てさせると、組み立て方を CC が推測することになり、デザイナーが Figma の Dev Mode で見ている名前とも食い違いうる（原則B「推測させない」）。CC は `:root` での定義にも `var()` での参照にもこの名前をそのまま使う。置き場所を `$extensions` にするのは、DTCG が道具ごとの追加情報のために用意した欄だからで、キーは他の道具と重ならないよう DTCG が勧める逆ドメイン表記にする。

- **Variable は、`codeSyntax.WEB` に CSS 変数名があればそれを使う。** Variable をコードでどう書くかを持つ Figma 自身の欄であり、Dev Mode もこれを表示する（原則A）。Figma の作法では WEB の code syntax は `var(--名前)` の形で書くので、その中の `--名前` を取り出す（後ろに `, 既定値` が付いていてもよい）。Setup が作る変数はすべてこれを持つ（4.3.4）
- **`codeSyntax.WEB` が空か、`var(--…)` の形でない場合は、名前から作る。** `$fg-default` のような別の書き方は CSS 変数名ではないので、書かれていないものとして扱う。Style（Text Style・Color Style・Effect Style）は code syntax を持たないので常にこちらになり、**名前の前にグループ名を付けてから作る**（`typography/heading-md`・`fills/brand-gradient`・`effects/shadow-md`）。Variable と Style は別々に名付けられるので、付けないと Setup の変数 `shadow` とデザイナーが作った Effect Style `shadow` がどちらも `--shadow` になり、片方の値が黙って消える。作り方は次の順:
  1. `/`・`.`・空白を `-` にする
  2. 英大文字を小文字にする
  3. 文字（日本語など英字以外の文字を含む）・数字・`-`・`_` 以外（絵文字・記号など）を取り除く
  4. 続いた `-` は1つにし、先頭と末尾の `-` を取る。空になったら `token` にする（4.5.2 でフォルダ名が空になったとき `frame` にするのと同じ）
  5. 先頭に `--` を付ける（`fg/default` → `--fg-default`、`spacing/1.5` → `--spacing-1-5`、`🔵 Blue 0000FF` → `--blue-0000ff`）
- `.` を取り除かずに `-` にするのは、取り除くと `spacing/1.5` と `spacing/15` がどちらも `--spacing-15` になるため。段階の名前に小数を使うのは珍しくない
- 名前から作る規則は、Dev Mode がデザイナーに見せる名前に合わせるためのもの（原則A）。Figma は「Dev Mode は正しい CSS にするため変数名を正規化する」と書き、`🔵 Blue 0000FF` → `--blue-0000FF` を例に挙げる。この例で確かめられるのは、絵文字を取り除くこと・空白を `-` にすること・`Blue` が `blue` になることまで。同じ例の `0000FF` と、同じ記事の別の例（`Thin-100` → `var(--Thin-100, 100)`）では大文字が残っており、どの大文字を小文字にするかは資料から決まらない。`.` の扱いも資料に無い。telldes はすべて小文字にし、`.` は `-` にする。CSS 変数名は小文字をハイフンでつなぐのが慣習で、CC は `tokens.json` に書かれた名前だけを使うので、Dev Mode と違っても出力は壊れない。Dev Mode との違いは実機で確かめる（4.7.7）。Setup が作る名前は英小文字・数字・`-`・`/` だけなので、どの手順でも結果は変わらない
- ダーク対応ファイルで Light と Dark の対を1つのトークンにする場合（下記）は、Light 側の変数の名前を使う。Dark 側はデザイナーのピッカーに出ず、telldes が差し替えに使う相方だから（4.3.9）
- 別々のトークンが同じ CSS 変数名になることは確かめない。重なりの主な源だった2つ — Variable と同じ名前の Style、`.` を取り除くことで重なる名前 — は、Style にグループ名を付けることと `.` を `-` にすることで起きなくした。残るのは `fg/default` と `fg-default` のように紛らわしい名前を両方作ったときだけで、まれだから
- 複合値のトークンは、CSS のプロパティ1つにつき CSS 変数1つとする。CSS 変数はプロパティの値を丸ごと置き換えるもので、1つの変数に複数のプロパティは入らないから。`typography` は6つのプロパティにまたがるので、`$value` のキーごとに名前を書く（Style 名から作った名前に `-font-family` などを足す）。影は下の `cssValue` の形ごとに1つ（`-box-shadow` / `-text-shadow` / `-filter`）

**CSS 変数に入れる値も telldes が決めて、`cssVariable` の隣の `cssValue` に書く。** `cssVariable` と同じ形（文字列、複合値ならキーごとのオブジェクト、テーマ違いなら `{ "light": …, "dark": … }`）。`$value` の数には単位が無く、`16` を `16px` にするか `16` のままにするかは CC には決められない（原則B「推測させない」）。`$value` は Figma の値のまま残す — `spec.json` の解決済みの値と同じ数で照合できるようにするため。どちらも telldes が同時に書くので、片方だけ古くなることは無い。

| `$type` | `cssValue` |
|---|---|
| `color` | `$value` と同じ文字列 |
| `fontFamily` | `"` で囲んだ書体名（`"Noto Sans JP"`）。空白や数字を含む書体名は囲まないと CSS で読めないため、常に囲む |
| `number` | Variable の `scopes` で決める（下表） |
| `typography` | `fontFamily` は上と同じ、`fontSize` は `px` を付け、`fontWeight` は数のまま、`fontStyle` / `lineHeight` / `letterSpacing` は `$value` のまま |
| `shadow` | 下記 |

| `scopes` | 単位 | 理由 |
|---|---|---|
| `CORNER_RADIUS` / `WIDTH_HEIGHT` / `GAP` / `STROKE_FLOAT` / `EFFECT_FLOAT` / `FONT_SIZE` / `LINE_HEIGHT` / `LETTER_SPACING` / `PARAGRAPH_SPACING` / `PARAGRAPH_INDENT` | `px` | Figma はこれらの欄の数を px として描く |
| `OPACITY` | `%`（`50` → `50%`） | Figma の不透明度の変数は 0〜100 の数を持つ。CSS の `opacity` は `%` を受け付ける |
| `FONT_WEIGHT` | 単位なし | CSS の `font-weight` も単位の無い数 |

`scopes` が `ALL_SCOPES` を含む、または単位の違う欄にまたがる場合は、`scopes` では決まらない。そのときは、読み取りデータの中でその Variable が実際にバインドされている欄（`itemSpacing`・`opacity`・`fontWeight` など）を同じ表に当てて決める。それでも決まらない（どこにも使われていない、または単位の違う欄の両方に使われている）ものは `cssValue` を持たせず、「決められない値」として告知する（4.7.2）。持たせない方を選ぶのは、決まらない単位を telldes が選べば推測になるから。Setup が作る数値の変数は `GAP` か `CORNER_RADIUS` だけを持つ（4.3.4）ので、常に `px` に決まる。

**影は、描くプロパティごとに CSS の書き方が違う。** 同じ Effect Style を箱にもテキストにも使えるので、CC が使いうる形をすべて持たせる。

| キー | 値 | 持つ条件 |
|---|---|---|
| `boxShadow` | 影の並びを逆にした `box-shadow` の値（内側の影は `inset` を付ける） | 常に |
| `textShadow` | 影の並びを逆にした `text-shadow` の値（`offsetX offsetY blur color`） | すべて外側の影で、`spread` が 0 |
| `filter` | `drop-shadow(offsetX offsetY blur color)` | 外側の影が1つだけで、`spread` が 0 |

並びを逆にするのは、Figma の effects は `fills` と同じく下の影から並び、CSS の影の並びは先頭が一番上だから（4.5.2.1）。`text-shadow` と `drop-shadow()` は `spread` と内側の影を表せないので、その場合は形を持たせない。`filter` を影1つに限るのは、`drop-shadow()` を並べると後のものが前の影ごと影を落とし、別々の影の重ねにならないため。どのノードにどの形を使うかは `spec.json` が持つ（4.5.2.1 の `shadowProperty`）。形の無いものを使うノードは、影を出さずに告知する（4.7.2）。

**ダーク対応ファイル（Light / Dark / Base の3コレクション、4.3.9）の場合**、コレクション名でJSONをグループ化しない。Light・Darkの両コレクションに同名の変数が存在する場合は1つのトークンとして扱い、`$value`を`{ "light": ..., "dark": ... }`の形にする。Baseコレクションの変数（テーマで値が変わらないもの）は単一値のままとする。Color Style・Effect Style のトークンも、中の色が Light の変数を指していれば同じ `{ "light": ..., "dark": ... }` の形にする。dark 側は、その色を Dark の対に差し替えた値（付け替えの結果と同じ。4.3.9）。スタイルの色もテーマで変わる以上、変数と同じ形で出さなければ CC はダークの値を知りようがない。`cssValue` も同じ形になり、影の `boxShadow` などはキーごとに `{ "light": …, "dark": … }` を持つ。

```json
{
  "bg": {
    "$type": "color",
    "$value": { "light": "#FFFFFF", "dark": "#1A1A1A" },
    "$extensions": {
      "com.github.lovaizu.telldes": {
        "cssVariable": "--bg",
        "cssValue": { "light": "#FFFFFF", "dark": "#1A1A1A" }
      }
    }
  },
  "spacing": {
    "xs": {
      "$type": "number",
      "$value": 4,
      "$extensions": { "com.github.lovaizu.telldes": { "cssVariable": "--spacing-xs", "cssValue": "4px" } }
    }
  }
}
```

コレクション名でグループ化する（`{"Light": {"bg": ...}, "Dark": {"bg": ...}}`）と、CCが「Light.bgとDark.bgは同じトークンの2つの値」と認識できず、無関係な2つの変数として誤って出力しかねない。トークン名を最上位キーにし、`$value`がlight/darkのオブジェクトかどうかだけを見て`:root`と`[data-theme="dark"]`の両方に出すか単一に出すかを機械的に判断できる形にする（原則B「形が揃っている」）。

**light/darkのペアにするかどうかは Export 設定の「ダークモード対応」で決める**（4.7.4.2）。Dark コレクションの有無では決めない — Setup（4.3.4）は3コレクションを一式生成するので、ダーク対応しないファイルにも Dark コレクションは存在する。有無で判定すると、使っていないダーク値が全ファイルの `tokens.json` に載ることになる。設定がOFFなら Light の値だけを単一値として出す。

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
- 値は常に解決済み値を持つ。Variable または Style が適用されている場合は `*Token` フィールドにトークン名も付与
- `note` は付与されたノードにのみ存在
- 非表示のノード（`visible: false`。祖先が非表示のものを含む）は出さない。描かれていないものを CC に作らせると、カンプと食い違うため。黙って落とさないよう、書き出し時の除外物として記録する（4.7.2）

#### 4.5.2.1 フィールド詳細

上記の基本例に加え、以下のフィールドを出力する。いずれも該当する値が存在する場合のみ付与する（存在しない場合はフィールド自体を省略する）。

**fills（背景・塗り）**

`fills` 配列の各要素は `type` で種類を表す。**表示されている塗り（`visible` が false でないもの）だけを出す。** 非表示の塗りは描かれておらず、出せば CC が描いてしまう（4.5.2 の非表示のノードと同じ理由）。

| type | フィールド | CSS |
|---|---|---|
| `SOLID` | `color`（#RRGGBB / #RRGGBBAA）, `colorToken?`, `opacity?` | 単色 |
| `IMAGE` | `asset`, `backgroundSize`, `backgroundPosition`, `backgroundRepeat`, `opacity?` | `url(asset) {backgroundPosition} / {backgroundSize} {backgroundRepeat}`。`asset` は塗りの元の画像ファイル（下記「アセット」） |
| `GRADIENT_LINEAR` | `angle`, `gradientStops`, `opacity?` | `linear-gradient({angle}deg, {色} {位置}, …)` |
| `GRADIENT_RADIAL` | `size`（`{ x, y }`）, `center`（`{ x, y }`）, `gradientStops`, `opacity?` | `radial-gradient({size.x}% {size.y}% at {center.x}% {center.y}%, …)` |
| `GRADIENT_ANGULAR` | `angle`, `center`, `gradientStops`, `opacity?` | `conic-gradient(from {angle}deg at {center.x}% {center.y}%, …)` |
| CSS で同じに描けないグラデーション（下記） | `asset` | 塗り1枚を画像にしたものを `url(asset)` で箱いっぱいに敷く |

- `gradientStops` は `[{ position, color, colorToken? }]`。`color` は #RRGGBB（アルファ < 1 の場合は #RRGGBBAA）。stop の色が Variable にバインドされていれば `colorToken` も付く（4.3.4）。`position` は CSS の stop の位置（1 を 100% とする数）で、Figma の stop の位置ではない（下記）。0 未満や 1 を超える値もありうる（CSS はそのまま受け付ける）
- `size` と `center` はノードの幅・高さに対する %、`angle` は CSS の角度（度。0 が上、時計回り）
- `opacity` は塗りの不透明度が 1 未満の場合のみ付与する数値（0〜1）。半透明オーバーレイ（4.3.5）の再現に使う。CSS の背景には1枚ごとの不透明度が無いので、CC は色のアルファに掛ける。トークンの色には `color-mix(in srgb, var(--…) {opacity×100}%, transparent)` を使う（アルファを掛けたのと同じ色になり、トークンを使ったまま書ける）
- IMAGE / GRADIENT を含む全種類の塗りを `fills` に出力する（SOLID 以外を欠落させない）。
- **画像の塗りの置き方は、②が `scaleMode` から CSS の値にして載せる**（下表）。`scaleMode` のまま渡すと、CC が対応を当てることになる

| `scaleMode` | Figma の置き方 | `backgroundSize` | `backgroundPosition` | `backgroundRepeat` |
|---|---|---|---|---|
| `FILL` | 箱を覆うまで拡大縮小し、はみ出しを切る。中央に置く | `cover` | `center` | `no-repeat` |
| `FIT` | 箱に収まるまで拡大縮小する。中央に置く | `contain` | `center` | `no-repeat` |
| `TILE` | 元の大きさに `scalingFactor` を掛けた大きさで敷き詰める | `{画像の幅×scalingFactor}px {画像の高さ×scalingFactor}px` | `0 0` | `repeat` |
| `CROP` | 画像の中の切り抜いた範囲（`imageTransform`）を箱に合わせる | `{100 / 横の倍率}% {100 / 縦の倍率}%` | `{tx / (1 − 横の倍率) × 100}% {ty / (1 − 縦の倍率) × 100}%` | `no-repeat` |

- `CROP` の `imageTransform` は、箱の 0〜1 の座標を画像の 0〜1 の座標へ写す行列で、横の倍率・縦の倍率は箱に見えている範囲が画像の幅・高さに占める割合、tx・ty はその範囲の左上の位置。% で書くのは、箱の寸法が変わっても同じ範囲が見えるようにするため（倍率が 1 の軸は位置 `0%`）
- `TILE` の画像の幅と高さは、元の画像の画素数（読み取りデータの `images`）
- **CSS で同じにならない画像の塗り — `rotation` が 0 でないもの、`filters`（露出・コントラストなど）が1つでも 0 でないもの、`imageTransform` が回転を含むもの — は、塗り1枚を画像にして渡す**（CSS で描けないグラデーションと同じ。下記）。CSS の背景は画像を回せず、Figma の画像の調整と同じ計算の CSS の `filter` も無い。このときは `backgroundSize` などを出さず、`asset` を箱いっぱいに敷く
- 塗りが複数あるとき、`fills` は Figma と同じく下の塗りから並ぶ。CSS の `background` は上の層から書くので、CC は並びを逆にする。一番下以外の単色の塗りは `linear-gradient(色, 色)` にする（`background` で単色を置けるのは一番下の層だけだから）。どちらも CC に任せると推測になるので、ここで決めておく（原則B）。
- `blendMode` は塗りの描き方が `NORMAL` 以外のときだけ付ける。値は CSS の名前（`MULTIPLY` → `multiply`、`COLOR_BURN` → `color-burn` のように小文字にして `_` を `-` にしたもの）で、CC は `background-blend-mode` の同じ層に書く。CSS に同じものが無い `LINEAR_BURN` / `LINEAR_DODGE` と、一番下の塗りの描き方（ノードの後ろにあるものと混ぜる。`background-blend-mode` は要素の中の層どうししか混ぜない）は出さず、再現できない描画として告知する（4.7.2）。黙って `normal` で描かせると色が変わったことに誰も気づかない
- ノードの `fillStyleId` がグラデーション・複数 fill の Color Style を指すときは、ノードに `fillsToken`（例 `"fills/brand-gradient"`）を付ける。命名は `tokens.json` の `fills` トークン名（4.5.1）と対応する。**そのノードの塗りの `colorToken`（単色の塗りと stop）は、Variable ではなく Style のトークン（`fills/<Style 名>/<塗りの番号>` と `…/<stop の番号>`）を指す。** Style を当てたことがデザイナーの宣言であり、Style の中身が Variable を指していても、使う名前は Style の方だから。このときの `color` は Style のトークンと同じく塗りの不透明度を含み（4.5.1）、`opacity` は付けない — 2度掛けを起こさないため。単色の Color Style はトークンにならない（除外物。4.7.2）ので付けない。

**グラデーションの値は②がノードごとに計算して載せる。** Figma はグラデーションの向きと大きさを `gradientTransform`（ノードの枠を 0〜1 とした座標から、グラデーションの座標への変換）で持つ。CSS の書き方とは基準が違い、変換を CC に任せると推測になる（原則B）。値はカンプの寸法で計算する。

- **線形**: Figma で同じ位置になる点の集まり（色の等しい線）は、ノードの実寸の上で平行な直線になる。この線に垂直な向きを `angle` にする。CSS のグラデーションの線は箱の中心を通り、両端が箱の角を通る色の等しい線に乗る長さを持つので、その両端での Figma の位置を t0・t1 として、各 stop の位置 p を `(p − t0) / (t1 − t0)` に直す。CSS の線の長さは角度と縦横比で決まり Figma のハンドルとは一致しないので、Figma の位置をそのまま % にするとノードごとにずれる。ハンドルが斜めに歪められていても色の等しい線は平行な直線のままなので、線形はいつも CSS で同じに描ける
- **円形**: ハンドルが作る楕円の半径を `size`、中心を `center` にする。stop の位置は Figma のまま（どちらも中心が 0、楕円の縁が 1）。楕円の軸が箱の辺と平行でない（傾いている）ものは `radial-gradient` では描けない
- **角度**: 中心を `center`、始まりの向きを `angle` にし、stop の位置は1周を 1 とする数のまま。ハンドルが直角で同じ長さでない（向きによって伸び方が違う）ものは `conic-gradient` では描けない
- **CSS で同じに描けないもの — `GRADIENT_DIAMOND` のすべてと、上の2つの描けない場合、上記の画像の塗り — は、塗り1枚を画像にして渡す。** ダイヤモンドは CSS にも SVG にも同じ形のグラデーションが無い。近い形を CC に作らせれば推測になり、告知だけにすると描かれない。塗りの画像なら Figma 自身の描画そのものになる。①が、ノードと同じ大きさの長方形を一時的に作ってその塗り1枚だけを持たせ、PNG（2倍）で書き出して消す（ノードそのものを書き出すと子が焼き込まれるため）。`type` は元のまま残し、`gradientStops` などは出さない — CC が描き直さないように

**strokes（線）**

線も描画に効くので出す（4.3.4 の基本姿勢）。表示されている線だけを出す（塗りと同じ）。

| フィールド | 説明 |
|---|---|
| `strokes` | `fills` と同じ形の配列（`type`・`color`・`colorToken?`・`angle`・`gradientStops`・`opacity?`・`blendMode?` など）。線の Color Style は `strokesToken`（`fillsToken` と同じ規則） |
| `strokeWeight` | 太さ（px）。辺ごとに違う場合は `{ "top": n, "right": n, "bottom": n, "left": n }`。Variable 適用時は `strokeWeightToken`（辺ごとなら同じ形のオブジェクト） |
| `strokeAlign` | `INSIDE` / `CENTER` / `OUTSIDE` |
| `dashPattern` | 破線のときのみ。線と間の長さ（px）の並び |
| `strokesIncludedInLayout` | 線が中身の配置に場所を取るときのみ `true`（下記） |
| `strokeAsset`, `strokeAssetOverflow` | 線を SVG で渡すときのみ（下記） |

**箱の線（フレーム・長方形・インスタンスなど、テキストとアセットにしたノード以外）は、ノードに重ねた擬似要素 `::after` に描く。** 線を中身の配置から切り離したまま、CSS の `border` の描き方を使うため。

| 部分 | CSS |
|---|---|
| 置き方 | `content: ""; position: absolute; pointer-events: none; box-sizing: border-box;`。ノードには `position: relative` を付ける（`::after` の位置の基準にするため。寸法にも中身の位置にも効かない） |
| 位置（`inset`） | INSIDE は `0`、CENTER は `-{太さ/2}px`、OUTSIDE は `-{太さ}px`。辺ごとの太さなら辺ごとに |
| 角丸 | ノードの角丸に、その角の外へはみ出した分を足す（INSIDE は 0、CENTER は太さの半分、OUTSIDE は太さ）。辺ごとの太さなら横の半径には左右の辺、縦の半径には上下の辺の分を足す。角丸が 0 の角は 0 のまま |
| 線 | 辺ごとの `border-{辺}: {太さ}px solid {色}`。太さ 0 の辺は書かない |

- **`::after` の `border` で描くのは、単色の線が1本で、破線でなく、描き方が `NORMAL` のときだけ。** 辺ごとの太さはこれで描ける
- **それ以外（破線・グラデーションや画像の線・複数の線・`NORMAL` 以外の描き方）は、Figma に線だけを SVG で書き出させ、`::after` の背景にする。** ①が、ノードと同じ大きさ・同じ角丸・同じ線（太さ・位置・破線を含む）で塗りと影の無い長方形を一時的に作り、SVG で書き出して消す。ファイルは `assets/icons/{レイヤーパスのファイル名}--stroke.svg`。`spec.json` には `strokeAsset`（そのパス）と `strokeAssetOverflow`（画像がノードの枠の外にはみ出す幅。辺ごとに、CENTER は太さの半分・OUTSIDE は太さ・INSIDE は 0）を載せ、`strokes` と `dashPattern` は出さない — CC が描き直さないように。CC は `::after` の `inset` を `-{はみ出す幅}px` にし、`background: url(strokeAsset) 0 0 / 100% 100%` で敷く。CSS の `dashed` は線と間の長さを決められず、破線が角のどこから始まるか・グラデーションが線に沿ってどう乗るかも CC が SVG を組み立てれば推測になる。Figma に描かせれば同じ描画になる
- `outline` を使わないのは、フォーカスリングや CSS のリセットと同じプロパティを取り合い、辺ごとの太さも描けないため。`border` をノード自身に付けないのは、CSS の `border` が中身を線の太さだけ内側へ押し、Figma の CENTER / OUTSIDE の線（中身の配置に場所を取らない）と食い違うため。場所を取る線は下の padding で表す
- **`strokesIncludedInLayout`**: Figma は Auto Layout のフレームで、INSIDE の線だけを中身の配置に数える（既定で数える。設定で外せる）。CENTER と OUTSIDE の線は設定に関わらず数えない。そこで `spec.json` の `strokesIncludedInLayout: true` は「Auto Layout で、線が INSIDE で、数える設定」のときだけ付け、CC はその辺の線の太さを padding に足す（`padding` がトークンなら `calc(var(--…) + 1px)`）。線の描き方は変えない
- `clipsContent`（下記）で `overflow: hidden` になるノードでは、`::after` の枠の外にはみ出す部分が切れる。そのため、枠の外にかかる線（CENTER・OUTSIDE）を持つノードでは、単色の線が1本で辺の太さが揃っているときに限り、外にはみ出す分を `box-shadow: 0 0 0 {はみ出す幅}px {色}` で描き（`box-shadow` はノード自身の `overflow` で切れない。角丸にも沿う）、残りの内側の分だけを `::after` に描く。この輪は影の並びの先頭（一番上）に置く。それ以外の線と切り抜きの組み合わせは描けないので、再現できない描画として告知する（4.7.2）

**テキストの線は `-webkit-text-stroke` で描く。** CSS で文字の輪郭に線を描けるのはこれだけ。`-webkit-text-stroke` は輪郭の中央に線を引くので、Figma の位置ごとに次のようにする。

| `strokeAlign` | CSS |
|---|---|
| CENTER | `-webkit-text-stroke: {太さ}px {色}` |
| OUTSIDE | `-webkit-text-stroke: {太さ×2}px {色}; paint-order: stroke fill`（線を先に描き、内側の半分を文字の塗りで隠す）。文字の色が不透明な単色1枚（`text.fill` で `fillOpacity` が無く、アルファが 1）のときだけ |
| INSIDE | CSS に手段が無い |

- ②はこの値を計算済みで `text.stroke`（`{ "width": n, "color": …, "colorToken"?: …, "paintOrder"?: "stroke fill" }`）に載せ、テキストのノードには `strokes` 一式を出さない。形が箱の線と違うのは、描くプロパティが違うからで、箱の線の形で渡すと CC が `::after` を作ってしまう
- 描けないもの — INSIDE、単色でない線・複数の線・破線、文字の色が不透明な単色1枚でない OUTSIDE — は出さず、再現できない描画として告知する（4.7.2）。OUTSIDE を不透明な単色に限るのは、半透明なら隠したはずの内側の半分が透け、`text.fills`（`background-clip: text` と `color: transparent`）では文字の塗りが線の上に描かれず内側の半分を隠せないため（文字が細く見える）
- 区間ごとに文字の色が違うテキストの OUTSIDE は、すべての区間の色が不透明な単色のときだけ描ける

**アセットにしたノードは、線・塗り・影を出さない。** ノードを丸ごと書き出したアセット（下記「アセット」）には、Figma がそれらを焼き込み済みで、CSS でも描けば二重になる。

**text.fill と text.fills**

テキスト色は、表示されている塗りが単色1枚のときは `text.fill`（#RRGGBB）と `text.fillToken?`、塗りの不透明度が 1 未満なら `text.fillOpacity`（0〜1）で出す（CSS の `color`）。それ以外（グラデーション・画像・複数の塗り）のときは `text.fill` の代わりに `text.fills`（`fills` と同じ形。グラデーションはテキストノードの箱で計算する）を出し、CC は `background` にそれを書いて `background-clip: text` と `color: transparent` で文字の形に切り抜く。両方は同時に出さない。ほとんどのテキストは単色で `color` 1つで書けるので、そのための形を残し、そうでないときだけ背景として渡す。

**cornerRadius**

- 全角共通の場合: 数値（例 `8`）。Variable 適用時は `cornerRadiusToken`。
- 角ごとに異なる場合: オブジェクト `{ "topLeft": n, "topRight": n, "bottomRight": n, "bottomLeft": n }`。
- `cornerRadiusToken` が `radius/full` のときは、CC は解決済みpx値ではなく `border-radius: 9999px` を出す（4.3.6）。値そのものは他のトークンと同じく解決済みで載せる。

**clipsContent（切り抜き）**

Figma の「コンテンツを切り抜く」が ON で、**実際に枠の外へはみ出す表示中の子があるときだけ** `clipsContent: true` を出す。CSS は `overflow: hidden`（角丸があれば角丸で切れる）。はみ出す子が無ければ切り抜いても描画は同じで、`overflow: hidden` はノード自身の線の `::after` を切るという副作用だけを持つ（上記）ので、効いているときに限る。はみ出すかどうかは読み取りデータの各ノードの描画範囲から②が決める。

**effects（影・ぼかし）**

可視の effect を `effects` 配列として出力する（描画に効くため暗黙に捨てない。4.3.4 の基本姿勢）。各要素は `type` で種類を表す。並びは Figma と同じ（下の影から）。CSS の影の並びは先頭が一番上なので、CC は逆にして書く。

| type | フィールド | CSS 対応 |
|---|---|---|
| `DROP_SHADOW` | `color`（#RRGGBB/#RRGGBBAA）, `offsetX`, `offsetY`, `blur`, `spread?` | ノードの `shadowProperty` のプロパティ（下記） |
| `INNER_SHADOW` | 同上 ＋ `inset: true` | `box-shadow: inset ...` |
| `LAYER_BLUR` | `blur` | `filter: blur(blur px)` |
| `BACKGROUND_BLUR` | `blur` | `backdrop-filter: blur(blur px)` |

- `blur` は Figma の `effect.radius`。`spread` は 0 のとき省略。非可視 effect は出力しない。
- 各フィールド（`color` / `radius` / `spread` / `offsetX` / `offsetY`）が Variable にバインドされている場合は、他のフィールドと同じく `*Token` を併せて付与する（4.3.4）。
- **影を描くプロパティはノードの種類で決まり、②がノードの `shadowProperty` に書く。** Figma は影を落とす形をノードによって変えるので、`box-shadow` 1つでは同じにならない。

| ノード | Figma の影の形 | `shadowProperty` |
|---|---|---|
| テキスト | 文字の形 | `text-shadow` |
| 表示されている塗りを持つノード | ノードの箱 | `box-shadow` |
| 表示されている塗りの無いノード（フレーム・グループ・線だけの長方形など） | 中身と線の形 | `filter`（`drop-shadow()`） |

- `text-shadow` と `drop-shadow()` は `spread` と内側の影を表せず、`drop-shadow()` は並べると別々の影にならない（4.5.1）。これらに当たる影と、CSS に手段の無いもの — 半透明の塗りの下に影を透かす設定（`showShadowBehindNode`。`box-shadow` は箱の下には描かれない）、`NORMAL` 以外の描き方 — は出さず、再現できない描画として告知する（4.7.2）
- `filter` にぼかし（`LAYER_BLUR`）も入るノードでは、1つの `filter` に `drop-shadow()`、`blur()` の順で並べる
- ノードの `effectStyleId` が Effect Style を指し、その Effect Style が影を含むときは `effectsToken`（例 `"effects/shadow-md"`）を付ける。命名は `tokens.json` の `effects` トークン名（4.5.1）と対応する。フィールド単位の `*Token` とは別で、こちらは Effect Style という複合値の名前を指す。CC はトークンの `cssVariable` のうち `shadowProperty` に合うもの（`box-shadow` なら `boxShadow`）を使う。ぼかし（`LAYER_BLUR` / `BACKGROUND_BLUR`）はトークンに入らないので、`effects` の値から書く。

**アセット**

画像やベクターは `spec.json` にパス（フレームフォルダ相対）で載せ、CC にファイル名を組み立てさせない。

| 置き場所 | 中身 | ファイル名 |
|---|---|---|
| ノードの `asset`（と `assetOverflow`） | ノードを丸ごと書き出したもの。ベクター（Vector・Boolean・Star・Polygon・Ellipse・Line）は SVG、画像の塗りを持つ末端のノードは PNG（2倍） | `assets/icons/{ファイル名}.svg` / `assets/images/{ファイル名}.png` |
| 塗りの `asset`（`IMAGE`） | 塗りの元の画像そのもの（子を持つノードの背景画像など） | `assets/images/{ファイル名}--fill-{塗りの番号}.{元の形式}` |
| 塗りの `asset`（CSS で描けないグラデーション・画像の塗り） | 塗り1枚の画像（上記） | `assets/images/{ファイル名}--fill-{塗りの番号}.png` |
| `strokeAsset` | 線だけの SVG（上記） | `assets/icons/{ファイル名}--stroke.svg` |

- `{ファイル名}` はレイヤーパスを `--` で結合したもの（4.3.8）。塗りの番号は Figma の塗りの並び（下から、1始まり、非表示の塗りも数える）で、1つのノードに画像の塗りが2枚あっても別のファイルになる
- `{元の形式}` は②が画像の先頭のバイト列から決める（PNG / JPEG / GIF / WebP）。元の画像を変換せずに渡すのは、描いた解像度と画質をそのまま渡すため
- `assetOverflow` は、ノードを丸ごと書き出した画像が外側の線や影の分だけノードの枠より大きいときの、はみ出す幅（辺ごとの px）。CC は画像をノードの寸法の箱に置き、はみ出す分だけ外に出す（負の margin か absolute）。枠に合わせて縮めると、中の絵がずれる

**text（タイポグラフィのメトリクス）**

`text` には `characters` / `fontSize` / `fontFamily` / `fontWeight` に加え、描画に効くメトリクスを CSS 相当で出力する（該当時のみ）。1つのテキストの中で設定が区間ごとに違う場合（一部だけ太字・リンクの色など）は、最も多くの文字を占める設定を `text` の値とし、それと違う区間を `text.runs` に出す（下記）。

| フィールド | 値の例 | 備考 |
|---|---|---|
| `lineHeight` | `"24px"` / `"150%"` | AUTO（既定）は省略 |
| `letterSpacing` | `"0.5px"` / `"0.02em"` | PERCENT はフォントサイズ比＝em に変換。0 は省略 |
| `textAlign` | `center` / `right` / `justify` | LEFT（既定）は省略 |
| `textCase` | `uppercase` / `lowercase` / `capitalize` / `small-caps` | ORIGINAL（既定）は省略 |
| `textDecoration` | `underline` / `line-through` | NONE（既定）は省略 |
| `fontStyle` | `italic` | 書体名（`fontName.style`）に `Italic` / `Oblique` を含むときのみ（4.5.1 と同じ判定） |

- `fontWeight` は区間が持つ太さの値をそのまま使う。書体名から決めるのは、太さの値を持たない Text Style のときだけ（4.5.1）
- `link`: 区間に Figma のリンク（`hyperlink`）が付いていれば、その URL の文字列。リンク先が Figma のノードなら `{ "path": リンク先の path }`（書き出し範囲の外や別ページのノードなら、飛び先が zip に無いので出さず、再現できない描画として告知する。4.7.2）。CC は `<a>` にし、ノードへのリンクはその要素へのページ内リンクにする

**text.runs（区間ごとに違う設定）**

区間ごとの設定が1つでも違えば、`text.runs` に文字列全体を先頭から区切った並びを出す。各要素は `characters` と、`text` の値と違うフィールドだけを持つ（`fontWeight`・`fill`・`fillToken`・`typographyToken`・`link` など、`text` と同じ名前と形）。違いの無い区間は `characters` だけを持つ。CC は違いを持つ区間を `<span>`（`link` があれば `<a>`）にして書く。

- 先頭の区間の値で全体を代表させると、一部だけ太字の見出しやリンクの色が黙って消える（原則B「欠けていると分かる」）。区切った並びにするのは、文字の位置（開始と終了の番号）で渡すと CC が文字列を数えて切る必要があり、絵文字などで数え間違えるため
- 基準を最も多くの文字を占める設定にするのは、`<span>` の数を最も少なくするため。同じ数なら先に現れる設定
- 全体に1つずつしか無い設定（`textAlign`・線・影）は区間に出ない

- `typographyToken`: 区間が Text Style を指している場合に付与する文字列（例 `"typography/heading-md"`。命名は `tokens.json` の `typography` トークン名（4.5.1）と対応する）。`text` には基準の設定の Text Style を、違う Text Style の区間には `text.runs` の側に付ける。Text Style が適用されていない区間は省略する。
- `typographyToken` と `fontSizeToken` / `fillToken` などのプロパティ単位のトークンは独立しており、併存しうる。`typographyToken` は適用された Text Style を表し、`fontSizeToken` / `fillToken` は個々のプロパティに直接バインドされた Variable を表すため、両者は排他的ではない。同一ノードがどちらか一方のみ、両方、またはいずれも持たない場合があり、各フィールドは加算的（additive）に付与される。

**opacity（ノード不透明度）**

ノード自身の不透明度が 1 未満の場合のみ `opacity`（0〜1）を出力する。塗り単位の `opacity`（fills 内）／テキスト色の `fillOpacity` とは別のノード全体の不透明度。

**blendMode（ノードの描き方）**

ノード自身の描き方が `NORMAL` / `PASS_THROUGH` 以外のときだけ `blendMode` を出す。値は塗りの `blendMode` と同じ CSS の名前で、CC は `mix-blend-mode` に書く（下にあるものと混ぜる）。`LINEAR_BURN` / `LINEAR_DODGE` は CSS に同じものが無いので出さず、再現できない描画として告知する（4.7.2）。

**layout の折り返し**

`layoutWrap` が `WRAP` のときだけ `layout.wrap: "WRAP"` を出し、折り返した行（列）どうしの間隔 `counterAxisSpacing` があれば `layout.counterAxisGap` に出す（4.6）。

**layout.sizing**

- `width` / `height` はサイジングモード（`FILL` / `HUG` / `FIXED`）。`FIXED` の場合は実ピクセル値 `widthPx` / `heightPx` を併せて付与する。
- 4.3.3 で許可される最小/最大サイズが設定されている場合、`minWidth` / `maxWidth` / `minHeight` / `maxHeight`（数値）を付与する。
- Auto Layout コンテナ以外のノード（末端要素など）でも、Auto Layout の子であればサイジング情報を持つ。その場合 `layout` は `direction` 等を持たず `sizing` のみを含む。
- **CSS は軸ごとに、その軸が親の `direction` と同じ向き（主軸）かどうかで決まる。** `width` は親が横並びなら主軸、縦並びなら交差軸（`height` はその逆）。

| モード | 主軸 | 交差軸 |
|---|---|---|
| `FILL` | `flex: 1 1 0` と `min-width: 0`（縦並びは `min-height: 0`） | `align-self: stretch` |
| `HUG` | サイズを書かない。`flex-shrink: 0` | サイズを書かない |
| `FIXED` | `width: {widthPx}px`（縦並びは `height`）と `flex-shrink: 0` | `width` / `height` に px |

- `FILL` を `width: 100%` にしないのは、兄弟に Fixed や Hug があると 100% のうえに兄弟の幅が足されてあふれ、縮められる側（CSS の既定 `flex-shrink: 1`）が Fixed の兄弟まで縮めるため。縦の `height: 100%` は、親の高さが Hug（中身で決まる）だと基準の高さが無く効かない。主軸を `flex: 1 1 0` にするのは、Figma が Fill の兄弟どうしで残りの幅を「中身の幅が揃うように」分ける（Figma ヘルプ「Use auto layout with CSS Flexbox in mind」: 線と padding の分を除いた中身の広さで分ける、CSS の border-box と同じ）からで、`flex-basis: 0` と `box-sizing: border-box`（4.6）の組み合わせが同じ分け方になる。`min-width: 0` は、中身の最小幅で Fill が広がらないようにするため（Figma の Fill は中身に押し広げられない）
- `FIXED` と主軸の `HUG` に `flex-shrink: 0` を付けるのは、Figma では Fill 以外の子は縮まないため
- 交差軸の `HUG` がサイズを書かないだけで済むのは、親が常に `align-items` を書くから（4.6。`counterAxisAlign` が無ければ `MIN` ＝ `flex-start`）。CSS の既定 `stretch` のままだと Hug の子が引き伸ばされる
- Figma の `layoutAlign` / `layoutGrow` は出さない。どちらも Fill を表す Figma の内部の値で、`layoutSizingHorizontal` / `Vertical` が同じことを Fill / Hug / Fixed の形で持っている。2箇所に書けば食い違いうる（原則B「1箇所にだけある」）

**position（Auto Layout の流れの外にある子）**

Auto Layout が位置を決めない子 — Group の子と、`layoutPositioning: ABSOLUTE` の子 — は `position` を持つ。子を持つフレームに Auto Layout が無い場合は error なので（4.3.2）、ほかには生じない。持たせないと、CC はスクリーンショットから位置を当てることになる（原則B「推測させない」）。

- `position` は CSS に書く値そのもの（`{ "left": "24px", "top": "16px" }` など）で、親の箱の左上を基準にする。CC は親に `position: relative`、子に `position: absolute` を付けて書く
- Group の子は `left` / `top` の px。Figma は Group の子の座標を Group ではなくその外側のフレームを基準に持つので、②が Group の位置を引いて Group 基準に直す。Group は子を描くための入れ物で、寸法も子から決まり、伸び縮みしない
- `ABSOLUTE` の子は、Figma の制約（`constraints`）が親の寸法が変わったときの振る舞いを宣言しているので、それを CSS の基準に写す。カンプの寸法ではどれも同じ位置になる

| 制約（横。縦も同じ） | `position` |
|---|---|
| `MIN`（左） | `left: {x}px` |
| `MAX`（右） | `right: {親の幅 − x − 幅}px` |
| `STRETCH`（左右） | `left` と `right` の両方（幅は書かない） |
| `CENTER` | `left: calc(50% + {x − 親の幅/2}px)` |
| `SCALE` | `left` と `width` を親の幅に対する % で |

- **回転**は、回転だけの変換（反転や歪みを含まない）なら `rotate`（CSS の角度。度、時計回り）を出し、CC は `transform-origin: 0 0; transform: rotate({rotate}deg)` と書く。Figma の回転はノードの左上を中心とし、反時計回りを正とするので、②が符号を反対にする。回転した子の `position` は制約に関わらず `left` / `top` の px にする — 回った箱の基準を右端や中央に写すと、どこを基準にしたかが一意に決まらないため
- Auto Layout の流れの中にある子の回転、反転や歪みを含む変換、回転した Group は出さず、再現できない描画として告知する（4.7.2）。CSS の `transform` は並びに場所を取らず、Figma の並び（回った外形で場所を取る）と同じにならないため
- アセットにしたノード（4.5.2.1「アセット」）の回転は画像に焼き込まれているので出さない

**background（ページ背景）**

トップレベルフレーム自身の塗りはページ全体の背景（4.3.5）であり子ノードにはならないため、spec.json のトップレベルに `background`（`fills` と同じ形式の配列）として出力する。塗りがない場合はフィールドを省略する。

トップレベルフレーム自身の線・影・角丸は出さず、再現できない描画として告知する（4.7.2）。ブラウザのページには端が無く、フレームの端はビューポートの端になるので、描く場所が無い。

**path / ファイル名の一意性**

同一親内に同名の子（レイヤー順序で区別する同名インスタンス等、4.3.6）がある場合、2つ目以降の `path` セグメントとスクリーンショット/アセットのファイル名に `-2`, `-3` … の接尾辞を付けて一意化する。これにより spec.json の参照とファイル名が常に一致する。トップレベルフレーム名が重複する場合も、フォルダ名に同じ規則で接尾辞を付ける。

**フォルダ名（ページ直下のセグメント）の規約:** ページ直下のノード名は、そのままではフォルダ名・パス先頭セグメントとして使えないため、次の順で正規化する。

1. **パス区切り文字の無害化**: 名前に含まれる `/` と `\` を `-` に置換する。置換しないと `Desktop / Home` というフレーム名が zip 内で `Desktop/Home/` という入れ子フォルダを作ってしまい、READMEのパス表記とも食い違う
2. **前後空白の除去**: `.trim()` を適用する。`" Home "` と `"Home"` は読み手には区別がつかず、別フォルダとして並ぶと突き合わせ不能になる
3. **空名・ドットのみのフォールバック**: 1〜2の結果が空文字列になる場合、または `.` `..` `...` のようにドットだけになる場合は `frame` を用いる。空のセグメントはフォルダ名にもパス表記にもならず、`.` と `..` は名前ではなくパス操作である（`..` は展開先によっては書き出しルートの外にフォルダを作る）
4. **重複への `-N` 付与**: 上記を適用した結果が既出の名前と一致する場合、`-2`, `-3` … を付けて一意化する。「既出の名前」の集合には、zipルート直下に置くファイル名 `README.md` / `prompt.md` / `steering.md` / `tokens.json` / `settings.json` と、フォルダ名 `site`（4.5.3）をあらかじめ含める。含めないと `README.md` という名のフレームが、同名ファイルの隣に同名フォルダが並ぶzipを作ってしまう。`site` はフォルダ同士なので、同名フォルダが1つにまとまりfaviconとフレームの中身が混ざる。`site` は**実際に `site/` を書き出すかに関わらず予約する** — 予約を設定に依存させると、favicon の指定を外しただけでフレームのフォルダ名が変わる
5. **一致判定は大文字小文字を区別しない**: 4の「既出の名前と一致するか」は小文字化して照合する（予約ファイル名との照合も同様）。macOS（APFS既定）とWindowsは `Home` と `home` を同一パスに解決するため、別名として扱うと展開時に片方の `spec.json` がもう片方に黙って上書きされる。ただし**付与後に用いる綴りは元の名前のまま**とし（`Home` と `home` なら `Home` と `home-2`）、フォルダ名からFigma上のレイヤー名を辿れる状態を保つ

**ページ直下の兄弟は、フレームも非フレームも同一のパスで一度に命名する。** すなわち上記1〜5を、ページ直下の全ノードに対して単一の「使用済み名の集合」上で適用する。ただし**書き出し対象のフレーム（`FRAME`／`SECTION`）を先に命名する**。フレームはzipフォルダを所有するため接尾辞なしの名前を保持し、同名の非フレーム側が `-N` を取って譲る。これにより (a) フレームのセグメントはzipフォルダ名と常にバイト一致し、(b) 「フォルダ `Home/` が存在するのに README が `Home` は書き出されていないと述べる」「`A/B` のフレームと `A-B` という名の Component が同一文字列で表示される」といった自己矛盾が原理的に起こらない。これが成り立つのは命名対象がページ直下の全ノードである場合に限られるため、**書き出し対象フレームの決定とこの命名は、同じノード列から一度に解決した1つの値として扱う**（片方を別のノード集合から作れる形にすると、(b)は破れる）。この規約は 4.7.2 の除外物告知におけるレイヤーパス先頭セグメントにもそのまま適用される。

#### 4.5.3 site/（favicon・OG画像）

Export 設定（4.7.4.2）で favicon / OG 画像のフレームが指定された場合のみ `site/` を出力する。

| 出力 | 元 | 書き出し |
|---|---|---|
| `site/favicon.svg` | favicon に指定したフレーム | `exportAsync({ format: 'SVG' })` |
| `site/favicon.ico` | 同上 | 32×32 の PNG を ICO コンテナに収める |
| `site/apple-touch-icon.png` | 同上 | `exportAsync({ format: 'PNG', constraint: { type: 'WIDTH', value: 180 } })` |
| `site/og-image.png` | OG 画像に指定したフレーム | 同上、`value: 1200` |

- 仕組みは screenshots / assets（4.4.2、4.3.8）と同じ `node.exportAsync` で、違いは倍率ではなく実寸（`constraint.type: 'WIDTH'`）を指定する点だけ。
- ICO だけ別扱いなのは、Plugin API の書き出し形式が PNG / JPG / SVG / PDF しかなく ICO が無いため。PNG を包む形で作る（ICO 生成の実装手段は実装タスクで決める）。
- **ツールは切り抜きも余白の追加もしない。** `WIDTH` 指定は等比縮小なので、縦横比が合わないフレームからは 1200×630 も 180×180 も出ない。どこを捨てて何を足すかはデザインに書かれていない情報であり、決めれば推測になる（4.9）。所定の比率で描くのはデザイナー側のルール（README）。
- ファイル名は固定。レイヤーパス由来にしない理由は、`<link rel="icon">` や `<meta property="og:image">` が参照する先であり、フレーム名を変えただけで HTML の参照が切れるのを避けるため。この4つは `settings.site` からもパスで参照される（4.5.4）。
- `site/` は**フレームフォルダの外**に置く。サイト全体に1組しか無いものであり、どれか1つのフレームフォルダに入れると「そのページのアセット」に見える。

#### 4.5.4 settings.json

Export 設定（4群。項目の定義と理由は 4.7.4.2 が正）を zip ルートに出力する。

```json
{
  "responsive": [
    { "minWidth": 0, "frame": "top-mobile", "contentWidth": "100%" },
    { "minWidth": 1024, "frame": "top", "contentWidth": "1120px" }
  ],
  "darkMode": true,
  "site": {
    "title": "Product Name",
    "description": "…",
    "lang": "ja",
    "themeColorToken": "color/bg",
    "themeColor": "#FFFFFF",
    "favicon": { "svg": "site/favicon.svg", "ico": "site/favicon.ico", "appleTouchIcon": "site/apple-touch-icon.png" },
    "ogImage": "site/og-image.png",
    "ogTitle": "…",
    "ogDescription": "…"
  },
  "rules": "…（共通ルールの自由記述）"
}
```

- **設定はサイト全体で1つなので、zip ルートに1つだけ置きフレームフォルダには複製しない。** Export は実装への依頼書（4.7.4.1）であり、依頼書の全体条件は1枚目に1回書くもので、ページごとに繰り返す依頼書は無い。設定はファイル単位（4.7.4.3）で、`tokens.json` が既にルート共通なのとも揃う（原則B「1箇所にだけある」）。CC がページごとに設定を取り違えないことは、`prompt.md` が「各ページを作る前にルートの `settings.json` を読む」と手順で指示して担保する（4.8.1）——**手順で解ける問題を出力の形を歪めて解かない**。
- **設定が1つも入力されていなくても必ず出力する。** `tokens.json`（源泉が無ければ出さない）と異なるのは、こちらが「デザイナーが何を宣言したか」を表すファイルで、無いと CC には「設定していない」のか「telldes が落とした」のかが区別できないため（原則B「欠けていると分かる」）。未指定の群・項目はフィールドごと省略する（4.5.2.1 の規約と同じ）。
- `responsive` の各行は `minWidth`（適用開始幅。`0` は最小幅から適用）・`frame`（その幅で使うフレームのzipフォルダ名。4.5.2の正規化後）・`contentWidth`（固定pxなら `"1120px"`、比率なら `"100%"`）。フレーム名ではなくフォルダ名で持つのは、CC が読むのはzipであってFigmaのレイヤーツリーではないため。
- `themeColorToken` は Variables から選んだテーマカラーのトークン名。値が light/dark の対かどうかは `tokens.json` を引けば分かるので（4.5.1）、`<meta name="theme-color">` を1つ出すか `media` 付きで2つ出すかを CC が機械的に判断できる。`themeColor` は同じ値の解決済み表現で、`tokens.json` が出力されない場合の退避。
- `favicon` / `ogImage` は zip ルートからの相対パス（4.5.3）。`spec.json` の `screenshot` などがフレームフォルダ相対なのとは基準が違うため、`prompt.md` がどちらの基準かを明記する（4.8.1）。

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
| `counterAxisAlignItems: "MIN"`（既定。出力に無いときもこれ） | `align-items: flex-start`（省略しない。CSS の既定は `stretch`） |
| `counterAxisAlignItems: "CENTER"` | `align-items: center` |
| `counterAxisAlignItems: "MAX"` | `align-items: flex-end` |
| `counterAxisAlignItems: "BASELINE"` | `align-items: baseline` |
| 子の `layoutSizingHorizontal` / `Vertical` | 主軸・交差軸ごとの対応（4.5.2.1「layout.sizing」） |
| `counterAxisAlignContent: "SPACE_BETWEEN"` (wrap時) | `align-content: space-between` |
| `counterAxisSpacing` (wrap時) | 横並びなら `row-gap`（`itemSpacing` は `column-gap`）、縦並びなら `column-gap`（`itemSpacing` は `row-gap`） |

Figma の幅・高さは padding を含んだ外側の寸法なので、CC はすべての要素に `box-sizing: border-box` を使う。CSS の既定（`content-box`）のままでは、Fixed の幅に padding が足されて広がる。

### 4.7 プラグイン仕様

#### 4.7.1 画面構成

**オブジェクト指向UI（OOUI）で組む。** 画面に並べるのはデザイナーの関心の対象（名詞）であり、telldes の機能（動詞）ではない。

**オブジェクトの抽出**

抽出の出発点は 4.7.4.1 の「Export は実装への依頼書」の表である。依頼書の要素のうち telldes が**検出・記録の対象にするもの**が、そのままオブジェクトになる。

| オブジェクト | 依頼書での位置 | 正体 | 多重度 |
|---|---|---|---|
| **画面** | 何を作るか | 書き出し対象のトップレベルフレーム。zip の1フォルダ＝CC が作る1ページ（4.7.4） | コレクション |
| **レイヤー** | 何を作るか | 画面の中身 | 画面 1 — * レイヤー |
| **トークン** | 語彙 | Variables / Text Style / グラデーション・複数 fill の Color Style / Effect Style と、**トークンになるべきなのになっていない値**（生の色・生の数値・単色 Color Style 等） | コレクション |

残りの依頼書要素はオブジェクトではない。「どう作るか・全体」＝ Export 設定はファイルの属性で Export アクションのパラメータ、「どう作るか・個別」＝ note はレイヤーのプロパティ、「手順」＝ `prompt.md` / `steering.md` は自動生成物。テーマはファイルの状態（モード）、zip はアクションの結果である。

**違反・付け忘れの知らせ・note は、それ自体はオブジェクトではない。** 画面／レイヤー／トークンのいずれかのプロパティとして出す。**どちらのプロパティになるかは、デザイナーが下す1つの判断の対象が何かで決まる**（4.7.2 の原則2「Review の1行 ＝ デザイナーが下す1判断」）。

| 出るもの | 持ち主 | 理由 |
|---|---|---|
| 構造4種（Auto Layout 未適用 / デフォルト名 / 重複名 / 背景を子に）＋サイジング1種 | **レイヤー** | 直す対象がそのレイヤー1つに閉じている |
| テーマ整合5種（色の未バインド / 影の色 / グラデーション stop / ペア崩れ / light に Dark 混入） | **トークン** | 直す判断は「この色をどのトークンにするか」であって、それを使っている30箇所の判断ではない |
| 付け忘れの知らせ2種（トークンの付け忘れ / `radius/full` 不使用） | **トークン** | 同上 |
| 除外物告知のうち 単色 Color Style 使用・対象外 Variable 使用・トークン名衝突 | **トークン** | 4.7.2 が既に「除外される物」単位（Color Style ごと・Variable ごと）に集約している |
| 除外物告知のうち 裸の Component 定義・書き出し対象外レイヤーの note | **画面**（「渡されないもの」の行） | どの画面にも属さないもの |
| 除外物告知のうち 非表示のレイヤー・再現できない描画 | **画面**（「渡されないもの」の行） | 画面の中にあっても渡らないもの。画面の行に並べると渡るように見える |
| 除外物告知のうち 決められない値（太さが決まらない Text Style・単位が決まらない数値トークン） | **トークン** | 直す判断は「この Style・変数をどうするか」で、Style・変数ごとに1件 |
| note | **レイヤー** | 書いた対象がそのレイヤー |

**旧構成の4タブ（Setup / Review / Notes / Export）がタスク指向だったのは、これらのプロパティをビューに昇格させていたから。** 同じレイヤーのプロパティが別々の箱に入り、4症状（note の一覧が Notes と Export の2箇所に要る／付け忘れの知らせは Export に出るが直す作業は Review 側／Export を押すとチェック結果を見せるために Review へ飛ばされる／テーマ切り替えの置き場所が無い）を生んでいた。**プロパティを持ち主に戻せば、4症状は原因ごと消える。**

**ビューとナビゲーション**

ビューは3つ。

1. **トークンのコレクションビュー**（語彙）。各行＝1つのトークン、または「トークンになっていない値」1つ。行は原因単位で、`#333333` が30箇所で使われていれば**1行**（「30箇所」は行が持つ数）。テーマ整合の error と付け忘れの知らせはここに出る
2. **画面のコレクションビュー**（渡すもの）。各行＝1つの画面で、構造・サイジングの違反件数と note 件数を持つ。この一覧は**そのまま「これから渡すものの明細」**であり、Export 専用の明細ビューを別に持たない。末尾に **「渡されないもの」** の行を置き、どの画面にも属さないもの（裸の Component 定義、書き出し対象外レイヤーの note）と、画面の中にあっても渡らない非表示のレイヤー（4.5.2）と再現できない描画（4.5.2.1）を入れる。これまで zip 内 `README.md` にしか出ていなかった事実が Figma 上でも見える（原則B「欠けていると分かる」）
3. **レイヤーのシングルビュー**。選択に追従し、そのレイヤーの違反・note 入力欄を出す。Figma ではキャンバス上の選択がそのままオブジェクト選択になるため、直接操作が素で成立する

加えて、Export 実行時だけ入る**確認ビュー**がある（4.7.4.3）。これはアクションのモードであってオブジェクトのビューではない。

- 画面の行を展開すると、その画面で telldes が言うことのあるレイヤー（違反・note のいずれかを持つもの）が並ぶ。**この展開が画面のシングルビューを兼ねる**（画面固有のプロパティは Export 設定側にあり、別ビューを起こすほどの中身が無い）。**Figma のレイヤーツリーは作り直さない** — 純正のレイヤーパネルがある以上、telldes が出すべきは telldes が何か言うことのあるものだけ
- 一覧の行クリックで選択が変わる（4.7.3）。トークンの行をクリックしたときは、そのトークンを使っている（または使うべき）レイヤーを選択する
- **画面が0個のとき**（ページ直下に `FRAME`／`SECTION` が1つも無い）、Export は実行できない。画面のコレクションビューにその旨を出す。渡すものが無い zip を作らない
- **レイヤー未選択のとき**、シングルビューは「レイヤーを選ぶと、そのレイヤーについて分かることがここに出る」ことを示す。空欄にしない（4.3.4 の基本姿勢）。書き出し対象外のレイヤーを選んだときは、渡らないものであることを示したうえで note 入力欄を出す（note はどのレイヤーにも書ける。4.7.3）

**アクション**

アクションはオブジェクトに従属させる。

| アクション | 対象 | 置き場所 |
|---|---|---|
| Export（4.7.4） | 画面コレクション | 画面コレクションビューの見出し |
| Review（手動実行。4.7.2 の原則3） | 画面コレクション＋トークンコレクション | 両コレクションに効くのでヘッダ |
| テーマ切り替え（4.3.9） | ファイル | ヘッダに常設 |
| Setup（トークン一式の生成。4.3.4） | ファイル | ヘッダ |

**Setup だけはタスク指向のままで正しい。** OOUI がタスク指向を例外的に認める条件は「オブジェクトが限定的で、選択する必要がない」ことで、Setup の対象は現在のファイル1つに決まっている（ATM がカードを入れた時点で口座が確定しているのと同じ）。ファイルごとに一度きりで、デザイン中に繰り返す作業でもない。

**常設するもの**

常設するのは **テーマの現在状態**・**error 件数**・**付け忘れの件数**の3つ。`figma.notify()` との線引きは**消えてよいかどうか**で引く。

| | 例 | 置き場所 |
|---|---|---|
| 状態（持続する事実） | テーマが Light か Dark か / error 件数 / 付け忘れの件数 / 一覧の走査に失敗している | UI に領域を持つ |
| 出来事（一度きり） | note を保存した、行の対象が消えた、走査に失敗した**という知らせ** | `figma.notify()` |

走査の失敗は両方に出る。**失敗したという知らせ**は一度きりなので notify、**失敗したまま結果を持っていない状態**は持続するので UI が領域を持つ（4.7.3 の「未着／失敗／受信済み」）。

テーマ状態の常設が要るのは、telldes が付け替え（4.3.9）で**ファイルの状態を書き換える**ため。利用者に影響のある変更を知らせずに行わない。「起動時に dark のまま残っている」の復旧の促し（4.7.2）もここに出る。表示と切り替えを1つの `Light | Dark` にまとめるのは、分けると「今 Dark と書いてあるが切り替えはどこか」になるため。

**件数が「まだ計算していない」状態を 0 と表示しない。** 違反・知らせ・note は更新のきっかけが別々なので（下表）、同じ行に並ぶ数字のどれが今の値か分からなくなる状態を作らない。4.7.3 が note 一覧について定めた「未着／失敗／受信済み」の3状態を、違反と知らせにも同じ粒度で適用する。

| プロパティ | 作り直すきっかけ |
|---|---|
| 違反・付け忘れの知らせ | 起動時／Review の各ゲート（4.7.2 の原則3）／ページ切り替え時 |
| note | 起動時／note 保存時／ページ切り替え時（4.7.3） |
| 画面の行そのもの | 起動時／ページ切り替え時 |

**起動時にチェックを走らせる**のは、error 件数を常設すると決めた以上、起動直後に出す値が要るため。「未チェック」を常設しても、デザイナーは結局ボタンを押すことになり常設の意味が消える。

**ページを切り替えたときは、両コレクションビューを丸ごと作り直す。** 走査は `figma.currentPage` に閉じており（4.7.5）、切り替え後も前のページの一覧が残ると、それが今のページの一覧に見える。

**寸法**

360 × 640（`figma.showUI` の既定は 300×200、旧構成は 360×480）。コレクションビュー2つとシングルビューを縦に積むため高さが要る。Figma 公式がプラグインに勧める「最小幅 300px」は Dev Mode のインスペクトパネルに収める場合の助言で、フローティングウィンドウである telldes には当てはまらない。違反行（レイヤーパス＋理由）が折り返さずに読める幅を優先する。

**`figma.showUI()` に `themeColors: true` を渡し、Figma が注入する CSS 変数で UI をライト/ダークに追従させる。** ダークモード対応を作るプラグイン自身が Figma のダークテーマで白く光っている状態を作らない。Figma 公式がプラグインUIについて具体項目として挙げている数少ない推奨事項でもある。

**密度・アイコン・展開の既定（どの画面を開いた状態で出すか）は実機で使って決める。** 紙の上では決まらず、決めても実機で覆るため。

利用者から見た操作手順は README「プラグインの使い方」が正。本節以下はその裏の判断。

#### 4.7.2 チェック

本節は3つの異なる出力を定める。(1) **Review（チェック）**: 制作ルール違反を検出し、各違反に改善方法を提示する。Reviewが報告するのはエラーのみで、すべて書き出しのブロッカーである。(2) **書き出し時の除外物告知**: ツールが構造上対象外にするもの ― 違反ではなく、したがって改善方法も持たないもの ― を書き出し時に検出し、zip内 `README.md` に事実として記録する。(3) **付け忘れの知らせ**: 出力は壊れていないが、デザイナーが宣言し忘れたと機械的に分かる箇所を、そのレイヤーのプロパティとして出す（4.7.1）。(1) はデザイナーが直さなければ渡せないもの、(2) は直す義務がないもの、(3) は直すかどうかがデザイナーの判断であるもの。3つは相手も置き場所も違うので混ぜない。

**Review の走査範囲は書き出し対象の範囲**（ページ直下の `FRAME`／`SECTION` とその配下。4.7.4）とする。原則1 の判定軸は「出力が壊れるか」であり、zip に入らないものが壊れていても出力は壊れない。渡さないものを直さないと渡せない、という状態はゲートの趣旨と逆になる。範囲の判定には書き出しと**同じ判定**（②の層に1つだけ置く。4.7.6）を使う。同じ定義を2箇所に持たなければ、Review と zip の対象が黙ってズレることはない。除外物告知のうち Color Style / Variable の使用も既にこの範囲なので（後述）、両者はここで揃う。**非表示のノード（祖先が非表示のものを含む）はこの範囲から外す。** zip に出ない（4.5.2）以上、壊れていても出力は壊れない。

**チェックの原則**

チェックは体系として設計する。ダーク対応のような新しい検証が要るたびに個別に足すのではなく、次の3原則に当てて置き場所と重さを決める。

**原則1 — error はデザイナーが選んだやり方に対する整合性だけを見る。やり方自体は強制しない。** 「Variables を使え」は error にしない。判定軸は「出力が壊れるか」の一点であり、壊れるかどうかは**デザイナーが何を宣言したか**で決まる。Export 設定の「ダークモード対応」（4.7.4.2）を ON にした時点でそのファイルは「ダーク対応する」と宣言したことになり、テーマ整合チェックが有効になる。OFF のファイルでは1件も発火しない。

**判定軸は Export 設定であって、Dark コレクションの有無ではない。** Setup は3コレクションを一式生成する（4.3.4、4.3.9）ので Dark コレクションは全ファイルに存在し、有無では判定できない。有無を軸にすると、ダーク対応しないファイルでテーマ整合 error が出続ける。

| チェック | ダークモード対応 ON | OFF（ライトのみ） |
|---|---|---|
| 色が変数にバインドされていない | error（トグルで変わらない＝出力が壊れる） | 発火しない |
| Effect Style の影の色が変数を指していない | error（同上） | 発火しない |
| グラデーション stop の色が変数を指していない | error（同上） | 発火しない |
| Light / Dark のペアが崩れている | error | 発火しない |
| light 状態に Dark バインドが混入 | error | 発火しない |

影とグラデーション stop の色は、telldes が Light ⇄ Dark で差し替える対象（4.3.9）であり、バインドされていなければそこだけライトの色で取り残される。Effect Style / Color Style は複合的な見た目としての源泉のまま、内側の `color` / `radius` / `spread` / `offsetX` / `offsetY` や各 stop の色が個別に Variable を指せる（4.3.4）ので、色のバインド漏れと同じ扱いに揃える。

**ライトのみのファイルで生値のまま残っていることは、どこにも報告しない。** 生値でも `spec.json` には実値が載り CC は正しく作れるので、直す理由が無い（4.3.4「Variable化はデザイナーの判断に委ね、ツールは促さない」）。font-size や padding/gap の生値は ON のファイルでも同じで、テーマで値が変わらない以上ダーク対応していても壊れない。これらを書き出しのたびに zip の `README.md` へ並べると LP 1枚で数十〜数百行になり、ツールが本当に捨てた事実（除外物告知）がその中に埋もれる。並べること自体が「Variables を使え」と促すことにもなる。

代わりに、機械的に「付け忘れ」と言い切れるものだけを (3) で知らせる（後述）。各チェックの検出仕様と文言は実装タスクで定める。

**原則2 — Review の1行 ＝ デザイナーが下す1判断。原因単位で集約する。** 「色が変数にバインドされていない」は LP 1枚で数十〜数百箇所出る。ノード単位で並べればノイズになり、直すべきことが埋もれる。同じ `#333333` が30箇所なら1行にまとめる。デザイナーの作業は「この色を変数にして割り当てる」という1つの判断であって、30回の判断ではない。後述の除外物告知が「除外される物」単位で集約しているのと同じ考え方である。

**原則3 — チェックは行為の前に自動で走るゲート。結果は必ず画面に出す。**

| ゲート | 走らせるチェック | 失敗時 |
|---|---|---|
| 起動時 | 全部 | 結果をコレクションビューに表示（ゲートではないので何も中止しない） |
| Export の**実行**（確認ビューの実行ボタン。4.7.4.3） | 出力が壊れるもの全部（構造4種＋サイジング1種＋テーマ整合5種） | コレクションビューに結果表示、Export 中止 |
| テーマ切り替え | テーマ整合のみ | コレクションビューに結果表示、切り替え中止 |
| 手動 Review（ヘッダ。4.7.1） | 全部 | コレクションビューに結果表示 |

件数だけを返して場所を教えない形にすると、デザイナーは自分でチェックを実行し直すことになり、同じチェックが2回走る。結果にはどのゲートで止まったかが分かる見出しを付ける（「Export できません」「ダーク表示に切り替えられません」）。止まった理由が分からないと混乱するため。**結果は画面のコレクションビューにそのまま出る**（4.7.1）ので、旧構成のように別のタブへ飛ばす必要はない。

テーマ切り替えで構造チェックを走らせないのは、Auto Layout 未適用やレイヤー名の重複がダーク表示の正しさに関係しないため。切り替えは見た目を確かめるための操作なので、無関係な理由で止めない。

**「起動時に dark のまま残っている」はこの体系に含めない。** 直すべき違反ではなく、書き出しの中断で残った状態だから（4.3.9）。error ではなく「ライトに戻しますか？」という復旧の促しにする。

**Review のチェック項目**（構造4種＋サイジング1種＋テーマ整合5種。利用者に見せる文言は README「Review」）:
- Auto Layout未適用のフレーム（GROUP は対象外。4.3.2）
- Figmaデフォルト名のレイヤー
- 同一親内での重複レイヤー名
- 背景を子レイヤーとして配置
- Hug/Fill/Fixed以外の曖昧なサイジング
- 色（塗り・線）が変数にバインドされていない（ダークモード対応 ON のときのみ。以下同じ）
- Effect Style の影の色が変数を指していない
- グラデーション stop の色が変数を指していない
- Light / Dark のペアが崩れている
- light 状態に Dark バインドが混入

Reviewが報告するのはエラーのみとする。エラーは書き出し前に解消必須であり、Reviewの結果はすべて書き出しのブロッカーである。「直せるものだけを出す」ことで、デザイナーは「エラーをゼロにして書き出す」という一本の流れに集中できる。

**実行失敗の扱い:** チェックの実行自体が例外で中断した場合は、その旨をUIに通知し「実行中…」表示を解除する（書き出しの失敗通知と同じ方針）。通知しないと画面が「実行中…」のまま固まり、デザイナーには原因も次の一手も分からない。あわせて**前回の実行結果の表示を消す**。画面が示すのは常に直近1回の実行の結果であり、失敗通知の下に前回の一覧が残っていると、それが今回の検出結果だと読めてしまう。**消す対象は各行の違反・知らせの件数と、展開内の違反・知らせの行に限る**（4.7.1 の更新トリガ表）。note は別のきっかけで更新される別系統の事実なので巻き込まない — 巻き込むと、チェックが失敗しただけで note の一覧が消える。

**書き出し時の除外物告知（README出力）:** 上記(2)。ツールが対象外にするもの（＝デザイナーに直す義務はないが、黙って捨ててはいけないもの）は、Reviewではなく書き出し時に検出し、zip内 `README.md` の「Not included in this export」セクションに**実際に検出された項目のみ**を対象レイヤーパス（トークン名の衝突はトークン名、noteはレイヤーパスと本文）付きで記録する。検出ゼロの項目は行を出さない。「予測できない動き」を防ぐ基本姿勢（4.3.4）と原則B「欠けていると分かる」を、Reviewのノイズではなく書き出し結果の事実記録として担保する。

**Figma 上での出し先は 4.7.1 の表による。** トークンに属するもの（単色 Color Style 使用・対象外 Variable 使用・トークン名衝突・決められない値）はトークンのコレクションビューに、渡らないもの（裸の Component 定義・書き出し対象外レイヤーの note・非表示のレイヤー・再現できない描画）は画面コレクションビュー末尾の「渡されないもの」の行に出る。zip の `README.md` と Figma の画面は同じ事実を別の読み手に届けるもので、重複ではない（README は zip を開く CC とデザイナー、画面は今 Figma を開いているデザイナー）。
- **単色の** Color Styleを使用 → カラーはVariablesに一本化するためトークン化されない（4.3.4。グラデーション・複数fillのColor Styleは正式な源泉なので告知しない）。**Color Styleごとに1件**、使用レイヤー数と代表レイヤーパス（最大3件）を列挙する。1つのテキストノード内で複数のColor Styleが混在する場合（`fillStyleId === figma.mixed`）は単一のidに解決できないため、その旨を示す名前の1件にまとめる
- BOOLEAN Variable、または書体として扱われない STRING Variable を使用 → トークン出力対象外（判別は 4.3.4。書体は源泉なので告知しない）。**Variableごとに1件**、Variable名・使用レイヤー数・代表レイヤーパス（最大3件）を列挙する
- ページ直下に裸で置かれたComponent/Component Set定義 → 書き出し対象外（4.7.4の範囲方針）。該当レイヤーと、画面フレーム内にインスタンスとして配置するか、ライブラリページへ移す旨を記録する
- Variableのフルパスが `typography/<name>` に一致し、同名のText Styleが存在（tokens.jsonの`typography`グループで衝突し、後に書き出されるText Style側が上書きする。4.5.1） → 衝突したトークン名の組を記録する。`fills/<name>` と Color Style、`effects/<name>` と Effect Style も同じ
- 書き出し対象外のレイヤーに付いたnote → noteは `spec.json` の `note` としてしかCCに届かず（4.5.2）、`spec.json` は書き出し対象フレーム配下しか持たないため、対象外のレイヤーに付いたnoteは `spec.json` には現れない（CCがスペックとして読む場所には届かない）。一方、note の一覧はページ全体を走査するため（4.7.3）そのnoteは一覧には出る（「渡されないもの」の行に入る。4.7.1）。zip 側にも同じ事実を残すため、レイヤーパスと本文を記録する
- 非表示のレイヤー → 描かれていないので `spec.json`・スクリーンショット・アセットに出ない（4.5.2）。**最上位の非表示レイヤー（祖先はすべて表示されているもの）ごとに1件**とし、その配下は数に含めて並べない。配下まで並べると、非表示にしたグループ1つで数十行になる。非表示のページ直下フレームもここに入る（画面にならない。4.7.4）。配下に note があれば、レイヤーパスと本文も記録する（note は `spec.json` にしか届かないため、ここに書かなければ消える）。インスタンスの中のものは次の2つでまとめる（Color Style 使用をインスタンスの数だけ並べないのと同じ理由）
  - **部品の真偽値プロパティで表示を切り替えているレイヤー**（`componentPropertyReferences.visible` を持つもの）は、プロパティごとに1件とし、部品名・プロパティ名・件数・代表レイヤーパス（最大3件）を持たせる（「Card の Show badge がオフ: 12 箇所」）。表示の切り替えをプロパティで持たせるのは Figma の作法そのもので（原則A）、1つずつ並べると作法どおりに作ったファイルほど告知が長くなる
  - それ以外で、**同じ主コンポーネントのインスタンスの中の同じ位置にある**（最も近い祖先のインスタンスから、子の並びの番号をたどって同じになる）非表示のレイヤーは1件にまとめ、件数と代表レイヤーパス（最大3件）を持たせる。部品側で非表示にしてあるのか、インスタンスごとに非表示にしたのかは読み取りデータからは決められない — 主コンポーネントは別のページに置くのが定石で（4.7.4）、読む範囲の外にある。そこで「同じ部品の同じ位置で非表示」という読める事実だけでまとめる。位置を名前ではなく番号でたどるのは、同じ名前の兄弟（重複名の違反）があっても取り違えないため
- **再現できない描画** → Figma では描かれているが、CSS で同じに描く手段が無いので `spec.json` に出さなかったもの（4.5.2.1 が挙げるもの: テキストの INSIDE の線、`text-shadow` などで表せない影、CSS に同じものが無い描き方、切り抜きと重なる線、流れの中の回転や反転、ページ直下フレーム自身の線・影・角丸、飛び先が zip に無いリンクなど）。**種類ごとに1件**とし、件数と代表レイヤーパス（最大3件）を持たせる。近い形に置き換えて出すと、CC はそれが近似だと知らずに正しい値として使うので、出さずに告知し、デザインを CSS で描ける形に直すかどうかをデザイナーに委ねる
- **決められない値** → 書体名から太さが決まらない Text Style（4.5.1）と、単位が決まらない数値トークン（4.5.1）。**Text Style・Variable ごとに1件**

**除外物告知の走査範囲:** README に載る項目は、読み手がzipの中身と突き合わせられるものでなければならない。したがって走査範囲をカテゴリごとに次のとおり定める。
- Color Style使用／対象外Variable使用 → **書き出し対象のページ直下 `FRAME`／`SECTION` 配下のみ**を走査する（当該フレーム自身を含む。Review と同じ範囲・同じ判定）。ページ直下に裸で置かれた他のノードや、裸のComponent定義の内部は走査しない（前者はzipに現れず突き合わせ不能、後者は「裸のComponent」として既に1件記録済みで二重計上になるため）
- **インスタンス内部のノードも走査する**。インスタンス内部のノードは主コンポーネント由来の `fillStyleId` / `boundVariables` を保持しており、主コンポーネントを別ページ（ライブラリ）に置き画面ページにインスタンスを並べるという定石の構成（4.7.4）では、インスタンス内部を除外すると「Color Style使用ゼロ」というREADMEが出てしまう ― 実際には書き出したスクリーンショット上の全カードがColor Styleで着色されているのに、である。これは4.3.4の姿勢に反する黙殺であり、走査対象に含める
- 上記により同じ部品をN個配置すると同一内容のN行が出る問題は、**レイヤー単位ではなく「除外される物」単位でまとめる**ことで解決する。すなわちColor Style使用はColor Styleごと、対象外Variable使用はVariableごとに1件へ集約し、各件は対象レイヤー数と代表レイヤーパス（最大3件）を持つ。ノイズを抑えつつ、検出事実そのものは失われない
- ページ直下に裸で置かれたComponent/Component Set → ページ直下のノードを走査する（書き出し範囲の外にあるものを告知するための項目であるため）
- トークン名衝突 → ノードではなくVariables／Styleを対象とするため走査範囲の影響を受けない
- 書き出し対象外のレイヤーに付いたnote → **書き出し対象のページ直下 `FRAME`／`SECTION` 配下に無いノード**（ページ直下に裸で置かれたComponent／Component Set定義の内部、ページ直下の裸の他のノードとその内部）を走査する。書き出し範囲の外にあるものを告知するための項目であるため、Color Style使用等とは逆に対象フレーム配下は走査しない（そこに付いたnoteは `spec.json` に載る）。裸のComponent定義の内部まで走査するのは、Color Style使用と違い、note本文はデザイナーが書いた情報そのもので「Component X は対象外」の1件から復元できないためである。二重計上ではなく別の事実として記録する
- 非表示のレイヤー → 書き出し対象のページ直下 `FRAME`／`SECTION` 配下（インスタンスの内部を含む）を走査する。Color Style 使用・対象外 Variable 使用は非表示のノードを走査しない。非表示のレイヤーとして既に1件になっており、二重に数えないため
- 再現できない描画 → 書き出し対象の範囲の表示されているノード（インスタンスの内部を含む）。`spec.json` に出るはずだったものの告知なので、`spec.json` と同じ範囲
- 決められない値 → トークン名衝突と同じく、ノードではなく Style・Variable を対象とする。`tokens.json` に出るものの告知なので、`tokens.json` と同じ範囲
- 同一カテゴリ内で内容が完全に一致する項目は1行にまとめる。レイヤーパスの**先頭セグメントは、4.5.2「フォルダ名（ページ直下のセグメント）の規約」をページ直下の全ノードに一度に適用した結果の文字列**とする。書き出し対象フレーム配下のレイヤーであれば、それはそのフレームのzipフォルダ名そのものになる。裸のComponent等の非フレームも同じ規約・同じ「使用済み名の集合」で命名されるため、フォルダ名と別ノードの表記が衝突することはない（フォルダ名とREADMEのパス先頭セグメントは同一の走査で一度だけ決定し、zipとREADMEの双方へ同じ値を渡す。等価な走査を別の場所でもう一度行わないことで、両者が食い違うことをあり得なくする）。先頭セグメント以外は4.5.2の `path` と同じく同名の兄弟を `-N` で区別する。画面フレーム名を含む点がspec.jsonの`path`と異なるのは、READMEがデザイナーにzip内のフォルダとFigmaのレイヤーツリーの両方を辿らせるための表記であるため

**付け忘れの知らせ:** 上記(3)。出力は壊れていないが、デザイナーが宣言し忘れたと機械的に判定できる箇所だけを並べる。2種類ある。

- **既にあるトークンと同じ値なのに、そのトークンを指していない箇所**。値の照合は機械的にできるので、明らかな付け忘れだけに絞られ、ノイズが桁違いに減る
- **丸い形（角丸が短辺の半分に達している）なのに `radius/full` を指していない箇所**（4.3.6）

どちらも **error にしない**。直さなくても `spec.json` には実値が載り CC は正しく作れるので、Export もブロックしない。**telldes が自動で置き換えることもしない** — 値が一致しても、デザイナーがそのトークンを意図したとは限らないからで、4.3.4 の「値をどのスロットに割り当てるかを自動判定しない」をここでも守る。

**置き場所が zip の `README.md` ではなく Figma 上の画面なのは、4.7.4.1 の切り分けによる。** 付け忘れを直すのはデザインの判断であり、デザイナーが Figma を開いている今しか答えられない。zip を開くのは CC で、そこに書いてもデザイナーには届かない。

#### 4.7.3 note入力UI

note は `setPluginData('note', value)` に持つ（Free 版にアノテーションが無いため。4.10）。note があるノードに `setRelaunchData` で編集ボタンを出すのは、プラグインを開かなくても note の存在に気づけるようにするため。

**note一覧を置く理由:** 入力欄はノードを1つ選択して初めて1件のnoteを見せるため、それだけでは「このページのどこに何を書いたか」を確かめる手段がレイヤーを1つずつ選び直すことしかない。そこで、現在のページでnoteが設定済みの全レイヤーを一覧に出す。

**一覧の置き場所は 4.7.1 の画面コレクションビューであり、note 専用の一覧は作らない。** 各画面の行を展開したところに、そのレイヤーの違反と並んで note が出る。入力欄はレイヤーのシングルビューにある。本節が定めるのは走査範囲・更新のきっかけ・行クリック時の挙動といった、置き場所に依らない規定である。

- **各項目にレイヤーパスと本文の両方を出す**: レイヤーパスだけではnoteの中身が分からず、note本文だけではどのレイヤーの話か分からない
- **パスは Figma 上の生のレイヤー名をそのまま並べる**（4.5.2のフォルダ名正規化も `-N` 付与も行わない）: 一覧はzipと突き合わせるための表記ではなく、Figmaのレイヤーツリーを辿るための表記であるため
- **走査範囲はページ全体。ただし画面ごとにグループ化し、どの画面にも属さないものと非表示のレイヤーに付いたものは「渡されないもの」の行に入れる**（4.7.1）: noteはどのレイヤーにも付けられるため、書き出し対象外のノード（ページ直下に裸で置かれたComponent定義の内部など）に付いたnoteも一覧に出す。出さなければ、書いたはずのnoteが見当たらないという状態になる。一方で一覧に出ることは書き出されることを意味しない ― 書き出し対象外のレイヤーに付いたnoteは `spec.json` に載らない。**グループ分けがこの両方を同時に満たす**: 全部見えるが、どれが渡ってどれが渡らないかも同じ一覧の上で分かる（原則B「欠けていると分かる」）。旧構成で一覧を2つ持っていた理由（書いた全部 / 渡る分）はこれで消える。並び順は画面内ではレイヤーツリーの走査順（トークンに属する行は原因単位で集約されレイヤーツリー上の位置を持たないため、別のコレクションビューに出る。4.7.1）
- **一覧はプラグイン起動時・note 保存時（空文字保存＝削除を含む）・ページ切り替え時の3時点で作り直すスナップショットで、それ以外の変更は追わない**: 一覧が「現在のページ」のものだと言えるのは、ページが変わるたびに作り直すからである。Figmaはプラグインを開いたままページを切り替えられるため、起動時と保存時だけでは切り替え後も前のページの一覧が残る。一方、レイヤーの削除・undo・別セッションからの変更は追わない（`documentchange` は購読しない）。文書全体の変更通知は重く（dynamic-page 設定下では全ページのロードが前提になるほど）、しかも変更は周期的にまとめて届くため、購読しても一覧が常に最新だとは言えない。古くなった行は嘘のまま固定されない ― 対象が消えた行はクリック時の検出（次の箇条）で回収でき、undoでnoteだけが消えたレイヤーの行はクリックすれば入力欄が空の保存済みnoteを映す。この程度の古さは許容する。選択の変更でも更新しない（一覧は選択に依存しない）ので、行クリックで選択が成立しても一覧は作り直さない
- **行が指すレイヤーが現在のページに無いときは、その旨をUIに通知し、一覧を作り直す**: 行の対象は削除されうるし、一覧は前の箇条の範囲で古くなりうる。黙って無反応にすると、利用者にはクリックが効いていないのか対象が消えたのか分からない（4.3.4の基本姿勢）。通知と同時に作り直すのは、同じ行をもう一度クリックしても同じ結果になる状態を残さないため
- **一覧の走査が失敗したときは、その旨をUIに通知し、前回の一覧を消す**: 一覧が示すのは常に直近1回の走査結果である。特にページ切り替え直後の失敗で前ページの一覧が残ると、それが今ページの一覧に見える（Reviewの実行失敗で前回結果を消すのと同じ理由。4.7.2）
- **一覧のUI状態は「未着」「失敗」「受信済み」の3つで、0件のメッセージは受信済みでのみ出す**: 未着は起動直後で最初の走査結果がまだ届いていない状態、失敗は直近の走査が失敗した状態、受信済みは直近の走査結果（0件を含む）を持つ状態。未着や失敗を0件と同じ見た目にすると、走査失敗や到着前の空白が「このページにnoteは無い」という嘘の空状態として見える（4.3.4）
- **ノード未選択でも一覧は表示する**: 一覧の目的が「選択せずに全体を見る」ことだから（未選択時のシングルビューの扱いは 4.7.1）
- **行クリックは選択変更として扱い、選択が変われば未保存の入力は捨てられる。確認は挟まない**: 入力欄は常に選択中ノードの保存済みnoteを映す単一の源泉であり、保存ボタンが明示的なコミットである。行クリックはキャンバス上での選択操作と同義で、入力が捨てられるかどうかは選択が変わったかで決まり、行クリック自体では決まらない。編集中の入力欄のすぐ下に1クリックで捨てるコントロールが置かれる形にはなるが、確認ダイアログを挟むと一覧の「1クリックで辿る」用途が壊れるため、挙動は選択変更と揃える

#### 4.7.4 書き出し

**チェックのゲートは確認ビューの「実行」に掛ける**（4.7.2 の原則3）。エラーが1件でもあれば中止して結果をコレクションビューに出す（4.7.1）。Export ボタン（確認ビューへの入口）には掛けない — 設定4群の入力欄は確認ビューにしかなく、入口に掛けるとエラーがある間は設定を開けなくなる。とりわけテーマ整合チェックの発火可否は「ダークモード対応」設定が決めるため（4.7.2）、ダーク整合の error が出ているのに設定を OFF にしに行けない、というデッドロックが起きる。エラーだけを理由に止めてよいのは、Review の結果が出力の正確さを損なうものだけに絞ってあるから（4.7.2）。

**書き出し範囲の方針**: 出力単位は「画面フレーム」とする。具体的にはページ直下の `FRAME` および `SECTION` を対象とし、各フレームを1ページ/ビューポートとして書き出す。再利用部品は、画面フレーム内に配置された**インスタンスを展開してspec/スクリーンショットに含める**（コード化の単一の真実はレンダリング結果）。ページ直下に裸で置かれたComponent/Component Set定義そのものは書き出し対象外で、書き出し時に `README.md` の除外物セクションへ記録する（4.7.2）。非表示のページ直下フレームも画面にしない（描かれていないものは渡さない。4.5.2）。非表示のレイヤーとして告知し（4.7.2）、レスポンシブ設定などが指していれば、指す先が無いものとして扱う（4.7.4.3）。

**画面でないものは、画面を置くページとは別の Figma ページに置いてもらう。** 対象は3つ — 部品置き場（コンポーネント定義と、それをまとめたフレーム）、favicon 用フレーム、OG 画像用フレーム。telldes は現在のページだけを見るので、ルールを守れば自然に対象から外れる。ノードの種類では見分けられない（部品をまとめたフレームも favicon 用フレームも `FRAME` であり、画面と区別がつかない）が、見分けるために telldes 固有の印や除外リストを足すことはしない。Figma 公式のベストプラクティスがそもそも `file > page > frame` を入れ物にしたコンポーネント整理を勧めており（その階層がそのまま Assets パネルの並びになる）、デザイナーにとって新しい作法ではないため（原則A）。ページを分ける運用が Free で成立する条件は 4.10。

zip の構成は 4.5。

`README.md` の「Contents」節の各フレーム行は、**zip内のフォルダ名（4.5.2の正規化後）とFigma上の生のフレーム名の両方**を示す。正規化や `-N` 付与によって両者は食い違いうるため、フォルダ名だけではデザイナーはFigma上の当該フレームに辿り着けず（`Desktop - Home` という名のフレームはページ上に存在しない）、生名だけではzip内のどのフォルダを指すのか分からない。

`README.md` の「Contents」節は、**実際にzipへ書き込まれたものだけ**を列挙する。たとえば子を持たないフレームのフォルダには `spec.json` しか入らないため、その行でスクリーンショットやアセットに言及してはならない。READMEはzipと突き合わせるための文書であり（4.7.2）、存在しないものを約束する行は突き合わせを壊す。

zip生成にはJSZipライブラリを使用。プラグインUI内でBlobを生成しダウンロードリンクを表示する。

##### 4.7.4.1 Export は実装への依頼書

**Export の内容は実装への依頼内容である。** この見方で zip の中身が1つの棚に並ぶ。

| 依頼書の要素 | 中身 |
|---|---|
| 何を作るか | `spec.json` / `screenshots/` / `assets/`（描いたもの） |
| 語彙 | `tokens.json` |
| どう作るか・全体 | Export 設定＋共通ルール（4.7.4.2） |
| どう作るか・個別 | note（4.3.7） |
| 手順 | `prompt.md` / `steering.md`（4.8） |

**デザインの判断は telldes が Figma 上で受ける。実装の判断は zip 同梱の `steering.md` で CC が受ける。** 切り分けの基準は「誰が答えられるか」。zip を渡された人がデザイナーとは限らず、デザイナーは Figma を開いている今が一番答えやすい。コピーや OGP のような中身も、ページの外での見せ方に関わるのでデザイナー側に置く。

telldes は LLM を持たないので質問を動的に作れない。したがって**デザインするなら決めないといけないことを事前に洗い出し、固定の設定項目として用意する**。

##### 4.7.4.2 Export 設定（4群）

| 群 | 入力欄の形 |
|---|---|
| レスポンシブ | 複数行。各行が 適用開始幅 / 使うフレーム / コンテンツ幅（固定px または %） |
| ダークモード対応 | ON / OFF |
| サイト情報 | タイトル・説明文・言語・OGタイトル・OG説明はテキスト。favicon と OG画像はフレームを選ぶ。テーマカラーは Variables から選ぶ |
| 共通ルール | 複数行・自由記述 |

- OGタイトル・OG説明が空なら、タイトル・説明文を流用する。同じ文言を2度書かせないため。
- favicon / OG 画像のフレームは画面と別のページに置かれる（4.7.4）が、ピッカーには出せる。`manifest.json` に `documentAccess: "dynamic-page"` を置いていないため全ページに同期アクセスでき、フレームを列挙するのに `loadAllPagesAsync` は要らない。
- レスポンシブ設定が何を解くかは 4.9。favicon / OG画像の書き出しは 4.5.3。
- 設定値が `settings.json` にどう載るかは 4.5.4、CC がどう読むかは 4.8.1。

**専用欄にするか共通ルールに書かせるかの線引き**: CC が**値としてそのまま使う**ものだけを専用欄にする（メディアクエリの数値、分岐の ON/OFF、`<html lang>`、`<meta>` の中身）。自由記述では書き方がぶれて機械的に読めない。それ以外は共通ルールに文章で書く。この線引きがあれば、項目が増えたときの振り分けに迷わない。

**共通ルール（全体）と note（個別）が対になる。** モーションの既定値・reduced-motion の扱い・状態の方針などは、専用欄を増やさずすべて共通ルールが受ける。自由記述を CC の解釈に委ねるのは、note について 4.3.7 が既に取っている立場（構造化するとデザイナーが書けることを狭める）と同じ。

##### 4.7.4.3 設定の保存先と Export 確認ビュー

設定値は `figma.root.setPluginData` にファイル単位で保存し、次回以降の既定値として出す。Export のたびに入力させない。ノードではなくドキュメントに持つのは、設定がファイル全体（サイト1つ）に対するもので、どのノードにも属さないため。

**Export ボタンを押すと確認ビューに入る。** 並びは上から **設定 → 共通ルール → 付け忘れの件数 → 実行 →（実行後）zip のダウンロードリンク**。4.7.4.1 の依頼書の並び（全体 → 個別 → 手渡し）をそのまま画面にする。**知らせは Export をブロックしない** — error ではないので、押せば書き出される。

**このビューが持つのは「件数と、そこへ戻る導線」だけで、明細は持たない。** 渡すものの明細も付け忘れの明細も、それぞれ画面コレクションビューとトークンコレクションビュー（4.7.1）が既に持っている。ここで繰り返すと同じ事実が2箇所に出る（原則B「1箇所にだけある」）うえ、旧構成の4症状のひとつ「知らせは Export に出るが直す作業は別の場所」を名前を変えて作り直すことになる。実行直前に件数だけ出すのは、「直してから渡すか、このまま渡すか」をその場で決められるようにするため。

**zip のダウンロードリンクはこのビューに残す。** Export 完了そのものは一度きりの出来事だが（4.7.1）、リンクは消えると zip を取り出せないので、持続する状態として領域を持つ。

アクション実行のモードに入ることは OOUI と矛盾しない。Export は一本道で、途中で対象が変わることがないため。

**テーマの現在状態も同じ `figma.root.setPluginData` に持つ**（4.3.9）。ファイル単位であり、どのノードにも属さない点が Export 設定と同じだから。

**レスポンシブ設定・favicon / OG 画像が指すフレームは node id で保存する。** 名前で保存するとリネームで参照が黙って切れる。`settings.json` へ書き出すときに 4.5.2 の命名規約を通してフォルダ名へ解決する（選んだ時点の名前と、`-N` 付与後のフォルダ名は一致しないことがあるため）。参照先のフレームが消えていた場合は、その行を設定に残したまま確認ビューで知らせる — 黙って落とすと、指定したはずの favicon が出ない理由が分からなくなる（原則B「欠けていると分かる」）。

##### 4.7.4.4 ダーク対応ファイルの書き出し手順

Export の実行（確認ビューの「実行」）は、ダークモード対応の ON / OFF に関わらず次の順で進める（付け替えの仕組みは 4.3.9、層の分担は 4.7.6）。

1. **light にする** — dark 表示なら、②が読み取りデータから light への付け替えの計画を作り、①が書き込む
2. **読む** — light の状態で、読み取りデータを読み直す
3. **チェックする** — error があれば中止する（4.7.2 の原則3）
4. **作る** — 2 の読み取りデータから、zip に入るファイルの中身・撮る画像の一覧と、dark への付け替えの計画・light に戻す計画を作る
5. **light 撮影**
6. **dark 撮影**（ON のときだけ） — Dark へ付け替え → dark 撮影 → light に戻す

**読むのは light にしてから。** 読み取りデータは読んだ時点のバインドと値を写すので、dark のまま読むと `spec.json` と `tokens.json` に Dark の変数と値が入り、「light 状態に Dark バインドが混入」のチェックも誤って発火する。light に戻す計画を 2 の読み取りデータから作るのは、読んだとおりの状態に正確に戻すため。

ダークモード対応が ON のファイルでは、スクリーンショットを light と dark の2組書き出す。dark 側は `screenshots-dark/` に、light 側と同じファイル名で並べる（4.5）。同じ名前にしておくと、`spec.json` の `screenshot` から dark 側のパスが先頭フォルダの差し替えだけで導ける。

**先頭の「light にする」は、押した時点が dark 表示だった場合に備える。** 無ければ読み取りも light 組の撮影も dark のまま行われる。既に light なら何も起きない。Export はどうせ手順の中でライト⇄ダークを行き来するので、先頭で戻すのは同じ動作の延長であり、デザイナーに手間を課す理由がない。error にしてゲートで止めないのは、直すべき違反ではなく単なる状態だから — 「起動時に dark のまま残っている」を error にしなかったのと同じ理由（4.7.2）。書き出し後も light のまま残し、押す前のダーク表示には戻さない。手順の終わりが必ず light であることは、下の失敗時の扱いと揃う。

**アセットもダーク用を書き出す。** SVG アイコンは色が焼き込まれるため、ライト1組だけでは黒背景に黒アイコンが載る。色を抜いて CSS に塗らせる案は telldes がデザイナーの描いた色を捨てる変換であり（4.3.4 の基本姿勢に反する）、多色ロゴには使えない。出力先は `screenshots-dark/` と揃えて `assets-dark/`（`images/` `icons/` の内訳は `assets/` と同じ。4.5）。ただし **light と dark で見た目が実際に変わるアセットだけ2枚目を出す**。全アセットを機械的に倍にすると、色を持たない線画まで同一ファイルが2つ並び、CC が「別物が2つある」と誤読する余地を作る。**見た目が変わるかは②が読み取りデータから決める** — アセットに描かれる色（ノードを丸ごと書き出したものはその配下すべての塗り・線・影、塗りや線だけの画像はその塗り・線。Style を当てていれば Style の中身）のうち、Dark の対と値が違う Light の変数を指すものが1つでもあるか。撮った画像を比べる方式にしないのは、比べる処理が①に入って①が厚くなり、テストで確かめられなくなるため。塗りの元の画像（`IMAGE`）はテーマで変わらないので、2枚目を出さない。

**撮影や付け替えが途中で失敗しても、必ず light に戻す。** 戻さないとファイルが dark のまま残り、デザイナーは自分が触っていない変更を見ることになる。それでも中断で残る場合（プラグインの強制終了など）に備えて、起動時の復旧の促しを置く（4.7.2）。

#### 4.7.5 プラグインAPI使用箇所

| 機能 | API |
|---|---|
| UI の表示 | `figma.showUI(__html__, { width: 360, height: 640, themeColors: true })`（4.7.1） |
| ノード走査 | `figma.currentPage`, `node.children` 再帰 |
| Auto Layoutプロパティ取得 | `node.layoutMode`, `node.itemSpacing`, `node.paddingTop` 等 |
| note読み書き | `node.setPluginData('note', value)`, `node.getPluginData('note')` |
| 再起動ボタン | `node.setRelaunchData({ editNote: '' })` |
| シングルビューの選択追従 | `figma.on('selectionchange')`（4.7.1） |
| コレクションビューの再構築 | `figma.on('currentpagechange')`（ページ切り替え時。4.7.1・4.7.3） |
| Variable取得 | `node.boundVariables`, `figma.variables.getLocalVariables()` |
| トークン一式の生成（Setup） | `figma.variables.createVariableCollection()`, `variable.setValueForMode()`, `variable.scopes`（4.3.4 の表。Dark は `[]`。4.3.9）, `variable.setVariableCodeSyntax('WEB', …)`（4.3.4） |
| テーマの付け替え | `node.fills = …` / `node.strokes = …` / `node.effects = …`、テキストの区間は `node.setRangeFills(start, end, paints)`、スタイルは `paintStyle.paints = …` / `effectStyle.effects = …`（どれも②が作った配列をそのまま代入する。4.3.9）。Paint・Effect 以外の欄（角丸・余白など）は `node.setBoundVariable(field, variable)` |
| インスタンスの主コンポーネント | `instance.getMainComponentAsync()`（読み取りデータの `mainComponentId` / `mainComponentName` を作る。4.7.2） |
| 描画範囲 | `node.absoluteBoundingBox`, `node.absoluteRenderBounds`（はみ出す子の判定と `assetOverflow`。4.5.2.1） |
| 塗りの元の画像 | `figma.getImageByHash(hash).getBytesAsync()`（4.5.2.1「アセット」）、画素数は `getSizeAsync()`（`TILE` の大きさ。4.5.2.1） |
| 塗り・線だけの画像 | `figma.createRectangle()` に塗り1枚か線だけを持たせて `exportAsync` し、`remove()` する（4.5.2.1） |
| 付け替え対象のスタイル列挙 | `figma.getLocalPaintStylesAsync()`, `figma.getLocalEffectStylesAsync()`（4.3.9 の対象(2)） |
| Export設定・テーマ状態の保存 | `figma.root.setPluginData()` / `getPluginData()`（4.7.4.3） |
| スクリーンショット | `node.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: 2 } })` |
| favicon / OG画像 | `node.exportAsync` に実寸指定（`constraint: { type: 'WIDTH', value: 180 \| 1200 }`）。4.5.3 |
| ベクターアセット | `node.exportAsync({ format: 'SVG' })`（`SVG_STRING` は不可 — 文字列をバイト列に戻す `TextEncoder` がプラグインサンドボックスに無い） |

#### 4.7.6 作りの境目（3層）

プラグインのコードは3つの層に分ける。

| 層 | 受け持つこと | Figma に触るか |
|---|---|---|
| ① 読む層 | Figma から読んで、下の「読み取りデータ」にまとめる。②が作った計画どおりに Figma へ書き込み・書き出しを行う（付け替え、Setup の生成、画像の書き出し、note・Export 設定・テーマ状態の保存、選択の変更）。計画の値を判断せずにそのまま書き込む | 触る |
| ② 作る層 | 読み取りデータだけから、zip に入るファイルの中身（spec.json・tokens.json・settings.json・README.md・prompt.md・steering.md）、撮る画像の一覧（どのノードを zip のどのパスへ）、チェック結果（error・付け忘れの知らせ・除外物。行は原因単位で、選択に使うノード id を持つ）、付け替えの計画、`assets-dark/` に出すものの判定（4.7.4.4）、塗り・線だけの画像に持たせる塗り・線（4.5.2.1）、Setup の計画、画面に出す行を作る | 触らない |
| ③ UI | ②の結果を画面に出し、操作を①に渡す。zip を組み立てる（4.7.4） | 触らない |

計画は、①が判断せずに代入できるところまで②が作り切る。

- **付け替えの計画**は、ノード・スタイルごと、欄ごと（テキストは区間ごと）に、代入する値そのものを持つ。塗り・線・影は、stop の `boundVariables` まで含めて作り直した Paint・Effect の配列を丸ごと持ち、Paint・Effect 以外の欄はバインドする変数の id を持つ。Style を当てている箇所は含めず、Style の側の配列を持つ（4.3.9）。「この変数を対の変数へ」という指示だけを渡すと、配列の作り直し — 付け替えの計算そのもの — が①に入り、テストで確かめられなくなる
- **Setup の計画**は、あるべき Variable・コレクション・Style（4.3.4 の一式と `scopes`・`codeSyntax.WEB`・Style の中の変数のつながり）と、読み取りデータにある今のものとの差 — 作るもの・設定し直すもの — を持つ。2回目で増えないことはこの差が空になることで決まるので、②に置けばテストで確かめられる

**設計書の約束（出力の形・チェックの規則・付け替えの計算）は、すべて②に置く。** ②は Figma に触らないので、見本から取った読み取りデータを与えれば Figma なしで確かめられる（4.7.7）。Figma に触る部分はテストで確かめられず実機でしか確かめられないので、①に閉じ込めて薄くする。薄いほど、実機で確かめる量が減る。

**出力とチェックは同じ読み取りデータから作る。** 書き出し範囲の判定と 4.5.2 の命名を②に1つだけ置けば、Review と zip の対象（4.7.2）、zip のフォルダ名と README のパスの先頭（4.5.2）がずれることはない。Export の実行では、light にしてから読んだ読み取りデータでチェックし、同じ読み取りデータからそのまま出力を作る（手順は 4.7.4.4）。チェックしたものと書き出したものが別の読み取りにならないようにするため。

**読み取りデータ（①が②に渡すもの）**

形の決め方は3つ。

- **Figma の値をそのまま写す。** 色の #RRGGBB 化、太さの数値化、`path` と `-N`、section / block / element の判定のような変換は設計書の約束でありテストの対象なので、①ではなく②で行う
- **JSON にできる形にする。** 見本としてリポジトリに置き、テストの入力にするため（4.7.7）。Figma のオブジェクトへの参照は持たず、変数・スタイルは id で指す。`figma.mixed` は JSON にできないので、テキストは区間ごとの値で持つ。ノードの欄（`strokeWeight`・`cornerRadius` など）が `figma.mixed` のときは文字列 `"mixed"` にし、辺ごと・角ごとの欄（`strokeTopWeight`・`topLeftRadius` など）を常に読んでおく。欄が無いことと混在していることを区別するため
- **読む範囲は「現在のページ全体」と「ファイルのローカルな Variables / Style」。** 書き出し対象外のノードも読む — 裸の Component と書き出し対象外の note は範囲の外にあるものを告知する項目で（4.7.2）、note 一覧はページ全体を出す（4.7.3）。インスタンスの内部も読む（4.7.2 の走査範囲）

画像のバイト列は含めない。画像は Figma でしか作れないので、②が「何をどの名前で撮るか」を決め、①が撮る。例外は塗りの元の画像の先頭の数バイトで、ファイルの形式（拡張子）を②が決めるために持つ（4.5.2.1「アセット」）。

最上位:

| 項目 | 中身 | 使う先 |
|---|---|---|
| `pageName` | 現在のページ名 | spec.json の `page` |
| `nodes` | ページ直下のノード列（木。下表） | 出力・チェック・付け替えのすべて |
| `variables` | ローカルな Variable 全件（下表） | tokens.json、`*Token`、対象外 Variable の告知、テーマ整合、付け忘れ、付け替え |
| `collections` | コレクション全件（id・名前・モード） | Light / Dark / Base の判別と対の照合（4.3.9） |
| `textStyles` / `paintStyles` / `effectStyles` | ローカルな Style 全件（下表） | 下表 |
| `settings` | 保存されている Export 設定（4.7.4.3）。フレームは node id のまま | settings.json、テーマ整合の有効・無効（4.7.2）、tokens.json の light/dark（4.5.1）、画面ビューの確認 |
| `theme` | `light` / `dark`（4.7.4.3 の状態） | light に Dark 混入、起動時の復旧の促し（4.7.2）、付け替えの向き |
| `images` | 書き出し範囲の表示されている `IMAGE` の塗りが指す画像ごとに、`imageHash`・先頭の12バイト・画素数（幅・高さ） | 塗りの元の画像のファイル名と拡張子、`TILE` の `backgroundSize`（4.5.2.1） |
| `otherFrames` | 設定が指す node id のうち現在のページに無いもの（favicon / OG 画像。4.7.4）の名前。見つからなければ無いことを示す値 | 参照切れの知らせ（4.7.4.3）、settings.json の `site`（4.5.4） |

ノード（`nodes` の各要素と `children`）:

| 項目 | 使う先 |
|---|---|
| `id` | 行クリックでの選択（4.7.1）、撮る画像と付け替えの対象の指定 |
| `name`, `type`, `children` | `path`・フォルダ名（4.5.2）、section / block / element、書き出し範囲（ページ直下の `FRAME` / `SECTION`）、構造チェック4種、裸の Component（4.7.2）、アセットの判別（4.3.8） |
| `visible` | 非表示のノードを出力・撮影・アセット・チェックから外す（4.5.2）、非表示のレイヤーの告知（4.7.2） |
| `mainComponentId`, `mainComponentName`（インスタンスのみ） | 非表示のレイヤーの告知で、同じ部品の同じ位置のもの・同じプロパティのものを1件にまとめ、部品名を出す（4.7.2）。Figma のノードにこの名前の欄は無く、①が `getMainComponentAsync()` の結果の id と名前（バリアントなら Component Set の名前）から作る |
| `componentPropertyReferences`（`visible` のみ） | 真偽値プロパティで隠したレイヤーをプロパティごとにまとめる（4.7.2） |
| `width`, `height`, `x`, `y`, `layoutPositioning` | `viewport.width`、`FIXED` の `widthPx` / `heightPx`（4.5.2.1）、丸い形の判定（4.7.2）、背景を子に置いたものの検出（検出の仕様は実装で決める。4.7.2）、グラデーションの計算、`position`（4.5.2.1） |
| `relativeTransform`, `rotation`, `constraints` | `position` の基準と `rotate`、回転だけの変換かどうか（4.5.2.1） |
| `absoluteBoundingBox`, `absoluteRenderBounds` | はみ出す子があるか（`clipsContent`）、`assetOverflow`（4.5.2.1） |
| `clipsContent` | `clipsContent`、切り抜きと重なる線（4.5.2.1） |
| `blendMode` | ノードの `blendMode`（4.5.2.1） |
| `layoutMode`, `layoutWrap`, `primaryAxisAlignItems`, `counterAxisAlignItems`, `counterAxisAlignContent`, `paddingTop` / `Right` / `Bottom` / `Left`, `itemSpacing`, `counterAxisSpacing` | spec.json の `layout`（4.5.2、4.5.2.1、4.6）、Auto Layout 未適用 |
| `layoutSizingHorizontal` / `Vertical`, `minWidth` / `maxWidth` / `minHeight` / `maxHeight` | `layout.sizing`（4.5.2.1）、サイジングチェック |
| `fills`（Paint のまま。`visible`・`opacity`・`blendMode`・`imageHash`・`gradientTransform`・`gradientStops` を含む）, `fillStyleId` | `fills` / `background` / `text.fill` / `text.fills`・`fillsToken`・アセット（4.5.2.1）、画像を含むか（4.3.8）、単色 Color Style の告知、色・グラデーション stop の未バインド、付け忘れ、付け替え |
| `strokes`, `strokeStyleId`, `strokeWeight`, `strokeTopWeight` / `Right` / `Bottom` / `Left`, `strokeAlign`, `dashPattern`, `strokesIncludedInLayout` | spec.json の `strokes` 一式・`strokesToken`・`text.stroke`・線の SVG（4.5.2.1）、色（線）の未バインド（4.7.2）、単色 Color Style の告知、再現できない描画、付け替え |
| `effects`（`visible`・`blendMode`・`showShadowBehindNode` を含む）, `effectStyleId` | `effects`・`effectsToken`・`shadowProperty`（4.5.2.1）、影の色の未バインド、再現できない描画、付け替え |
| `opacity` | ノードの `opacity` |
| `cornerRadius`, `topLeftRadius` / `topRightRadius` / `bottomRightRadius` / `bottomLeftRadius` | `cornerRadius`（4.5.2.1）、丸い形の判定 |
| `boundVariables`（塗り・線・影・グラデーション stop の中のものを含む） | `*Token`、色の未バインド、light に Dark 混入、対象外 Variable の告知、付け忘れ、付け替え |
| `text`: `textAlignHorizontal` と、区間ごとの `characters`・`fontSize`・`fontName`・`fontWeight`・`lineHeight`・`letterSpacing`・`textCase`・`textDecoration`・`fills`・`fillStyleId`・`textStyleId`・`hyperlink`・`boundVariables` | spec.json の `text`（最も多くの文字を占める設定）と `text.runs`・`typographyToken`・`link`（4.5.2.1）、全区間の色の未バインド・付け替え、テキスト内の Color Style 混在（4.7.2） |
| `note` | spec.json の `note`、note 一覧（4.7.3）、書き出し対象外の note・非表示のレイヤーの note の告知 |

Variable・コレクション・Style:

| 項目 | 使う先 |
|---|---|
| Variable: `id`, `name`, `collectionId`, `resolvedType`, `scopes`, モードごとの値（エイリアスは参照先の id のまま）, `codeSyntax.WEB` | トークン名と `$type`・値（エイリアスは②で解決。4.5.1）、書体かどうか（4.3.4）、CSS 変数名（4.5.1）、対の照合、付け忘れの値の照合、`themeColorToken`（4.5.4） |
| コレクション: `id`, `name`, モード（id・名前）, 既定のモード | Light / Dark / Base の判別、どのモードの値を出すか |
| Text Style: `id`, `name`, `fontName`, `fontSize`, `lineHeight`, `letterSpacing`, `boundVariables` | `typography` トークンと CSS 変数名（4.5.1。太さと斜体は `fontName.style` から）、`typographyToken`、`typography/<name>` との衝突の告知、決められない値（4.7.2） |
| Paint Style: `id`, `name`, 塗り（Paint のまま。`visible`・不透明度・`boundVariables` を含む） | `fills` トークンと CSS 変数名（4.5.1）、`fillsToken` / `strokesToken`（4.5.2.1）、単色 Color Style の告知、stop の未バインド、`fills/<name>` との衝突の告知、付け替えの対象 (2)（4.3.9） |
| Effect Style: `id`, `name`, 影（Effect のまま。`visible`・`boundVariables` を含む） | `effects` トークンと CSS 変数名（4.5.1）、`effectsToken`（4.5.2.1）、影の色の未バインド（4.7.2）、`effects/<name>` との衝突の告知、付け替えの対象 (2)（4.3.9） |

#### 4.7.7 テスト

**テストは設計書の約束が守られていることだけを確かめる。** 約束とは出力の形（4.5、4.8）・チェックの規則（4.7.2）・付け替えの計算（4.3.9）である。コードの作りを確かめるテストは、作りを変えるたびに書き直しが要るうえ、CC に渡るものが正しいかについては何も言わない。

**②の層に見本の読み取りデータを与え、結果を正解と丸ごと比べる。** 比べる結果は、zip に入るファイルの中身・撮る画像の一覧・チェック結果・付け替えの計画（4.7.6）。一部の項目だけを見るテストは、見ていない項目が崩れても通る。出力の正確さが最優先なので、丸ごと比べる。

**入力は実物の見本ファイルから取る。** 手で作った入力は、Figma が実際に返す形（区間ごとに違う文字の設定、エイリアスの変数、インスタンスの内部など）と食い違いうる。食い違うところこそ出力が壊れるところで、手で作った入力ではそこを確かめられない。

- ①に「読み取りデータを JSON として保存する」機能を置く（開発用）
- 見本ファイルを2つ作る
  - **見本1（Setup あり）**: Setup を実行した新規ファイルに、ダーク対応の LP 1本・note・わざと入れた違反・除外物・付け忘れ・再現できない描画。1つのファイルで出力・チェック・付け替えのすべてに入力を与えるため
  - **見本2（Setup なし）**: Setup を使わず、デザイナーが自由に名付けたコレクションと Style だけのファイル、および Variable を1つも持たないファイル。Figma の普段の作法（原則A）で作ったファイルが telldes の主な入力であり、Setup の名前や `scopes`・`codeSyntax.WEB` に頼った処理は見本1だけでは見逃されるため
- 見本ファイルを読んで保存した JSON を、リポジトリにテストの入力として置く。わざと入れたものの一覧も一緒に置く。正解を作るときに突き合わせる先であり、チェックが見逃しなく拾ったかはこの一覧でしか判定できないから
- **見本の JSON から `settings` と `theme` だけを差し替えた入力も使う**（ダークモード対応 OFF、`theme: dark` で開いた状態、設定が空）。この2つは Figma の中身ではなく状態・設定で、Figma の返す形と食い違う心配が無い。差し替えのために見本ファイルを増やすと、同じ中身の JSON が並んで古さを揃える手間だけが増える。差し替えた箇所は入力の横に書いておく
- **わざと入れたものの一覧は、設計書の約束ごとに、それを確かめる見本の要素を対応させた表にする。** 行は、4.5 の各フィールド（線・影・グラデーションの各場合、`clipsContent`、アセットを含む）、4.7.2 のチェック・除外物・付け忘れの各項目、CSS 変数名を作る手順の各段（4.5.1）、`cssValue` の単位の各場合、付け替えの計画（Style を当てた箇所・テキストの区間を含む）。どの約束がどの見本のどのレイヤーで確かめられているか、また確かめられていない約束が残っていないかを、この表で判定する

**正解は②の出力を写して作らない。** 写せば、今の出力を正解と呼ぶだけになる。正解は設計書と突き合わせて作り、わざと入れたものの一覧と照らして置く。

正解を変えるのは次の2つのときだけ。どちらも正解を丸ごと上書きしない。

- **設計書の約束を変えたとき**: 先に正解を直し、テストが落ちることを確かめてから実装を直す（設計書 → 実装の順を、テストでも崩さない）
- **見本ファイルを変えたとき**: JSON を取り直し、②の出力と前の正解との差を1件ずつ設計書と照らし、合っている差だけを正解に入れる

テストは Given / When / Then の3つに分けて書く（Given＝どの見本か、When＝②のどの処理か、Then＝正解との比較）。何を用意し、何をして、何を確かめたかを読んだ人が追えるようにするため。

**Figma でしか分からないことはテストにしない。実機で確かめる。** テストで Figma の振る舞いを真似ると、真似が実物と食い違ったときにも通るテストになる。実機で確かめるものは次のとおり。

- ①が読んだ値が実物どおりであること（読み取りデータに上の項目がすべて入っていること）
- Setup の結果（変数44個・Style 11個ができ、2回目で増えない、`scopes`・`codeSyntax.WEB`、Dark がピッカーに出ない、Text Style の書体と影の色が変数につながっている。4.3.4）
- 画像の書き出し（スクリーンショット・アセットとダーク用・`site/`。`.ico` がブラウザで favicon として出ること。4.5.3）
- 付け替えの書き込み（Dark で見た目が暗くなる、往復でバインドが元に戻る、途中で失敗しても light に戻る、dark のまま開き直したときの復旧の促し。4.3.9、4.7.4.4）
- 画面（3ビュー、選択への追従、ページ切り替え時の作り直し、件数の「未着／失敗／受信済み」、Figma のテーマへの追従、zip のダウンロード。4.7.1）
- プラグインの実行環境との違い。テストは Node で走るので、Node にあってプラグインの実行環境に無いもの（`TextEncoder` など。4.7.5）はテストでは原理的に見つからない
- zip を CC に渡したとき、ダークモードとレスポンシブが反映されたコードができること。線（`::after` の `border`、線の SVG、テキストの `-webkit-text-stroke` と `paint-order`、切り抜きと重なる線の `box-shadow`）、重ねた塗りと `background-blend-mode` / `mix-blend-mode`、グラデーション（線形の角度と stop の位置、円形の大きさと中心、角度の始まりの向きと回る向き、塗りの画像）、影（`box-shadow` / `text-shadow` / `drop-shadow()` の使い分け、ぼかしの見え方、複数の影の重なり）が、スクリーンショットと同じに描かれること（4.5.2.1）
- `strokesIncludedInLayout` の振る舞い。INSIDE の線だけが中身の配置に数えられ、辺ごとの太さならその辺の padding にだけ効くこと、CENTER / OUTSIDE は数えないこと（4.5.2.1）
- Figma の線は子より上に描かれること（`::after` を子より上に置く前提。4.5.2.1）
- Figma の effects の並びが下の影からであること（CSS で逆にする前提。4.5.1、4.5.2.1）
- 塗りと OUTSIDE / CENTER の線を持つノードの影が、線の外側の縁から落ちるか。それまでは、影は塗りの箱（ノードの寸法）から落ちるものとして `box-shadow` をそのまま書く — `box-shadow` はノードの箱から落ち、`::after` の線は影の形に入らない。線の外側の縁から落ちると分かったら、線がはみ出す幅を `spread` に足す規則に改める（4.5.2.1）
- サイジングの対応（4.5.2.1「layout.sizing」）が Figma と同じ寸法になること。Fill の兄弟に padding や INSIDE の線の違いがあるとき、Fixed の兄弟が縮まないこと、Hug の親の中の縦の Fill
- `ABSOLUTE` の子の制約の写し方と、回転の向き・中心（4.5.2.1「position」）。回転したノードを書き出したアセットに回転が焼き込まれること
- 画像の塗りの置き方（4.5.2.1）。`FILL` / `FIT` が中央に置かれること、`TILE` の大きさが元の画素数×`scalingFactor` であること、`CROP` の `imageTransform` が箱から画像への向きの行列であること
- 塗りの描き方（`blendMode`）が、そのノードの塗りの層どうしだけを混ぜること（`background-blend-mode` に写す前提。4.5.2.1）
- 数値の変数の単位（4.5.1）。`OPACITY` の変数が 0〜100 の数を持つこと、`LINE_HEIGHT` / `LETTER_SPACING` の変数が px として効くこと
- ②が作った配列の代入でバインドされること。`boundVariables` を持つ Paint・Effect・stop を `fills` などに代入し、`setRangeFills` でテキストの区間に代入したとき、変数につながった状態になること（4.3.9、4.7.6）
- 一時的な長方形から書き出した塗り・線の画像が、元のノードの描画と同じであること。線の SVG の大きさが、②の計算したはみ出す幅と合うこと。ノードを丸ごと書き出した画像の大きさが `absoluteRenderBounds` と合うこと（4.5.2.1）
- 名前から作った CSS 変数名（4.5.1）が、Dev Mode に出る名前と一致するか。資料で確かめられない大文字の扱いを含め、違いがあれば記録する

#### 4.7.8 配布

Figma Community に公開する（現状は開発版プラグインとして読み込む。手順は README「インストール」）。Community 公開を選ぶのは、Free 版ではプライベートプラグインが使えず、組織内限定配布ができないため（4.10）。ソースコードはGitHubで管理。

### 4.8 CCプロンプト設計

zip内に同梱されるCC向けファイルは2つ。

#### 4.8.1 prompt.md（作業指示書）

CCへのコーディング指示。エクスポート時にプラグインが自動生成する。

**構成:**

1. **概要**: このzipの内容と使い方
2. **入力データの読み方**: tokens.json、settings.json、spec.json、screenshots/、screenshots-dark/、assets/、assets-dark/、site/ の説明
3. **最初にやること**: steering.mdを読み、spec.jsonとnoteから埋められる項目を埋める。不明点はユーザーにヒアリングする。steering.mdの合意が取れてからコーディングに入る
4. **コーディング手順**:
   - tokens.json → CSS変数定義を生成（ある場合）。変数名は `cssVariable`、値は `cssValue` をそのまま使い、トークン名から作らず単位も足さない（4.5.1）。`cssValue` が `{ light, dark }` なら `:root` と `[data-theme="dark"]` の両方に書く。`$root` はグループ自身の値。tokens.json は DTCG の骨組みを土台にしているが準拠はしていないことを書き、DTCG の道具で読ませない
   - spec.json → 階層構造からHTML DOM構造を構築
   - layout プロパティ → CSS flexboxスタイルを生成（対応表付き）
   - fills, strokes, effects, text 等 → ビジュアルスタイルを生成。線の `::after`、影の `shadowProperty`、グラデーションの計算済みの値、`*Token` の使い方（Style のトークンと `color-mix()`）は 4.5.2.1 のとおりに書く
   - asset パス → `spec.json` に載ったパス（`asset`・`strokeAsset`）をそのまま使い、`<img>` / インラインSVG / 背景を配置する。ダーク対応なら `assets-dark/` に同じ名前があるものだけを `[data-theme="dark"]` で差し替える
   - screenshots/ → 見た目の妥当性を検証。ダーク対応なら `screenshots-dark/` でダーク表示を検証する
   - note → 動き・インタラクション等の実装
5. **HTML導出ルール**（README「レイヤー名」の「CCが解釈する特別な名前」を転記）
6. **Auto Layout → CSS flexbox対応表**（4.6節の内容）
7. **完了時**: steering.mdのチェックリストで自己検証する

**Export 設定（`settings.json`）の読み方**を prompt.md が指示する。設定の定義は 4.7.4.2、JSON 上の形は 4.5.4 が正で、ここは「読んで何をするか」だけを持つ。**設定は zip ルートに1つだけある**ので、prompt.md は「各ページを作る前にルートの `settings.json` を読む」ことと、`settings.site.favicon` / `ogImage` は zip ルート相対・`spec.json` の `screenshot` やアセットのパスはフレームフォルダ相対であることを手順として書く。

| 設定 | CC がすること |
|---|---|
| `responsive` | mobile-first の `min-width` メディアクエリを作る。各行の `frame` フォルダの spec をその幅での構造として使い、`contentWidth` を中身の包み（コンテナ）に適用する（4.9） |
| `darkMode` | true なら `tokens.json` の light/dark ペアから `:root` と `[data-theme="dark"]` の両方を作る（4.5.1）。false なら単一値だけ |
| `site` | `<html lang>` / `<title>` / `<meta name="description">` / `<meta name="theme-color">` / `<link rel="icon">` / OG の `<meta>` に値をそのまま入れる |
| `rules` | ページ全体に効く指示として読む。note（個別。4.3.7）と食い違う場合は note を採る — 狭い方が後から書かれた判断だから |

#### 4.8.2 steering.md（確認・タスク・ルール）

コーディング着手前の確認リスト、作業中のタスクリスト、守るべきルールをまとめたファイル。プラグインがテンプレートとして出力する。

CCはspec.jsonやnoteから埋められる項目を自動で埋め、不明点だけユーザーにヒアリングする。合意後はコーディングのチェックリストとしても使う。

**含まれる内容（詳細は実装時に決定）:**

- **確認項目**: 出力形式、CSS方針、画像パス構成、コンポーネント分割粒度、フォント読み込み、デプロイ先 等
- **タスクリスト**: コーディング作業のステップと完了チェック
- **ルール**: コーディング時に守るべき規約

**確認項目と Export 設定に同じことを置かない。** レスポンシブ・OGP/meta・言語はテンプレートの確認項目から外し、telldes の Export 設定（4.7.4.2）へ移した。いずれもデザイナーが Figma を開いている時点で答えられる項目であり、zip を受け取った CC がユーザーに聞き直すのは二度手間になる（4.7.4.1 の切り分け）。両方に残せば、設定で答えたのにもう一度聞かれる。

### 4.9 レスポンシブ対応

レスポンシブは2つに分けて扱う。**どんな見た目になるか**はフレームが持ち、**どの幅からそれを使うか**は Export 設定が持つ。

**幅ごとの見た目は別フレームにする**（README「レスポンシブ」）。他のフレームと同じ仕組み（フレーム名でフォルダ分け。4.5）に乗り、`tokens.json` は共通で、差異はレイアウト構造（spec.json）だけになる。

**ブレークポイントとコンテンツ幅は Export 設定で宣言する**（4.7.4.2 のレスポンシブ設定）。フレームだけでは足りないのは、フレームが答えていない問いが2つあるため。

- **どの幅からそのフレームを使うか。** フレーム幅とブレークポイント値は一致しない。1440px のデザインを 1440px から適用すると、1439px では常にモバイル版が出る。実際には 1024〜1280px あたりから適用するのが普通だが、その値はデザインのどこにも描かれていない
- **フレーム内の横方向の余白が何だったか。** ただの余白なのか、コンテンツ幅を作るためのものなのか（次段落）

**描かれていない幅の振る舞いはデザインに存在しない情報であり、ツールが推測してはならない**（原則B「推測させない」）。 1440px フレームの `padding: 0 340px` を `max-width: 760px` + `margin-inline: auto` に変換すべきかは、データからは決められない。両者は 1440px で**完全に同一の描画になる**からで、違いが出るのは 1440px より狭いとき ― つまりデザインが何も記述していない幅だけである。値の大小から意図を当てにいくのは推測であり、出力精度最優先の方針（2. ペイン）に反する。

設定でコンテンツ幅を宣言させれば、この問いは消える。**コンテンツ幅の宣言があれば、その padding は「コンテナを作っていたもの」だと確定する** ― 推測ではなく、デザイナーが言ったことになる。宣言が無ければ padding は padding のままで、狭い幅では単に潰れる。どちらも正しい出力であり、どちらになるかをデザイナーが選べる状態にするのが設定の役割である。

レスポンシブ設定が空なら、フレームは1つの幅として出る（メディアクエリを作らない）。LP 1枚の既定はこれで、設定を書いて初めてブレークポイントが生まれる。

同じ形で解く問題がもう1つある。角丸の `full`（4.3.6）— 円・ピル形状も、px 値と `border-radius: 9999px` が同じ描画になるため値からは区別できず、トークンへのバインドを宣言として読む。

グリッドを Auto Layout の WRAP と子の minWidth/maxWidth で表現させるのは、Figma の Grid（Auto Layout の grid モード）を使わせず、4.6 の flexbox 対応表の範囲に収めるため。

### 4.10 Free版の制約と対応

| 制約 | 影響 | 対応 |
|---|---|---|
| Variable Modes不可 | 1つのコレクション内でライト/ダークを切り替えられない | コレクションを Light / Dark / Base に分け、telldes が付け替える（4.3.9）。コレクション数に制限は無い |
| デザインファイル3つまで | LP/HP数の上限 | 1ファイル内でページ分割（下の条件つき） |
| Starter チームのファイルは1ファイル3ページまで | 画面ページと部品ページを分ける余地が無くなる | Drafts で作る（ページ数無制限。ただし共同編集不可） |
| 共有ライブラリ不可 | ファイル間でVariables/Styleを共有できない（publishが有料プラン専用） | 1ファイル内で完結。トークン一式は Setup がファイルごとに生成する（4.3.4） |
| アノテーション不可 | 標準UIで補足情報を付けられない | プラグインのnote入力UIで代替 |
| プライベートプラグイン不可 | 組織内限定配布不可 | Figma Communityに公開 |

**Free で成立するのは実質 Drafts 運用のとき。** Starter プランのページ数制限はチームのファイルにかかり、Drafts のファイルにはかからない。ページ分割でファイル数の上限を回避し（上表）、さらに画面でないものを別ページへ逃がす（4.7.4）と、チームのファイルでは3ページで足りなくなる。Drafts なら両方が成り立つ。代償は共同編集ができないこと — 1. 状況のとおりデザイナーは自分ひとりなので、この前提では問題にならない。
