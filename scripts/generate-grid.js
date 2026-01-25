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

// Purple ramp (edit these if you want)
const colors = [
  "#161b22", // empty (GitHub dark tile)
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
  // GitHub-like sizing
  const cell = 10;
  const gap = 3;

  const padX = 16;
  const padY = 10;

  const headerH = 20; // months row
  const leftW = 32;   // day labels column
  const legendH = 22; // legend row

  const cols = weeks.length;
  const rows = 7;

  const gridW = cols * (cell + gap) - gap;
  const gridH = rows * (cell + gap) - gap;

  const width = padX * 2 + leftW + gridW;
  const height = padY * 2 + headerH + gridH + legendH;

// Month labels: based on first day-of-month encountered (GitHub-like)
let monthLabels = "";

// Map monthKey -> first column index where that month appears
// monthKey is "YYYY-MM" so year boundaries are handled correctly.
const firstColForMonth = new Map();

// Walk days left->right, top->bottom, record first time we see a month
weeks.forEach((w, x) => {
  w.contributionDays.forEach((day) => {
    if (!day.date) return;
    const dt = new Date(day.date + "T00:00:00Z");
    const key = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
    if (!firstColForMonth.has(key)) firstColForMonth.set(key, x);
  });
});

// Sort months by their first column
const months = [...firstColForMonth.entries()]
  .sort((a, b) => a[1] - b[1]); // by column index

// Avoid overlap like GitHub (only label if far enough from last label)
const minColsBetween = 3;
let lastLabelX = -999;

// IMPORTANT: drop the first label if it's a tiny partial month at the very start.
// This fixes "Jan" showing at far-left when the 12-mo window should start at Feb.
// (If a month starts in the first 2 columns, it's almost always just a stub.)
const skipIfStartsBeforeCol = 2;

months.forEach(([key, colX], idx) => {
  // Skip first label if it starts too close to the left edge (partial month stub)
  if (idx === 0 && colX <= skipIfStartsBeforeCol) return;

  if (colX - lastLabelX < minColsBetween) return;

  const [yyyy, mm] = key.split("-");
  const mIndex = Number(mm) - 1;

  const lx = padX + leftW + colX * (cell + gap);
  const ly = padY + 14;

  monthLabels += `<text x="${lx}" y="${ly}" font-family="ui-sans-serif,system-ui" font-size="12" fill="${text}">${monthName(mIndex)}</text>\n`;
  lastLabelX = colX;
});

  // Day labels (Mon/Wed/Fri)
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

  // Squares + hover title
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

  // Transparent SVG (no background rect)
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  ${monthLabels}
  ${dayLabels}
  ${rects}
  ${legend}
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
