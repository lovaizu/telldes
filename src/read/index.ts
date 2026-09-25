import type {
  ReadCollection,
  ReadData,
  ReadEffectStyle,
  ReadImage,
  ReadNode,
  ReadPaintStyle,
  ReadTextStyle,
  ReadVariable,
} from "../readData";
import { readNodes } from "./nodes";
import { readOtherFrames, readSettings, readTheme } from "./pluginData";

// The reading half of the read layer (old design doc 4.7.6): Figma in, read
// data out, nothing decided on the way. Every failure is thrown to the caller
// rather than turned into an empty list — an empty list would be read by ② as
// "the file has none" (4.7.6, principle B「欠けていると分かる」).

/** Reads the current page and the file's local Variables / Styles. */
export async function readFigma(): Promise<ReadData> {
  const page = figma.currentPage;
  const settings = readSettings();
  const theme = readTheme();
  const [nodes, variables, collections, textStyles, paintStyles, effectStyles, otherFrames] =
    await Promise.all([
      readNodes(page),
      readVariables(),
      readCollections(),
      readTextStyles(),
      readPaintStyles(),
      readEffectStyles(),
      readOtherFrames(settings, page),
    ]);
  const images = await readImages(imageHashesIn(nodes, paintStyles));
  return {
    pageName: page.name,
    nodes,
    variables,
    collections,
    textStyles,
    paintStyles,
    effectStyles,
    settings,
    theme,
    images,
    otherFrames,
  };
}

async function readVariables(): Promise<ReadVariable[]> {
  const variables = await figma.variables.getLocalVariablesAsync();
  return variables.map((variable) => ({
    id: variable.id,
    name: variable.name,
    collectionId: variable.variableCollectionId,
    resolvedType: variable.resolvedType,
    scopes: variable.scopes,
    valuesByMode: variable.valuesByMode,
    codeSyntax: variable.codeSyntax,
  }));
}

async function readCollections(): Promise<ReadCollection[]> {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  return collections.map((collection) => ({
    id: collection.id,
    name: collection.name,
    modes: collection.modes.map(({ modeId, name }) => ({ modeId, name })),
    defaultModeId: collection.defaultModeId,
  }));
}

async function readTextStyles(): Promise<ReadTextStyle[]> {
  const styles = await figma.getLocalTextStylesAsync();
  return styles.map((style) => ({
    id: style.id,
    name: style.name,
    fontName: style.fontName,
    fontSize: style.fontSize,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
    boundVariables: style.boundVariables ?? {},
  }));
}

async function readPaintStyles(): Promise<ReadPaintStyle[]> {
  const styles = await figma.getLocalPaintStylesAsync();
  return styles.map((style) => ({ id: style.id, name: style.name, paints: style.paints }));
}

async function readEffectStyles(): Promise<ReadEffectStyle[]> {
  const styles = await figma.getLocalEffectStylesAsync();
  return styles.map((style) => ({ id: style.id, name: style.name, effects: style.effects }));
}

/**
 * Every hash an `IMAGE` paint points at — fills, strokes, text segment fills,
 * Paint Styles — once each. Taken from the read data rather than Figma so
 * the walk sees exactly the paints ② will see.
 */
function imageHashesIn(nodes: ReadNode[], paintStyles: ReadPaintStyle[]): string[] {
  const hashes = new Set<string>();
  const add = (paints: readonly Paint[] | "mixed" | undefined) => {
    if (paints === undefined || paints === "mixed") return;
    for (const paint of paints) {
      if (paint.type === "IMAGE" && paint.imageHash !== null) hashes.add(paint.imageHash);
    }
  };
  const walk = (node: ReadNode) => {
    add(node.fills);
    add(node.strokes);
    for (const segment of node.text?.segments ?? []) add(segment.fills);
    node.children?.forEach(walk);
  };
  nodes.forEach(walk);
  for (const style of paintStyles) add(style.paints);
  return [...hashes];
}

async function readImages(hashes: string[]): Promise<ReadImage[]> {
  return Promise.all(
    hashes.map(async (imageHash): Promise<ReadImage> => {
      const image = figma.getImageByHash(imageHash);
      if (image === null) return { imageHash, found: false };
      const [bytes, size] = await Promise.all([image.getBytesAsync(), image.getSizeAsync()]);
      return {
        imageHash,
        found: true,
        // Enough for every format signature ② checks (4.5.2.1「アセット」);
        // the whole file would bloat the read data for nothing.
        head: Array.from(bytes.subarray(0, 12)),
        width: size.width,
        height: size.height,
      };
    }),
  );
}
