import { formatDateCN, formatDateRangeCN, monthLabel } from "./utils.mjs"

function getFallbackSummary({ stats, year, issuesCount }) {
  const hottestMonth = stats.maxContributionsMonth
    ? `${Number(stats.maxContributionsMonth.slice(5, 7))}月`
    : "暂无峰值"

  const busiestDayText = stats.maxContributionsDate
    ? `${formatDateCN(stats.maxContributionsDate)} 达到 ${stats.maxContributionsInADay} 次贡献`
    : "本年度暂无有效贡献记录"

  return {
    intro: `你在 ${year} 年保持了稳定的 GitHub 活跃度，全年贡献 ${stats.totalContributions} 次，日均 ${stats.averageContributionsPerDay} 次。`,
    sections: [
      {
        heading: "活跃节奏",
        content: `贡献峰值集中在 ${hottestMonth}，最长连续打卡 ${stats.longestStreak} 天。`,
      },
      {
        heading: "高光时刻",
        content: busiestDayText,
      },
      {
        heading: "协作信号",
        content: `你在 ${year} 年共参与 ${issuesCount} 个 Issues，最长休息间隔 ${stats.longestGap} 天（${formatDateRangeCN(stats.longestGapStartDate, stats.longestGapEndDate)}）。`,
      },
    ],
  }
}

function normalizeOpenAIBaseUrl(baseUrl) {
  if (!baseUrl) {
    return "https://api.openai.com/v1"
  }

  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl
}

export async function generateAiSummary(options) {
  const {
    enabled,
    apiKey,
    baseUrl,
    model,
    username,
    year,
    stats,
    issuesCount,
    topLanguages,
    topRepos,
  } = options

  const fallback = getFallbackSummary({ stats, year, issuesCount })

  if (!enabled || !apiKey) {
    return {
      mode: "fallback",
      ...fallback,
      reason: "AI is disabled or OPENAI_API_KEY is missing",
    }
  }

  const endpoint = `${normalizeOpenAIBaseUrl(baseUrl)}/chat/completions`
  const topLanguageText = topLanguages
    .slice(0, 3)
    .map((item, idx) => `#${idx + 1} ${item.language}`)
    .join("，")

  const topRepoText = topRepos
    .slice(0, 3)
    .map((repo) => `${repo.nameWithOwner}(${repo.commits})`)
    .join("，")

  const promptData = {
    username,
    year,
    totalContributions: stats.totalContributions,
    averagePerDay: stats.averageContributionsPerDay,
    longestStreak: stats.longestStreak,
    longestGap: stats.longestGap,
    mostActiveMonth: stats.maxContributionsMonth,
    maxContributionsDay: stats.maxContributionsInADay,
    maxContributionsDate: stats.maxContributionsDate,
    issuesCount,
    topLanguages: topLanguageText,
    topRepos: topRepoText,
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20000)

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "你是 GitHub 年报分析助手。请基于输入数据生成克制专业、简洁的中文总结。输出 JSON，格式必须是 {\"intro\":string,\"sections\":[{\"heading\":string,\"content\":string}] }。sections 固定 3 项。",
          },
          {
            role: "user",
            content: `请分析以下数据并输出 JSON: ${JSON.stringify(promptData)}`,
          },
        ],
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const message = await response.text()
      throw new Error(`OpenAI request failed (${response.status}): ${message}`)
    }

    const payload = await response.json()
    const content = payload?.choices?.[0]?.message?.content

    if (!content) {
      throw new Error("OpenAI returned empty content")
    }

    const parsed = JSON.parse(content)

    if (!parsed?.intro || !Array.isArray(parsed?.sections) || parsed.sections.length === 0) {
      throw new Error("OpenAI response schema is invalid")
    }

    return {
      mode: "ai",
      intro: String(parsed.intro),
      sections: parsed.sections.slice(0, 3).map((item) => ({
        heading: String(item.heading ?? "分析"),
        content: String(item.content ?? ""),
      })),
    }
  }
  catch (error) {
    return {
      mode: "fallback",
      ...fallback,
      reason: error instanceof Error ? error.message : "Unknown AI error",
    }
  }
  finally {
    clearTimeout(timeout)
  }
}
