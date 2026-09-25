// Operations on the whole file: they have no object to pick, so they sit on top.
import { ariaBool, Tentative } from "./parts";
import { useWorkspace } from "./workspace";

export function TopBar() {
  const ws = useWorkspace();
  return (
    <header class="topbar">
      <button class="file-button" aria-current={ws.state.selected.kind === "file" && "true"} onClick={() => ws.open({ kind: "file" })}>
        <span class="file-name">{ws.file.fileName}</span>
        <span class="page-name">{ws.file.page.name}</span>
      </button>
      <span class="spacer" />
      <button onClick={() => ws.runSetup()}>Setup</button>
      <button onClick={() => ws.runReview()}>
        Review
        <span class={["pill", { error: ws.errorCount() > 0 }]}>error {ws.errorCount()}</span>
        <span class="pill">知らせ {ws.noticeCount()}</span>
      </button>
      <Tentative task={5} />
      <div class="segmented" role="group" aria-label="テーマ">
        <button aria-pressed={ariaBool(ws.state.theme === "light")} onClick={() => ws.setTheme("light")}>
          Light
        </button>
        <button aria-pressed={ariaBool(ws.state.theme === "dark")} onClick={() => ws.setTheme("dark")}>
          Dark
        </button>
      </div>
      <Tentative task={9} />
    </header>
  );
}
