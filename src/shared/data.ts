// The one-time read of a Figma file. Review, Export, Setup and Light / Dark all
// work from this data, so it must stay JSON-serializable and free of Figma API
// calls. Field names follow the Plugin API so each value traces back to Figma.
import type {
  AutoLayoutChildrenMixin,
  AutoLayoutMixin,
  BlendMode,
  CodeSyntaxPlatform,
  ComponentProperties,
  ComponentPropertyDefinitions,
  Constraints,
  Effect,
  FontName,
  FontStyle,
  GridChildrenMixin,
  GridTrackSize,
  HyperlinkTarget,
  LeadingTrim,
  LayoutMixin,
  LayoutGrid,
  LetterSpacing,
  LineHeight,
  MinimalStrokesMixin,
  OpenTypeFeature,
  OverflowDirection,
  Paint,
  Reaction,
  Rect,
  StrokeCap,
  StrokeJoin,
  TextCase,
  TextDecoration,
  TextDecorationColor,
  TextDecorationOffset,
  TextDecorationStyle,
  TextDecorationThickness,
  TextListOptions,
  TextNode,
  TextStyleOverrideType,
  TextWrapStyle,
  Transform,
  VariableAlias,
  VariableResolvedDataType,
  VariableScope,
  VariableValue,
} from "@figma/plugin-typings/plugin-api-standalone";

/** Stands in for `figma.mixed`, which is a Symbol and cannot cross postMessage. */
export const MIXED = "MIXED";
export type Mixed = typeof MIXED;

export interface FileData {
  fileName: string;
  /** Plugin data on `figma.root`, for settings that belong to the whole file. */
  pluginData: Record<string, string>;
  page: PageData;
  tokens: TokenData;
}

export interface PageData {
  id: string;
  name: string;
  pluginData: Record<string, string>;
  /** Every node directly under the page, screens or not. */
  children: LayerData[];
}

// ---- Tokens ----

export interface TokenData {
  collections: VariableCollectionData[];
  variables: VariableData[];
  textStyles: TextStyleData[];
  effectStyles: EffectStyleData[];
  /** Color Styles are not exported; read so they can be reported as dropped. */
  paintStyles: PaintStyleData[];
}

export interface VariableCollectionData {
  id: string;
  name: string;
  modes: { modeId: string; name: string }[];
  defaultModeId: string;
  variableIds: string[];
}

export interface VariableData {
  id: string;
  name: string;
  description: string;
  resolvedType: VariableResolvedDataType;
  variableCollectionId: string;
  valuesByMode: Record<string, VariableValue>;
  scopes: readonly VariableScope[];
  codeSyntax: Partial<Record<CodeSyntaxPlatform, string>>;
}

export interface TextStyleData {
  id: string;
  name: string;
  description: string;
  fontName: FontName;
  fontSize: number;
  lineHeight: LineHeight;
  letterSpacing: LetterSpacing;
  textCase: TextCase;
  textDecoration: TextDecoration;
  paragraphSpacing: number;
  paragraphIndent: number;
  leadingTrim: LeadingTrim;
  boundVariables: BoundVariables;
}

export interface EffectStyleData {
  id: string;
  name: string;
  description: string;
  effects: readonly Effect[];
  boundVariables: BoundVariables;
}

export interface PaintStyleData {
  id: string;
  name: string;
  description: string;
  paints: readonly Paint[];
  boundVariables: BoundVariables;
}

/**
 * Field name → alias; list fields (fills, effects…) hold one alias per item and
 * `componentProperties` maps property name → alias.
 */
export interface BoundVariables {
  readonly [field: string]:
    | VariableAlias
    | readonly VariableAlias[]
    | { readonly [propertyName: string]: VariableAlias }
    | undefined;
}

// ---- Layers ----

/**
 * One node and its subtree. Groups of optional fields exist only when the node
 * has the matching Plugin API mixin, so absence means "the node has no such
 * property", never "unset".
 */
export interface LayerData {
  id: string;
  name: string;
  /** Plugin API `NodeType`, e.g. FRAME, TEXT, INSTANCE. */
  type: string;
  visible: boolean;
  /** Keys and values stored by this plugin with `setPluginData` (e.g. the note). */
  pluginData: Record<string, string>;
  boundVariables: BoundVariables;

  // DimensionAndPositionMixin / LayoutMixin / ConstraintMixin
  // x, y and relativeTransform are relative to the nearest frame-like ancestor (frame, component, instance, section or page); groups and boolean operations in between are skipped.
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  relativeTransform?: Transform;
  absoluteBoundingBox?: Rect | null;
  constraints?: Constraints;
  minWidth?: number | null;
  maxWidth?: number | null;
  minHeight?: number | null;
  maxHeight?: number | null;
  layoutSizingHorizontal?: LayoutMixin["layoutSizingHorizontal"];
  layoutSizingVertical?: LayoutMixin["layoutSizingVertical"];
  // AutoLayoutChildrenMixin
  layoutAlign?: AutoLayoutChildrenMixin["layoutAlign"];
  layoutGrow?: number;
  layoutPositioning?: AutoLayoutChildrenMixin["layoutPositioning"];
  // GridChildrenMixin, only when the parent is a grid
  gridChild?: GridChildData;

  // MinimalBlendMixin / BlendMixin
  opacity?: number;
  blendMode?: BlendMode;
  isMask?: boolean;
  effects?: readonly Effect[];
  effectStyleId?: string;

  // MinimalFillsMixin / MinimalStrokesMixin / IndividualStrokesMixin
  fills?: readonly Paint[] | Mixed;
  fillStyleId?: string | Mixed;
  strokes?: readonly Paint[];
  strokeStyleId?: string;
  strokeWeight?: number | Mixed;
  strokeTopWeight?: number;
  strokeRightWeight?: number;
  strokeBottomWeight?: number;
  strokeLeftWeight?: number;
  strokeAlign?: MinimalStrokesMixin["strokeAlign"];
  strokeJoin?: StrokeJoin | Mixed;
  strokeCap?: StrokeCap | Mixed;
  dashPattern?: readonly number[];

  // CornerMixin / RectangleCornerMixin
  cornerRadius?: number | Mixed;
  cornerSmoothing?: number;
  topLeftRadius?: number;
  topRightRadius?: number;
  bottomRightRadius?: number;
  bottomLeftRadius?: number;

  // Frame-like containers
  clipsContent?: boolean;
  autoLayout?: AutoLayoutData;
  layoutGrids?: readonly LayoutGrid[];
  // FramePrototypingMixin / ReactionMixin
  overflowDirection?: OverflowDirection;
  reactions?: readonly Reaction[];

  text?: TextData;
  component?: ComponentRef;
  /** INSTANCE: the value set for each property, variants included. */
  componentProperties?: ComponentProperties;
  /** COMPONENT inside a component set: its variant values. */
  variantProperties?: Record<string, string> | null;
  /** COMPONENT_SET, or a COMPONENT outside a set: the properties it defines. */
  componentPropertyDefinitions?: ComponentPropertyDefinitions;

  children?: LayerData[];
}

export interface AutoLayoutData {
  layoutMode: AutoLayoutMixin["layoutMode"];
  layoutWrap: AutoLayoutMixin["layoutWrap"];
  primaryAxisSizingMode: AutoLayoutMixin["primaryAxisSizingMode"];
  counterAxisSizingMode: AutoLayoutMixin["counterAxisSizingMode"];
  primaryAxisAlignItems: AutoLayoutMixin["primaryAxisAlignItems"];
  counterAxisAlignItems: AutoLayoutMixin["counterAxisAlignItems"];
  counterAxisAlignContent: AutoLayoutMixin["counterAxisAlignContent"];
  itemSpacing: number;
  counterAxisSpacing: number | null;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  itemReverseZIndex: boolean;
  strokesIncludedInLayout: boolean;
  grid?: GridLayoutData;
}

export interface GridLayoutData {
  gridRowCount: number;
  gridColumnCount: number;
  gridRowGap: number;
  gridColumnGap: number;
  gridRowSizes: readonly GridTrackSize[];
  gridColumnSizes: readonly GridTrackSize[];
}

export interface GridChildData {
  gridRowAnchorIndex: number;
  gridColumnAnchorIndex: number;
  gridRowSpan: number;
  gridColumnSpan: number;
  gridChildHorizontalAlign: GridChildrenMixin["gridChildHorizontalAlign"];
  gridChildVerticalAlign: GridChildrenMixin["gridChildVerticalAlign"];
}

export interface TextData {
  characters: string;
  textAlignHorizontal: TextNode["textAlignHorizontal"];
  textAlignVertical: TextNode["textAlignVertical"];
  textAutoResize: TextNode["textAutoResize"];
  textTruncation: TextNode["textTruncation"];
  maxLines: number | null;
  textStyleId: string | Mixed;
  leadingTrim: LeadingTrim | Mixed;
  paragraphSpacing: number | Mixed;
  paragraphIndent: number | Mixed;
  listSpacing: number | Mixed;
  hangingPunctuation: boolean;
  hangingList: boolean;
  textWrapStyle: TextWrapStyle | Mixed;
  /** Runs of characters that share every styling field below; never mixed. */
  segments: TextSegmentData[];
}

export interface TextSegmentData {
  characters: string;
  start: number;
  end: number;
  fontName: FontName;
  fontSize: number;
  fontWeight: number;
  fontStyle: FontStyle;
  lineHeight: LineHeight;
  letterSpacing: LetterSpacing;
  textCase: TextCase;
  textDecoration: TextDecoration;
  textDecorationStyle: TextDecorationStyle | null;
  textDecorationOffset: TextDecorationOffset | null;
  textDecorationThickness: TextDecorationThickness | null;
  textDecorationColor: TextDecorationColor | null;
  textDecorationSkipInk: boolean | null;
  openTypeFeatures: { readonly [feature in OpenTypeFeature]: boolean };
  paragraphSpacing: number;
  paragraphIndent: number;
  listOptions: TextListOptions;
  listSpacing: number;
  indentation: number;
  hyperlink: HyperlinkTarget | null;
  fills: readonly Paint[];
  fillStyleId: string;
  textStyleId: string;
  /** How this run differs from its text style. */
  textStyleOverrides: TextStyleOverrideType[];
  boundVariables: BoundVariables;
}

/** For an INSTANCE: its main component. The main component may live on another page. */
export interface ComponentRef {
  mainComponentId: string | null;
  mainComponentName: string | null;
  /** True when the main component comes from a library outside this file. */
  remote: boolean;
}
