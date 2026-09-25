// Operations on the whole file: they have no object to pick, so they sit on top.
// Export is here too, since it always writes every Web page of the file.
import type { Finding } from "../core/findings";
import { counted } from "./format";
import { ariaBool, placeholderTitle, RowMarks } from "./parts";
import { useWorkspace } from "./workspace";

export function TopBar() {
  const ws = useWorkspace();
  return (
    <header class="topbar">
      <button
        class="file-button"
        aria-current={ws.isOpen({ kind: "file" }) && "true"}
        title="File settings"
        onClick={() => ws.open({ kind: "file" })}
      >
        <span class="file-name">
          {ws.file.fileName}
          <RowMarks findings={ws.findingsOf({ kind: "file" })} />
        </span>
        <span class="page-name">{ws.file.page.name}</span>
      </button>
      <span class="spacer" />
      <button title="Add the recommended tokens this file is missing" onClick={() => ws.runSetup()}>
        Setup
      </button>
      <button title="Check the whole file" onClick={() => ws.runReview()}>
        Review
      </button>
      <FilterButton severity="error" count={ws.errorCount()} />
      <FilterButton severity="notice" count={ws.noticeCount()} />
      <button
        class="primary"
        disabled={ws.screens.length === 0}
        title="Export every Web page of this file. Review runs first, and errors stop it."
        onClick={() => ws.runExport()}
      >
        Export
      </button>
      <div class="segmented" role="group" aria-label="Theme" title={placeholderTitle("theme")}>
        <button aria-pressed={ariaBool(ws.state.theme === "light")} onClick={() => ws.setTheme("light")}>
          Light
        </button>
        {/* aria-disabled, not disabled: the button stays hoverable and clickable, so the reason can be shown. */}
        <button
          aria-pressed={ariaBool(ws.state.theme === "dark")}
          aria-disabled={ariaBool(!ws.state.settings.file.darkSupport)}
          title={ws.state.settings.file.darkSupport ? placeholderTitle("theme") : "Dark support is off, so there is no Dark"}
          onClick={() => ws.setTheme("dark")}
        >
          Dark
        </button>
      </div>
    </header>
  );
}

/** A count from Review that, pressed, narrows the lists to the rows that carry it. */
function FilterButton(props: { severity: Finding["severity"]; count: number }) {
  const ws = useWorkspace();
  const on = () => ws.state.filter === props.severity;
  return (
    <button
      class={["count", props.severity, { some: props.count > 0 }]}
      aria-pressed={ariaBool(on())}
      disabled={props.count === 0 && !on()}
      title={on() ? "Show all rows" : `Show only rows with ${props.severity}s`}
      onClick={() => ws.setFilter(on() ? null : props.severity)}
    >
      {props.severity === "error" ? "●" : "○"} {counted(props.count, props.severity)}
    </button>
  );
}
