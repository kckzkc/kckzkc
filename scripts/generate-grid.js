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

const bg = "#0d1117";       // GitHub dark
const border = "#161b22";
const text = "#c9d1d9";

// purple ramp (you can change these)
const colors = ["#161b22", "#2d1655", "#4c1d95", "#6d28d9", "#8b5cf6"];

function level(count) {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 6) return 2;
  if (count <= 12) return 3;
  return 4;
}

function renderSVG(weeks) {
  const cell = 11;
  const gap = 3;
  const pad = 16;
  const header = 26;

  const cols = weeks.length;
  const rows = 7;

  const width = pad * 2 + cols * (cell + gap) - gap;
  const height = pad * 2 + header + rows * (cell + gap) - gap;

  let rects = "";
  weeks.forEach((w, x) => {
    w.contributionDays.forEach((d, y) => {
      const fill = colors[level(d.contributionCount)];
      const px = pad + x * (cell + gap);
      const py = pad + header + y * (cell + gap);
      rects += `<rect x="${px}" y="${py}" width="${cell}" height="${cell}" rx="2" fill="${fill}">
  <title>${d.date}: ${d.contributionCount} contributions</title>
</rect>\n`;
    });
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" rx="12" fill="${bg}" stroke="${border}" />
  <text x="${pad}" y="${pad+16}" font-family="ui-sans-serif, system-ui" font-size="14" fill="${text}">
    Contributions
  </text>
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
