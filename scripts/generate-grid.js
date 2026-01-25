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

  // Month labels: label when month changes
let monthLabels = "";
let lastMonth = null;
let lastLabelX = -999;          // last labeled column index
const minColsBetween = 3;       // prevent overlap (tweak 3–5)

weeks.forEach((w, x) => {
  const topDay = w.contributionDays[0]; // Sunday
  const d = new Date(topDay.date + "T00:00:00Z");
  const m = d.getUTCMonth();

  const monthChanged = (m !== lastMonth);
  const farEnough = (x - lastLabelX) >= minColsBetween;

  if (monthChanged && farEnough) {
    const lx = padX + leftW + x * (cell + gap);
    const ly = padY + 14;
    monthLabels += `<text x="${lx}" y="${ly}" font-family="ui-sans-serif,system-ui" font-size="12" fill="${text}">${monthName(m)}</text>\n`;
    lastLabelX = x;
  }

  lastMonth = m;
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

  // Legend (Less -> More) bottom-right
  const legendX = padX + leftW + gridW - (5 * cell + 4 * gap + 55);
  const legendY = padY + headerH + gridH + 16;

  const legendSquares = colors
    .map((c, i) => {
      const x = legendX + 38 + i * (cell + gap);
      const y = legendY - cell + 2;
      return `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="${c}" />`;
    })
    .join("\n");

  const legend = `
<text x="${legendX}" y="${legendY}" font-family="ui-sans-serif,system-ui" font-size="12" fill="${text}">Less</text>
${legendSquares}
<text x="${legendX + 38 + 5 * (cell + gap) + 6}" y="${legendY}" font-family="ui-sans-serif,system-ui" font-size="12" fill="${text}">More</text>
`;

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
