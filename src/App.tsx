import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { LuArrowBigUp, LuCornerDownLeft, LuPanelRightClose, LuPanelRightOpen } from 'react-icons/lu'
import './App.css'
import GithubPage from './GithubPage'
import { formatGithubDate, useGithubPortfolio } from './github'

const AI_BASE_URL = import.meta.env.VITE_AI_API_URL ?? 'https://portfolio-ai-dla4.onrender.com'
const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_API_URL ?? 'https://portfolio-backend-lutt.onrender.com'

type ServiceStatus = 'waking' | 'ready'
type ChatMessage = { id: string; role: 'assistant' | 'user'; text: string; sources?: string[] }

const CHAT_SESSION_KEY = 'portfolio-chat-session'

function getChatSessionId() {
  const existing = window.localStorage.getItem(CHAT_SESSION_KEY)
  if (existing) return existing

  const sessionId = window.crypto.randomUUID()
  window.localStorage.setItem(CHAT_SESSION_KEY, sessionId)
  return sessionId
}

const ArrowIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)

const WarningIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 3 2.5 20h19L12 3Z" />
    <path d="M12 9v5M12 17.5v.5" />
  </svg>
)

const GithubIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3.3-.4 6.8-1.6 6.8-7A5.4 5.4 0 0 0 19.4 4 5 5 0 0 0 19.3.5S18.2.1 15 1.8a13.4 13.4 0 0 0-7 0C4.8.1 3.7.5 3.7.5A5 5 0 0 0 3.6 4a5.4 5.4 0 0 0-1.4 3.7c0 5.3 3.5 6.5 6.8 7A4.8 4.8 0 0 0 8 18v4" />
    <path d="M8 19c-3 .9-3-1.5-4.2-2" />
  </svg>
)

const LinkedinIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6Z" />
    <path d="M2 9h4v12H2zM4 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
  </svg>
)

const MailIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect width="20" height="16" x="2" y="4" rx="1" />
    <path d="m2 6 10 7L22 6" />
  </svg>
)

function ChatSidebar() {
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus>('waking')
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isMobileLayout, setIsMobileLayout] = useState(() => window.matchMedia('(max-width: 1080px)').matches)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [sessionId] = useState(getChatSessionId)
  const chatMessagesRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<HTMLTextAreaElement>(null)
  const chatToggleRef = useRef<HTMLButtonElement>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Ask me about Zaid’s work, technical background, or approach to backend engineering.',
    },
  ])

  useEffect(() => {
    const mobileQuery = window.matchMedia('(max-width: 1080px)')
    const updateLayout = (event: MediaQueryListEvent) => setIsMobileLayout(event.matches)

    mobileQuery.addEventListener('change', updateLayout)
    return () => mobileQuery.removeEventListener('change', updateLayout)
  }, [])

  useEffect(() => {
    if (!isMobileOpen) return

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setIsMobileOpen(false)
      window.requestAnimationFrame(() => chatToggleRef.current?.focus())
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [isMobileOpen])

  useEffect(() => {
    const request = new AbortController()

    const loadHistory = async () => {
      try {
        const response = await fetch(`${BACKEND_BASE_URL}/api/chat-messages?sessionId=${sessionId}`, {
          signal: request.signal,
        })
        if (!response.ok) throw new Error('History request failed')

        const history = (await response.json()) as Array<{
          id: string
          role: 'assistant' | 'user'
          content: string
          sources: string[]
        }>
        if (!request.signal.aborted && history.length > 0) {
          setMessages(history.map((message) => ({
            id: message.id,
            role: message.role,
            text: message.content,
            sources: message.sources,
          })))
        }
      } catch {
        // History is supplementary; chat remains available if persistence is waking or unavailable.
      }
    }

    void loadHistory()
    return () => request.abort()
  }, [sessionId])

  useEffect(() => {
    const container = chatMessagesRef.current
    if (!container) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    container.scrollTo({ top: container.scrollHeight, behavior: reduceMotion ? 'auto' : 'smooth' })
  }, [messages, isSending])

  useEffect(() => {
    let cancelled = false
    let retryTimer: ReturnType<typeof setTimeout>
    let activeRequest: AbortController | undefined

    const checkHealth = async () => {
      activeRequest = new AbortController()
      const requestTimeout = window.setTimeout(() => activeRequest?.abort(), 8000)

      try {
        const response = await fetch(`${AI_BASE_URL}/health`, {
          cache: 'no-store',
          signal: activeRequest.signal,
        })
        const data = (await response.json()) as { status?: string; chatConfigured?: boolean }

        if (!cancelled && response.ok && data.status === 'healthy' && data.chatConfigured === true) {
          setServiceStatus('ready')
          return
        }
      } catch {
        // A timed-out request still wakes Render; retry until the free service responds.
      } finally {
        window.clearTimeout(requestTimeout)
      }

      if (!cancelled) {
        setServiceStatus('waking')
        retryTimer = window.setTimeout(checkHealth, 4000)
      }
    }

    void checkHealth()

    return () => {
      cancelled = true
      activeRequest?.abort()
      window.clearTimeout(retryTimer)
    }
  }, [])

  const persistMessage = async (message: ChatMessage) => {
    const response = await fetch(`${BACKEND_BASE_URL}/api/chat-messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        role: message.role.toUpperCase(),
        content: message.text,
        sources: message.sources ?? [],
      }),
    })
    if (!response.ok) throw new Error('History persistence failed')
  }

  const sendMessage = async (message: string) => {
    const cleanMessage = message.trim()
    if (!cleanMessage || serviceStatus !== 'ready' || isSending) return

    const userMessage: ChatMessage = { id: window.crypto.randomUUID(), role: 'user', text: cleanMessage }
    setMessages((current) => [...current, userMessage])
    setInput('')
    setIsSending(true)
    window.requestAnimationFrame(() => chatInputRef.current?.focus())
    void persistMessage(userMessage).catch(() => undefined)

    const history = messages
      .filter((previousMessage) => previousMessage.id !== 'welcome')
      .slice(-50)
      .map((previousMessage) => ({
        role: previousMessage.role,
        content: previousMessage.text,
      }))

    try {
      const response = await fetch(`${AI_BASE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: cleanMessage, history }),
      })

      if (!response.ok) throw new Error('Chat request failed')

      const data = (await response.json()) as { response: string; sources?: string[] }
      const assistantMessage: ChatMessage = {
        id: window.crypto.randomUUID(),
        role: 'assistant',
        text: data.response,
        sources: data.sources,
      }
      setMessages((current) => [
        ...current,
        assistantMessage,
      ])
      void persistMessage(assistantMessage).catch(() => undefined)
    } catch {
      const errorMessage: ChatMessage = {
        id: window.crypto.randomUUID(),
        role: 'assistant',
        text: 'The chat channel is unavailable right now. Please try again shortly.',
      }
      setMessages((current) => [
        ...current,
        errorMessage,
      ])
      void persistMessage(errorMessage).catch(() => undefined)
    } finally {
      setIsSending(false)
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void sendMessage(input)
  }

  const isReady = serviceStatus === 'ready'

  return (
    <aside className={`chat-sidebar${isMobileOpen ? ' is-mobile-open' : ''}`} aria-label="Portfolio AI assistant">
      <button
        ref={chatToggleRef}
        className="chat-drawer-toggle"
        type="button"
        aria-controls="portfolio-chat-panel"
        aria-expanded={isMobileOpen}
        onClick={() => setIsMobileOpen((current) => !current)}
      >
        {isMobileOpen ? <LuPanelRightClose aria-hidden="true" /> : <LuPanelRightOpen aria-hidden="true" />}
        <span>{isMobileOpen ? 'Close AI chat' : 'Ask AI about me'}</span>
      </button>
      <div
        className="chat-drawer-content"
        id="portfolio-chat-panel"
        aria-hidden={isMobileLayout && !isMobileOpen}
        inert={isMobileLayout && !isMobileOpen}
      >
      <div className="chat-header">
        <div>
          <p>ZAID.AI / CHAT</p>
          <span>Portfolio knowledge interface</span>
        </div>
        <span className={`chat-led ${isReady ? 'is-ready' : ''}`} aria-hidden="true" />
      </div>

      <div className={`service-notice ${isReady ? 'is-ready' : ''}`} role="status" aria-live="polite">
        {isReady ? (
          <>
            <span className="ready-mark" aria-hidden="true">✓</span>
            <div><strong>AI service online</strong><p>Secure channel established.</p></div>
          </>
        ) : (
          <>
            <span className="service-spinner" aria-hidden="true" />
            <div>
              <strong>Waking AI service</strong>
              <p>Render cold starts can take up to 60 seconds. Please wait.</p>
            </div>
          </>
        )}
      </div>

      <div className="chat-messages" ref={chatMessagesRef} aria-live="polite" aria-relevant="additions">
        {messages.map((message) => (
          <div className={`chat-message ${message.role}`} key={message.id}>
            <span>{message.role === 'assistant' ? 'AI' : 'YOU'}</span>
            <div className="chat-response">
              <p>{message.text}</p>
              {message.sources && message.sources.length > 0 && (
                <div className="chat-sources" aria-label="Response sources">
                  {message.sources.map((source) => <span key={source}>{source}</span>)}
                </div>
              )}
            </div>
          </div>
        ))}
        {isSending && (
          <div className="chat-message assistant typing-message">
            <span>AI</span><p><i /><i /><i /><b className="sr-only">Generating response</b></p>
          </div>
        )}
      </div>

      <div className="chat-controls">
        {messages.length === 1 && messages[0].id === 'welcome' && (
          <>
            <p className="suggestion-label">QUICK PROMPTS</p>
            <div className="chat-suggestions">
              {['What does Zaid build?', 'Show technical strengths', 'How does he approach reliability?'].map((prompt) => (
                <button type="button" disabled={!isReady || isSending} onClick={() => void sendMessage(prompt)} key={prompt}>
                  {prompt}<span aria-hidden="true">↗</span>
                </button>
              ))}
            </div>
          </>
        )}
        <form onSubmit={handleSubmit}>
          <label htmlFor="chat-input" className="chat-newline-hint">
            <kbd aria-hidden="true"><LuArrowBigUp /></kbd><span aria-hidden="true">+</span><kbd aria-hidden="true"><LuCornerDownLeft /></kbd> New line
          </label>
          <div className="chat-input-wrap">
            <textarea
              ref={chatInputRef}
              id="chat-input"
              aria-label="Ask the portfolio AI"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault()
                  event.currentTarget.form?.requestSubmit()
                }
              }}
              disabled={!isReady}
              maxLength={1000}
              rows={3}
              placeholder={isReady ? 'Type a question…' : 'Waiting for AI service…'}
            />
            <button type="submit" disabled={!isReady || isSending || !input.trim()} aria-label="Send message with Enter">
              <span className="send-button-shortcut">Send<kbd aria-hidden="true"><LuCornerDownLeft /></kbd></span>
            </button>
          </div>
        </form>
        <p className="chat-disclaimer"><WarningIcon /><span>AI-generated responses can be inaccurate. Verify important details.</span></p>
      </div>
      </div>
    </aside>
  )
}

type ContactDialogProps = {
  isOpen: boolean
  onClose: () => void
}

function ContactDialog({ isOpen, onClose }: ContactDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [companyName, setCompanyName] = useState('')
  const [applicationEmail, setApplicationEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle')

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen && !dialog.open) dialog.showModal()
    if (!isOpen && dialog.open) dialog.close()
  }, [isOpen])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus('saving')

    const gmailWindow = window.open('about:blank', '_blank')
    if (gmailWindow) gmailWindow.opener = null

    try {
      const response = await fetch(`${BACKEND_BASE_URL}/api/contact-intents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName, applicationEmail }),
      })

      if (!response.ok) throw new Error('Unable to save contact details')

      const subject = companyName.trim()
        ? `Portfolio opportunity — ${companyName.trim()}`
        : 'Portfolio opportunity'
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=syedzaidhaider%40gmail.com&su=${encodeURIComponent(subject)}`

      if (gmailWindow) {
        gmailWindow.location.href = gmailUrl
      } else {
        window.location.href = gmailUrl
      }

      setCompanyName('')
      setApplicationEmail('')
      setStatus('idle')
      onClose()
    } catch {
      gmailWindow?.close()
      setStatus('error')
    }
  }

  return (
    <dialog
      className="contact-dialog"
      ref={dialogRef}
      onCancel={onClose}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <form onSubmit={handleSubmit}>
        <div className="dialog-topline">
          <span>CONTACT.SYS / NEW_INTENT</span>
          <button type="button" onClick={onClose} aria-label="Close contact form">×</button>
        </div>
        <p className="dialog-kicker">Establish connection</p>
        <h2>Open a conversation.</h2>
        <p className="dialog-intro">
          Add context if you want. Both fields are optional and are saved only to help Zaid
          identify the opportunity. Gmail opens after the details are saved.
        </p>

        <label htmlFor="company-name">Company name <span>Optional</span></label>
        <input
          id="company-name"
          value={companyName}
          onChange={(event) => setCompanyName(event.target.value)}
          maxLength={120}
          autoComplete="organization"
          placeholder="Acme, Inc."
        />

        <label htmlFor="application-email">Your job application email <span>Optional</span></label>
        <input
          id="application-email"
          type="email"
          value={applicationEmail}
          onChange={(event) => setApplicationEmail(event.target.value)}
          maxLength={254}
          autoComplete="email"
          placeholder="you@company.com"
        />

        {status === 'error' && (
          <p className="dialog-error" role="alert">
            The details could not be saved. The backend may be waking up; please try again.
          </p>
        )}

        <button className="dialog-submit" type="submit" disabled={status === 'saving'}>
          {status === 'saving' ? <><span className="button-spinner" aria-hidden="true" /> Saving details…</> : <>Save & open Gmail <ArrowIcon /></>}
        </button>
        <p className="dialog-privacy">No message body is stored. Gmail never sends automatically.</p>
      </form>
    </dialog>
  )
}

function App() {
  const [isContactOpen, setIsContactOpen] = useState(false)
  const [isGithubPage, setIsGithubPage] = useState(window.location.hash === '#/github')
  const [activeSection, setActiveSection] = useState('')
  const github = useGithubPortfolio(BACKEND_BASE_URL)

  useEffect(() => {
    const updateRoute = () => setIsGithubPage(window.location.hash === '#/github')
    window.addEventListener('hashchange', updateRoute)
    return () => window.removeEventListener('hashchange', updateRoute)
  }, [])

  useEffect(() => {
    if (isGithubPage) {
      setActiveSection('github')
      return
    }

    const sections = ['about', 'work', 'stack', 'featured', 'contact']
      .map((id) => document.getElementById(id))
      .filter((section): section is HTMLElement => section !== null)
    let animationFrame = 0

    const updateActiveSection = () => {
      window.cancelAnimationFrame(animationFrame)
      animationFrame = window.requestAnimationFrame(() => {
        const readingLine = window.scrollY + 76 + window.innerHeight * 0.25
        const current = sections.reduce(
          (active, section) => section.offsetTop <= readingLine ? section.id : active,
          '',
        )
        setActiveSection(current)
      })
    }

    updateActiveSection()
    window.addEventListener('scroll', updateActiveSection, { passive: true })
    window.addEventListener('resize', updateActiveSection)
    return () => {
      window.cancelAnimationFrame(animationFrame)
      window.removeEventListener('scroll', updateActiveSection)
      window.removeEventListener('resize', updateActiveSection)
    }
  }, [isGithubPage])

  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>

      <header className="site-header">
        <a className="brand" href="#top" aria-label="Zaid Haider Rizvi, home">
          <span className="brand-mark">ZH</span>
          <span className="brand-slash">/</span>
          <span>RIZVI</span>
        </a>
        <nav aria-label="Primary navigation">
          <a className={activeSection === 'about' ? 'is-active' : undefined} aria-current={activeSection === 'about' ? 'location' : undefined} href="#about">About</a>
          <a className={activeSection === 'work' ? 'is-active' : undefined} aria-current={activeSection === 'work' ? 'location' : undefined} href="#work">Work</a>
          <a className={activeSection === 'featured' ? 'is-active' : undefined} aria-current={activeSection === 'featured' ? 'location' : undefined} href="#featured">Featured</a>
          <a className={activeSection === 'stack' ? 'is-active' : undefined} aria-current={activeSection === 'stack' ? 'location' : undefined} href="#stack">Stack</a>
          <a className={`nav-github${activeSection === 'github' ? ' is-active' : ''}`} aria-label="GitHub repositories" aria-current={activeSection === 'github' ? 'page' : undefined} href="#/github"><GithubIcon /><span className="sr-only">GitHub repositories</span></a>
          <button className={`nav-contact${activeSection === 'contact' ? ' is-active' : ''}`} aria-current={activeSection === 'contact' ? 'location' : undefined} type="button" onClick={() => setIsContactOpen(true)}>Contact</button>
        </nav>
      </header>

      {isGithubPage ? (
        <GithubPage github={github} />
      ) : (
      <>
      <div className="content-layout">
      <main id="main-content" className="page-content">
        <section className="hero-section" id="top">
          <div className="hero-copy">
            <p className="eyebrow"><span>01</span> Backend systems / integrations</p>
            <h1 className="glitch" data-text="I BUILD SYSTEMS THAT HOLD UP.">
              I BUILD SYSTEMS<br />THAT HOLD UP.
            </h1>
            <p className="hero-intro">
              I’m <strong>Zaid Haider Rizvi</strong>, a backend-focused engineer with 4+ years of
              experience building APIs, multi-tenant platforms, asynchronous workflows, and
              production-critical integrations.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="#work">
                Explore my work <ArrowIcon />
              </a>
              <button className="button button-ghost" type="button" onClick={() => setIsContactOpen(true)}>
                Start a conversation
              </button>
            </div>
            <p className="availability"><span aria-hidden="true" /> Open to remote and Lucknow-based roles</p>
          </div>

          <aside className="profile-console" aria-label="Profile summary">
            <div className="console-bar">
              <span>profile.sys</span>
              <span className="console-status">ONLINE</span>
            </div>
            <div className="console-body">
              <p><span className="prompt">$</span> load engineer.profile</p>
              <dl>
                <div><dt>NAME</dt><dd>Zaid Haider Rizvi</dd></div>
                <div><dt>BASE</dt><dd>Lucknow, India</dd></div>
                <div><dt>EXPERIENCE</dt><dd>4+ years</dd></div>
                <div><dt>MODE</dt><dd>Backend / full-stack</dd></div>
                <div><dt>STATUS</dt><dd className="status-value">Available</dd></div>
              </dl>
              <p className="console-line"><span className="prompt">›</span> reliability-first engineering</p>
              <span className="cursor" aria-hidden="true" />
            </div>
          </aside>
        </section>

        <div className="signal-strip" aria-hidden="true">
          <span>REST APIs</span><i />
          <span>MULTI-TENANT</span><i />
          <span>ASYNC WORKFLOWS</span><i />
          <span>OBSERVABILITY</span><i />
          <span>INTEGRATIONS</span>
        </div>

        <section className="about-section section-grid" id="about">
          <div className="section-label">
            <span>02</span>
            <p>About</p>
          </div>
          <div className="about-content">
            <h2>Backend engineering for the messy parts of real systems.</h2>
            <div className="about-columns">
              <p>
                My work centers on the difficult edges that appear after software meets production:
                duplicate events, retries, partial failures, tenant isolation, data consistency,
                observability, and safe recovery.
              </p>
              <p>
                I take capabilities from initial implementation through rollout and stabilization,
                working across backend services, shared platform modules, frontend integration,
                testing, and production debugging.
              </p>
            </div>
          </div>
        </section>

        <section className="metrics" aria-label="Career highlights">
          <article>
            <strong>4+</strong>
            <span>Years building production backend systems</span>
          </article>
          <article>
            <strong>30</strong>
            <span>Repositories in a verified delivery window</span>
          </article>
          <article>
            <strong>03</strong>
            <span>Weeks for a multi-repository integration launch</span>
          </article>
          <article>
            <strong>1+</strong>
            <span>Year maintaining application observability</span>
          </article>
        </section>

        <section className="work-section" id="work">
          <div className="section-heading">
            <div className="section-label"><span>03</span><p>Selected work</p></div>
            <p>Client names withheld; engineering scope and outcomes preserved.</p>
          </div>

          <div className="work-list">
            <article className="case-study featured-case">
              <div className="case-index">CASE_01</div>
              <div className="case-copy">
                <p className="case-type">End-to-end marketplace integration</p>
                <h3>From empty repositories to a stable, multi-tenant production system.</h3>
                <p>
                  Built core integration capabilities across OAuth, webhooks, onboarding, catalog,
                  pricing, multi-warehouse inventory, orders, shipping, and fulfillment. Stabilized
                  production behavior with tenant-scoped queries, atomic writes, duplicate guards,
                  validation, and safe data backfills.
                </p>
                <ul className="tag-list" aria-label="Technologies and focus areas">
                  <li>OAuth</li><li>Webhooks</li><li>Multi-tenant</li><li>Data integrity</li>
                </ul>
              </div>
              <div className="case-signal" aria-hidden="true"><span>01</span></div>
            </article>

            <article className="case-study">
              <div className="case-index">CASE_02</div>
              <div className="case-copy">
                <p className="case-type">Rapid platform delivery</p>
                <h3>A new integration established across four repositories in about three weeks.</h3>
                <p>
                  Delivered OAuth, automatic token refresh, webhook processing, seller onboarding,
                  API-key rotation, throttling, conflict handling, and safer error behavior without
                  trading away reliability for speed.
                </p>
                <ul className="tag-list" aria-label="Technologies and focus areas">
                  <li>REST APIs</li><li>Token lifecycle</li><li>Throttling</li><li>Reliability</li>
                </ul>
              </div>
              <div className="case-signal signal-magenta" aria-hidden="true"><span>02</span></div>
            </article>

            <article className="case-study">
              <div className="case-index">CASE_03</div>
              <div className="case-copy">
                <p className="case-type">Application observability</p>
                <h3>Tracing designed to answer production questions, not decorate dashboards.</h3>
                <p>
                  Introduced and maintained application-level OpenTelemetry instrumentation across
                  PHP and Phalcon services, including trace propagation, span attributes, log
                  correlation, queue tracing, and fatal-error handling.
                </p>
                <ul className="tag-list" aria-label="Technologies and focus areas">
                  <li>OpenTelemetry</li><li>Tracing</li><li>Log correlation</li><li>Debugging</li>
                </ul>
              </div>
              <div className="case-signal signal-yellow" aria-hidden="true"><span>03</span></div>
            </article>
          </div>
        </section>

        <section className="stack-section section-grid" id="stack">
          <div className="section-label"><span>04</span><p>Toolbox</p></div>
          <div className="stack-content">
            <h2>Tools are secondary.<br />Knowing where systems break isn’t.</h2>
            <div className="stack-grid">
              <article>
                <p className="stack-number">[01]</p>
                <h3>Backend</h3>
                <p>Java, Spring Boot, PHP, Phalcon, Node.js, NestJS, Fastify, REST APIs, OAuth, webhooks, queues, and asynchronous workers.</p>
              </article>
              <article>
                <p className="stack-number">[02]</p>
                <h3>Data & systems</h3>
                <p>MongoDB, Redis, PostgreSQL, TypeORM, SQS, Lambda, API Gateway, S3, multi-tenant architecture, and idempotent processing.</p>
              </article>
              <article>
                <p className="stack-number">[03]</p>
                <h3>Frontend & delivery</h3>
                <p>React, TypeScript, JavaScript, Docker, GitHub Actions, Render, GitHub Pages, Vitest, and application-level OpenTelemetry.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="featured-section" id="featured">
          <div className="section-heading">
            <div className="section-label"><span>05</span><p>Featured</p></div>
            <p>Current product work, backed by recent engineering activity.</p>
          </div>
          <article className="featured-project">
            <div className="featured-project-signal" aria-hidden="true">RS</div>
            <div className="featured-project-copy">
              <div className="project-topline"><span>PRODUCT / RUSHSERVE</span><span>CO-OWNED</span></div>
              <h3>RushServe</h3>
              <p>A multi-tenant food-delivery platform co-built across customer, store-owner, admin, backend, and local infrastructure repositories. Contributed to backend services, frontend integration, data modeling, operational workflows, and automated tests.</p>
              <div className="project-stack">NESTJS · REACT · POSTGRESQL · TYPEORM · DOCKER</div>
              <a className="button button-primary" href="#/github">View GitHub activity <ArrowIcon /></a>
            </div>
            <div className="featured-activity" aria-live="polite">
              <span>RECENT_ENGINEERING_ACTIVITY</span>
              {github.isLoading && <p>Loading recent activity…</p>}
              {github.hasError && <p>Recent activity is temporarily unavailable.</p>}
              {github.data && (
                <>
                  <strong>{github.data.rushServe.repositoryCount}</strong>
                  <p>Repositories across the RushServe product stack</p>
                  <time dateTime={github.data.rushServe.lastUpdatedAt ?? undefined}>
                    Last commit {formatGithubDate(github.data.rushServe.lastUpdatedAt)}
                  </time>
                </>
              )}
            </div>
          </article>
        </section>

        <section className="projects-section">
          <div className="section-heading">
            <div className="section-label"><span>06</span><p>Independent build</p></div>
            <p>Open-source systems built beyond day-to-day delivery.</p>
          </div>
          <div className="project-grid project-grid-single">
            <article className="project-card project-card-alt">
              <div className="project-topline"><span>SYSTEM / 01</span><span>PRIVATE BUILD</span></div>
              <h3>Zedtron Discord</h3>
              <p>A webhook-driven GitHub and Discord integration with idempotent processing, per-resource queues, renewable leases, rate-aware retries, and graceful shutdown.</p>
              <div className="project-stack">TYPESCRIPT · FASTIFY · MONGODB · VITEST</div>
            </article>
          </div>
        </section>

        <section className="principles-section section-grid">
          <div className="section-label"><span>07</span><p>Operating principles</p></div>
          <ol className="principles-list">
            <li><span>01</span><p>Reliability is part of feature design, not post-release cleanup.</p></li>
            <li><span>02</span><p>Multi-tenant systems require explicit isolation at every data boundary.</p></li>
            <li><span>03</span><p>Webhook and queue consumers should be idempotent by default.</p></li>
            <li><span>04</span><p>AI-generated code is an untrusted draft until verified.</p></li>
          </ol>
        </section>

        <section className="contact-section" id="contact">
          <p className="eyebrow"><span>08</span> Establish connection</p>
          <h2 className="glitch glitch-small" data-text="LET’S BUILD SOMETHING RELIABLE.">
            LET’S BUILD<br />SOMETHING RELIABLE.
          </h2>
          <p>I’m open to remote and Lucknow-based backend or full-stack engineering opportunities.</p>
          <button className="contact-email" type="button" onClick={() => setIsContactOpen(true)}>
            syedzaidhaider@gmail.com <ArrowIcon />
          </button>
          <div className="social-links">
            <a href="https://github.com/ZorionTen" target="_blank" rel="noreferrer"><GithubIcon /> GitHub</a>
            <a href="https://www.linkedin.com/in/zaid-haider-b3ba3919/" target="_blank" rel="noreferrer"><LinkedinIcon /> LinkedIn</a>
            <button type="button" onClick={() => setIsContactOpen(true)}><MailIcon /> Email</button>
          </div>
        </section>
      </main>
      <ChatSidebar />
      </div>
      </>
      )}

      <footer>
        <p>© 2026 ZAID HAIDER RIZVI</p>
        <p>BUILT WITH REACT <span aria-hidden="true">//</span> SIGNAL STABLE</p>
        <a href={isGithubPage ? '#/github' : '#top'} onClick={isGithubPage ? () => window.scrollTo({ top: 0, behavior: 'smooth' }) : undefined}>BACK TO TOP ↑</a>
      </footer>
      <ContactDialog isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} />
    </div>
  )
}

export default App
