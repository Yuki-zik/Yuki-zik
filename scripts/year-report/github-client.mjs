const GITHUB_GRAPHQL_ENDPOINT = "https://api.github.com/graphql"

export class GitHubClient {
  constructor({ token }) {
    if (!token) {
      throw new Error("GH_STATS_TOKEN is required")
    }

    this.token = token
  }

  async graphql(query, variables = {}) {
    const response = await fetch(GITHUB_GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`GitHub GraphQL request failed (${response.status}): ${body}`)
    }

    const payload = await response.json()

    if (Array.isArray(payload.errors) && payload.errors.length > 0) {
      const firstError = payload.errors[0]
      throw new Error(`GitHub GraphQL error: ${firstError?.message ?? "Unknown error"}`)
    }

    return payload.data
  }

  async fetchYearlyProfileData({ username, year, from, to }) {
    const fromDate = from || `${year}-01-01T00:00:00Z`
    const toDate = to || `${year}-12-31T23:59:59Z`

    const query = `
      query YearlyProfileData($username: String!, $from: DateTime!, $to: DateTime!) {
        user(login: $username) {
          name
          login
          avatarUrl
          bio
          followers {
            totalCount
          }
          following {
            totalCount
          }
          contributionsCollection(from: $from, to: $to) {
            contributionCalendar {
              totalContributions
              weeks {
                contributionDays {
                  contributionCount
                  contributionLevel
                  date
                  weekday
                }
              }
            }
            commitContributionsByRepository(maxRepositories: 100) {
              contributions {
                totalCount
              }
              repository {
                nameWithOwner
                url
                description
                stargazerCount
                forkCount
                languages(first: 20, orderBy: { field: SIZE, direction: DESC }) {
                  edges {
                    size
                    node {
                      name
                    }
                  }
                }
              }
            }
          }
        }
        rateLimit {
          remaining
          resetAt
        }
      }
    `

    const data = await this.graphql(query, { username, from: fromDate, to: toDate })

    if (!data?.user) {
      throw new Error(`GitHub user not found: ${username}`)
    }

    return data
  }

  async fetchIssueCount({ username, year, createdRange }) {
    const range = createdRange || `${year}-01-01..${year}-12-31`
    const queryString = `involves:${username} is:issue created:${range}`

    const query = `
      query IssueCount($queryString: String!) {
        search(type: ISSUE, query: $queryString, first: 1) {
          issueCount
        }
      }
    `

    const data = await this.graphql(query, { queryString })

    return data?.search?.issueCount ?? 0
  }

  async fetchPrCount({ username, year, createdRange }) {
    const range = createdRange || `${year}-01-01..${year}-12-31`
    const queryString = `author:${username} is:pr created:${range}`

    const query = `
      query PrCount($queryString: String!) {
        search(type: ISSUE, query: $queryString, first: 1) {
          issueCount
        }
      }
    `

    const data = await this.graphql(query, { queryString })

    return data?.search?.issueCount ?? 0
  }
}
