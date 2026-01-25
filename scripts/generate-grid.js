import fs from "fs";
import { Octokit } from "@octokit/rest";

const username = process.env.USERNAME;
const token = process.env.GITHUB_TOKEN;

if (!username || !token) {
  console.error("Missing USERNAME or GITHUB_TOKEN env vars");
  process.exit(1);
}

const octokit = new Octokit({ auth: token });

const query = `
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
`;

const text = "#8b949e"; // GitHub secondary text on dark

// Card background (not transparent)
const bg = "#0d1117";
const border = "#161b22";

// Purple ramp
const colors = [
  "#161b22", // empty
  "#2d1655",
  "#4c1d95",
  "#6d28d9",
  "#8b5cf6",
];

function level(count) {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 6) return 2;
  if (count <= 12) return 3;
  return 4;
}

function monthName(m) {
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m];
}

function renderSVG(weeks) {
  const cell = 10;
  const gap = 3;

  const padX = 16;
  const padY = 12;

  const headerH = 20; // months row
  const leftW = 32;   // day labels column
  const bottomPad = 14;

  const cols = weeks.length;
  const rows = 7;

  const gridW = cols * (cell + gap) - gap;
  const gridH = rows * (cell + gap) - gap;

  const width = padX * 2 + leftW + gridW;
  const height = padY * 2 + headerH + gridH + bottomPad;

  // ---- Month labels (GitHub-like): based on first day-of-month encountered ----
  let monthLabels = "";

  const firstColForMonth = new Map(); // "YYYY-MM" -> first column index

  weeks.forEach((w, x) => {
    w.contributionDays.forEach((day) => {
      if (!day.date) return;
      const dt = new Date(day.date + "T00:00:00Z");
      const key = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
      if (!firstColForMonth.has(key)) firstColForMonth.set(key, x);
    });
  });

  const months = [...firstColForMonth.entries()].sort((a, b) => a[1] - b[1]);

  const minColsBetween = 3;
  let lastLabelX = -999;

  // Skip the first month label if it starts too close to the left edge (partial stub month)
  const skipIfStartsBeforeCol = 2;

  months.forEach(([key, colX], idx) => {
    if (idx === 0 && colX <= skipIfStartsBeforeCol) return;
    if (colX - lastLabelX < minColsBetween) return;

    const [, mm] = key.split("-");
    const mIndex = Number(mm) - 1;

    const lx = padX + leftW + colX * (cell + gap);
    const ly = padY + 14;

    monthLabels += `<text x="${lx}" y="${ly}" font-family="ui-sans-serif,system-ui" font-size="12" fill="${text}">${monthName(mIndex)}</text>\n`;
    lastLabelX = colX;
  });

  // ---- Day labels (Mon/Wed/Fri) ----
  const dayLabels = [
    { label: "Mon", row: 1 },
    { label: "Wed", row: 3 },
    { label: "Fri", row: 5 },
  ]
    .map(({ label, row }) => {
      const x = padX;
      const y = padY + headerH + row * (cell + gap) + cell - 1;
      return `<text x="${x}" y="${y}" font-family="ui-sans-serif,system-ui" font-size="12" fill="${text}">${label}</text>`;
    })
    .join("\n");

  // ---- Squares ----
  let rects = "";
  weeks.forEach((w, x) => {
    w.contributionDays.forEach((d, y) => {
      const fill = colors[level(d.contributionCount)];
      const px = padX + leftW + x * (cell + gap);
      const py = padY + headerH + y * (cell + gap);
      rects += `<rect x="${px}" y="${py}" width="${cell}" height="${cell}" rx="2" fill="${fill}">
  <title>${d.date}: ${d.contributionCount} contributions</title>
</rect>\n`;
    });
  });

  // ---- Background card (non-transparent) ----
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect x="0" y="0" width="${width}" height="${height}" rx="12" fill="${bg}" stroke="${border}" />
  ${monthLabels}
  ${dayLabels}
  ${rects}
</svg>`;
}

async function main() {
  const res = await octokit.graphql(query, { login: username });
  const weeks = res.user.contributionsCollection.contributionCalendar.weeks;

  const svg = renderSVG(weeks);

  fs.mkdirSync("assets", { recursive: true });
  fs.writeFileSync("assets/contributions.svg", svg, "utf8");
  console.log("Generated assets/contributions.svg");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
