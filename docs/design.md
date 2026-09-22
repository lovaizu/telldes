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

Hug / Fill / Fixed の3つに限定するのは、CSS への対応が一意に決まるものだけを許すため。

| Figma設定 | CSS出力 |
|---|---|
| Hug contents | サイズ指定なし |
| Fill container | `flex-grow: 1` / `width: 100%` |
| Fixed + 数値 | `width: Npx` / `height: Npx` |

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
| Color Style（単色） | カラー | 非推奨。トークン源泉として扱わず、使用時は書き出し時のREADMEに除外物として記録（Figma本体もVariables推奨） |
| Variables（BOOLEAN）、それ以外の Variables（STRING） | — | トークン対象外。使用時は書き出し時のREADMEに除外物として記録 |

**書体も `tokens.json` に出す。** 色・余白・角丸・文字サイズ・影はどれも「解決済み値＋`*Token`」で出て CC は `var(--…)` で書けるのに、書体だけ生の文字列になるのは原則B「形が揃っている」を崩す特別扱いであり、telldes 自身が Setup で作ったもの（`font/heading` 等）を自分で「拾えませんでした」と告知する形にもなる。Figma 公式も String Variable の適用先に font-family を挙げており、W3C DTCG にも `fontFamily` 型があるので、公式の作法の範囲に収まる（原則A）。デザイナーが独自に作った STRING Variable のうち書体でないもの（テキストの中身・バリアント切り替え等）と BOOLEAN Variable は、対応する CSS の受け皿が無いため引き続き対象外・告知対象とする。

**書体かどうかは Variable の `scopes` で決める — `FONT_FAMILY` を含み、かつ `ALL_SCOPES` を含まないもの**、すなわちデザイナーが Figma の変数パネルで書体用だと絞ったものだけを書体として扱う。`scopes` は変数ピッカーにどのフィールドで出すかの絞り込みで、新規作成した Variable は既定で `ALL_SCOPES`（＝絞っていない）である。`ALL_SCOPES` を書体の印にすると、テキストの中身の差し替え用に作った STRING Variable まで書体として `tokens.json` に出てしまう。既定値のままは宣言ではない（原則B「推測させない」）。変数名から当てにいかないのも同じ理由。絞っていない STRING Variable は対象外のまま除外物として README に載る（4.7.2）ので、拾われなかったことは黙って落ちず、スコープを絞れば拾われるという手がかりが届く（原則B「欠けていると分かる」）。**Setup が生成する `font/heading` / `font/body` / `font/accent` には `scopes: ["FONT_FAMILY"]` を設定する。** 書体がトークンとして出ることはこのスコープ設定に依存する。

カラーは **単色は Variables に一本化**する。Color Style はグラデーション・複数fillのように単色に展開できないものに限り正式な源泉として扱う。Variable の COLOR 型は単色しか持てないため、グラデーションは Color Style 以外に表現手段がない（Figma本体も「値の組み合わせは Style、Style の中身は Variables を指す」という立場を取っており、実際 `GradientPaint.gradientStops[].boundVariables` で各stopの色を個別に Variable へバインドできる）。したがって、グラデーション・複数fillの Color Style を使用している場合は、各stopの色がVariableにバインドされていればそのトークン名を、されていなければ解決済みの値をそのまま `tokens.json` / `spec.json` に出力する。**ただしダークモード対応が ON のファイルでは、stop の色の未バインドは影の色と同じく error とする**（4.7.2）。telldes は stop の色も Light ⇄ Dark で差し替えるため（4.3.9）、バインドされていない stop だけがライトの色のまま取り残され、`screenshots-dark/` が実物と食い違う。単色なのに Color Style を使っている場合（Variables に一本化できるのにしていない場合）は、引き続き除外物としてREADMEで告知する（4.7.2）。

**Effect Style（影）も同じ扱いに揃える。** Figma は影の `color` / `radius` / `spread` / `offsetX` / `offsetY` を個別に Variable へバインドできる（`VariableBindableEffectField`）。したがって Effect Style は複合的な見た目としての源泉のままとし、各フィールドが Variable を指していればそのトークン名を、指していなければ解決済みの値を `spec.json` の `effects`（4.5.2.1）に出力する。影の色はテーマで変わりうるため、ダーク対応ファイルでは色のバインド漏れがそのまま出力の破綻になる（4.7.2 の原則1）。

Variablesの使用そのものは必須ではない。使わない場合、CCはspec.jsonの解決済み値（`resolvedValue`）から直接CSSを生成する（同じ値が複数箇所でも個別値として出力）。出力の正しさは変わらないため、Variable化はデザイナーの判断に委ね、ツールは促さない。例外は、既にあるトークンと同じ値なのにそれを指していない箇所 — 判断済みの語彙を使い損ねているだけなので、付け忘れとして知らせる（4.7.2）。

命名規約は自由（唯一の例外は `radius/full`。4.3.6）。ただし意味の一貫性のため、以下の**推奨トークン体系**を本ドキュメント上の指針として示す（プラグインが命名を促すことはしない）。**telldesは値をどのスロットに割り当てるかを自動判定しない**（誤検知を避けるため）。「トークン化する値の命名はこの体系から選ぶ」という共通語彙の提示までが本書の役割で、トークン化の要否と具体的なスロット選択はデザイナーが行う。

命名は Figma の変数パネルが自動でグループ化する `/` 区切りの階層名とする。値は各変数が直接持つ1層構成とし、原始値を別変数に分けるPrimitives/Semanticの2層構成は採らない（この規模のトークン数ではFigma公式ガイドも1層構成を推奨している）。この体系は「よく使われる値だけに名前を付ける」という位置づけであり、ここに無い一回限りの値（突出して大きい/小さいフォントサイズ、ページ端の大きな余白等）は生値のままでよい。全ての値をトークンに収めることは目標にしない。

```
Color（Variables COLOR、Light 8 ＋ Dark 8）
  bg / surface / border
  fg/default / fg/muted
  primary/default / primary/hover / primary/on
Spacing（Variables FLOAT、8）
  spacing/xs=4 / sm=8 / md=16 / lg=24 / xl=32 / 2xl=48 / 3xl=64 / 4xl=96
Radius（Variables FLOAT、5）
  radius/sm=4 / md=8 / lg=16 / xl=24 / full
Font family（Variables STRING、3）
  font/heading / body / accent
Typography（Text Style名、8）
  display / heading-lg / heading-md / heading-sm / lead / body / label / caption
Elevation（Effect Style / drop shadow、2）
  shadow-sm / shadow-md
```

Typographyが8段階なのは、実際のLPの実測値（18 / 20px）が6段階から外れたため。`lead`（本文より少し大きい導入文）がそこを受け、`label`（フォーム・ボタンの文字）はWebでほぼ必ず出る。Font familyの3役割で足りない書体（装飾用の一回限りの書体等）は、Variableを増やさず生値のまま使ってよい。同様に8段階に無い一回限りの大きさも生値のままでよい。

この一式 ― **変数32個（Color Light 8 / Color Dark 8 / Spacing 8 / Radius 5 / Font family 3）＋ Style 10個（Text Style 8 / Effect Style 2）＝ 42個** ― を Setup タブ（4.7.1）がファイルに生成する。Figma Free ではチームライブラリの publish が使えずファイルをまたいで Variables / Style を揃える手段が他に無いため（4.10）、揃えるにはプラグイン自身が作るしかない。生成後の改名・値変更は Figma 純正の Assets パネルで行う（telldes 側に編集UIを持たない）。

**ダーク用の8色も Setup が最初から作る。** Dark コレクションの変数は `scopes: []` でカラーピッカーから隠れるため（4.3.9）、ダーク対応しないファイルに存在してもデザイナーの邪魔にならない。ダークを始めるときは Export 設定を ON にして色を入れるだけで済み、生成のタイミングが1つで済む。4.7.2 原則1 が「Dark コレクションの有無を判定軸にしない」根拠（Setup を実行した全ファイルに Dark がある）も、これで実在する。

Elevation（ドロップシャドウ）の命名指針も本体系に含めるが、プラグインが命名を促すことはしない。影の実値は `spec.json` の `effects`（4.5.2.1）に出力されるため、Effect Style にまとめなくても CC には届く。この体系は命名の共通語彙として、デザイナーとCCが同じ言葉を使うための指針である（Effect Style を named token として tokens.json に出す対応は Text Style トークンと同じく別途）。

#### 4.3.5 背景の扱い

背景をフレームの fill に限定する理由: 子要素がすべてコンテンツになり、CCはAuto Layoutの子要素＝HTMLの子要素と機械的に対応付けできる。背景専用の子レイヤーを許すと、CC は画像から「これは背景か中身か」を推測することになる（2. ペイン）。

#### 4.3.6 命名規約

「同じ親の中でユニークであればよい」とする理由: 階層情報は Figma のレイヤーツリーが持っているので、名前に親を繰り返させる必要がない。ユニーク性の単位を親に限ることで、spec.json の `path` とファイル名の一意化（4.5.2「path / ファイル名の一意性」）が親ごとの `-N` 付与だけで済む。

**CCが解釈する特別な名前**（`header` / `footer` / `nav` / `heading` / `cta` / `button`）の一覧は README「レイヤー名」が正。`prompt.md`（4.8.1 の「HTML導出ルール」）はそれを転記する。名前から HTML 要素を導くのは、デザイナーに HTML を意識させずに見出しレベルとランドマークを決めるため。

**telldesが解釈する特別なトークン名 — `radius/full`**: 円・ピル形状は Figma 上では絶対px（短辺の半分）としてしか現れず、`border-radius: 9999px` と px 値のどちらが正しいかはデータから決まらない。そこで `radius/full`（4.3.4）へのバインドを「常に丸める」という宣言とみなし、バインドされていれば `border-radius: 9999px`、されていなければ px 値のまま出す。px 値の大小から円・ピルを当てにいかないのは、4.9 の「描かれていない振る舞いを推測しない」と同じ理由 — 描画結果は一致しており、値からは意図を区別できない。

**命名は自由だが、この名前だけは意味を持つ。** 4.3.4 が命名規約を自由にしているのは、telldes が値からスロットを当てにいかないためであり、その方針と `radius/full` は矛盾しない ― 名前は telldes が当てるのではなくデザイナーが宣言するものだから。ただし改名や自作の命名でこの名前を外すと、宣言は黙って効かなくなり、円・ピルは px 値のまま出る。黙らせないために、**丸い形（角丸が短辺の半分に達している）なのに `radius/full` を指していない箇所**を Export タブで知らせる（4.7.2 の付け忘れの知らせ）。error にはしない — px 値のまま出ても描画は一致しており、出力は壊れていない。名前で宣言させる形自体を変えないのは、デザイナーが Figma の中だけで完結でき、telldes 固有の印を足さずに済むため（原則A）。

#### 4.3.7 note（補足情報）

Figmaの標準プロパティでは伝えられない情報（動き・インタラクション・意図・リンク先・アクセシビリティ）の受け皿。Free 版にはアノテーション機能が無い（4.10）ため、プラグイン側で `setPluginData` に持つ。内容を自由記述にしているのは、構造化するとデザイナーが書けることを狭めるから — 解釈は CC に委ねる。

#### 4.3.8 画像アセット

画像を含むノードは書き出し時に自動でアセットになる（形式と出力先は README「画像」）。ファイル名はレイヤーパスを `--` で結合したもので、スクリーンショット（4.4.2）と同じ規則。同じ規則にしておくと spec.json の `path` からファイル名が機械的に導ける。

#### 4.3.9 ダークモード（1フレーム＋トグル）

Figma のプラン制限がかかるのは「1コレクションあたりのモード数」であり（Free はモードを作れない）、**コレクションの数はどのプランでも制限されていない**。したがって Variable Modes を使わずコレクションを分ければ Free でもダーク対応ができる。変数は3コレクションに分ける。

| コレクション | 内容 | 対を持つか |
|---|---|---|
| Light | 色（4.3.4 の Color 8個） | Dark と対 |
| Dark | 同名の色 | Light と対 |
| Base | 余白・角丸・書体 | 持たない |

**変数名にテーマを入れない**（`bg-light` にしない）。`tokens.json` がその名前で出ると CSS 変数が `--bg-light` になり、`--bg` が `:root` と `[data-theme="dark"]` で値を変える形（4.5.1）を CC が機械的に作れなくなる。テーマ違いはコレクション名が持つ。

**対を持つのは色だけ**。余白・角丸・書体はテーマで値が変わらないので Base に置く。文字サイズは Text Style（4.3.4）が持つものでコレクションには入らない。二重管理が起きず、付け替えも「バインド中の変数と同名の変数が対のコレクションにあれば差し替える、無ければ触らない」で済み、Base を除外する特別扱いが要らない。

**フレームは複製しない。** telldes がバインドを Light ⇄ Dark で差し替え、キャンバス上で実際にダークを描画する。dark フレームを別に生成する方式を採らない理由:

- dark フレームはトップレベルフレームとして書き出し対象になり（4.7.4）、`Home/spec.json` と `Home-dark/spec.json` という**別ページ2つ**として CC に渡る。同じページのテーマ違いを別ページとして渡すことになり、出力構造が歪む
- light の構造変更が dark に伝わらない。古さを検出する仕組みが別途要り、怠れば古い dark が CC に渡る
- 再生成は delete-insert になり、レビュー中に付いた Figma のコメントが迷子になる（コメントは Plugin API から触れない）

**暗くなるのはページ全体。** 付け替えの対象は2つ — (1) ページ上の全書き出し対象フレーム配下のノード（4.7.4）、(2) ファイル共有の `PaintStyle` / `EffectStyle` オブジェクト自体。選択フレームだけを暗くしない理由は目的側にある。ダークはサイト全体にかかる振る舞いであり、フレームごとに明暗が混在する状態は実物に無い。書き出しは全フレームを撮る（4.7.4）ので、ページ全体を揃えて初めて `screenshots-dark/` が全フレーム分そろう。スタイルはファイル全体で共有されるものなので、下の状態フラグ（ファイル単位）とも粒度が一致する。

**影とグラデーションの色も変わる。** 明るい背景用の影は暗い背景では見えず、グラデーションは浮く。変わらなければ `screenshots-dark/` が実物と食い違い、出力の正確さが崩れる。4.7.2 が影やグラデーション stop の色を変数にすることを要求しておきながら付け替えないのは、言われたとおりにしても直らないという最悪の体験になる。Color Style / Effect Style を使っている場合、そのバインドはノードではなくスタイルオブジェクト側に載るため、(2) を対象に含めなければ届かない。実現手段は Paint / Effect の配列を作り直して再代入する形になる — `ColorStop.boundVariables` は `readonly`、`setBoundVariableForPaint` は `SolidPaint` しか受け取らず、1フィールドだけを差し替える API が無いため。

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

書き出し対象: セクション（必須）＋ 子を持つブロック（自動）。エレメント（末端）は書き出さない。

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
├── tokens.json        ← デザイントークン（対応Variables（COLOR/FLOAT/書体のSTRING）またはText Styleが定義されている場合のみ）
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

対応Variables（COLOR / FLOAT / 書体の STRING。判別と対象外の範囲は 4.3.4）またはText Styleのいずれかが定義されている場合のみ出力。どちらも未定義の場合は`tokens.json`自体を出力しない。W3C Design Tokens Community Groupの仕様に準拠。

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
  "font": {
    "heading": {
      "$type": "fontFamily",
      "$value": "Inter"
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

Variablesの構造をそのままJSON化する。デザイナーの命名がそのままトークン名になる。`$type` は Variable の型から決まり、COLOR は `color`、FLOAT は `number`、書体の STRING は `fontFamily`（W3C DTCG の型名）になる。書体も他と同じ「トークン名＋値」で出るので、CC は font-family も `var(--…)` で書ける（原則B「形が揃っている」）。

`typography` グループは Text Style から出力する（4.3.4「Text Style は named typography token として出力し、spec から参照」）。Variables ではなく Text Style が源泉である点が color/spacing と異なるが、`tokens.json` 上のトークンとしての扱いは同じ。`$type` は `"typography"`、`$value` は `fontFamily` / `fontSize` / `fontWeight` / `lineHeight` / `letterSpacing` を持つ複合値（W3C DTCG の composite token 形式）とする。トークン名（上記例の `heading-md`）は Text Style 名をそのまま用いる。命名は自由だが、4.3.4 の推奨トークン体系（`display` / `heading-lg` / `heading-md` / `heading-sm` / `lead` / `body` / `label` / `caption`）に従うことを推奨する。

`$value` は Text Style の canonical な定義値であり、個々のノードに対する解決済みメトリクスではない。そのため 4.5.2.1 の `text.*` フィールドで採用している「既定値は省略」という間引き規約はここには適用されず、各値が既定的かどうかに関わらず `fontFamily` / `fontSize` / `fontWeight` / `lineHeight` / `letterSpacing` の 5 キーを常にすべて含める（例の `"letterSpacing": "0em"` はこの規約により省略しない）。`lineHeight` が Text Style 上 AUTO 設定の場合も同様に省略や `"AUTO"` という文字列での出力はせず、CSS の `line-height: normal` に相当するキーワード文字列 `"normal"` を `$value.lineHeight` に出力する（Figma Plugin API は AUTO 設定の描画後 line-height をpx値として提供しないため、CSS 側の意味的な等価表現を用いる）。これは mixed 値を先頭文字の値で解決する他フィールドの方針と同じく、`$value` が常に具体的な解決値を持つようにするためである。

color トークンの `$value` は #RRGGBB（6桁）。アルファが 1 未満の場合のみ #RRGGBBAA（8桁）で表現する。エイリアス（他トークンの参照）は解決済みの値に展開する。

あるトークン名が、別のトークンのグループ接頭辞と一致する場合（例: `color` と `color/primary` が併存）、グループ自身の値は予約キー `$base` に格納する（例: `color.$base` と `color.primary` の両方を保持）。これにより同名の値が失われない。

**ダーク対応ファイル（Light / Dark / Base の3コレクション、4.3.9）の場合**、コレクション名でJSONをグループ化しない。Light・Darkの両コレクションに同名の変数が存在する場合は1つのトークンとして扱い、`$value`を`{ "light": ..., "dark": ... }`の形にする。Baseコレクションの変数（テーマで値が変わらないもの）は単一値のままとする。

```json
{
  "bg": {
    "$type": "color",
    "$value": { "light": "#FFFFFF", "dark": "#1A1A1A" }
  },
  "spacing": {
    "xs": { "$type": "number", "$value": 4 }
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
| `GRADIENT_LINEAR` / `GRADIENT_RADIAL` / `GRADIENT_ANGULAR` / `GRADIENT_DIAMOND` | `gradientStops`（`[{ position, color, colorToken? }]`）, `gradientTransform`, `opacity?` | グラデーション。`position` は 0〜1、`color` は #RRGGBB（アルファ < 1 の場合は #RRGGBBAA）。stop の色が Variable にバインドされていれば `colorToken` も付く（4.3.4）。`gradientTransform` は 2x3 変換行列で角度/中心/スケールを表す |

- `opacity` は塗りの不透明度が 1 未満の場合のみ付与する数値（0〜1）。半透明オーバーレイ（4.3.5）の再現に使う。
- IMAGE / GRADIENT を含む全種類の塗りを `fills` に出力する（SOLID 以外を欠落させない）。

**text.fill**

テキスト色も塗りの不透明度が 1 未満の場合は `text.fillOpacity`（0〜1）を付与する。

**cornerRadius**

- 全角共通の場合: 数値（例 `8`）。Variable 適用時は `cornerRadiusToken`。
- 角ごとに異なる場合: オブジェクト `{ "topLeft": n, "topRight": n, "bottomRight": n, "bottomLeft": n }`。
- `cornerRadiusToken` が `radius/full` のときは、CC は解決済みpx値ではなく `border-radius: 9999px` を出す（4.3.6）。値そのものは他のトークンと同じく解決済みで載せる。

**effects（影・ぼかし）**

可視の effect を `effects` 配列として出力する（描画に効くため暗黙に捨てない。4.3.4 の基本姿勢）。各要素は `type` で種類を表す。

| type | フィールド | CSS 対応 |
|---|---|---|
| `DROP_SHADOW` | `color`（#RRGGBB/#RRGGBBAA）, `offsetX`, `offsetY`, `blur`, `spread?` | `box-shadow: offsetX offsetY blur spread color` |
| `INNER_SHADOW` | 同上 ＋ `inset: true` | `box-shadow: inset ...` |
| `LAYER_BLUR` | `blur` | `filter: blur(blur px)` |
| `BACKGROUND_BLUR` | `blur` | `backdrop-filter: blur(blur px)` |

- `blur` は Figma の `effect.radius`。`spread` は 0 のとき省略。非可視 effect は出力しない。
- 各フィールド（`color` / `radius` / `spread` / `offsetX` / `offsetY`）が Variable にバインドされている場合は、他のフィールドと同じく `*Token` を併せて付与する（4.3.4）。
- Effect Style 自体を named token として `tokens.json` に出す対応は未実装（Text Style トークンと同様の別途対応）。フィールド単位のトークン名とは別の話で、こちらは複合値としての名前を指す。

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

4つのタブ（Setup / Review / Notes / Export）。利用者から見た各タブの挙動は README「プラグインの使い方」が正。本節以下はその裏の判断。

Setup を独立したタブにするのは、トークン一式の生成（4.3.4）がファイルごとに一度きりの準備作業で、デザイン中に繰り返す Review / Notes / Export とは頻度も目的も違うため。

#### 4.7.2 チェック

本節は3つの異なる出力を定める。(1) **Review（チェック）**: 制作ルール違反を検出し、各違反に改善方法を提示する。Reviewが報告するのはエラーのみで、すべて書き出しのブロッカーである。(2) **書き出し時の除外物告知**: ツールが構造上対象外にするもの ― 違反ではなく、したがって改善方法も持たないもの ― を書き出し時に検出し、zip内 `README.md` に事実として記録する。(3) **付け忘れの知らせ**: 出力は壊れていないが、デザイナーが宣言し忘れたと機械的に分かる箇所を Export タブに出す。(1) はデザイナーが直さなければ渡せないもの、(2) は直す義務がないもの、(3) は直すかどうかがデザイナーの判断であるもの。3つは相手も置き場所も違うので混ぜない。

**Review の走査範囲は書き出し対象の範囲**（ページ直下の `FRAME`／`SECTION` とその配下。4.7.4）とする。原則1 の判定軸は「出力が壊れるか」であり、zip に入らないものが壊れていても出力は壊れない。渡さないものを直さないと渡せない、という状態はゲートの趣旨と逆になる。範囲の判定には書き出しと**同じ関数**（`src/export/exportScope.ts` の `isExportedFrame`）を使う。同じ定義を2箇所に持たなければ、Review と zip の対象が黙ってズレることはない。除外物告知のうち Color Style / Variable の使用も既にこの範囲なので（後述）、両者はここで揃う。

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

**原則3 — Review は行為の前に自動で走るゲート。結果は必ず Review タブに出す。**

| ゲート | 走らせるチェック | 失敗時 |
|---|---|---|
| Export | 出力が壊れるもの全部（構造4種＋サイジング1種＋テーマ整合5種） | Review に結果表示、Export 中止 |
| テーマ切り替え | テーマ整合のみ | Review に結果表示、切り替え中止 |
| 手動 Review ボタン | 全部 | Review に結果表示 |

件数だけを返して場所を教えない形にすると、デザイナーは自分で Review タブへ移動してボタンを押し直すことになり、同じチェックが2回走る。結果にはどのゲートで止まったかが分かる見出しを付ける（「Export できません」「ダーク表示に切り替えられません」）。Export を押したのに Review タブに飛ぶ理由が分からないと混乱するため。

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

**実行失敗の扱い:** チェックの実行自体が例外で中断した場合は、その旨をUIに通知し「実行中…」表示を解除する（書き出しの失敗通知と同じ方針）。通知しないとタブが「実行中…」のまま固まり、デザイナーには原因も次の一手も分からない。あわせて**前回の実行結果の表示を消す**。Reviewタブが示すのは常に直近1回の実行の結果であり、失敗通知の下に前回の一覧が残っていると、それが今回の検出結果だと読めてしまう。

**書き出し時の除外物告知（README出力）:** 上記(2)。ツールが対象外にするもの（＝デザイナーに直す義務はないが、黙って捨ててはいけないもの）は、Reviewではなく書き出し時に検出し、zip内 `README.md` の「Not included in this export」セクションに**実際に検出された項目のみ**を対象レイヤーパス（トークン名の衝突はトークン名、noteはレイヤーパスと本文）付きで記録する。検出ゼロの項目は行を出さない。「予測できない動き」を防ぐ基本姿勢（4.3.4）と原則B「欠けていると分かる」を、Reviewのノイズではなく書き出し結果の事実記録として担保する。
- **単色の** Color Styleを使用 → カラーはVariablesに一本化するためトークン化されない（4.3.4。グラデーション・複数fillのColor Styleは正式な源泉なので告知しない）。**Color Styleごとに1件**、使用レイヤー数と代表レイヤーパス（最大3件）を列挙する。1つのテキストノード内で複数のColor Styleが混在する場合（`fillStyleId === figma.mixed`）は単一のidに解決できないため、その旨を示す名前の1件にまとめる
- BOOLEAN Variable、または書体として扱われない STRING Variable を使用 → トークン出力対象外（判別は 4.3.4。書体は源泉なので告知しない）。**Variableごとに1件**、Variable名・使用レイヤー数・代表レイヤーパス（最大3件）を列挙する
- ページ直下に裸で置かれたComponent/Component Set定義 → 書き出し対象外（4.7.4の範囲方針）。該当レイヤーと、画面フレーム内にインスタンスとして配置するか、ライブラリページへ移す旨を記録する
- Variableのフルパスが `typography/<name>` に一致し、同名のText Styleが存在（tokens.jsonの`typography`グループで衝突し、後に書き出されるText Style側が上書きする。4.5.1） → 衝突したトークン名の組を記録する
- 書き出し対象外のレイヤーに付いたnote → noteは `spec.json` の `note` としてしかCCに届かず（4.5.2）、`spec.json` は書き出し対象フレーム配下しか持たないため、対象外のレイヤーに付いたnoteは `spec.json` には現れない（CCがスペックとして読む場所には届かない）。一方、Notesタブの一覧はページ全体を走査するため（4.7.3）そのnoteは一覧には出る。「一覧に出ている＝CCに届く」と読めて届かない状態を防ぐため、レイヤーパスと本文を記録する

**除外物告知の走査範囲:** README に載る項目は、読み手がzipの中身と突き合わせられるものでなければならない。したがって走査範囲をカテゴリごとに次のとおり定める。
- Color Style使用／対象外Variable使用 → **書き出し対象のページ直下 `FRAME`／`SECTION` 配下のみ**を走査する（当該フレーム自身を含む。Review と同じ範囲・同じ判定）。ページ直下に裸で置かれた他のノードや、裸のComponent定義の内部は走査しない（前者はzipに現れず突き合わせ不能、後者は「裸のComponent」として既に1件記録済みで二重計上になるため）
- **インスタンス内部のノードも走査する**。インスタンス内部のノードは主コンポーネント由来の `fillStyleId` / `boundVariables` を保持しており、主コンポーネントを別ページ（ライブラリ）に置き画面ページにインスタンスを並べるという定石の構成（4.7.4）では、インスタンス内部を除外すると「Color Style使用ゼロ」というREADMEが出てしまう ― 実際には書き出したスクリーンショット上の全カードがColor Styleで着色されているのに、である。これは4.3.4の姿勢に反する黙殺であり、走査対象に含める
- 上記により同じ部品をN個配置すると同一内容のN行が出る問題は、**レイヤー単位ではなく「除外される物」単位でまとめる**ことで解決する。すなわちColor Style使用はColor Styleごと、対象外Variable使用はVariableごとに1件へ集約し、各件は対象レイヤー数と代表レイヤーパス（最大3件）を持つ。ノイズを抑えつつ、検出事実そのものは失われない
- ページ直下に裸で置かれたComponent/Component Set → ページ直下のノードを走査する（書き出し範囲の外にあるものを告知するための項目であるため）
- トークン名衝突 → ノードではなくVariables／Text Stylesを対象とするため走査範囲の影響を受けない
- 書き出し対象外のレイヤーに付いたnote → **書き出し対象のページ直下 `FRAME`／`SECTION` 配下に無いノード**（ページ直下に裸で置かれたComponent／Component Set定義の内部、ページ直下の裸の他のノードとその内部）を走査する。書き出し範囲の外にあるものを告知するための項目であるため、Color Style使用等とは逆に対象フレーム配下は走査しない（そこに付いたnoteは `spec.json` に載る）。裸のComponent定義の内部まで走査するのは、Color Style使用と違い、note本文はデザイナーが書いた情報そのもので「Component X は対象外」の1件から復元できないためである。二重計上ではなく別の事実として記録する
- 同一カテゴリ内で内容が完全に一致する項目は1行にまとめる。レイヤーパスの**先頭セグメントは、4.5.2「フォルダ名（ページ直下のセグメント）の規約」をページ直下の全ノードに一度に適用した結果の文字列**とする。書き出し対象フレーム配下のレイヤーであれば、それはそのフレームのzipフォルダ名そのものになる。裸のComponent等の非フレームも同じ規約・同じ「使用済み名の集合」で命名されるため、フォルダ名と別ノードの表記が衝突することはない（フォルダ名とREADMEのパス先頭セグメントは同一の走査で一度だけ決定し、zipとREADMEの双方へ同じ値を渡す。等価な走査を別の場所でもう一度行わないことで、両者が食い違うことをあり得なくする）。先頭セグメント以外は4.5.2の `path` と同じく同名の兄弟を `-N` で区別する。画面フレーム名を含む点がspec.jsonの`path`と異なるのは、READMEがデザイナーにzip内のフォルダとFigmaのレイヤーツリーの両方を辿らせるための表記であるため

**付け忘れの知らせ（Export タブ）:** 上記(3)。出力は壊れていないが、デザイナーが宣言し忘れたと機械的に判定できる箇所だけを Export タブに並べる。2種類ある。

- **既にあるトークンと同じ値なのに、そのトークンを指していない箇所**。値の照合は機械的にできるので、明らかな付け忘れだけに絞られ、ノイズが桁違いに減る
- **丸い形（角丸が短辺の半分に達している）なのに `radius/full` を指していない箇所**（4.3.6）

どちらも **error にしない**。直さなくても `spec.json` には実値が載り CC は正しく作れるので、Export もブロックしない。**telldes が自動で置き換えることもしない** — 値が一致しても、デザイナーがそのトークンを意図したとは限らないからで、4.3.4 の「値をどのスロットに割り当てるかを自動判定しない」をここでも守る。

**置き場所が zip の `README.md` ではなく Figma 上の Export タブなのは、4.7.4.1 の切り分けによる。** 付け忘れを直すのはデザインの判断であり、デザイナーが Figma を開いている今しか答えられない。zip を開くのは CC で、そこに書いてもデザイナーには届かない。Export タブは「今から何を渡すか」を確かめる場所（4.7.4.3）なので、note 一覧と同じ並びに置く。

#### 4.7.3 note入力UI

note は `setPluginData('note', value)` に持つ（Free 版にアノテーションが無いため。4.10）。note があるノードに `setRelaunchData` で編集ボタンを出すのは、プラグインを開かなくても note の存在に気づけるようにするため。

**note一覧を置く理由:** 入力欄はノードを1つ選択して初めて1件のnoteを見せるため、それだけでは「このページのどこに何を書いたか」を確かめる手段がレイヤーを1つずつ選び直すことしかない。そこで入力欄の下に、現在のページでnoteが設定済みの全レイヤーを一覧表示する。

- **各項目にレイヤーパスと本文の両方を出す**: レイヤーパスだけではnoteの中身が分からず、note本文だけではどのレイヤーの話か分からない
- **パスは Figma 上の生のレイヤー名をそのまま並べる**（4.5.2のフォルダ名正規化も `-N` 付与も行わない）: 一覧はzipと突き合わせるための表記ではなく、Figmaのレイヤーツリーを辿るための表記であるため
- **走査範囲はページ全体**: noteはどのレイヤーにも付けられるため、書き出し対象外のノード（ページ直下に裸で置かれたComponent定義の内部など）に付いたnoteも一覧に出す。出さなければ、書いたはずのnoteが見当たらないという状態になる。ただし一覧に出ることは書き出されることを意味しない ― 書き出し対象外のレイヤーに付いたnoteは `spec.json` に載らないため、書き出し時に除外物として告知する（4.7.2）。「これから渡すもの」を示す Export タブの一覧は範囲が違う（4.7.4.3）。並び順はレイヤーツリーの走査順
- **一覧はプラグイン起動時・note 保存時（空文字保存＝削除を含む）・ページ切り替え時の3時点で作り直すスナップショットで、それ以外の変更は追わない**: 一覧が「現在のページ」のものだと言えるのは、ページが変わるたびに作り直すからである。Figmaはプラグインを開いたままページを切り替えられるため、起動時と保存時だけでは切り替え後も前のページの一覧が残る。一方、レイヤーの削除・undo・別セッションからの変更は追わない（`documentchange` は購読しない）。文書全体の変更通知は重く（dynamic-page 設定下では全ページのロードが前提になるほど）、しかも変更は周期的にまとめて届くため、購読しても一覧が常に最新だとは言えない。古くなった行は嘘のまま固定されない ― 対象が消えた行はクリック時の検出（次の箇条）で回収でき、undoでnoteだけが消えたレイヤーの行はクリックすれば入力欄が空の保存済みnoteを映す。この程度の古さは許容する。選択の変更でも更新しない（一覧は選択に依存しない）ので、行クリックで選択が成立しても一覧は作り直さない
- **行が指すレイヤーが現在のページに無いときは、その旨をUIに通知し、一覧を作り直す**: 行の対象は削除されうるし、一覧は前の箇条の範囲で古くなりうる。黙って無反応にすると、利用者にはクリックが効いていないのか対象が消えたのか分からない（4.3.4の基本姿勢）。通知と同時に作り直すのは、同じ行をもう一度クリックしても同じ結果になる状態を残さないため
- **一覧の走査が失敗したときは、その旨をUIに通知し、前回の一覧を消す**: 一覧が示すのは常に直近1回の走査結果である。特にページ切り替え直後の失敗で前ページの一覧が残ると、それが今ページの一覧に見える（Reviewの実行失敗で前回結果を消すのと同じ理由。4.7.2）
- **一覧のUI状態は「未着」「失敗」「受信済み」の3つで、0件のメッセージは受信済みでのみ出す**: 未着は起動直後で最初の走査結果がまだ届いていない状態、失敗は直近の走査が失敗した状態、受信済みは直近の走査結果（0件を含む）を持つ状態。未着や失敗を0件と同じ見た目にすると、走査失敗や到着前の空白が「このページにnoteは無い」という嘘の空状態として見える（4.3.4）
- **入力欄は一覧の上に残し、ノード未選択でも一覧は表示する**: 一覧の目的が「選択せずに全体を見る」ことだから
- **行クリックは選択変更として扱い、選択が変われば未保存の入力は捨てられる。確認は挟まない**: 入力欄は常に選択中ノードの保存済みnoteを映す単一の源泉であり、保存ボタンが明示的なコミットである。行クリックはキャンバス上での選択操作と同義で、入力が捨てられるかどうかは選択が変わったかで決まり、行クリック自体では決まらない。編集中の入力欄のすぐ下に1クリックで捨てるコントロールが置かれる形にはなるが、確認ダイアログを挟むと一覧の「1クリックで辿る」用途が壊れるため、挙動は選択変更と揃える

#### 4.7.4 書き出し

Export はボタンを押した時点でチェックが自動で走り（4.7.2 の原則3）、エラーが1件でもあれば中止して結果を Review タブに出す。エラーだけを理由に止めてよいのは、Review の結果が出力の正確さを損なうものだけに絞ってあるから（4.7.2）。

**書き出し範囲の方針**: 出力単位は「画面フレーム」とする。具体的にはページ直下の `FRAME` および `SECTION` を対象とし、各フレームを1ページ/ビューポートとして書き出す。再利用部品は、画面フレーム内に配置された**インスタンスを展開してspec/スクリーンショットに含める**（コード化の単一の真実はレンダリング結果）。ページ直下に裸で置かれたComponent/Component Set定義そのものは書き出し対象外で、書き出し時に `README.md` の除外物セクションへ記録する（4.7.2）。

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

##### 4.7.4.3 設定の保存先と Export タブの並び

設定値は `figma.root.setPluginData` にファイル単位で保存し、次回以降の既定値として出す。Export のたびに入力させない。ノードではなくドキュメントに持つのは、設定がファイル全体（サイト1つ）に対するもので、どのノードにも属さないため。

Export タブの並びは上から **設定 → 共通ルール → note 一覧（読み取り専用）→ 付け忘れの知らせ → Export ボタン**。4.7.4.1 の依頼書の並び（全体 → 個別 → 手渡し）をそのまま画面にする。note 一覧を読み取り専用でここに置くのは、Export が「今から何を渡すか」を確かめる場所だから。編集は Notes タブが持つ（4.7.3）。付け忘れの知らせ（4.7.2）を直前に置くのは、渡す中身を見た流れで「直してから渡すか、このまま渡すか」を決められるようにするため。**知らせは Export をブロックしない** — error ではないので、押せば書き出される。

**Export タブの note 一覧は、走査範囲を書き出し対象フレーム配下に限る。** Notes タブの一覧（ページ全体・編集用。4.7.3）とはここだけが違う。ページ全体にすると、`spec.json` に載らない note ― 書き出し対象外のレイヤーに付いたもの ― まで「これから渡すもの」として並び、4.7.2 の除外物告知が塞いだ黙殺を UI 側で作り直すことになる（原則B「欠けていると分かる」）。2つの一覧は示す事実が別（書いた全部 / 渡る分）なので重複ではない。二重実装にならないよう、行の組み立ては**走査範囲を引数に取る1つの関数**にし、両者が同じコードを通る形にする。

##### 4.7.4.4 ダーク対応ファイルの書き出し手順

ダークモード対応が ON のファイルでは、スクリーンショットを light と dark の2組書き出す。手順は **light にする** → light 撮影 → Dark へ付け替え → dark 撮影 → light に戻す（付け替えの仕組みは 4.3.9）。dark 側は `screenshots-dark/` に、light 側と同じファイル名で並べる（4.5）。同じ名前にしておくと、`spec.json` の `screenshot` から dark 側のパスが先頭フォルダの差し替えだけで導ける。

**先頭の「light にする」は、押した時点が dark 表示だった場合に備える。** 無ければ light 組が dark のまま撮られる。既に light なら何も起きない。Export はどうせ手順の中でライト⇄ダークを行き来するので、先頭で戻すのは同じ動作の延長であり、デザイナーに手間を課す理由がない。error にしてゲートで止めないのは、直すべき違反ではなく単なる状態だから — 「起動時に dark のまま残っている」を error にしなかったのと同じ理由（4.7.2）。書き出し後も light のまま残し、押す前のダーク表示には戻さない。手順の終わりが必ず light であることは、下の失敗時の扱いと揃う。

**アセットもダーク用を書き出す。** SVG アイコンは色が焼き込まれるため、ライト1組だけでは黒背景に黒アイコンが載る。色を抜いて CSS に塗らせる案は telldes がデザイナーの描いた色を捨てる変換であり（4.3.4 の基本姿勢に反する）、多色ロゴには使えない。出力先は `screenshots-dark/` と揃えて `assets-dark/`（`images/` `icons/` の内訳は `assets/` と同じ。4.5）。ただし **light と dark で見た目が実際に変わるアセットだけ2枚目を出す**。全アセットを機械的に倍にすると、色を持たない線画まで同一ファイルが2つ並び、CC が「別物が2つある」と誤読する余地を作る。

**撮影や付け替えが途中で失敗しても、必ず light に戻す。** 戻さないとファイルが dark のまま残り、デザイナーは自分が触っていない変更を見ることになる。それでも中断で残る場合（プラグインの強制終了など）に備えて、起動時の復旧の促しを置く（4.7.2）。

#### 4.7.5 プラグインAPI使用箇所

| 機能 | API |
|---|---|
| ノード走査 | `figma.currentPage`, `node.children` 再帰 |
| Auto Layoutプロパティ取得 | `node.layoutMode`, `node.itemSpacing`, `node.paddingTop` 等 |
| note読み書き | `node.setPluginData('note', value)`, `node.getPluginData('note')` |
| 再起動ボタン | `node.setRelaunchData({ editNote: '' })` |
| note一覧の更新 | `figma.on('currentpagechange')`（ページ切り替え時。4.7.3） |
| Variable取得 | `node.boundVariables`, `figma.variables.getLocalVariables()` |
| トークン一式の生成（Setup） | `figma.variables.createVariableCollection()`, `variable.setValueForMode()`, `variable.scopes`（書体は `["FONT_FAMILY"]`。4.3.4。Dark は `[]`。4.3.9） |
| テーマの付け替え | `node.setBoundVariable()`, `figma.variables.setBoundVariableForPaint()`, `figma.variables.setBoundVariableForEffect()`（戻り値で Paint / Effect の配列を作り直して再代入する。4.3.9） |
| 付け替え対象のスタイル列挙 | `figma.getLocalPaintStylesAsync()`, `figma.getLocalEffectStylesAsync()`（4.3.9 の対象(2)） |
| Export設定の保存 | `figma.root.setPluginData()` / `getPluginData()`（4.7.4.3） |
| スクリーンショット | `node.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: 2 } })` |
| favicon / OG画像 | `node.exportAsync` に実寸指定（`constraint: { type: 'WIDTH', value: 180 \| 1200 }`）。4.5.3 |
| ベクターアセット | `node.exportAsync({ format: 'SVG' })`（`SVG_STRING` は不可 — 文字列をバイト列に戻す `TextEncoder` がプラグインサンドボックスに無い） |

#### 4.7.6 配布

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
| 共有ライブラリ不可 | ファイル間でVariables/Styleを共有できない（publishが有料プラン専用） | 1ファイル内で完結。トークン一式は Setup タブがファイルごとに生成する（4.3.4） |
| アノテーション不可 | 標準UIで補足情報を付けられない | プラグインのnote入力UIで代替 |
| プライベートプラグイン不可 | 組織内限定配布不可 | Figma Communityに公開 |

**Free で成立するのは実質 Drafts 運用のとき。** Starter プランのページ数制限はチームのファイルにかかり、Drafts のファイルにはかからない。ページ分割でファイル数の上限を回避し（上表）、さらに画面でないものを別ページへ逃がす（4.7.4）と、チームのファイルでは3ページで足りなくなる。Drafts なら両方が成り立つ。代償は共同編集ができないこと — 1. 状況のとおりデザイナーは自分ひとりなので、この前提では問題にならない。
