// Orical Keyboard
// Left halves: U+E100..U+E10F  (16)
// Right halves: U+E200..U+E20F (16)

const screen = document.getElementById("screen");
const leftGrid = document.getElementById("leftGrid");
const rightGrid = document.getElementById("rightGrid");

const statusLeft = document.getElementById("statusLeft");
const statusRight = document.getElementById("statusRight");

const btnCopy = document.getElementById("btnCopy");
const btnBackspace = document.getElementById("btnBackspace");
const btnSpace = document.getElementById("btnSpace");
const btnNewline = document.getElementById("btnNewline");
const btnClear = document.getElementById("btnClear");

// Utility: insert text at caret in a contenteditable element.
function insertAtCaret(el, text) {
  el.focus();
  const sel = window.getSelection();
  if (!sel) return;

  const range =
    sel.rangeCount > 0 ? sel.getRangeAt(0) : document.createRange();
  const anchorNode = sel.anchorNode || range.startContainer;
  const hasValidSelection =
    anchorNode && (anchorNode === el || el.contains(anchorNode));

  if (!hasValidSelection) {
    range.selectNodeContents(el);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);

  // Move caret after inserted text
  range.setStartAfter(node);
  range.setEndAfter(node);
  sel.removeAllRanges();
  sel.addRange(range);
}

// Track last-selected halves (purely for UI feedback)
let lastLeft = null;
let lastRight = null;
let pendingLeft = null;

function codepointToChar(cp) {
  return String.fromCodePoint(cp);
}

function makeKey(label, glyphChar, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "key";
  btn.setAttribute("aria-label", label);

  const g = document.createElement("div");
  g.className = "key__glyph";
  g.textContent = glyphChar;

  const l = document.createElement("div");
  l.className = "key__label";
  l.textContent = label;

  btn.appendChild(g);
  btn.appendChild(l);

  btn.addEventListener("click", onClick);
  return btn;
}

function formatStatus(prefix, selection) {
  if (!selection) return `${prefix}: none`;
  return `${prefix}: ${selection.label} ${selection.char}`;
}

function updateStatusLeft(selection) {
  statusLeft.textContent = formatStatus("L", selection);
}

function updateStatusRight(selection) {
  statusRight.textContent = formatStatus("R", selection);
}

function buildPads() {
  // Left keys
  for (let i = 0; i < 16; i++) {
    const label = `L${String(i + 1).padStart(2, "0")}`;
    const cp = 0xE100 + i;
    const ch = codepointToChar(cp);

    leftGrid.appendChild(
      makeKey(label, ch, () => {
        pendingLeft = { label, char: ch };
        lastLeft = pendingLeft;
        updateStatusLeft(pendingLeft);
      })
    );
  }

  // Right keys
  for (let i = 0; i < 16; i++) {
    const label = `R${String(i + 1).padStart(2, "0")}`;
    const cp = 0xE200 + i;
    const ch = codepointToChar(cp);

    rightGrid.appendChild(
      makeKey(label, ch, () => {
        if (!pendingLeft) {
          statusRight.textContent = "R: select a left key first";
          return;
        }

        lastRight = { label, char: ch };
        updateStatusRight(lastRight);
        insertAtCaret(screen, pendingLeft.char + ch);
        pendingLeft = null;
      })
    );
  }
}

function backspaceSmart() {
  // Removes one codepoint before caret (works with PUA chars).
  screen.focus();
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;

  const range = sel.getRangeAt(0);

  // If selection exists, delete it.
  if (!range.collapsed) {
    range.deleteContents();
    return;
  }

  // If we're inside a text node, remove one codepoint.
  let node = range.startContainer;
  let offset = range.startOffset;

  // If caret is in the root element, try last child text node.
  if (node === screen) {
    // Find a text node to act on
    const walker = document.createTreeWalker(screen, NodeFilter.SHOW_TEXT);
    let lastText = null;
    while (walker.nextNode()) lastText = walker.currentNode;
    if (!lastText) return;
    node = lastText;
    offset = node.nodeValue.length;
  }

  if (node.nodeType !== Node.TEXT_NODE) return;

  const text = node.nodeValue;
  if (offset === 0) return;

  // Handle surrogate pairs by stepping one Unicode codepoint back
  const before = Array.from(text.slice(0, offset));
  const after = text.slice(offset);

  before.pop();

  const newText = before.join("") + after;
  node.nodeValue = newText;

  // Restore caret at the new position
  const newOffset = before.join("").length;
  const newRange = document.createRange();
  newRange.setStart(node, newOffset);
  newRange.setEnd(node, newOffset);
  sel.removeAllRanges();
  sel.addRange(newRange);
}

function clearScreen() {
  screen.textContent = "";
  lastLeft = null;
  lastRight = null;
  pendingLeft = null;
  updateStatusLeft(lastLeft);
  updateStatusRight(lastRight);
}

async function copyScreen() {
  const text = screen.textContent || "";
  await navigator.clipboard.writeText(text);
}

// Buttons
btnBackspace.addEventListener("click", backspaceSmart);
btnSpace.addEventListener("click", () => insertAtCaret(screen, " "));
btnNewline.addEventListener("click", () => insertAtCaret(screen, "\n"));
btnClear.addEventListener("click", clearScreen);
btnCopy.addEventListener("click", copyScreen);

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "l") {
    // Ctrl+L clears (terminal trope)
    e.preventDefault();
    clearScreen();
  }
});

// Initialize
buildPads();

// Seed prompt so it looks alive
screen.textContent = "▌";
setTimeout(() => {
  screen.textContent = "";
  screen.focus();
}, 250);
