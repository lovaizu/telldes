Rn version: 0.8.0
Design: docs/design.md

# Goal

設計書（`docs/design.md`）の目的を満たす Telldes プラグインを、ゼロから作る。目的は、Figma で作った LP / HP のデザインを、Claude Code（CC）がカンプと同じ見た目のコードにできる zip として渡すこと。

作り方は、土台（最新のビルド設定・Solid v2）を作り、作り込む前に画面だけを試して固めてから、デザイナーが使う順（Setup → Review → note → Export → Light / Dark）に機能を1つずつ完成させ、そのつど実機で試す。一通り動いたらテストを入れ、README を書き直し、通し試験をする。

# Acceptance criteria

目的に合っているか

- 作った見本とユーザーの LP のそれぞれで Setup → デザイン → Review → note → Export した zip を CC に渡すと、CC が作ったページのスクリーンショットが、Export に入ったカンプの画像と、色・大きさ・間隔・文字・並びで一致する（ダーク対応 ON の見本では Light と Dark の両方）
- Setup: 押すと Light・Dark・Base の3つのコレクションに、README の推奨一式（変数・Text Style・Effect Style）が、使える欄の絞り込みと CSS 変数名つきでそろう。2回押しても増えない。Setup を使わずに作ったファイルも読めて正しく出る
- Review: 直さないと出力が壊れるものだけを error にし、error が残る間は Export できない。機械的に分かる指定し忘れは止めずに知らせる。同じ原因は1行にまとまる。見る範囲は Export が書き出す範囲と同じ。プラグインを開いたときと Export の前に自動で走り、error の件数が常に見える。項目を押すと該当レイヤーが選ばれる
- note: レイヤーごとに書いて保存でき、プロパティパネルから開ける。書いた note は Export の出力に載り、画面の外のレイヤーの note は「含まれなかったもの」に記録される
- Export: Export 設定（切り替える幅・コンテンツ幅・ダーク対応の有無・ページの題名・共通ルール）を受け、zip に `prompt.md`・`tokens.json`・画面ごとの `spec.json`・画像・アセット・`README.md` が入る。落としたものは `README.md` に必ず書かれる
- Light / Dark: `Light | Dark` の1つの切り替えで、ページ全体の変数のつながりが付け替わり、今どちらかが常に見える。Export が途中で失敗しても Light に戻る。Dark のまま残ったファイルを開くと、戻すよう促される
- 画面は OOUI で組まれている: トークン・画面・レイヤーが並び、違反・知らせ・note はその持ち主の行に出る。画面の一覧には渡らないものも並ぶ。上部には Light / Dark、Review の error・知らせの件数と Review し直す操作、Export があり、Setup はトークンの一覧にある。プラグインの画面の文言は英語にそろっている

品質

- Figma 無償版の Drafts で動き、有料の機能を使わない
- 判断（出力の中身・Review・付け替えの判断）は Figma に触らない部分にあり、Figma なしで動く。Review と Export は一度読んだ同じデータから作られる
- テストは、見本ファイルから読み取った入力を判断の部分に与え、結果を正解と丸ごと比べる。正解は `prompt.md` と見本にわざと入れたものの一覧に照らして作られている
- README が新しい画面と流れのとおりに書かれ、設計書と食い違わない
- 検証用の一時コード・一時ファイルがリポジトリに残っていない

# Assumptions

- 事実: リポジトリには README・設計書・LICENSE・.gitignore しかなく、捨てる古いコードは無い
- 事実: 2026-09-25 時点で Solid v2 は正式版が出ておらず、最新は `solid-js@2.0.0-rc.9`（`next`）。これを使う。正式版が出たら上げる
- 事実: 最新は Vite 8・TypeScript 7・vitest 5・`@figma/plugin-typings` 1.139。ビルドとテストは bun で回す
- 未検証: 実機での操作（プラグインを読み込む・ボタンを押す・画面を見る）はユーザーに頼む。こちらは手順と見るところを短く渡し、書き出された zip やログは自分で確かめる
- 事実: Figma の MCP でファイルに書き込む機能は有料プランの Dev / Full シート限定で、Starter では使えない
- 見本は2種類使う。1つは「作った見本」で、Telldes に一時的に組み込んだボタンから Plugin API で作る（Plugin API は無償版でも使える）。わざと入れたものの一覧と対応させてテストに使う。もう1つは「ユーザーの LP」で、ユーザーが普段どおりに作った LP 1枚（Community の LP を Drafts に複製したものでもよい）。こちらが想定していない作り方で出力が外れないかを確かめるため、通し試験に使う
- 作った見本の見た目はこちらでは見られない。見た目はユーザーに確かめてもらい、こちらは書き出された zip と画像で確かめる
- 未検証: 設計書の決定は、Figma 無償版の API で実現できる（コレクション数に上限が無い、変数のつながりをページ全体で付け替えられる、など）。できないと分かったら、その決定を目的から決め直して設計書を直す

# Rules

- commit and push every change; one completion marker per task
- 設計書に無い作り方は、目的（CC がカンプと一致するコードを書ける正確な出力）と設計書の原則から自分で決める。README・実装から読めない理由だけを設計書に書き、報告で伝える。ユーザーに聞くのは目的・意図が不明なときだけ
- 機能はボタンと同じ名前（Setup / Review / Export / Light・Dark）で呼ぶ
- 各機能は、#2 の画面の仮の値を本物に差し替え、読み取り・判断・書き込みまで作り切り、実機で試してから次へ進む。画面の形は #3 で承認されたものを保つ
- テストは #10 まで書かない
- 実機で確かめるためのコードは Telldes に一時的に組み込み、コミットしない。済んだら外してビルドし直す。大文字小文字だけが違うファイル名は付けない
- レビューの指摘は、目的に効くものだけ直す
- タスクごとの承認では止まらない。ユーザーの判断が要るのは目的・意図に関わるときだけ

# Tasks

### #1: 土台

**Purpose**: 最新のビルド設定と Solid v2 で、Figma に読み込め、ファイルを読んだデータを画面に渡せる土台を作る。

**Prerequisites**: none

**Steps**:

- [x] `package.json`・`tsconfig.json`・`manifest.json`・Vite 設定を作る（画面は1つの HTML、Figma 側は1つの JS に）
- [x] Figma からファイルを読み、JSON にできるデータにまとめる窓口を作る（Review・Export もこれを使う）
- [x] 画面と Figma 側のやり取りの型を作り、読んだデータを画面に渡す
- [x] `bun run build` し、ユーザーに読み込んで開いてもらう
- [x] self-check (OK/NG per completion criterion, record in checks/1.md)
- [x] QA expert review (subagent)
- [x] Craft expert review (subagent, per the task's medium)
- [x] Verification expert review (subagent, per the task's medium)
- [x] Design expert review (subagent)

**Completion criteria**:

- `bun install && bun run build` だけで `dist/` ができ、Figma デスクトップの Drafts で manifest から読み込むと画面が開く
- 実機で、開いたファイルのトークン・画面・レイヤーが読まれ、画面側に届いている（件数などで確かめられる）
- 依存は `solid-js` の v2 系と、Vite・TypeScript などその時点の最新版で、型検査が通る
- Figma 側のコードが、画面の描画や判断を持っていない（読み取りと書き込みの窓口だけ）

### #2: 画面の試作

**Purpose**: 機能を作り込む前に、Setup から Light / Dark までのすべてを載せた画面を、仮の結果で触って試せるようにする。

**Prerequisites**: #1

**Steps**:

- [x] OOUI の手順で画面を設計する: オブジェクト（ファイル・トークン・画面・レイヤー）とその属性・関係を取り出し、Setup から Light / Dark までのすべての機能を、どのオブジェクトの属性・操作になるかに割り当てる → 一覧と詳細のビューを決める → レイアウトを決める
- [x] トークン・画面・レイヤーの一覧と詳細を、#1 で読んだ実物のデータで出す
- [x] まだ作っていない機能の結果（Setup で作るもの、違反と知らせ、note、Export 設定、渡らないもの、テーマ）は仮の値で載せ、操作は押せるが Figma に書き込まない。仮の値はこのあとの各機能で本物に差し替える
- [ ] ユーザーに Figma で触ってもらい、分かりにくいところを直す
  - 1回目の感想（2026-09-25）への直し: 画面の文言を英語にそろえる（README・設計書は日本語のまま）、見た目を Figma 本体に合わせ説明と仮の印を減らす、Export を上部へ移す、上部の error の件数を押すと error のある行だけに絞る。2回目: Light / Dark をファイル名の隣へ（ラベル無し）、上部の右は件数・⟳・Export だけにし Setup はトークンの一覧へ
- [x] self-check (OK/NG per completion criterion, record in checks/2.md)
- [x] QA expert review (subagent)
- [x] Craft expert review (subagent, per the task's medium)
- [x] Verification expert review (subagent, per the task's medium)
- [x] Design expert review (subagent)

**Completion criteria**:

- Figma の中で、Setup・Review・note・Export（設定を含む）・Light / Dark のすべての操作を画面で試せ、それぞれの結果がどこに出るかが見える
- 画面は機能ごとの区画（Review の欄、note の欄など）を持たず、オブジェクトの一覧と詳細でできている。違反・知らせ・note は持ち主の行と詳細に出る
- 操作しても Figma のファイルが変わらない。仮の値は仮と分かる形でコードにまとまっていて、各機能のタスクで差し替える場所が決まっている
- 実物のデータのトークン・画面・レイヤーが一覧に並び、レイヤーを選ぶと Figma でもそのレイヤーが選ばれる

### #3: 画面の承認

**Purpose**: 試作した画面をユーザーに承認してもらい、作り込みの前に形を固める。

**Prerequisites**: #2

**Steps**:

- [ ] 試作した画面を示し、`/rn:ty`（承認）か `/rn:gm`（直し → 直して再提示）を受ける

**Completion criteria**:

- 試作した画面がユーザーに承認されている

### #4: Setup

**Purpose**: Setup を押すと、推奨の変数・スタイル一式のうち足りないものだけが作られるようにする。

**Prerequisites**: #3

**Steps**:

- [ ] あるべき一式と今あるものの差を出す判断を作る
- [ ] 差を Figma に書き込む窓口を作る（Light・Dark・Base の3コレクション、使える欄の絞り込み、CSS 変数名）
- [ ] トークンの一覧に Setup を置き、作ったものがその一覧に出るようにする
- [ ] 空のファイルと、一部を手で作ったファイルで、実機で2回ずつ押して確かめる
- [ ] self-check (OK/NG per completion criterion, record in checks/4.md)
- [ ] QA expert review (subagent)
- [ ] Craft expert review (subagent, per the task's medium)
- [ ] Verification expert review (subagent, per the task's medium)
- [ ] Design expert review (subagent)

**Completion criteria**:

- 空のファイルで押すと、README の推奨一式（色 Light・Dark 各14、余白、角丸、書体、Text Style 9、Effect Style 2）がそろい、各変数に使える欄と CSS 変数名が付いている
- 2回目に押しても、変数・スタイル・コレクションが増えない。手で作った同名のものは、値を上書きされず残る
- 作ったものはトークンの一覧に出る。何も作らなかったときは、そうと分かる

### #5: Review

**Purpose**: ページを一度読んだデータから違反と知らせを出し、持ち主の行に並べ、error が残る間は Export できないようにする。

**Prerequisites**: #4

**Steps**:

- [ ] 作った見本（ライトのみ、ダーク対応 ON）を一時ボタンで作る。違反・知らせ・書き出せないものをわざと入れ、その一覧を残す
- [ ] 書き出す範囲の判定と、Review の判断（error・知らせ・同じ原因を1行に）を作る
- [ ] エラーのあるコンポーネントセット（とそのインスタンス）が1つあっても読み取り全体を失敗させず、読めなかった欄を「読めなかった」とデータに残す。見本にも1つ入れて実機で確かめる
- [ ] トークン・画面・レイヤーの行に違反と知らせを付けて出し、押すとレイヤーを選ぶ
- [ ] 開いたときに自動で走らせ、上部の Review に error の件数を出す
- [ ] 違反を入れたファイルで実機で確かめる
- [ ] self-check (OK/NG per completion criterion, record in checks/5.md)
- [ ] QA expert review (subagent)
- [ ] Craft expert review (subagent, per the task's medium)
- [ ] Verification expert review (subagent, per the task's medium)
- [ ] Design expert review (subagent)

**Completion criteria**:

- わざと入れた「出力が壊れる違反」がすべて error として、その持ち主の行に出る。直すと消える
- ライトだけのファイルで、変数につないでいない値は何も報告されない。ダーク対応 ON のファイルでだけ、変数につないでいない色が error になる
- 同じ原因の違反（同じ色の30か所など）が1行にまとまる
- 書き出さない範囲（画面の外・別ページ）にある違反は出ない
- 開いた直後から error の件数が上部に出て、項目を押すとそのレイヤーが選ばれる
- 違反と知らせは持ち主の行と詳細にだけ出て、Review だけの一覧は無い
- 読み取りは1回で、判断の部分は Figma の API を呼んでいない

### #6: note

**Purpose**: レイヤーごとの補足を書いて保存し、持ち主のレイヤーの行とプロパティパネルから開けるようにする。

**Prerequisites**: #5

**Steps**:

- [ ] note の保存・読み出しの窓口と、プロパティパネルから開く入口を作る
- [ ] note の保存先を、Community 公開でプラグイン id（今は仮の `telldes-dev`）が変わっても読めるものにする
- [ ] レイヤーの詳細で note を読み書きし、レイヤーの一覧の行で note の有無が分かるようにする
- [ ] 実機で書く・閉じて開き直す・プロパティパネルから開くを確かめる
- [ ] self-check (OK/NG per completion criterion, record in checks/6.md)
- [ ] QA expert review (subagent)
- [ ] Craft expert review (subagent, per the task's medium)
- [ ] Verification expert review (subagent, per the task's medium)

**Completion criteria**:

- 書いた note がファイルに保存され、プラグインを閉じて開き直しても出る
- note のあるレイヤーはプロパティパネルから note を開ける
- note は Review と同じ読み取りデータに入り、持ち主のレイヤーの行に出る
- 書きかけの内容が、黙って消えたり別のレイヤーに保存されたりしない

### #7: Export 設定と spec / tokens の書き出し

**Purpose**: Export 設定を受け、画面の一覧から zip を書き出し、`tokens.json`・画面ごとの `spec.json`・落としたものを記録した `README.md` を入れる。

**Prerequisites**: #6

**Steps**:

- [ ] Export 設定（切り替える幅・コンテンツ幅・ダーク対応・題名・共通ルール）を、#2 で割り当てたオブジェクトの属性として作り、保存する
- [ ] 読み取りデータから `spec.json`・`tokens.json`・`README.md` を作る判断を作る（設計書の出力の4つの約束を守る）
- [ ] 画面の一覧に Export を付け、Review を走らせて error ゼロのときだけ zip を書き出す
- [ ] Web ページの名前が空・重なりのとき zip のフォルダがぶつからないよう Review で知らせる。一番狭い画面の「切り替える幅」の入れ方を迷わない形にする
- [ ] 実機で書き出し、中身を読んで確かめる
- [ ] self-check (OK/NG per completion criterion, record in checks/7.md)
- [ ] QA expert review (subagent)
- [ ] Craft expert review (subagent, per the task's medium)
- [ ] Verification expert review (subagent, per the task's medium)
- [ ] Design expert review (subagent)

**Completion criteria**:

- 見本の画面の、色・大きさ・間隔・文字・並び・サイジング・note が `spec.json` に値として出て、変数につないだものはトークン名で出る
- 同じ種類のものは同じ形、同じ事実は1か所、指定されていないことは出ていない
- 書き出せなかったもの（Color Style、STRING / BOOLEAN の変数、画面の外の note など）が `README.md` にすべて書かれている
- error があると Export が押せない
- Export 設定がファイルに保存され、開き直しても残る

### #8: Export の画像・アセット・prompt

**Purpose**: zip に画面・セクション単位の画像、画像アセット、CSS で描けないものの画像、CC への作業指示を入れ、CC に渡せる形にする。

**Prerequisites**: #7

**Steps**:

- [ ] Figma に画像を書き出させる窓口を作る（スクリーンショット・ラスター・ベクター・CSS で描けないもの）
- [ ] `prompt.md` を作る（渡すものの読み方、実装の判断は利用者に確かめること）
- [ ] 実機で書き出し、zip を CC に渡して読み方が伝わるかを1画面で試す
- [ ] self-check (OK/NG per completion criterion, record in checks/8.md)
- [ ] QA expert review (subagent)
- [ ] Craft expert review (subagent, per the task's medium)
- [ ] Verification expert review (subagent, per the task's medium)

**Completion criteria**:

- 画面ごとに画像がそろい、画像を含むノードは写真が PNG、アイコン・ロゴが SVG として入り、`spec.json` から参照できる
- CSS で同じに描けないものは Figma が描いた画像で入り、それもできないものは `README.md` に書かれている
- `prompt.md` だけを手がかりに、CC が zip の読み方を迷わず1画面を組める
- 画像の書き出しに失敗したとき、黙って欠けた zip を出さない

### #9: Light / Dark

**Purpose**: `Light | Dark` の切り替えで変数のつながりを付け替え、ダーク対応 ON のとき Export に両方のテーマを入れる。

**Prerequisites**: #8

**Steps**:

- [ ] ページ全体のつながりを Light と Dark の間で付け替える判断と書き込みを作る
- [ ] 上部の `Light | Dark` で状態を見せ、切り替える
- [ ] ダーク対応 ON の Export で Dark の画像も書き出し、終わったら（失敗しても）Light に戻す
- [ ] Dark のまま開いたとき戻すよう促す
- [ ] 実機で切り替え・Export・途中で失敗させる・Dark のまま閉じて開くを確かめる
- [ ] self-check (OK/NG per completion criterion, record in checks/9.md)
- [ ] QA expert review (subagent)
- [ ] Craft expert review (subagent, per the task's medium)
- [ ] Verification expert review (subagent, per the task's medium)
- [ ] Design expert review (subagent)

**Completion criteria**:

- 切り替えると、Light につないだすべてのレイヤーが Dark の同名の変数につながり、戻すと元どおりになる（取りこぼしも、つながりの消失も無い）
- 今のテーマが上部に常に出ている
- ダーク対応 ON の zip に両テーマの画像が入り、Export 後のファイルは Light
- Export を途中で失敗させても Light に戻り、Dark で残ったファイルを開くと戻すよう促される

### #10: テスト

**Purpose**: 作った見本から読み取った入力で、判断の部分を正解と丸ごと比べるテストを入れる。

**Prerequisites**: #9

**Steps**:

- [ ] 作った見本にわざと入れたもの（違反・知らせ・書き出せないもの・テーマ）の一覧を、ここまでの実装に合わせて仕上げる
- [ ] 作った見本から読み取りデータを取り出し、テストの入力にする
- [ ] Setup・Review・Export・Light / Dark の判断の結果を、`prompt.md` と一覧に照らした正解と丸ごと比べる
- [ ] self-check (OK/NG per completion criterion, record in checks/10.md)
- [ ] QA expert review (subagent)
- [ ] Craft expert review (subagent, per the task's medium)
- [ ] Verification expert review (subagent, per the task's medium)

**Completion criteria**:

- `bun run test` が通り、判断の部分を Figma なしで確かめている
- 入力は Figma で作った見本から読み取ったもので、手で作った入力は無い
- 正解は今の出力を写したものではなく、見本にわざと入れたものが1つずつ正解に現れている
- 判断の部分をわざと1か所壊すと、テストが落ちる

### #11: README の書き直し

**Purpose**: README を、新しい画面と流れでデザイナーが迷わず使える内容にする。

**Prerequisites**: #10

**Steps**:

- [ ] 画面（上部の操作、トークン・画面・レイヤーの並び）、Setup・Export 設定・Light / Dark、zip の中身に合わせて書き直す
- [ ] README と設計書の言葉を画面の言葉にそろえる（画面に出る「Frame」を、文書で「画面」と呼んでいるところなど）
- [ ] 古い記述（3つのタブ、存在しない steering へのリンク、「幅違いはフレーム名で表す」など）を消し、Web ページの組み分けは Export 設定で宣言すると書く
- [ ] self-check (OK/NG per completion criterion, record in checks/11.md)
- [ ] QA expert review (subagent)
- [ ] Craft expert review (subagent, per the task's medium)
- [ ] Verification expert review (subagent, per the task's medium)

**Completion criteria**:

- README の手順どおりに、初めての人がインストールから Export まで進められる
- README に書かれた画面・ボタン・出力が、実物と一致する。設計書と食い違う記述が無い
- 設計の理由は README に書かず、設計書を指している

### #12: 通し試験

**Purpose**: 作った見本とユーザーの LP を最初から最後まで通し、CC が作ったページがカンプと一致することを確かめる。

**Prerequisites**: #11

**Steps**:

- [ ] 作った見本（ライトのみと、ダーク対応 ON）とユーザーの LP で、Setup → Review → note → Export を実機で通す
- [ ] zip を新しい CC に渡してページを作らせ、スクリーンショットを Export の画像と比べる
- [ ] 食い違いがあれば原因を特定して直し、やり直す
- [ ] 一時コード・一時ファイルが残っていないことを確かめる
- [ ] self-check (OK/NG per completion criterion, record in checks/12.md)
- [ ] QA expert review (subagent)
- [ ] Verification expert review (subagent, per the task's medium)

**Completion criteria**:

- 作った見本とユーザーの LP のどちらでも、CC が作ったページが、Export の画像と色・大きさ・間隔・文字・並びで一致する（ダーク対応 ON の見本では Light と Dark の両方）
- 食い違いが残る場合、その原因が「含まれなかったもの」として zip の `README.md` に書かれている
- 通しの途中で、プラグインがエラーで止まったり、ファイルが Dark のまま残ったりしない

### #13: Evaluation sign-off

**Purpose**: Acceptance criteria の通し結果をユーザーに見せ、承認を得る。

**Prerequisites**: #12

**Steps**:

- [ ] Acceptance criteria の通し結果を示し、`/rn:ty`（承認）か `/rn:gm`（直し）を受ける

**Completion criteria**:

- Acceptance criteria の通し結果がユーザーに承認されている

# State

(written by /rn:dn, read and reset to this placeholder by /rn:up. `Status` is `paused` while a
session is suspended — the signal /rn:up and /rn:dn search for — and resets to `not suspended` here,
so only a genuinely suspended session reads `paused`.)

- **Status**: not suspended
- **Date**: YYYY-MM-DD
- **Last completed**: #N description
- **Next**: #N description
- **Notes**: bounded forward pointer — branch/PR, next concrete action, open blockers, user-deferred paths, open questions / pending decisions not yet captured in `design.md`; not a re-narration of the session (that lives in `git log`)
