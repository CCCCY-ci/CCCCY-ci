import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execSync } from "node:child_process";

const root = dirname(fileURLToPath(import.meta.url));
const assetsDir = join(root, "assets");
const datesDir = join(assetsDir, "repository-dates");

let token = process.env.GH_TOKEN;
if (!token) {
  try {
    token = execSync("gh auth token", { encoding: "utf-8" }).trim();
  } catch {
    token = "";
  }
}

const login = (process.env.GH_USERNAME || "CCCCY-ci").trim();

const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "profile-readme-builder",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
};

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const labels = {
  en: {
    overview: `${login} open-source overview`,
    totalStars: "Total stars",
    repositories: "repositories",
    followers: "Followers",
    forks: "Forks",
    contributedTo: "Contributed to",
    commits: "Commits",
    activity: "Contributions",
    prs: "Pull requests",
    issues: "Issues",
    starSources: "Star sources",
    owned: "Owned repositories",
    member: "Member / collaborator",
    organizations: "Organizations",
  },
  "zh-CN": {
    overview: `${login} 开源概览`,
    totalStars: "Star 总数",
    repositories: "个仓库",
    followers: "关注者",
    forks: "复刻",
    contributedTo: "参与项目",
    commits: "提交数",
    activity: "贡献分布",
    prs: "合并请求",
    issues: "议题",
    starSources: "Star 来源",
    owned: "个人仓库",
    member: "成员 / 协作仓库",
    organizations: "组织仓库",
  },
};

const styles = `
  text{font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:16px}
  .section{font-size:24px;font-weight:700;fill:#171717}
  .rule{stroke:#d4d4d4;stroke-width:1}
  .meta{font-size:13px;font-style:italic;fill:#737373;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace}
  @media(prefers-color-scheme:dark){.section{fill:#fafafa}.rule{stroke:#404040}.meta{fill:#8b949e}}`;

function buildSectionHeadingSvg(title) {
  const textWidth = [...title].reduce(
    (width, char) =>
      width +
      (/[\u2e80-\uffff]/u.test(char)
        ? 1
        : /[ilI.,:;'!|]/.test(char)
        ? 0.3
        : /[MW@%]/.test(char)
        ? 0.95
        : /\s/.test(char)
        ? 0.32
        : /[A-Z0-9]/.test(char)
        ? 0.66
        : 0.57) *
        24,
    0
  );
  const lineStart = Math.ceil(textWidth * 1.06 + 24);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="64" role="img" aria-labelledby="title">
<title id="title">${escapeXml(title)}</title>
<style>${styles}</style>
<line class="rule" x1="${lineStart}" y1="32" x2="100%" y2="32"/>
<text class="section" x="0" y="40">${escapeXml(title)}</text>
</svg>
`;
}

function buildRepositoryDateSvg(createdAt) {
  const date = createdAt ? createdAt.slice(0, 10) : "—";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="112" height="24" viewBox="0 0 112 24" role="img" aria-labelledby="title">
<title id="title">Created ${escapeXml(date)}</title>
<style>${styles}</style>
<text class="meta" text-anchor="end" x="110" y="17">${escapeXml(date)}</text>
</svg>
`;
}

function breakdown(items) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  let x = 0;
  return items.map((item, index) => {
    const width = total > 0 ? (item.value / total) * 400 : 0;
    const segment = {
      ...item,
      x,
      width,
      percent: total > 0 ? (item.value / total) * 100 : 0,
      tone: `tone${index % 3}`,
    };
    x += width;
    return segment;
  });
}

function buildOverviewSvg(input, locale = "en") {
  const text = labels[locale] || labels.en;
  const n = (val) => Number(val).toLocaleString("en-US");

  const starSegments = breakdown(
    input.starSources.map((item) => ({
      ...item,
      label:
        item.label === "Owned repositories"
          ? text.owned
          : item.label === "Member / collaborator"
          ? text.member
          : text.organizations,
    }))
  );

  const activitySegments = breakdown([
    { label: text.commits, value: input.activity.commits },
    { label: text.prs, value: input.activity.prs },
    { label: text.issues, value: input.activity.issues },
  ]);

  const stat = (x, y, value, label) =>
    `<text class="stat" x="${x}" y="${y}">${n(value)}</text>\n<text class="label" x="${x}" y="${y + 18}">${escapeXml(label)}</text>`;

  const chart = (x, title, segments) => `<g transform="translate(${x}, 148)">
  <text class="title" x="0" y="0">${escapeXml(title)}</text>
  <g transform="translate(0, 14)">
    <rect class="track" width="400" height="8" rx="4"/>
    <g clip-path="url(#bar)">${segments
      .map(
        (s) =>
          `<rect class="${s.tone}" x="${s.x.toFixed(2)}" y="0" width="${s.width.toFixed(2)}" height="8"/>`
      )
      .join("")}</g>
  </g>
  ${segments
    .map(
      (s, i) => `<g transform="translate(0, ${48 + i * 26})">
    <circle class="${s.tone}" cx="4" cy="-5" r="4"/>
    <text class="body" x="16" y="0">${escapeXml(s.label)}</text>
    <text class="body" text-anchor="end" x="330" y="0">${n(s.value)}</text>
    <text class="value" text-anchor="end" x="400" y="0">${s.percent.toFixed(1)}%</text>
  </g>`
    )
    .join("\n  ")}
</g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" lang="${locale}" width="840" height="264" viewBox="0 0 840 264" role="img" aria-labelledby="overview-title">
<title id="overview-title">${escapeXml(text.overview)}</title>
<defs><clipPath id="bar"><rect width="400" height="8" rx="4"/></clipPath></defs>
<style>
  text{font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-variant-numeric:tabular-nums;fill:#171717}
  .hero{font-size:80px;font-weight:800;letter-spacing:-3px;fill:#171717}
  .stat{font-size:24px;font-weight:700;letter-spacing:-0.5px}
  .title{font-size:15px;font-weight:600}
  .label{font-size:13px;fill:#737373}
  .body{font-size:14px}
  .value{font-size:14px;fill:#737373}
  .track{fill:#f5f5f5}
  .tone0{fill:#171717}
  .tone1{fill:#737373}
  .tone2{fill:#d4d4d4}
  @media(prefers-color-scheme:dark){
    text{fill:#fafafa}
    .hero,.tone0{fill:#fafafa}
    .label,.value,.tone1{fill:#a3a3a3}
    .track{fill:#262626}
    .tone2{fill:#525252}
  }
</style>

<!-- Stars on the left; four supporting metrics in a 2 x 2 grid on the right -->
<text class="hero" x="0" y="68">${n(input.stars)}</text>
<text class="label" x="0" y="100">${escapeXml(text.totalStars)} · ${n(input.repositoryCount)} ${escapeXml(text.repositories)}</text>
${stat(440, 29, input.followers, text.followers)}
${stat(640, 29, input.forks, text.forks)}
${stat(440, 82, input.activity.contributed_to, text.contributedTo)}
${stat(640, 82, input.activity.commits, text.commits)}

<!-- Star sources and activity -->
${chart(0, text.starSources, starSegments)}
${chart(440, text.activity, activitySegments)}
</svg>
`;
}

async function fetchStats() {
  // 1. User info
  const userRes = await fetch(`https://api.github.com/users/${login}`, { headers });
  const userData = await userRes.json();

  // 2. Repositories
  let repos = [];
  let page = 1;
  while (true) {
    const res = await fetch(`https://api.github.com/user/repos?type=all&per_page=100&page=${page}`, { headers });
    if (!res.ok) break;
    const batch = await res.json();
    if (!Array.isArray(batch)) break;
    repos.push(...batch);
    if (batch.length < 100) break;
    page++;
  }

  // 3. GraphQL contributions
  const gqlQuery = `
    query($login: String!) {
      user(login: $login) {
        contributionsCollection {
          totalCommitContributions
          totalPullRequestContributions
          totalIssueContributions
          totalRepositoryContributions
        }
        repositoriesContributedTo(first: 100, contributionTypes: [COMMIT, ISSUE, PULL_REQUEST]) {
          totalCount
        }
      }
    }
  `;
  let gqlData = {};
  try {
    const gqlRes = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ query: gqlQuery, variables: { login } }),
    });
    gqlData = await gqlRes.json();
  } catch (e) {
    console.error("GraphQL error:", e);
  }

  // 4. Search counts
  const fetchCount = async (url) => {
    try {
      const res = await fetch(url, { headers });
      const data = await res.json();
      return data.total_count ?? 0;
    } catch {
      return 0;
    }
  };

  const [searchCommits, searchPRs, searchIssues] = await Promise.all([
    fetchCount(`https://api.github.com/search/commits?q=author:${login}`),
    fetchCount(`https://api.github.com/search/issues?q=author:${login}+is:pr`),
    fetchCount(`https://api.github.com/search/issues?q=author:${login}+is:issue`),
  ]);

  const ownedRepos = repos.filter((r) => r.owner && r.owner.login === login && !r.fork);
  const memberRepos = repos.filter((r) => r.owner && r.owner.login !== login && !r.fork);
  const ownedStars = ownedRepos.reduce((acc, r) => acc + (r.stargazers_count || 0), 0);
  const memberStars = memberRepos.reduce((acc, r) => acc + (r.stargazers_count || 0), 0);
  const totalStars = ownedStars + memberStars;
  const totalForks = ownedRepos.reduce((acc, r) => acc + (r.forks_count || 0), 0);

  const collection = gqlData.data?.user?.contributionsCollection;
  const commits = Math.max(collection?.totalCommitContributions || 0, searchCommits);
  const prs = Math.max(collection?.totalPullRequestContributions || 0, searchPRs);
  const issues = Math.max(collection?.totalIssueContributions || 0, searchIssues);
  const contributedTo = gqlData.data?.user?.repositoriesContributedTo?.totalCount || memberRepos.length;

  return {
    followers: userData.followers || 0,
    stars: totalStars,
    forks: totalForks,
    repositoryCount: ownedRepos.length,
    activity: {
      commits,
      prs,
      issues,
      contributed_to: contributedTo,
    },
    starSources: [
      { label: "Owned repositories", value: ownedStars },
      { label: "Member / collaborator", value: memberStars },
      { label: "Organizations", value: 0 },
    ],
    repos,
  };
}

async function main() {
  await mkdir(datesDir, { recursive: true });

  console.log(`Refreshing profile stats for ${login}...`);
  const stats = await fetchStats();

  // Curated repositories
  const curatedConfig = JSON.parse(await readFile(join(root, "repositories.json"), "utf-8"));
  const repoMetaMap = new Map();
  for (const r of stats.repos) {
    repoMetaMap.set(r.full_name.toLowerCase(), r);
  }

  // Generate repository dates SVGs and markup
  for (const item of curatedConfig) {
    const repoData = repoMetaMap.get(item.repository.toLowerCase());
    const createdAt = repoData?.created_at || new Date().toISOString();
    const stars = repoData?.stargazers_count ?? 0;
    item.stars = stars;
    item.created_at = createdAt;

    const slug = item.repository.replace("/", "-");
    await writeFile(join(datesDir, `${slug}.svg`), buildRepositoryDateSvg(createdAt));
  }

  // Generate overview SVGs
  await writeFile(join(assetsDir, "overview-heading.svg"), buildSectionHeadingSvg("Overview"));
  await writeFile(join(assetsDir, "overview-heading.zh-CN.svg"), buildSectionHeadingSvg("概览"));
  await writeFile(join(assetsDir, "repositories-heading.svg"), buildSectionHeadingSvg("Repositories"));
  await writeFile(join(assetsDir, "repositories-heading.zh-CN.svg"), buildSectionHeadingSvg("精选项目"));

  await writeFile(join(assetsDir, "github-overview.svg"), buildOverviewSvg(stats, "en"));
  await writeFile(join(assetsDir, "github-overview.zh-CN.svg"), buildOverviewSvg(stats, "zh-CN"));

  // Generate Repository lists
  function renderRepoList(locale = "en") {
    return (
      "<!-- repositories starts -->\n<div>\n" +
      curatedConfig
        .map((repo) => {
          const desc = locale === "zh-CN" ? repo.description_zh || repo.description : repo.description;
          const slug = repo.repository.replace("/", "-");
          return `<p>
  <img align="right" src="./assets/repository-dates/${slug}.svg" alt="Created ${repo.created_at.slice(0, 10)}" width="112" height="24">
  <strong><a href="https://github.com/${escapeXml(repo.repository)}">${escapeXml(repo.name)}</a></strong> &nbsp; <span>★&nbsp;${repo.stars.toLocaleString("en-US")}</span><br>
  ${escapeXml(desc)}
</p>`;
        })
        .join("\n") +
      "\n</div>\n<!-- repositories ends -->"
    );
  }

  // Update README.md & README.zh-CN.md
  const readmeEnPath = join(root, "README.md");
  let contentEn = await readFile(readmeEnPath, "utf-8");
  contentEn = contentEn.replace(
    /<!-- repositories starts -->[\s\S]*<!-- repositories ends -->/,
    renderRepoList("en")
  );
  await writeFile(readmeEnPath, contentEn);

  const readmeZhPath = join(root, "README.zh-CN.md");
  let contentZh = await readFile(readmeZhPath, "utf-8");
  contentZh = contentZh.replace(
    /<!-- repositories starts -->[\s\S]*<!-- repositories ends -->/,
    renderRepoList("zh-CN")
  );
  await writeFile(readmeZhPath, contentZh);

  // Write snapshot
  await writeFile(join(root, "github_overview.json"), JSON.stringify(stats, null, 2));

  console.log("README and SVGs updated successfully!");
}

main().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
