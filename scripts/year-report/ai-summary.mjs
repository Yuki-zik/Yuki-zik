import { formatDateCN, formatDateRangeCN } from "./utils.mjs"

function getFallbackSummary({ stats, year, issuesCount, isRolling }) {
  const yearText = isRolling ? "过去一年" : `${year} 年`
  const hottestMonth = stats.maxContributionsMonth
    ? `${Number(stats.maxContributionsMonth.slice(5, 7))}月`
    : "暂无峰值"

  const busiestDayText = stats.maxContributionsDate
    ? `${formatDateCN(stats.maxContributionsDate)} 达到 ${stats.maxContributionsInADay} 次贡献`
    : "本年度暂无有效贡献记录"

  return {
    intro: `你在 ${yearText} 保持了稳定的 GitHub 活跃度，全年贡献 ${stats.totalContributions} 次，日均 ${stats.averageContributionsPerDay} 次。`,
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
        content: `你在 ${yearText} 共参与 ${issuesCount} 个 Issues，最长休息间隔 ${stats.longestGap} 天（${formatDateRangeCN(stats.longestGapStartDate, stats.longestGapEndDate)}）。`,
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
    isRolling,
  } = options

  const fallback = getFallbackSummary({ stats, year, issuesCount, isRolling })

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
    mode: isRolling ? "Rolling 365 Days" : "Calendar Year",
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
              [
                "你是 GitHub 年报分析助手。",
                "目标：输出高信息密度、可复核的中文总结，避免空话、夸张和模板化修辞。",
                "要求：",
                "1) 所有判断必须基于输入数据，优先写具体数字、日期、排名、仓库名。",
                "2) 先讲结论，再讲证据；不要写与数据无关的鼓励语。",
                "3) 语言简洁专业，每段不超过2句。",
                "4) 若某项数据缺失，直接略过，不要臆测。",
                "输出 JSON，格式必须是 {\"intro\":string,\"sections\":[{\"heading\":string,\"content\":string}]}。",
                "sections 固定 3 项，建议主题：贡献概览、节奏与稳定性、技术与项目。",
              ].join("\n"),
          },
          {
            role: "user",
            content: [
              "请基于以下数据输出 JSON 年报摘要。",
              `模式：${isRolling ? "过去365天滚动统计" : `${year} 自然年统计`}。`,
              "请尽量包含：总贡献、日均、峰值月份、峰值日期、最长连续/最长间隔、issues、Top 语言与Top仓库。",
              `数据：${JSON.stringify(promptData)}`,
            ].join("\n"),
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

