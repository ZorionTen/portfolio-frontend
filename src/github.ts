import { useEffect, useState } from 'react'

export type GithubRepository = {
  id: string
  name: string
  description: string | null
  isPrivate: boolean
  isFork: boolean
  languages: string[]
  lastUpdatedAt: string
  url: string | null
}

export type GithubPortfolio = {
  repositories: GithubRepository[]
  rushServe: {
    repositoryCount: number
    lastUpdatedAt: string | null
  }
  fetchedAt: string
}

export type GithubPortfolioState = {
  data: GithubPortfolio | null
  isLoading: boolean
  hasError: boolean
}

export function useGithubPortfolio(backendBaseUrl: string): GithubPortfolioState {
  const [state, setState] = useState<GithubPortfolioState>({
    data: null,
    isLoading: true,
    hasError: false,
  })

  useEffect(() => {
    const request = new AbortController()

    const loadRepositories = async () => {
      try {
        const response = await fetch(`${backendBaseUrl}/api/github/repositories`, {
          signal: request.signal,
        })
        if (!response.ok) throw new Error('GitHub repository request failed')

        const data = (await response.json()) as GithubPortfolio
        if (!request.signal.aborted) {
          setState({ data, isLoading: false, hasError: false })
        }
      } catch {
        if (!request.signal.aborted) {
          setState({ data: null, isLoading: false, hasError: true })
        }
      }
    }

    void loadRepositories()
    return () => request.abort()
  }, [backendBaseUrl])

  return state
}

export function formatGithubDate(value: string | null): string {
  if (!value) return 'No commit activity'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value))
}
