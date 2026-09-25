Rn version: 0.8.0
Design: docs/design.md

# Goal

設計書（`docs/design.md`）の目的を満たす Telldes プラグインを、ゼロから作る。目的は、Figma で作った LP / HP のデザインを、Claude Code（CC）がカンプと同じ見た目のコードにできる zip として渡すこと。

作り方は、土台（最新のビルド設定・Solid v2）を作ってから、デザイナーが使う順（Setup → Review → note → Export → Light / Dark）に機能を1つずつ完成させ、そのつど実機で試す。一通り動いたらテストを入れ、README を書き直し、通し試験をする。

# Acceptance criteria

目的に合っているか

- 見本の Figma ファイルで Setup → デザイン → Review → note → Export した zip を CC に渡すと、CC が作ったページのスクリーンショットが、Export に入ったカンプの画像と、色・大きさ・間隔・文字・並びで一致する（ダーク対応 ON の見本では Light と Dark の両方）
- Setup: 押すと Light・Dark・Base の3つのコレクションに、README の推奨一式（変数・Text Style・Effect Style）が、使える欄の絞り込みと CSS 変数名つきでそろう。2回押しても増えない。Setup を使わずに作ったファイルも読めて正しく出る
- Review: 直さないと出力が壊れるものだけを error にし、error が残る間は Export できない。機械的に分かる指定し忘れは止めずに知らせる。同じ原因は1行にまとまる。見る範囲は Export が書き出す範囲と同じ。プラグインを開いたときと Export の前に自動で走り、error の件数が常に見える。項目を押すと該当レイヤーが選ばれる
- note: レイヤーごとに書いて保存でき、プロパティパネルから開ける。書いた note は Export の出力に載り、画面の外のレイヤーの note は「含まれなかったもの」に記録される
- Export: Export 設定（切り替える幅・コンテンツ幅・ダーク対応の有無・ページの題名・共通ルール）を受け、zip に `prompt.md`・`tokens.json`・画面ごとの `spec.json`・画像・アセット・`README.md` が入る。落としたものは `README.md` に必ず書かれる
- Light / Dark: `Light | Dark` の1つの切り替えで、ページ全体の変数のつながりが付け替わり、今どちらかが常に見える。Export が途中で失敗しても Light に戻る。Dark のまま残ったファイルを開くと、戻すよう促される
- 画面は OOUI で組まれている: トークン・画面・レイヤーが並び、違反・知らせ・note はその持ち主の行に出る。画面の一覧には渡らないものも並ぶ。Export は画面の一覧に、Review・Light / Dark・Setup は上部にある

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
- 未検証: 見本の Figma ファイルは Figma の MCP（`use_figma`）で作れる。作れなければユーザーに頼む
- 未検証: 設計書の決定は、Figma 無償版の API で実現できる（コレクション数に上限が無い、変数のつながりをページ全体で付け替えられる、など）。できないと分かったら、その決定を目的から決め直して設計書を直す

# Rules

- commit and push every change; one completion marker per task
- 設計書に無い作り方は、目的（CC がカンプと一致するコードを書ける正確な出力）と設計書の原則から自分で決める。README・実装から読めない理由だけを設計書に書き、報告で伝える。ユーザーに聞くのは目的・意図が不明なときだけ
- 機能はボタンと同じ名前（Setup / Review / Export / Light・Dark）で呼ぶ
- 各機能は、読み取り・判断・書き込み・画面まで作り切り、実機で試してから次へ進む
- テストは #8 まで書かない
- 実機で確かめるためのコードは Telldes に一時的に組み込み、コミットしない。済んだら外してビルドし直す。大文字小文字だけが違うファイル名は付けない
- レビューの指摘は、目的に効くものだけ直す
- タスクごとの承認では止まらない。ユーザーの判断が要るのは目的・意図に関わるときだけ

# Tasks

### #1: 土台

**Purpose**: 最新のビルド設定と Solid v2 で、Figma に読み込めて、画面と Figma 側がやり取りできる空のプラグインを作る。

**Prerequisites**: none

**Steps**:

- [ ] `package.json`・`tsconfig.json`・`manifest.json`・Vite 設定を作る（画面は1つの HTML、Figma 側は1つの JS に）
- [ ] 画面の骨組み（上部に Setup・Review・`Light | Dark`、下にトークン・画面・レイヤーの並び）と、画面と Figma 側のやり取りの型を作る
- [ ] `bun run build` し、ユーザーに読み込んで開いてもらう
- [ ] self-check (OK/NG per completion criterion, record in checks/1.md)
- [ ] QA expert review (subagent)
- [ ] Craft expert review (subagent, per the task's medium)
- [ ] Verification expert review (subagent, per the task's medium)
- [ ] Design expert review (subagent)

**Completion criteria**:

- `bun install && bun run build` だけで `dist/` ができ、Figma デスクトップの Drafts で manifest から読み込むと画面が開く
- 画面から Figma 側へ送った要求に Figma 側が答え、その結果が画面に出る（実機で確認）
- 依存は `solid-js` の v2 系と、Vite・TypeScript などその時点の最新版で、型検査が通る
- Figma 側のコードが、画面の描画や判断を持っていない（読み取りと書き込みの窓口だけ）

### #2: Setup

**Purpose**: Setup を押すと、推奨の変数・スタイル一式のうち足りないものだけが作られるようにする。

**Prerequisites**: #1

**Steps**:

- [ ] あるべき一式と今あるものの差を出す判断を作る
- [ ] 差を Figma に書き込む窓口を作る（Light・Dark・Base の3コレクション、使える欄の絞り込み、CSS 変数名）
- [ ] 上部の Setup ボタンからつなぐ
- [ ] 空のファイルと、一部を手で作ったファイルで、実機で2回ずつ押して確かめる
- [ ] self-check (OK/NG per completion criterion, record in checks/2.md)
- [ ] QA expert review (subagent)
- [ ] Craft expert review (subagent, per the task's medium)
- [ ] Verification expert review (subagent, per the task's medium)
- [ ] Design expert review (subagent)

**Completion criteria**:

- 空のファイルで押すと、README の推奨一式（色 Light・Dark 各14、余白、角丸、書体、Text Style 9、Effect Style 2）がそろい、各変数に使える欄と CSS 変数名が付いている
- 2回目に押しても、変数・スタイル・コレクションが増えない。手で作った同名のものは、値を上書きされず残る
- 何を作ったか（または何も作らなかったか）が画面に出る

### #3: Review

**Purpose**: ページを一度読んだデータから違反と知らせを出し、持ち主の行に並べ、error が残る間は Export できないようにする。

**Prerequisites**: #2

**Steps**:

- [ ] Figma からページを読み、JSON にできるデータにまとめる窓口を作る（Export もこれを使う）
- [ ] 書き出す範囲の判定と、Review の判断（error・知らせ・同じ原因を1行に）を作る
- [ ] トークン・画面・レイヤーの行に違反と知らせを付けて出し、押すとレイヤーを選ぶ
- [ ] 開いたときに自動で走らせ、上部に error の件数を出す
- [ ] 違反を入れたファイルで実機で確かめる
- [ ] self-check (OK/NG per completion criterion, record in checks/3.md)
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
- 読み取りは1回で、判断の部分は Figma の API を呼んでいない

### #4: note

**Purpose**: レイヤーごとの補足を書いて保存し、持ち主のレイヤーの行とプロパティパネルから開けるようにする。

**Prerequisites**: #3

**Steps**:

- [ ] note の保存・読み出しの窓口と、プロパティパネルから開く入口を作る
- [ ] レイヤーの行で note を読み書きできるようにする
- [ ] 実機で書く・閉じて開き直す・プロパティパネルから開くを確かめる
- [ ] self-check (OK/NG per completion criterion, record in checks/4.md)
- [ ] QA expert review (subagent)
- [ ] Craft expert review (subagent, per the task's medium)
- [ ] Verification expert review (subagent, per the task's medium)

**Completion criteria**:

- 書いた note がファイルに保存され、プラグインを閉じて開き直しても出る
- note のあるレイヤーはプロパティパネルから note を開ける
- note は Review と同じ読み取りデータに入り、持ち主のレイヤーの行に出る
- 書きかけの内容が、黙って消えたり別のレイヤーに保存されたりしない

### #5: Export 設定と spec / tokens の書き出し

**Purpose**: Export 設定を受け、画面の一覧から zip を書き出し、`tokens.json`・画面ごとの `spec.json`・落としたものを記録した `README.md` を入れる。

**Prerequisites**: #4

**Steps**:

- [ ] Export 設定の入力欄（切り替える幅・コンテンツ幅・ダーク対応・題名・共通ルール）と保存を作る
- [ ] 読み取りデータから `spec.json`・`tokens.json`・`README.md` を作る判断を作る（設計書の出力の4つの約束を守る）
- [ ] 画面の一覧に Export を付け、Review を走らせて error ゼロのときだけ zip を書き出す
- [ ] 実機で書き出し、中身を読んで確かめる
- [ ] self-check (OK/NG per completion criterion, record in checks/5.md)
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

### #6: Export の画像・アセット・prompt

**Purpose**: zip に画面・セクション単位の画像、画像アセット、CSS で描けないものの画像、CC への作業指示を入れ、CC に渡せる形にする。

**Prerequisites**: #5

**Steps**:

- [ ] Figma に画像を書き出させる窓口を作る（スクリーンショット・ラスター・ベクター・CSS で描けないもの）
- [ ] `prompt.md` を作る（渡すものの読み方、実装の判断は利用者に確かめること）
- [ ] 実機で書き出し、zip を CC に渡して読み方が伝わるかを1画面で試す
- [ ] self-check (OK/NG per completion criterion, record in checks/6.md)
- [ ] QA expert review (subagent)
- [ ] Craft expert review (subagent, per the task's medium)
- [ ] Verification expert review (subagent, per the task's medium)

**Completion criteria**:

- 画面ごとに画像がそろい、画像を含むノードは写真が PNG、アイコン・ロゴが SVG として入り、`spec.json` から参照できる
- CSS で同じに描けないものは Figma が描いた画像で入り、それもできないものは `README.md` に書かれている
- `prompt.md` だけを手がかりに、CC が zip の読み方を迷わず1画面を組める
- 画像の書き出しに失敗したとき、黙って欠けた zip を出さない

### #7: Light / Dark

**Purpose**: `Light | Dark` の切り替えで変数のつながりを付け替え、ダーク対応 ON のとき Export に両方のテーマを入れる。

**Prerequisites**: #6

**Steps**:

- [ ] ページ全体のつながりを Light と Dark の間で付け替える判断と書き込みを作る
- [ ] 上部の `Light | Dark` で状態を見せ、切り替える
- [ ] ダーク対応 ON の Export で Dark の画像も書き出し、終わったら（失敗しても）Light に戻す
- [ ] Dark のまま開いたとき戻すよう促す
- [ ] 実機で切り替え・Export・途中で失敗させる・Dark のまま閉じて開くを確かめる
- [ ] self-check (OK/NG per completion criterion, record in checks/7.md)
- [ ] QA expert review (subagent)
- [ ] Craft expert review (subagent, per the task's medium)
- [ ] Verification expert review (subagent, per the task's medium)
- [ ] Design expert review (subagent)

**Completion criteria**:

- 切り替えると、Light につないだすべてのレイヤーが Dark の同名の変数につながり、戻すと元どおりになる（取りこぼしも、つながりの消失も無い）
- 今のテーマが上部に常に出ている
- ダーク対応 ON の zip に両テーマの画像が入り、Export 後のファイルは Light
- Export を途中で失敗させても Light に戻り、Dark で残ったファイルを開くと戻すよう促される

### #8: テスト

**Purpose**: 見本ファイルから読み取った入力で、判断の部分を正解と丸ごと比べるテストを入れる。

**Prerequisites**: #7

**Steps**:

- [ ] 見本にわざと入れたもの（違反・知らせ・書き出せないもの・テーマ）の一覧を作る
- [ ] 見本ファイルから読み取りデータを取り出し、テストの入力にする
- [ ] Setup・Review・Export・Light / Dark の判断の結果を、`prompt.md` と一覧に照らした正解と丸ごと比べる
- [ ] self-check (OK/NG per completion criterion, record in checks/8.md)
- [ ] QA expert review (subagent)
- [ ] Craft expert review (subagent, per the task's medium)
- [ ] Verification expert review (subagent, per the task's medium)

**Completion criteria**:

- `bun run test` が通り、判断の部分を Figma なしで確かめている
- 入力は実物の見本ファイルから取ったもので、手で作った入力は無い
- 正解は今の出力を写したものではなく、見本にわざと入れたものが1つずつ正解に現れている
- 判断の部分をわざと1か所壊すと、テストが落ちる

### #9: README の書き直し

**Purpose**: README を、新しい画面と流れでデザイナーが迷わず使える内容にする。

**Prerequisites**: #8

**Steps**:

- [ ] 画面（上部の操作、トークン・画面・レイヤーの並び）、Setup・Export 設定・Light / Dark、zip の中身に合わせて書き直す
- [ ] 古い記述（3つのタブ、存在しない steering へのリンクなど）を消す
- [ ] self-check (OK/NG per completion criterion, record in checks/9.md)
- [ ] QA expert review (subagent)
- [ ] Craft expert review (subagent, per the task's medium)
- [ ] Verification expert review (subagent, per the task's medium)

**Completion criteria**:

- README の手順どおりに、初めての人がインストールから Export まで進められる
- README に書かれた画面・ボタン・出力が、実物と一致する。設計書と食い違う記述が無い
- 設計の理由は README に書かず、設計書を指している

### #10: 通し試験

**Purpose**: 見本ファイルを最初から最後まで通し、CC が作ったページがカンプと一致することを確かめる。

**Prerequisites**: #9

**Steps**:

- [ ] 見本ファイル（ライトのみと、ダーク対応 ON）で Setup → Review → note → Export を実機で通す
- [ ] zip を新しい CC に渡してページを作らせ、スクリーンショットを Export の画像と比べる
- [ ] 食い違いがあれば原因を特定して直し、やり直す
- [ ] 一時コード・一時ファイルが残っていないことを確かめる
- [ ] self-check (OK/NG per completion criterion, record in checks/10.md)
- [ ] QA expert review (subagent)
- [ ] Verification expert review (subagent, per the task's medium)

**Completion criteria**:

- CC が作ったページが、Export の画像と色・大きさ・間隔・文字・並びで一致する（ダーク対応 ON の見本では Light と Dark の両方）
- 食い違いが残る場合、その原因が「含まれなかったもの」として zip の `README.md` に書かれている
- 通しの途中で、プラグインがエラーで止まったり、ファイルが Dark のまま残ったりしない

### #11: Evaluation sign-off

**Purpose**: Acceptance criteria の通し結果をユーザーに見せ、承認を得る。

**Prerequisites**: #10

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
