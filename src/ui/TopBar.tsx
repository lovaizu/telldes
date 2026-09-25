// The whole file's state and the operations on all of it: Light / Dark, Review and its counts, and Export,
// which always writes every Web page. Setup makes tokens, so it sits on the token list instead.
import type { Finding } from "../core/findings";
import { counted } from "./format";
import { ariaBool, placeholderTitle, RowMarks } from "./parts";
import { useWorkspace } from "./workspace";

const CANVAS_THEME_TITLE = "Switches this page's variables between Light and Dark. The plugin itself follows Figma's theme.";

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
      {/* The design's theme, not the plugin's: the plugin follows Figma's theme, so this sits with the file's own state. */}
      <div class="canvas-theme" title={`${CANVAS_THEME_TITLE}\n${placeholderTitle("theme")}`}>
        <div class="segmented" role="group" aria-label="Theme">
          <button aria-pressed={ariaBool(ws.state.theme === "light")} onClick={() => ws.setTheme("light")}>
            Light
          </button>
          {/* aria-disabled, not disabled: the button stays hoverable and clickable, so the reason can be shown. */}
          <button
            aria-pressed={ariaBool(ws.state.theme === "dark")}
            aria-disabled={ariaBool(!ws.state.settings.file.darkSupport)}
            title={
              ws.state.settings.file.darkSupport
                ? `${CANVAS_THEME_TITLE}\n${placeholderTitle("theme")}`
                : "Dark support is off, so there is no Dark"
            }
            onClick={() => ws.setTheme("dark")}
          >
            Dark
          </button>
        </div>
      </div>
      <span class="spacer" />
      {/* Named, not an icon: designers did not find ⟳. It runs by itself too; pressing it is for after fixing something in Figma. */}
      <button
        class="review"
        title="Review runs on open, on settings change and before Export. Click to run it again."
        onClick={() => ws.runReview()}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true">
          <path d="M12.5 8a4.5 4.5 0 1 1-1.32-3.18" stroke-linecap="round" />
          <path d="M11.5 2.5v2.5H9" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
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
