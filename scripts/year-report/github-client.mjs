const GITHUB_GRAPHQL_ENDPOINT = "https://api.github.com/graphql"

export class GitHubClient {
  constructor({ token, fetchImpl = globalThis.fetch, timeoutMs = 30_000, retries = 2, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
    if (!token) throw new Error("A GitHub token is required (GH_STATS_TOKEN or GITHUB_TOKEN)")
    this.token = token
    this.fetchImpl = fetchImpl
    this.timeoutMs = timeoutMs
    this.retries = retries
    this.sleep = sleep
  }

  async graphql(query, variables = {}) {
    for (let attempt = 0; ; attempt++) {
      let response
      try {
        response = await this.fetchImpl(GITHUB_GRAPHQL_ENDPOINT, {
          method: "POST",
          headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ query, variables }),
          signal: AbortSignal.timeout(this.timeoutMs),
        })
      } catch (error) {
        if (attempt >= this.retries) throw new Error("GitHub request failed after retries", { cause: error })
        await this.sleep(1000 * 2 ** attempt)
        continue
      }
      if (!response.ok) {
        if ((response.status === 429 || response.status >= 500) && attempt < this.retries) {
          await this.sleep(1000 * 2 ** attempt)
          continue
        }
        // Do not copy upstream bodies or credentials into public report artifacts.
        throw new Error(`GitHub GraphQL request failed (HTTP ${response.status}); check token validity, permissions and rate limits`)
      }
      const payload = await response.json()
      if (payload.errors?.length) throw new Error(`GitHub GraphQL error: ${payload.errors[0]?.message || "Unknown error"}`)
      if (!payload.data) throw new Error("GitHub GraphQL returned no data")
      return payload.data
    }
  }

  async fetchYearlyProfileData({ username, year, from, to }) {
    const query = `
      query YearlyProfileData($username: String!, $from: DateTime!, $to: DateTime!) {
        user(login: $username) {
          name login avatarUrl bio
          followers { totalCount }
          following { totalCount }
          contributionsCollection(from: $from, to: $to) {
            restrictedContributionsCount
            contributionCalendar {
              totalContributions
              weeks { contributionDays { contributionCount contributionLevel date weekday } }
            }
            commitContributionsByRepository(maxRepositories: 100) {
              contributions { totalCount }
              repository {
                isPrivate nameWithOwner url description stargazerCount forkCount
                languages(first: 20, orderBy: { field: SIZE, direction: DESC }) {
                  edges { size node { name } }
                }
              }
            }
          }
        }
        rateLimit { remaining resetAt }
      }
    `
    const data = await this.graphql(query, {
      username,
      from: from || `${year}-01-01T00:00:00Z`,
      to: to || `${year}-12-31T23:59:59Z`,
    })
    if (!data.user) throw new Error(`GitHub user not found: ${username}`)
    // The profile repository is PUBLIC. Never publish private repository names,
    // descriptions, URLs or language breakdowns, even when a PAT can read them.
    const collection = data.user.contributionsCollection
    collection.commitContributionsByRepository = (collection.commitContributionsByRepository || [])
      .filter(item => item.repository?.isPrivate === false)
    return data
  }

  async fetchIssueCount({ username, year, activityRange }) {
    return this.fetchAuthoredCount("issue", username, activityRange || `${year}-01-01..${year}-12-31`)
  }

  async fetchPrCount({ username, year, activityRange }) {
    return this.fetchAuthoredCount("pr", username, activityRange || `${year}-01-01..${year}-12-31`)
  }

  async fetchAuthoredCount(kind, username, range) {
    const query = `query AuthoredCount($queryString: String!) {
      search(type: ISSUE, query: $queryString, first: 1) { issueCount }
    }`
    const data = await this.graphql(query, {
      queryString: `author:${username} is:${kind} is:public created:${range}`,
    })
    if (!Number.isInteger(data.search?.issueCount)) throw new Error(`GitHub returned no ${kind} count`)
    return data.search.issueCount
  }
}
