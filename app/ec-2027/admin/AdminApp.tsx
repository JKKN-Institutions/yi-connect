'use client'

/**
 * Yi Erode EC 2027 EOI leadership desk: login, entry list, search, area filter,
 * response dialog and the three downloads, from the agreed design's admin
 * section. Data now comes from the server, and every read or download re-checks
 * the sign-in on the server.
 */
import { useEffect, useRef } from 'react'
import type { EoiExportEntry } from '@/lib/ec-eoi/workbook'
import { adminListEntries, adminSignOut } from './actions'

interface Props {
  gate: 'allowed' | 'no-access' | 'signed-out'
  email: string | null
  areas: { id: string; name: string }[]
}

const esc = (value: unknown) => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const date = (iso: string) => new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))

export function AdminApp({ gate, email, areas }: Props) {
  const signedIn = gate === 'allowed'
  const root = useRef<HTMLElement>(null)

  useEffect(() => {
    const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T
    let entries: EoiExportEntry[] = []

    if (!signedIn) return

    function renderEntries() {
      const text = $<HTMLInputElement>('search').value.trim().toLowerCase()
      const area = $<HTMLSelectElement>('area-filter').value
      const digits = text.replace(/^\+91/, '').replace(/\D/g, '')
      const filtered = entries.filter(
        e => (!text || e.name.toLowerCase().includes(text) || (digits && e.phone.includes(digits))) && (!area || e.selections.some(s => s.id === area))
      )
      const selectedArea = areas.find(v => v.id === area)
      const exportArea = $<HTMLButtonElement>('export-area')
      exportArea.disabled = !selectedArea || !entries.some(e => e.selections.some(s => s.id === area))
      exportArea.textContent = selectedArea ? 'Download ' + selectedArea.name + ' · Excel ↓' : 'Download selected area · Excel ↓'
      $<HTMLButtonElement>('export-verticals').disabled = !entries.length
      $('total').textContent = String(entries.length)
      $('proposals').textContent = String(entries.reduce((sum, e) => sum + e.selections.length, 0))
      $('areas').textContent = String(new Set(entries.flatMap(e => e.selections.map(s => s.id))).size)
      $('table-status').textContent = `Showing ${filtered.length} of ${entries.length} entries.`
      $('entry-rows').innerHTML = filtered
        .map(
          e =>
            `<tr><td>${esc(e.name)}${e.recordType.includes('repeat') ? `<br><span class="table-chip">${esc(e.recordType.replace('Submitted · ', ''))}</span>` : ''}</td><td>+91 ${esc(e.phone)}</td><td>${e.selections
              .map(s => `<span class="table-chip">${s.choice == null ? '' : s.choice + '. '}${esc(s.name)}</span>`)
              .join('')}${e.ranked ? '' : '<br><span class="table-chip">Not ranked</span>'}</td><td>${esc(date(e.submittedAt))}</td><td>${
              area ? `<p class="area-answer">${esc(e.selections.find(s => s.id === area)!.answer)}</p>` : ''
            }<button class="outline-button" data-view="${esc(e.id)}" aria-label="View responses from ${esc(e.name)}">View responses →</button></td></tr>`
        )
        .join('')
      const empty = $('empty')
      empty.hidden = !!filtered.length
      empty.innerHTML = entries.length
        ? '<strong>No matching entries.</strong><p>Try another name, contact number, or area.</p>'
        : '<strong>No entries yet.</strong><p>Submitted member forms will appear here.</p>'
    }

    async function refresh() {
      const button = $<HTMLButtonElement>('refresh')
      button.disabled = true
      $('dashboard-error').textContent = ''
      try {
        const res = await adminListEntries()
        if (res.ok) entries = res.entries
        else if (res.signedOut) {
          window.location.reload()
          return
        } else $('dashboard-error').textContent = res.error
      } catch {
        $('dashboard-error').textContent = 'Unable to load entries. Please try again.'
      }
      button.disabled = false
      renderEntries()
    }

    async function download(url: string, fallbackName: string, button: HTMLButtonElement, failMessage: string) {
      button.disabled = true
      $('dashboard-error').textContent = ''
      try {
        const res = await fetch(url, { cache: 'no-store' })
        if (res.status === 401) {
          window.location.reload()
          return
        }
        if (!res.ok) throw new Error(await res.text())
        const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '')?.[1] || fallbackName
        const href = URL.createObjectURL(await res.blob())
        const a = document.createElement('a')
        a.href = href
        a.download = name
        a.click()
        setTimeout(() => URL.revokeObjectURL(href), 1000)
      } catch {
        $('dashboard-error').textContent = failMessage
      } finally {
        button.disabled = false
        renderEntries()
      }
    }

    const handlers: [string, string, EventListener][] = [
      ['logout', 'click', async () => {
        await adminSignOut()
        window.location.reload()
      }],
      ['refresh', 'click', refresh],
      ['search', 'input', renderEntries],
      ['area-filter', 'change', renderEntries],
      ['close-dialog', 'click', () => $<HTMLDialogElement>('entry-dialog').close()],
      ['export', 'click', () => download('/ec-2027/admin/export?kind=all', 'Yi-Erode-EC-2027-Entries.xlsx', $('export'), 'Unable to prepare the Excel file. Please try again.')],
      ['export-area', 'click', () => {
        const area = $<HTMLSelectElement>('area-filter').value
        if (area) download('/ec-2027/admin/export?kind=area&area=' + encodeURIComponent(area), 'Yi-Erode-EC-2027-Area.xlsx', $('export-area'), 'Unable to prepare this area’s Excel file. Please try again.')
      }],
      ['export-verticals', 'click', () => download('/ec-2027/admin/export?kind=zip', 'Yi-Erode-EC-2027-Separate-Areas.zip', $('export-verticals'), 'Unable to prepare the separate area files. Please try again.')],
      ['entry-rows', 'click', event => {
        const button = (event.target as HTMLElement).closest<HTMLElement>('[data-view]')
        if (!button) return
        const entry = entries.find(e => e.id === button.dataset.view)
        if (!entry) return
        const area = $<HTMLSelectElement>('area-filter').value
        $('entry-detail').innerHTML = `<h2>${esc(entry.name)}</h2><p class="member-meta">+91 ${esc(entry.phone)}<br>Submitted ${esc(date(entry.submittedAt))} IST<br>All four mandatory commitments acknowledged.${
          entry.ranked ? '' : '<br>Not ranked: sent before members could rank their choices.'
        }${
          entry.recordType.includes('repeat') ? '<br>' + esc(entry.recordType.replace('Submitted · ', 'This entry is ')) + '.' : ''
        }</p><p class="receipt">Entry ID: ${esc(entry.id)}</p>${entry.selections
          .filter(s => !area || s.id === area)
          .map(s => `<section class="proposal"><span class="category-tag">${s.choice == null ? '' : ['1st', '2nd', '3rd'][s.choice - 1] + ' choice · '}${esc(s.category)}</span><h3>${esc(s.name)}</h3><p>${esc(s.answer)}</p>${(s.extras ?? []).map(x => `<p class="extra-qa"><strong>${esc(x.question)}</strong><br>${esc(x.answer)}</p>`).join('')}${s.extrasNotAsked ? '<p class="extra-qa">Extra questions not asked: sent before 24 Nov.</p>' : ''}</section>`)
          .join('')}`
        $<HTMLDialogElement>('entry-dialog').showModal()
      }],
    ]
    handlers.forEach(([id, type, fn]) => $(id).addEventListener(type, fn))
    refresh()
    return () => handlers.forEach(([id, type, fn]) => $(id)?.removeEventListener(type, fn))
  }, [signedIn, areas])

  return (
    <>
      <main className="admin-shell" ref={root}>
        <div className="admin-top">
          <a href="/ec-2027">← Member form</a>
          <span className="local-badge">ADMIN</span>
        </div>
        {!signedIn ? (
          <section id="login-panel" className="login-layout">
            <div className="login-story">
              <div className="eyebrow">YI ERODE · LEADERSHIP DESK</div>
              <h1>
                Every expression.
                <br />A possibility
                <br />
                <em>for Erode.</em>
              </h1>
              <p>Review the members stepping forward to become Enablers of Change. Bring their ideas together for the year ahead.</p>
            </div>
            <div className="card login-card">
              <div className="step-label">ADMIN ACCESS</div>
              {gate === 'signed-out' ? (
                <>
                  <h2>Welcome back.</h2>
                  <p className="intro">Sign in with your Yi Connect account to review and download member entries.</p>
                  <a className="primary" id="login-button" href="/login?redirectTo=%2Fec-2027%2Fadmin">
                    Sign in with Yi Connect <span aria-hidden="true">→</span>
                  </a>
                  <p className="micro-note">For the Yi Erode leadership team only.</p>
                </>
              ) : (
                <>
                  <h2>You don&apos;t have access yet.</h2>
                  <p className="intro">
                    You are signed in{email ? ` as ${email}` : ''}, but this desk is open only to the Yi Erode Chair, Co-Chair and the people
                    they add. Please contact the Yi Erode Chair.
                  </p>
                  <p id="login-error" className="error" role="alert">
                    No Yi Erode EOI access on this account.
                  </p>
                  <button className="outline-button" id="switch-account" type="button" onClick={async () => { await adminSignOut(); window.location.href = '/login?redirectTo=%2Fec-2027%2Fadmin' }}>
                    Sign in with a different account
                  </button>
                </>
              )}
            </div>
          </section>
        ) : (
          <section id="dashboard">
            <div className="dashboard-title">
              <div>
                <div className="step-label">LEADERSHIP DESK · 2027</div>
                <h2>Members ready to make a difference.</h2>
                <p className="intro">Review every expression of interest and the ideas behind it.</p>
              </div>
              <button className="outline-button" id="logout">
                Sign out
              </button>
            </div>
            <div className="stats">
              <div>
                <span>Total entries</span>
                <strong id="total">0</strong>
              </div>
              <div>
                <span>Proposals shared</span>
                <strong id="proposals">0</strong>
              </div>
              <div>
                <span>Areas represented</span>
                <strong id="areas">0</strong>
              </div>
            </div>
            <div className="card entries-card">
              <div className="entries-toolbar">
                <div>
                  <h3>Expressions of interest</h3>
                  <p>Download all entries, or choose an area below to review and download its responses.</p>
                </div>
                <button className="primary" id="export">
                  Download all entries · Excel ↓
                </button>
              </div>
              <div className="filters">
                <label htmlFor="search">
                  Find a member
                  <input id="search" type="search" placeholder="Search by name or contact number" />
                </label>
                <label htmlFor="area-filter">
                  Area of interest
                  <select id="area-filter" defaultValue="">
                    <option value="">All areas</option>
                    {areas.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button id="refresh" className="outline-button">
                  Refresh entries
                </button>
              </div>
              <div className="vertical-exports">
                <p id="vertical-export-hint">
                  Choose an area above to download its member details and proposals. Downloads include every response for that area, regardless of the member search.
                </p>
                <div>
                  <button className="outline-button" id="export-area" disabled>
                    Download selected area · Excel ↓
                  </button>
                  <button className="outline-button" id="export-verticals">
                    Download separate area files · ZIP ↓
                  </button>
                </div>
                <p className="micro-note">The ZIP contains one Excel file for each area with responses.</p>
              </div>
              <p id="dashboard-error" className="error" role="alert" />
              <p id="table-status" className="micro-note" role="status" />
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Member</th>
                      <th scope="col">Contact number</th>
                      <th scope="col">Areas of interest</th>
                      <th scope="col">Submitted (IST)</th>
                      <th scope="col">Responses</th>
                    </tr>
                  </thead>
                  <tbody id="entry-rows" />
                </table>
              </div>
              <div className="empty" id="empty" hidden>
                <strong>No entries yet.</strong>
                <p>Submitted member forms will appear here.</p>
              </div>
            </div>
          </section>
        )}
      </main>
      <dialog id="entry-dialog">
        <div className="dialog-top">
          <span className="step-label">MEMBER EXPRESSION OF INTEREST</span>
          <button className="outline-button" id="close-dialog" aria-label="Close member details">
            Close ×
          </button>
        </div>
        <div id="entry-detail" />
      </dialog>
    </>
  )
}
