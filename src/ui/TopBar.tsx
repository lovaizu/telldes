// Operations on the whole file: they have no object to pick, so they sit on top.
import { ariaBool, RowMarks, Tentative } from "./parts";
import { useWorkspace } from "./workspace";

export function TopBar() {
  const ws = useWorkspace();
  return (
    <header class="topbar">
      <button class="file-button" aria-current={ws.isOpen({ kind: "file" }) && "true"} onClick={() => ws.open({ kind: "file" })}>
        <span class="file-name">
          {ws.file.fileName}
          <RowMarks findings={ws.findingsOf({ kind: "file" })} />
        </span>
        <span class="page-name" title="Figma のページ">
          {ws.file.page.name}
        </span>
      </button>
      <span class="spacer" />
      <button onClick={() => ws.runSetup()}>Setup</button>
      <button onClick={() => ws.runReview()}>
        Review
        <span class={["pill", { error: ws.errorCount() > 0 }]}>error {ws.errorCount()}</span>
        <span class="pill">知らせ {ws.noticeCount()}</span>
      </button>
      <Tentative task="review" />
      <div class="segmented" role="group" aria-label="テーマ">
        <button aria-pressed={ariaBool(ws.state.theme === "light")} onClick={() => ws.setTheme("light")}>
          Light
        </button>
        {/* aria-disabled, not disabled: the button stays hoverable and clickable, so the reason can be shown. */}
        <button
          aria-pressed={ariaBool(ws.state.theme === "dark")}
          aria-disabled={ariaBool(!ws.state.settings.file.darkSupport)}
          title={ws.state.settings.file.darkSupport ? undefined : "ダーク対応が OFF なので Dark はありません"}
          onClick={() => ws.setTheme("dark")}
        >
          Dark
        </button>
      </div>
      <Tentative task="theme" />
    </header>
  );
}
