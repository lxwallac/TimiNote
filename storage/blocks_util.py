# -*- coding: utf-8 -*-
"""日记块编辑器：存储格式解析、纯文本/Markdown 导出与字数统计。"""

import json

BLOCK_FORMAT = "blocks"


def default_blocks() -> list[dict]:
    return [{"type": "text", "content": "", "checked": False, "children": []}]


def _block_text(b: dict) -> str:
    return (b.get("content") or "").strip()


def _walk_blocks(blocks: list, fn):
    for b in blocks or []:
        fn(b)
        children = b.get("children") or []
        if children:
            _walk_blocks(children, fn)


def blocks_to_plain(blocks: list) -> str:
    if not blocks:
        return ""

    def render_list(blks: list, depth: int = 0) -> list[str]:
        lines = []
        n = 1
        for b in blks:
            t = b.get("type", "text")
            c = _block_text(b)
            ch = b.get("children") or []
            if t == "divider":
                lines.append("---")
            elif t == "h1":
                lines.append(f"# {c}")
            elif t == "h2":
                lines.append(f"## {c}")
            elif t == "h3":
                lines.append(f"### {c}")
            elif t == "h4":
                lines.append(f"#### {c}")
            elif t == "todo":
                mark = "[x]" if b.get("checked") else "[ ]"
                lines.append(f"{mark} {c}")
            elif t == "bullet":
                lines.append(f"{'  ' * depth}• {c}")
            elif t == "numbered":
                lines.append(f"{'  ' * depth}{n}. {c}")
                n += 1
            elif t == "quote":
                lines.append(f"> {c}")
            elif t == "callout":
                lines.append(f"「{c}」")
            elif t == "code":
                lines.append(c)
            elif t == "toggle":
                lines.append(f"▸ {c}")
                lines.extend(render_list(ch, depth + 1))
            elif t == "image":
                lines.append("[图片]")
            else:
                if c:
                    lines.append(c)
            if t == "numbered":
                pass
            elif ch and t != "toggle":
                lines.extend(render_list(ch, depth + 1))
        return lines

    return "\n".join(render_list(blocks))


def blocks_to_markdown(blocks: list) -> str:
    if not blocks:
        return ""

    def render_md(blks: list) -> list[str]:
        lines = []
        n = 1
        for b in blks:
            t = b.get("type", "text")
            c = _block_text(b)
            ch = b.get("children") or []
            if t == "divider":
                lines.append("---")
            elif t == "h1":
                lines.append(f"# {c}\n")
            elif t == "h2":
                lines.append(f"## {c}\n")
            elif t == "h3":
                lines.append(f"### {c}\n")
            elif t == "h4":
                lines.append(f"#### {c}\n")
            elif t == "todo":
                lines.append(f"- [{'x' if b.get('checked') else ' '}] {c}")
            elif t == "bullet":
                lines.append(f"- {c}")
            elif t == "numbered":
                lines.append(f"{n}. {c}")
                n += 1
            elif t == "quote":
                lines.append(f"> {c}\n")
            elif t == "callout":
                lines.append(f"> **{c}**\n")
            elif t == "code":
                lines.append(f"```\n{c}\n```\n")
            elif t == "toggle":
                lines.append(f"<details>\n<summary>{c}</summary>\n\n")
                lines.append("\n".join(render_md(ch)))
                lines.append("</details>\n")
            elif t == "image" and c.startswith("data:"):
                lines.append(f"![image]({c})\n")
            elif t == "image":
                lines.append("![image](本地图片)\n")
            else:
                if c:
                    lines.append(f"{c}\n")
            if ch and t not in ("toggle", "numbered"):
                lines.extend(render_md(ch))
        return lines

    return "\n".join(render_md(blocks)).strip()


def count_blocks_words(blocks: list) -> int:
    acc = []

    def grab(b):
        if b.get("type") != "image":
            acc.append(_block_text(b))

    _walk_blocks(blocks, grab)
    return len("".join(acc).replace("\n", ""))


def serialize_content(blocks: list | None, fallback_plain: str = "") -> str:
    if blocks is not None and len(blocks) > 0:
        return json.dumps({"format": BLOCK_FORMAT, "blocks": blocks}, ensure_ascii=False)
    return fallback_plain or ""


def parse_stored_content(raw: str) -> tuple[list[dict], str]:
    if not raw or not raw.strip():
        return default_blocks(), ""
    if raw.strip().startswith("{"):
        try:
            data = json.loads(raw)
            if isinstance(data, dict) and data.get("format") == BLOCK_FORMAT:
                blocks = data.get("blocks") or default_blocks()
                return blocks, blocks_to_plain(blocks)
        except json.JSONDecodeError:
            pass
    return [{"type": "text", "content": raw, "checked": False, "children": []}], raw


def plain_to_blocks(text: str) -> list[dict]:
    if not (text or "").strip():
        return default_blocks()
    return [{"type": "text", "content": text, "checked": False, "children": []}]
