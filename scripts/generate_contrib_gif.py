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

# Grid colors (purple ramp)
COLORS = ["#161b22", "#2d1655", "#4c1d95", "#6d28d9", "#8b5cf6"]

# Alien (neon green head)
ALIEN_GREEN = "#57D364"
DARK = "#0b0f14"
SHIRT = "#c9d1d9"
PANTS = "#8b949e"

def level(count: int) -> int:
    if count <= 0: return 0
    if count <= 2: return 1
    if count <= 6: return 2
    if count <= 12: return 3
    return 4

def hex_to_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def draw_alien(draw, x, y, phase=0.0, scale=1.0):
    """
    Non-pixel alien head + human-ish body.
    x, y = top-left anchor of character box.
    phase cycles walking (0..1).
    """
    g = hex_to_rgb(ALIEN_GREEN)
    dark = hex_to_rgb(DARK)
    shirt = hex_to_rgb(SHIRT)
    pants = hex_to_rgb(PANTS)

    head_w = int(18 * scale)
    head_h = int(22 * scale)
    body_w = int(14 * scale)
    body_h = int(18 * scale)

    # gentle bob while walking
    bob = int((math.sin(phase * 2 * math.pi) * 1.5) * scale)

    # Head (oval)
    hx0 = x
    hy0 = y + bob
    hx1 = x + head_w
    hy1 = y + head_h + bob
    draw.ellipse([hx0, hy0, hx1, hy1], fill=g)

    # Eyes (big black ovals)
    eye_w = int(5 * scale)
    eye_h = int(7 * scale)
    ex_offset = int(4 * scale)
    ey_offset = int(7 * scale)
    draw.ellipse([x + ex_offset, y + ey_offset + bob,
                  x + ex_offset + eye_w, y + ey_offset + eye_h + bob], fill=dark)
    draw.ellipse([x + head_w - ex_offset - eye_w, y + ey_offset + bob,
                  x + head_w - ex_offset, y + ey_offset + eye_h + bob], fill=dark)

    # Neck
    neck_w = int(5 * scale)
    neck_h = int(3 * scale)
    nx0 = x + head_w // 2 - neck_w // 2
    ny0 = y + head_h + bob - 1
    draw.rectangle([nx0, ny0, nx0 + neck_w, ny0 + neck_h], fill=g)

    # Torso (shirt)
    tx0 = x + head_w // 2 - body_w // 2
    ty0 = y + head_h + neck_h + bob
    tx1 = tx0 + body_w
    ty1 = ty0 + body_h
    draw.rounded_rectangle([tx0, ty0, tx1, ty1], radius=max(1, int(3 * scale)), fill=shirt)

    # Arms (swing)
    swing = math.sin(phase * 2 * math.pi)  # -1..1
    arm_len = int(10 * scale)
    arm_y = ty0 + int(5 * scale)

    # left arm
    draw.line(
        [tx0, arm_y, tx0 - arm_len, arm_y + int(3 * scale * swing)],
        fill=g, width=max(1, int(2 * scale))
    )
    # right arm
    draw.line(
        [tx1, arm_y, tx1 + arm_len, arm_y - int(3 * scale * swing)],
        fill=g, width=max(1, int(2 * scale))
    )

    # Legs (walking)
    leg_len = int(12 * scale)
    hip_y = ty1
    hip_x = x + head_w // 2
    step = math.sin(phase * 2 * math.pi)  # -1..1

    # left leg
    draw.line(
        [hip_x - int(3 * scale), hip_y,
         hip_x - int(5 * scale) - int(3 * scale * step), hip_y + leg_len],
        fill=pants, width=max(1, int(3 * scale))
    )
    # right leg
    draw.line(
        [hip_x + int(3 * scale), hip_y,
         hip_x + int(5 * scale) + int(3 * scale * step), hip_y + leg_len],
        fill=pants, width=max(1, int(3 * scale))
    )

    # Feet
    draw.line([hip_x - int(7 * scale), hip_y + leg_len, hip_x - int(2 * scale), hip_y + leg_len],
              fill=pants, width=max(1, int(3 * scale)))
    draw.line([hip_x + int(2 * scale), hip_y + leg_len, hip_x + int(7 * scale), hip_y + leg_len],
              fill=pants, width=max(1, int(3 * scale)))

def main():
    weeks = fetch_weeks()
    cols = len(weeks)
    rows = 7

    # Grid sizing
    cell = 10
    gap = 3
    padX = 18
    padY = 14

    gridW = cols * (cell + gap) - gap
    gridH = rows * (cell + gap) - gap

    # Background (GIF can’t be truly transparent reliably on GitHub)
    bg = hex_to_rgb("#0d1117")
    W = padX * 2 + gridW
    H = padY * 2 + gridH

    base = Image.new("RGBA", (W, H), bg + (255,))
    d0 = ImageDraw.Draw(base)

    # Draw grid safely
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

    # Slower animation
    total_frames = 80   # smoother + slower
    frames = []

    # Alien sizing (roughly matches draw_alien proportions)
    scale = 1.0
    alien_w = int(18 * scale)
    alien_h = int((22 + 3 + 18 + 12) * scale)  # head + neck + body + legs

    for i in range(total_frames):
        frame = base.copy()
        d = ImageDraw.Draw(frame)

        p = i / (total_frames - 1)  # 0..1 progress across the year

        # Walk left -> right across columns
        col = int(p * (cols - 1))
        row = 3  # middle-ish row for placement

        # Center of the target cell
        cx = padX + col * (cell + gap) + cell // 2
        cy = padY + row * (cell + gap) + cell // 2

        # Walk cycle phase (bigger divisor = slower step cadence)
        phase = (i / 18.0) % 1.0

        # Place alien so feet sit near the grid row
        x = int(cx - alien_w // 2)
        y = int(cy - alien_h + 12)  # adjust if you want higher/lower

        draw_alien(d, x, y, phase=phase, scale=scale)

        frames.append(frame.convert("P", palette=Image.ADAPTIVE))

    os.makedirs("assets", exist_ok=True)
    out_path = "assets/contributions.gif"

    frames[0].save(
        out_path,
        save_all=True,
        append_images=frames[1:],
        duration=140,  # ms per frame (slower)
        loop=0,
        optimize=True,
    )
    print(f"Wrote {out_path}")

if __name__ == "__main__":
    main()
