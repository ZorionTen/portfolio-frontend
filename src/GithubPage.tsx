import { formatGithubDate } from './github'
import type { GithubPortfolioState, GithubRepository } from './github'

type GithubPageProps = {
  github: GithubPortfolioState
}

const ExternalLinkIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M14 5h5v5M19 5l-9 9" />
    <path d="M19 13v6H5V5h6" />
  </svg>
)

function RepositoryEntry({ repository, index }: { repository: GithubRepository; index: number }) {
  return (
    <article className="repository-entry">
      <div className="repository-index">{String(index + 1).padStart(2, '0')}</div>
      <div className="repository-main">
        <div className="repository-title-line">
          {repository.url ? (
            <a href={repository.url} target="_blank" rel="noreferrer">
              {repository.name}<ExternalLinkIcon />
            </a>
          ) : (
            <h2>{repository.name}</h2>
          )}
          <span className={repository.isPrivate ? 'visibility-private' : 'visibility-public'}>
            {repository.isPrivate ? 'Private' : 'Public'}
          </span>
        </div>
        <p>{repository.description || 'Repository details are not publicly documented.'}</p>
      </div>
      <div className="repository-meta">
        <span>{repository.language || 'No primary language'}</span>
        {repository.isFork && <span>Contributed fork</span>}
        <time dateTime={repository.lastUpdatedAt}>
          Last commit {formatGithubDate(repository.lastUpdatedAt)}
        </time>
      </div>
    </article>
  )
}

export default function GithubPage({ github }: GithubPageProps) {
  const repositories = github.data
    ? [...github.data.repositories].sort(
        (first, second) => Date.parse(second.lastUpdatedAt) - Date.parse(first.lastUpdatedAt),
      )
    : []
  const privateCount = repositories.filter((repository) => repository.isPrivate).length

  return (
    <main id="main-content" className="github-page">
      <section className="github-page-hero" id="top">
        <p className="eyebrow"><span>ENGINEERING ACTIVITY</span> GitHub repositories</p>
        <h1 className="glitch" data-text="CODE, IN MOTION.">CODE, IN<br />MOTION.</h1>
        <p>
          A live view of projects I own or contribute to, ordered by most recent commit. Public
          repositories open on GitHub; private work is represented by metadata only.
        </p>
        <div className="github-summary" aria-live="polite">
          <div><strong>{github.isLoading ? '--' : repositories.length}</strong><span>Repositories</span></div>
          <div><strong>{github.isLoading ? '--' : privateCount}</strong><span>Private collaborations</span></div>
        </div>
        <a className="button button-ghost github-home-link" href="#top">Back to portfolio</a>
      </section>

      <section className="repository-directory" aria-labelledby="repository-directory-title">
        <div className="repository-directory-heading">
          <div>
            <p>PROJECT_ACTIVITY / MOST_RECENT_FIRST</p>
            <h2 id="repository-directory-title">Repository activity</h2>
          </div>
          {github.data && (
            <p>Activity refreshed <time dateTime={github.data.fetchedAt}>{formatGithubDate(github.data.fetchedAt)}</time></p>
          )}
        </div>

        {github.isLoading && (
          <div className="repository-loading" role="status">
            <span className="service-spinner" aria-hidden="true" />
            <p>Loading recent engineering activity…</p>
          </div>
        )}

        {github.hasError && (
          <div className="repository-error" role="alert">
            <p>Repository activity is temporarily unavailable.</p>
            <a href="https://github.com/ZorionTen" target="_blank" rel="noreferrer">Open public GitHub profile</a>
          </div>
        )}

        {!github.isLoading && !github.hasError && (
          <div className="repository-list">
            {repositories.map((repository, index) => (
              <RepositoryEntry repository={repository} index={index} key={repository.id} />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
