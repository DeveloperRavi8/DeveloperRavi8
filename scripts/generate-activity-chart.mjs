import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DAY_MS = 24 * 60 * 60 * 1000;
const username = process.env.GITHUB_REPOSITORY_OWNER;
const token = process.env.GITHUB_TOKEN;

if (!username || !token) {
  throw new Error('GITHUB_REPOSITORY_OWNER and GITHUB_TOKEN are required.');
}

const today = new Date();
const endDate = today.toISOString().slice(0, 10);
const endMs = Date.parse(`${endDate}T00:00:00.000Z`);
const startDate = new Date(endMs - 364 * DAY_MS).toISOString().slice(0, 10);
const query = `
  query ContributionCalendar($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar {
          weeks {
            contributionDays {
              date
              contributionCount
            }
          }
        }
      }
    }
  }
`;

async function fetchCalendarCounts(fromMs, toMs) {
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'developer-ravi8-profile-activity-chart',
    },
    body: JSON.stringify({
      query,
      variables: {
        login: username,
        from: new Date(fromMs).toISOString(),
        to: new Date(toMs).toISOString(),
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`GitHub GraphQL request failed with HTTP ${response.status}.`);
  }

  const payload = await response.json();
  if (payload.errors?.length) {
    throw new Error(`GitHub GraphQL returned an error: ${payload.errors[0].message}`);
  }

  const calendar = payload.data?.user?.contributionsCollection?.contributionCalendar;
  if (!calendar?.weeks) {
    throw new Error(`No contribution calendar was returned for ${username}.`);
  }

  const counts = new Map();
  for (const week of calendar.weeks) {
    for (const day of week.contributionDays ?? []) {
      const count = day.contributionCount;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date) || !Number.isSafeInteger(count) || count < 0) {
        throw new Error('GitHub returned an invalid contribution day.');
      }
      const existing = counts.get(day.date);
      if (existing !== undefined && existing !== count) {
        throw new Error(`GitHub returned conflicting contribution counts for ${day.date}.`);
      }
      counts.set(day.date, count);
    }
  }
  return counts;
}

const countsByDate = await fetchCalendarCounts(endMs - 365 * DAY_MS, endMs + 2 * DAY_MS);
const targetDates = [];
for (let dayMs = endMs - 364 * DAY_MS; dayMs <= endMs; dayMs += DAY_MS) {
  targetDates.push(new Date(dayMs).toISOString().slice(0, 10));
}

const missingDates = targetDates.filter((date) => !countsByDate.has(date));
if (missingDates.length) {
  const firstMissingMs = Date.parse(`${missingDates[0]}T00:00:00.000Z`);
  const lastMissingMs = Date.parse(`${missingDates.at(-1)}T00:00:00.000Z`);
  if (lastMissingMs - firstMissingMs > 28 * DAY_MS) {
    throw new Error(`GitHub's calendar omitted a range of days beginning ${missingDates[0]}.`);
  }

  // Long GitHub calendars can omit their first partial week. Query only the
  // missing boundary dates; the long-range response remains authoritative for
  // every overlapping day, which avoids conflicting counts between windows.
  const boundaryCounts = await fetchCalendarCounts(
    firstMissingMs - 14 * DAY_MS,
    lastMissingMs + 14 * DAY_MS,
  );
  for (const date of missingDates) {
    const count = boundaryCounts.get(date);
    if (count === undefined) {
      throw new Error(`GitHub's calendar did not include ${date}.`);
    }
    countsByDate.set(date, count);
  }
}

const allDays = targetDates.map((date) => ({ date, count: countsByDate.get(date) }));

const width = 1120;
const height = 340;
const plot = { left: 74, right: 1080, top: 90, bottom: 258 };
const plotWidth = plot.right - plot.left;
const plotHeight = plot.bottom - plot.top;
const outputDirectory = path.resolve('dist/activity');

function xml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function svgForRange(range) {
  const days = allDays.slice(-range);
  const total = days.reduce((sum, day) => sum + day.count, 0);
  const peak = Math.max(1, ...days.map((day) => day.count));
  const scale = Math.max(4, Math.ceil(peak / 4) * 4);
  const slotWidth = plotWidth / days.length;
  const barWidth = Math.max(1.5, slotWidth * 0.66);
  const yFor = (value) => plot.bottom - (value / scale) * plotHeight;
  const grid = [0, scale / 2, scale].map((value) => {
    const y = yFor(value);
    return `<g><line x1="${plot.left}" y1="${y}" x2="${plot.right}" y2="${y}" stroke="#28314a" stroke-width="1"/><text x="${plot.left - 14}" y="${y + 4}" text-anchor="end" fill="#7885a8" font-size="11">${Math.round(value)}</text></g>`;
  }).join('');

  const bars = days.map((day, index) => {
    const barHeight = day.count === 0 ? 2 : Math.max(3, (day.count / scale) * plotHeight);
    const x = plot.left + index * slotWidth + (slotWidth - barWidth) / 2;
    const y = plot.bottom - barHeight;
    const fill = day.count === 0 ? '#222a40'
      : day.count <= scale / 4 ? '#5140a1'
        : day.count <= scale / 2 ? '#7657d8'
          : '#b783ff';
    const label = `${day.date}: ${day.count} ${day.count === 1 ? 'contribution' : 'contributions'}`;
    return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${barHeight.toFixed(2)}" rx="2" fill="${fill}"><title>${xml(label)}</title></rect>`;
  }).join('');

  const trend = days.map((_, index) => {
    const windowStart = Math.max(0, index - 6);
    const average = days.slice(windowStart, index + 1).reduce((sum, day) => sum + day.count, 0) / (index - windowStart + 1);
    const x = plot.left + index * slotWidth + slotWidth / 2;
    return `${x.toFixed(2)},${yFor(average).toFixed(2)}`;
  }).join(' ');

  const monthLabels = days.map((day, index) => {
    const monthStart = index === 0 || day.date.slice(0, 7) !== days[index - 1].date.slice(0, 7);
    if (!monthStart) return '';
    const date = new Date(`${day.date}T00:00:00.000Z`);
    const label = new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' }).format(date).toUpperCase();
    const x = plot.left + index * slotWidth;
    return `<text x="${x.toFixed(2)}" y="${plot.bottom + 25}" fill="#8793b5" font-size="10" letter-spacing="1">${label}</text>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">GitHub contribution activity over ${range} days</title>
  <desc id="desc">${total} contributions from ${days[0].date} through ${days.at(-1).date}. Daily bars and a seven-day average trend.</desc>
  <defs>
    <linearGradient id="panel" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#151a2d"/><stop offset="100%" stop-color="#101525"/></linearGradient>
    <linearGradient id="trend" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#69a7ff"/><stop offset="100%" stop-color="#4de1d2"/></linearGradient>
  </defs>
  <rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="18" fill="url(#panel)" stroke="#28314a"/>
  <text x="38" y="38" fill="#d6ddf5" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="13" font-weight="700" letter-spacing="1.4">CONTRIBUTION SIGNAL</text>
  <text x="38" y="62" fill="#8591b5" font-family="ui-sans-serif, system-ui, sans-serif" font-size="12">${days[0].date}  &#8594;  ${days.at(-1).date} UTC &#183; ${range} DAYS</text>
  <text x="1080" y="41" text-anchor="end" fill="#70e6d6" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="22" font-weight="700">${total.toLocaleString('en-US')}</text>
  <text x="1080" y="61" text-anchor="end" fill="#8591b5" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11">TOTAL CONTRIBUTIONS</text>
  ${grid}
  ${bars}
  <polyline points="${trend}" fill="none" stroke="url(#trend)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.95"/>
  ${monthLabels}
  <line x1="38" y1="300" x2="58" y2="300" stroke="url(#trend)" stroke-width="2.5" stroke-linecap="round"/>
  <text x="66" y="304" fill="#a9b3d1" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11">7-day average</text>
  <rect x="181" y="294" width="11" height="11" rx="3" fill="#7657d8"/>
  <text x="200" y="304" fill="#a9b3d1" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11">daily contributions</text>
  <text x="1080" y="304" text-anchor="end" fill="#596583" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="10">SOURCE: GITHUB CONTRIBUTION CALENDAR</text>
</svg>`;
}

await mkdir(outputDirectory, { recursive: true });
for (const range of [30, 90, 365]) {
  const filePath = path.join(outputDirectory, `activity-${range}d.svg`);
  await writeFile(filePath, svgForRange(range), 'utf8');
  console.log(`Generated ${filePath}`);
}
