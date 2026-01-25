import os
import math
import requests
from PIL import Image, ImageDraw

USERNAME = os.environ.get("USERNAME")
TOKEN = os.environ.get("GITHUB_TOKEN")

if not USERNAME or not TOKEN:
    raise SystemExit("Missing USERNAME or GITHUB_TOKEN")

QUERY = """
query ($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        weeks {
          contributionDays {
            contributionCount
            date
          }
        }
      }
    }
  }
}
"""

def fetch_weeks():
    r = requests.post(
        "https://api.github.com/graphql",
        json={"query": QUERY, "variables": {"login": USERNAME}},
        headers={"Authorization": f"Bearer {TOKEN}"},
        timeout=30,
    )
    r.raise_for_status()
    data = r.json()
    return data["data"]["user"]["contributionsCollection"]["contributionCalendar"]["weeks"]

COLORS = ["#161b22", "#2d1655", "#4c1d95", "#6d28d9", "#8b5cf6"]
MONSTER = "#57D364"

def level(count: int) -> int:
    if count <= 0: return 0
    if count <= 2: return 1
    if count <= 6: return 2
    if count <= 12: return 3
    return 4

def hex_to_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

SPRITE = [
    "00111100",
    "01111110",
    "11011011",
    "11111111",
    "11111111",
    "10111101",
    "10000001",
    "01000010",
]

def draw_sprite(draw, x, y, scale=2):
    c = hex_to_rgb(MONSTER)
    for row, bits in enumerate(SPRITE):
        for col, b in enumerate(bits):
            if b == "1":
                x0 = x + col * scale
                y0 = y + row * scale
                draw.rectangle([x0, y0, x0 + scale - 1, y0 + scale - 1], fill=c)

def main():
    weeks = fetch_weeks()
    cols = len(weeks)
    rows = 7

    cell = 10
    gap = 3
    padX = 18
    padY = 14

    gridW = cols * (cell + gap) - gap
    gridH = rows * (cell + gap) - gap

    bg = hex_to_rgb("#0d1117")
    W = padX * 2 + gridW
    H = padY * 2 + gridH

    base = Image.new("RGBA", (W, H), bg + (255,))
    d0 = ImageDraw.Draw(base)

    # draw grid safely
    for x, week in enumerate(weeks):
        days = week.get("contributionDays", [])
        if len(days) < 7:
            days = days + [{"contributionCount": 0, "date": ""}] * (7 - len(days))

        for y in range(7):
            day = days[y]
            fill = hex_to_rgb(COLORS[level(day.get("contributionCount", 0))])
            px = padX + x * (cell + gap)
            py = padY + y * (cell + gap)
            d0.rounded_rectangle([px, py, px + cell, py + cell], radius=2, fill=fill)

    total_frames = 48
    frames = []

    def monster_pos(t):
        p = t / (total_frames - 1)
        col = int(p * (cols - 1))
        row = int((math.sin(p * math.pi * 4) + 1) * 0.5 * 6)
        jump = int(abs(math.sin(p * math.pi * 8)) * 8)
        return col, row, jump

    scale = 2
    sprite_w = 8 * scale
    sprite_h = 8 * scale

    for i in range(total_frames):
        frame = base.copy()
        d = ImageDraw.Draw(frame)

        col, row, jump = monster_pos(i)

        cx = padX + col * (cell + gap) + cell // 2
        cy = padY + row * (cell + gap) + cell // 2

        sx = cx - sprite_w // 2
        sy = cy - sprite_h - 2 - jump

        draw_sprite(d, sx, sy, scale=scale)
        frames.append(frame.convert("P", palette=Image.ADAPTIVE))

    os.makedirs("assets", exist_ok=True)
    out_path = "assets/contributions.gif"

    frames[0].save(
        out_path,
        save_all=True,
        append_images=frames[1:],
        duration=90,
        loop=0,
        optimize=True,
    )
    print(f"Wrote {out_path}")

if __name__ == "__main__":
    main()
