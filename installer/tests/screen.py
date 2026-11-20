"""What the user reads: a terminal's output rendered as the screen shows it, and its boxes checked (OUT1 of run.sh).

    python3 screen.py <columns> <file>     the rendered text on stdout; problems on stderr, exit 1 when there are any
    python3 screen.py --self-test

The renderer knows what install.sh writes: colors (dropped), carriage return, cursor up and down, the cursor column
(ESC[nG), erase line; a line wider than the terminal wraps. A character written by a column jump over one that is not a space is a border drawn inside the
text; in every box, the right border of a line is at the column of the box's top corner, or absent; no line of a box wraps; no frame of the turning sign is left behind.
"""
import re
import sys

CSI = re.compile(r"\x1b\[([?0-9;]*)([A-Za-z])")


def render(data, width):
    lines, row, col, jumped, problems = [[]], 0, 0, False, []
    i = 0
    while i < len(data):
        ch = data[i]
        m = CSI.match(data, i) if ch == "\x1b" else None
        if m:
            arg, op = m.group(1), m.group(2)
            n = int(arg) if arg.isdigit() else 1
            if op == "A":
                row = max(0, row - n)
            elif op == "B":
                row += n
            elif op == "G":
                col, jumped = n - 1, True
            elif op == "K":
                while len(lines) <= row:
                    lines.append([])
                lines[row] = [] if arg == "2" else lines[row][:col]
            i = m.end()
            continue
        i += 1
        if ch == "\r":
            col = 0
        elif ch == "\n":
            row, col, jumped = row + 1, 0, False
        elif ch >= " ":
            if col >= width:
                row, col = row + 1, 0
            while len(lines) <= row:
                lines.append([])
            line = lines[row]
            while len(line) <= col:
                line.append(" ")
            if jumped and line[col] != " ":
                problems.append(f"line {row + 1}: '{ch}' written over '{line[col]}' at column {col + 1}")
            line[col] = ch
            col += 1
        while len(lines) <= row:
            lines.append([])
    return ["".join(l).rstrip() for l in lines], problems


def boxes(screen):
    problems, corner = [], None
    for n, line in enumerate(screen, 1):
        if "╭" in line and line.rstrip().endswith("╮"):
            corner = len(line.rstrip()) - 1
        elif corner is not None and line.lstrip().startswith("╰"):
            if len(line) - 1 != corner:
                problems.append(f"line {n}: the bottom ends at column {len(line)}, the top at {corner + 1}")
            corner = None
        elif corner is not None and not line.lstrip().startswith("│"):
            problems.append(f"line {n}: a line of the box wider than the terminal, wrapped: {line.strip()}")
        elif corner is not None:
            right = line.rfind("│")
            if right != line.find("│") and right != corner:
                problems.append(f"line {n}: a border at column {right + 1}, the box's at {corner + 1}: {line.strip()}")
        if any(0x2801 <= ord(c) <= 0x28FF for c in line):
            problems.append(f"line {n}: a frame of the turning sign left on the screen: {line.strip()}")
    return problems


def check(data, width):
    screen, problems = render(data, width)
    return screen, problems + boxes(screen)


def self_test():
    good = "  ╭─ T ───╮\n  │ ok\x1b[11G│\n  │ a longer text\n  ╰───────╯\n"
    screen, problems = check(good, 80)
    assert not problems, problems
    assert screen[1] == "  │ ok    │", screen
    cut = "  ╭─ T ───╮\n  │ too long text\x1b[11G│\n  ╰───────╯\n"
    assert any("written over" in p for p in check(cut, 80)[1])
    shifted = "  ╭─ T ───╮\n  │ ok │\n  ╰───────╯\n"
    assert any("a border at column" in p for p in check(shifted, 80)[1])
    wrapped = "  ╭─ T ───╮\n  │ a text\nwrapped\x1b[11G│\n  ╰───────╯\n"
    assert any("wrapped" in p for p in check(wrapped, 80)[1])
    left = "\n\n\n\x1b[3A\r  ⠻⣿⠟ a very long line\n\n\n\x1b[3A\r\x1b[2K✓ done\n"
    assert any("turning sign" in p for p in check(left, 10)[1])
    spin = "a\nb\nc\n\x1b[3A\r\x1b[2Kx\n"
    assert check(spin, 80)[0][:3] == ["x", "b", "c"]
    print("screen.py: self-test passed")


if __name__ == "__main__":
    if sys.argv[1:] == ["--self-test"]:
        self_test()
        sys.exit(0)
    width, path = int(sys.argv[1]), sys.argv[2]
    with open(path, encoding="utf-8", errors="replace", newline="") as f:
        screen, problems = check(f.read(), width)
    print("\n".join(screen))
    for p in problems:
        print(p, file=sys.stderr)
    sys.exit(1 if problems else 0)
