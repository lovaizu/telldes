// The read data: everything the read layer (①) takes out of Figma, in the one
// shape the build layer (②) consumes (old design doc 4.7.6「読み取りデータ」).
//
// Three rules shape every field here:
// - Figma values are copied as they are. Converting them (#RRGGBB, weight
//   numbers, `path` / `-N`, section / block / element) is a design-doc promise
//   and so belongs to ②, where it can be tested.
// - Everything is JSON: sample files of this data are the test input for ②
//   (4.7.7). Variables and styles are referred to by id, and `figma.mixed`
//   becomes the string "mixed".
// - The scope is the whole current page — outside the export range, hidden
//   layers and instance internals included — plus the file's local Variables
//   and Styles. ② decides what of it is in scope.
//
// Figma's own types (Paint, Effect, FontName, …) are used where a value is
// copied unchanged, so "as Figma gives it" is stated by the type itself.

/** A node or text field that Figma reports as `figma.mixed`. */
export type Mixed = "mixed";

export interface ReadData {
  /** The current page's name. */
  pageName: string;
  /** The current page's children, as a tree. */
  nodes: ReadNode[];
  /** Every local Variable. */
  variables: ReadVariable[];
  /** Every local Variable collection. */
  collections: ReadCollection[];
  textStyles: ReadTextStyle[];
  paintStyles: ReadPaintStyle[];
  effectStyles: ReadEffectStyle[];
  /** The stored Export settings; `null` when none were ever saved. */
  settings: ExportSettings | null;
  /** Which theme the file is showing now (4.3.9, 4.7.4.3). */
  theme: Theme;
  /**
   * One entry per image hash used by an `IMAGE` paint anywhere on the page or
   * in a local Paint Style — not only the visible ones in the export range:
   * picking those is a judgment, so ② filters.
   */
  images: ReadImage[];
  /**
   * The frames the settings point at by id — favicon, OG image, each
   * responsive row — that are not on the current page and so not in `nodes`
   * (4.7.4). One entry per id. Ids on the current page are left out only
   * because `nodes` already has them.
   */
  otherFrames: OtherFrame[];
}

/**
 * One node of the current page.
 *
 * An optional field is absent exactly when this node type has no such
 * property in Figma (a GROUP has no `fills`, a TEXT no `children`), never
 * because its value was empty — so ② can tell "cannot have" from "has none".
 */
export interface ReadNode {
  id: string;
  name: string;
  type: NodeType;
  visible: boolean;
  children?: ReadNode[];

  /**
   * INSTANCE only. The main component's id and name — for a variant, the
   * Component Set's name. `null` when Figma finds no main component.
   */
  mainComponentId?: string | null;
  mainComponentName?: string | null;
  /**
   * Figma's `componentPropertyReferences`, keeping only `visible`: the
   * boolean property that hides this layer, by which 4.7.2 groups hidden
   * layers. `null` when Figma gives `null`.
   */
  componentPropertyReferences?: { visible?: string } | null;

  width?: number;
  height?: number;
  x?: number;
  y?: number;
  layoutPositioning?: "AUTO" | "ABSOLUTE";
  relativeTransform?: Transform;
  rotation?: number;
  constraints?: Constraints;
  absoluteBoundingBox?: Rect | null;
  absoluteRenderBounds?: Rect | null;
  clipsContent?: boolean;
  blendMode?: BlendMode;
  opacity?: number;

  layoutMode?: "NONE" | "HORIZONTAL" | "VERTICAL" | "GRID";
  layoutWrap?: "NO_WRAP" | "WRAP";
  primaryAxisAlignItems?: "MIN" | "MAX" | "CENTER" | "SPACE_BETWEEN";
  counterAxisAlignItems?: "MIN" | "MAX" | "CENTER" | "BASELINE";
  counterAxisAlignContent?: "AUTO" | "SPACE_BETWEEN";
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  itemSpacing?: number;
  counterAxisSpacing?: number | null;
  layoutSizingHorizontal?: "FIXED" | "HUG" | "FILL";
  layoutSizingVertical?: "FIXED" | "HUG" | "FILL";
  minWidth?: number | null;
  maxWidth?: number | null;
  minHeight?: number | null;
  maxHeight?: number | null;

  /** "mixed" on a TEXT whose characters differ; `text.segments` has each. */
  fills?: readonly Paint[] | Mixed;
  fillStyleId?: string | Mixed;
  strokes?: readonly Paint[];
  strokeStyleId?: string;
  /** "mixed" when the sides differ; the per-side fields below hold each. */
  strokeWeight?: number | Mixed;
  strokeTopWeight?: number;
  strokeRightWeight?: number;
  strokeBottomWeight?: number;
  strokeLeftWeight?: number;
  strokeAlign?: "CENTER" | "INSIDE" | "OUTSIDE";
  dashPattern?: readonly number[];
  strokesIncludedInLayout?: boolean;
  effects?: readonly Effect[];
  effectStyleId?: string;
  /** "mixed" when the corners differ; the per-corner fields below hold each. */
  cornerRadius?: number | Mixed;
  topLeftRadius?: number;
  topRightRadius?: number;
  bottomRightRadius?: number;
  bottomLeftRadius?: number;

  /**
   * The node's own bindings, as Figma gives them (`{}` when none). Bindings
   * inside paints, effects and gradient stops stay on those objects in
   * `fills` / `strokes` / `effects`.
   */
  boundVariables: NodeBoundVariables;

  /** TEXT only. */
  text?: ReadText;

  /** The designer's note (4.3.7); "" when none. */
  note: string;
}

export type NodeBoundVariables = NonNullable<SceneNodeMixin["boundVariables"]>;

export interface ReadText {
  textAlignHorizontal: "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED";
  textAutoResize: "NONE" | "WIDTH_AND_HEIGHT" | "HEIGHT" | "TRUNCATE";
  /**
   * The characters split where any of the fields below changes, in order.
   * Empty for an empty text layer.
   */
  segments: ReadTextSegment[];
}

export type ReadTextSegment = Pick<
  StyledTextSegment,
  | "characters"
  | "start"
  | "end"
  | "fontSize"
  | "fontName"
  | "fontWeight"
  | "lineHeight"
  | "letterSpacing"
  | "textCase"
  | "textDecoration"
  | "fills"
  | "fillStyleId"
  | "textStyleId"
  | "hyperlink"
> & {
  /** `{}` when none. */
  boundVariables: NonNullable<StyledTextSegment["boundVariables"]>;
};

export interface ReadVariable {
  id: string;
  name: string;
  collectionId: string;
  resolvedType: VariableResolvedDataType;
  scopes: VariableScope[];
  /** Per mode id; an alias stays `{ type: "VARIABLE_ALIAS", id }` (② resolves it). */
  valuesByMode: { [modeId: string]: VariableValue };
  /** Per platform; the `WEB` entry is the CSS variable name (4.3.4, 4.5.1). */
  codeSyntax: { [platform in CodeSyntaxPlatform]?: string };
}

export interface ReadCollection {
  id: string;
  name: string;
  modes: { modeId: string; name: string }[];
  defaultModeId: string;
}

export interface ReadTextStyle {
  id: string;
  name: string;
  fontName: FontName;
  fontSize: number;
  lineHeight: LineHeight;
  letterSpacing: LetterSpacing;
  /** `{}` when none. */
  boundVariables: NonNullable<TextStyle["boundVariables"]>;
}

export interface ReadPaintStyle {
  id: string;
  name: string;
  paints: readonly Paint[];
}

export interface ReadEffectStyle {
  id: string;
  name: string;
  effects: readonly Effect[];
}

/**
 * An image an `IMAGE` paint points at. Its bytes are not read: images are
 * made in Figma, so ② only decides what to export and ① exports it. The first
 * bytes are the exception, for ② to tell the file format (4.5.2.1「アセット」).
 */
export type ReadImage =
  | {
      imageHash: string;
      found: true;
      /** The first 12 bytes of the image file. */
      head: number[];
      /** Pixel size, for the `TILE` background size (4.5.2.1). */
      width: number;
      height: number;
    }
  /** Figma has no image for this hash. */
  | { imageHash: string; found: false };

export type OtherFrame =
  | {
      id: string;
      found: true;
      name: string;
      /** Figma's node type; the id may name something that is not a frame. */
      type: NodeType;
      /**
       * A hidden frame counts as missing (4.7.4); ② decides that, not ①.
       * Absent when the node has no `visible` (a page or the document).
       */
      visible?: boolean;
      /**
       * The page the node is on, so ② can tell "moved to another page"
       * from "deleted" when it reports a broken reference (4.7.4.3).
       * `null` for the document itself, which is on no page.
       */
      pageId: string | null;
      pageName: string | null;
    }
  /** No node has this id any more (4.7.4.3: kept, and reported by ②). */
  | { id: string; found: false };

export type Theme = "light" | "dark";

/**
 * The Export settings as stored in the file (the four groups of 4.7.4.2,
 * written out as settings.json by 4.5.4). Frames and the theme color are
 * stored by id, not by name, so a rename does not silently break the
 * reference (4.7.4.3).
 *
 * Absent is the only "not entered" for a text field: the writer omits the
 * field rather than store "", the same rule settings.json follows (4.5.4).
 * The doc does not say how the stored settings spell it; this is the
 * contract chosen here, so the writer and ② cannot read one blank two ways.
 */
export interface ExportSettings {
  /**
   * Absent or `[]`: no breakpoints — each frame is one width and no media
   * queries are made (4.9).
   */
  responsive?: ResponsiveRow[];
  /**
   * Absent means OFF. The doc gives only ON / OFF (4.7.4.2); OFF as the
   * default is the contract chosen here, because ON turns on the theme
   * checks (4.7.2), which only a designer's choice should do.
   */
  darkMode?: boolean;
  site?: SiteSettings;
  /** The shared rules, free text. */
  rules?: string;
}

export interface ResponsiveRow {
  /** The width this row applies from; 0 is from the smallest width. */
  minWidth: number;
  frameId: string;
  contentWidth: ContentWidth;
}

/** Fixed pixels or a percentage (4.7.4.2). */
export type ContentWidth = { unit: "px"; value: number } | { unit: "%"; value: number };

export interface SiteSettings {
  title?: string;
  description?: string;
  lang?: string;
  /** When absent (the doc's "empty"), the title is used (4.7.4.2). */
  ogTitle?: string;
  /** When absent (the doc's "empty"), the description is used (4.7.4.2). */
  ogDescription?: string;
  faviconFrameId?: string;
  ogImageFrameId?: string;
  themeColorVariableId?: string;
}
