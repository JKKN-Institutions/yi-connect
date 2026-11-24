'use client'

/**
 * Yi Erode EC 2027 EOI member form: the four steps from the agreed design
 * ("Yi Erode EOI - Website Design.html", member section), ported as-is so the
 * wording and behaviour stay identical. Changes: role text comes from the shared
 * catalogue, the sentence/phone rules come from the shared validation module,
 * and Submit saves to the server (success shows only after the save is confirmed;
 * on failure the answers stay and Submit can be pressed again).
 */
import { useEffect, useRef } from 'react'
import { EOI_EXTRA_QUESTIONS, type EoiCommitment, type EoiRole } from '@/lib/ec-eoi/catalog'
import { EOI_LIMITS, countSentences, isValidName, normalisePhone } from '@/lib/ec-eoi/validation'
import { shuffled } from '@/lib/ec-eoi/spread'
import { submitEoi } from './actions'

interface Props {
  roles: readonly EoiRole[]
  commitments: readonly EoiCommitment[]
  updateNote: string
  /** Areas with few picks so far (24 Nov 2026): tagged "Needs people". */
  needsPeople?: readonly string[]
}

interface FormState {
  step: number
  name: string
  phone: string
  ack: boolean
  selected: Set<string>
  open: string | null
  answers: Record<string, string>
  /** Extra-question answers keyed "<roleId>:<key>" (24 Nov 2026). */
  extras: Record<string, string>
  requestKey: string | null
  receipt: { id: string; submittedAt: string } | null
  submitting: boolean
}

const fresh = (): FormState => ({ step: 0, name: '', phone: '', ack: false, selected: new Set(), open: null, answers: {}, extras: {}, requestKey: null, receipt: null, submitting: false })
const RANK = ['1st', '2nd', '3rd']
const steps = ['Your details', 'Your commitment', 'Your interests', 'Your ideas']
const escapeHTML = (s: unknown) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const ist = (iso: string) => new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
const shortRef = (id: string) => id.slice(0, 8).toUpperCase()

export function MemberApp({ roles, commitments, updateNote, needsPeople = [] }: Props) {
  const appRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const app = appRef.current
    if (!app) return
    // Random order per visitor (Director 24 Nov 2026), so no area always sits at the top of its group.
    const verticals = shuffled(roles)
    const needs = new Set(needsPeople)
    const state = fresh()
    const $ = (id: string) => document.getElementById(id)

    function heading(title: string, intro: string) {
      return `<div class="step-label">STEP ${String(state.step + 1).padStart(2, '0')} OF 04</div><h2 tabindex="-1">${title}</h2><p class="intro">${intro}</p>`
    }
    function buttons(next = 'Continue', back = true) {
      return `<div class="actions">${back ? '<button class="secondary" type="button" data-back>← Back</button>' : '<span>A little intent goes a long way.</span>'}<button class="primary" type="submit">${next}<span class="arrow" aria-hidden="true">→</span></button></div>`
    }
    function roleDetails(v: EoiRole) {
      const note = `<p class="role-update-note">${updateNote}</p>`
      return `<p class="role-intro">${v.description}</p><ul class="role-responsibilities">${v.responsibilities
        .map(r => `<li><strong>${r.title}</strong><p>${r.text}</p></li>`)
        .join('')}</ul>${
        v.flagship
          ? `<div class="role-highlight"><span>${v.flagship.label}</span><h4>${v.flagship.title}</h4><p class="role-timing">${v.flagship.date}</p><p>${v.flagship.description}</p></div>`
          : ''
      }${note}`
    }

    function render(focus = true) {
      const progress = $('progress')
      if (progress)
        progress.innerHTML = steps
          .map(
            (s, i) =>
              `<li class="${i === state.step ? 'active-step' : i < state.step ? 'done-step' : ''}" ${i === state.step ? 'aria-current="step"' : ''}><span class="step-number">${i < state.step ? '✓' : String(i + 1).padStart(2, '0')}</span><span>${s}</span></li>`
          )
          .join('')
      app!.className = 'form-enter'
      app!.setAttribute('data-step', String(state.step))
      if (state.step === 0)
        app!.innerHTML =
          heading('A stronger Erode starts with you.', 'Express your interest in joining the <strong>Yi Erode Enablers of Change 2027.</strong> Let’s start with a quick introduction.') +
          `<form id="details-form" novalidate><div class="card"><p class="card-title">First, a little about you</p><p class="card-subtitle">All fields are required.</p><div class="field"><label for="member-name">Full name<span class="required">*</span></label><input id="member-name" name="name" type="text" maxlength="100" autocomplete="name" placeholder="Enter your full name" value="${escapeHTML(state.name)}" aria-describedby="name-error" required><p class="error" id="name-error" role="alert"></p></div><div class="field"><label for="member-phone">Contact number<span class="required">*</span></label><div class="phone-field"><span>+91</span><input id="member-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel-national" maxlength="18" placeholder="Your 10-digit mobile number" value="${escapeHTML(state.phone)}" aria-describedby="phone-hint phone-error" required></div><p class="hint" id="phone-hint">Use the number where the leadership team can reach you.</p><p class="error" id="phone-error" role="alert"></p></div><div class="privacy"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 10h14v11H5zM8 10V6a4 4 0 0 1 8 0v4M12 14v3" stroke-width="1.5"/></svg><span>Your name, contact number and ideas are seen only by the Yi Erode leadership team and used only to form the EC 2027 team.</span></div><p class="hint">Questions? Contact Sharabheshwaran, Co-Chair, Yi Erode.</p></div>${buttons('Let’s begin', false)}</form>`
      if (state.step === 1)
        app!.innerHTML =
          heading('Leadership begins with showing up.', 'EC stands for <strong>Enablers of Change.</strong> As part of this team, your presence and participation matter. Attendance at each of the following programmes and recurring meetings is mandatory.') +
          `<form id="commitment-form"><div class="card commitments">${commitments
            .map(
              item =>
                `<div class="commitment"><span class="event-icon" aria-hidden="true">${item.icon}</span><div><h3>${item.title}</h3><p class="event-schedule">${item.schedule}</p><p>${item.description}</p><span class="event-tag">MANDATORY ATTENDANCE · ${item.format}</span></div></div>`
            )
            .join('')}</div><p class="micro-note">The leadership team will share confirmed dates, venues, and joining details.</p><label class="ack"><input type="checkbox" id="ack" ${state.ack ? 'checked' : ''}><span>I understand the attendance requirements and commit to participating in Pathfinder, EC Leader Academy, the Regional Council Meeting, and the recurring EC meetings if selected.</span></label><p class="error" id="ack-error" role="alert"></p>${buttons('Choose your interests')}</form>`
      if (state.step === 2)
        app!.innerHTML =
          heading('Where would you like to contribute?', 'Choose two or three areas where you can make a meaningful contribution, then rank them in your order of preference. Explore the descriptions before making your selection.') +
          `<div class="selection-purpose"><strong>Focus on what matters to Erode</strong><p>These descriptions are a guide to help you explore each role; you are not expected to carry out every activity listed. Focus on the needs you see in Erode and where you can make a meaningful contribution. Success is measured by the impact you create, rather than the number of events you organise. Even a small, positive change matters.</p></div><form id="interests-form"><div class="selection-summary"><strong id="selected-count" aria-live="polite">${state.selected.size} of 3 selected</strong><span>Choose 2–3 areas, then rank them</span></div><p class="selection-guidance" id="selection-guidance" aria-live="polite">Tick two or three areas. Then put them in your order of preference in the box below the list. Open a role to learn more before choosing.</p>${needs.size ? '<p class="selection-guidance">Areas marked <span class="needs-tag">Needs people</span> have few volunteers so far. Your energy would count most there.</p>' : ''}<p class="selection-guidance">Areas marked <span class="extra-tag">+2 questions</span> have many applicants, so they ask two short extra questions to help the team choose.</p>${['Stakeholders', 'Projects', 'Initiatives']
            .map(
              cat =>
                `<h3 class="section-heading">${cat.toUpperCase()}<span>${verticals.filter(v => v.category === cat).length} options</span></h3>${verticals
                  .filter(v => v.category === cat)
                  .map(
                    v =>
                      `<div class="choice ${state.selected.has(v.id) ? 'selected' : ''}" id="choice-${v.id}"><div class="choice-row"><label for="${v.id}"><input type="checkbox" id="${v.id}" data-choice="${v.id}" ${state.selected.has(v.id) ? 'checked' : ''}><span>${v.name}</span>${needs.has(v.id) ? '<span class="needs-tag">Needs people</span>' : ''}${EOI_EXTRA_QUESTIONS[v.id] ? `<span class="extra-tag">+${EOI_EXTRA_QUESTIONS[v.id].length} questions</span>` : ''}</label><span class="rank-badge" id="rank-${v.id}" aria-hidden="true"></span><button type="button" class="disclosure" data-expand="${v.id}" aria-label="Show ${v.name} responsibilities" aria-expanded="${state.open === v.id}" aria-controls="detail-${v.id}">⌄</button></div><div class="details" id="detail-${v.id}" ${state.open === v.id ? '' : 'hidden'}>${roleDetails(v)}</div></div>`
                  )
                  .join('')}`
            )
            .join('')}<div class="rank-box" id="rank-box" hidden></div><p class="error" id="selection-error" role="alert"></p>${buttons('Share your ideas')}</form>`
      if (state.step === 3)
        app!.innerHTML =
          heading('Your ideas. Erode’s possibilities.', 'Aim for <strong>3–5 sentences for each selection</strong> about what you would like to do specifically in Erode. <strong>At least 2 sentences are required.</strong> Think local needs, practical actions, and the difference you hope to make.') +
          `<form id="ideas-form" novalidate>${[...state.selected].map(id => verticals.find(v => v.id === id)!)
            .map(
              (v, i) =>
                `<div class="card writing-card"><div class="writing-head"><label for="answer-${v.id}">${RANK[i]} choice · ${v.name}</label><span class="category-tag">${v.category}</span></div><p id="prompt-${v.id}">What would you like to do for ${v.name} in Erode?</p><textarea id="answer-${v.id}" data-answer="${v.id}" maxlength="3000" required aria-describedby="prompt-${v.id} count-${v.id} error-${v.id}" placeholder="Share the local need, your proposed action, and the impact you want to create…">${escapeHTML(state.answers[v.id] || '')}</textarea><div class="writing-meta"><span>3–5 sentences recommended · Minimum 2 required.</span><span class="count" id="count-${v.id}">${countSentences(state.answers[v.id] || '')} sentences · Minimum 2</span></div><div class="error" id="error-${v.id}" role="alert"></div>${(EOI_EXTRA_QUESTIONS[v.id] ?? [])
                  .map(
                    q =>
                      `<div class="extra-field"><label for="extra-${v.id}-${q.key}">${q.label}<span class="required">*</span></label><textarea id="extra-${v.id}-${q.key}" data-extra="${v.id}:${q.key}" rows="2" maxlength="${EOI_LIMITS.extraMax}" required aria-describedby="xerror-${v.id}-${q.key}">${escapeHTML(state.extras[v.id + ':' + q.key] || '')}</textarea><div class="error" id="xerror-${v.id}-${q.key}" role="alert"></div></div>`
                  )
                  .join('')}</div>`
            )
            .join('')}<p class="micro-note">Submitting an EOI expresses your interest; it does not confirm an EC appointment.</p><p class="error" id="submit-error" role="alert"></p>${buttons('Submit EOI')}</form>`
      if (state.step === 4)
        app!.innerHTML = `<div class="card success"><div class="success-symbol" aria-hidden="true">✓</div><div class="step-label">A STEP TOWARDS SOMETHING BIGGER</div><h2 tabindex="-1">Your first step to<br><em>nation building.</em></h2><p>Thank you, <strong>${escapeHTML(state.name)}</strong>, for stepping forward for Erode. Your willingness to contribute is where meaningful change begins.</p><p>The leadership team will get back to you after discussions on the formation of the EC Team.</p><div class="chips">${[...state.selected].map(id => verticals.find(v => v.id === id)!)
          .map((v, i) => `<span class="chip">${RANK[i]} · ${v.name}</span>`)
          .join('')}</div><p class="sample-result"><strong>Your EOI has been received.</strong><br>Reference ${escapeHTML(shortRef(state.receipt!.id))} · ${escapeHTML(ist(state.receipt!.submittedAt))} IST. Keep this for your records.</p><div class="success-actions"><button class="primary" id="download">Download your EOI <span aria-hidden="true">↓</span></button><button class="secondary" id="restart">Start another entry</button></div></div>`
      bind()
      if (state.step === 2) updateChoices()
      if (focus) {
        app!.querySelector('h2')?.focus({ preventScroll: true })
        const side = document.querySelector<HTMLElement>('.form-side')
        window.scrollTo({ top: window.innerWidth <= 900 && side ? side.offsetTop - 20 : 0, behavior: 'instant' })
      }
    }

    function error(id: string, message: string, input?: string) {
      const node = $(id)
      if (node) node.textContent = message
      if (input) $(input)?.setAttribute('aria-invalid', String(!!message))
    }

    function updateChoices() {
      verticals.forEach(v => {
        const selected = state.selected.has(v.id)
        const unavailable = state.selected.size >= 3 && !selected
        $('choice-' + v.id)!.classList.toggle('selected', selected)
        ;($(v.id) as HTMLInputElement).disabled = unavailable
        $('choice-' + v.id)!.classList.toggle('at-limit', unavailable)
        const rank = [...state.selected].indexOf(v.id)
        $('rank-' + v.id)!.textContent = rank < 0 ? '' : RANK[rank]
        $(v.id)!.setAttribute('aria-label', rank < 0 ? v.name : `${v.name}, your ${RANK[rank]} choice`)
        ;($('detail-' + v.id) as HTMLElement).hidden = state.open !== v.id
        document.querySelector(`[data-expand="${v.id}"]`)!.setAttribute('aria-expanded', String(state.open === v.id))
      })
      $('selected-count')!.textContent = state.selected.size + ' of 3 selected'
      // Sharabhesh / Director 23 Nov 2026: an explicit order box. Starts in tick order; ↑ ↓ change it.
      const picked = [...state.selected]
      const box = $('rank-box')!
      box.hidden = picked.length < 2
      box.innerHTML =
        picked.length < 2
          ? ''
          : `<p class="rank-title">Your preference order</p><p class="rank-hint">1 is the area you want most. Use the arrows to change the order before you continue.</p>${needs.size ? '<p class="rank-hint">Popular areas fill fast. Picking an area marked <strong>Needs people</strong> as your 2nd or 3rd choice raises your chance of joining the team.</p>' : ''}<ol>${picked
              .map((id, i) => {
                const n = verticals.find(v => v.id === id)!.name
                return `<li><span class="rank-num">${i + 1}</span><span class="rank-name">${n}</span><button type="button" class="rank-move" data-move="${id}" data-dir="-1" aria-label="Move ${n} up" ${i === 0 ? 'disabled' : ''}>↑</button><button type="button" class="rank-move" data-move="${id}" data-dir="1" aria-label="Move ${n} down" ${i === picked.length - 1 ? 'disabled' : ''}>↓</button></li>`
              })
              .join('')}</ol>`
      $('selection-guidance')!.textContent =
        state.selected.size >= 3
          ? 'Three areas selected. Deselect one to choose a different area. Set your order of preference in the box below the list.'
          : 'Tick two or three areas. Then put them in your order of preference in the box below the list. Open a role to learn more before choosing.'
    }

    function bind() {
      document.querySelector('[data-back]')?.addEventListener('click', () => {
        state.step--
        render()
      })
      $('details-form')?.addEventListener('input', e => {
        const t = e.target as HTMLInputElement
        if (t.name === 'name') state.name = t.value
        if (t.name === 'phone') state.phone = t.value
      })
      $('details-form')?.addEventListener('submit', e => {
        e.preventDefault()
        state.name = state.name.trim()
        const nameValid = isValidName(state.name)
        const digits = normalisePhone(state.phone)
        error('name-error', nameValid ? '' : 'Please enter your full name.', 'member-name')
        error('phone-error', digits ? '' : 'Please enter a valid 10-digit Indian mobile number.', 'member-phone')
        if (!nameValid || !digits) {
          $(!nameValid ? 'member-name' : 'member-phone')!.focus()
          return
        }
        state.phone = digits
        state.step = 1
        render()
      })
      $('ack')?.addEventListener('change', e => {
        state.ack = (e.target as HTMLInputElement).checked
        error('ack-error', '')
      })
      $('commitment-form')?.addEventListener('submit', e => {
        e.preventDefault()
        if (!state.ack) {
          error('ack-error', 'Please acknowledge the mandatory programmes and recurring EC meetings to continue.')
          $('ack')!.focus()
          return
        }
        state.step = 2
        render()
      })
      document.querySelectorAll<HTMLInputElement>('[data-choice]').forEach(el =>
        el.addEventListener('change', () => {
          const id = el.dataset.choice!
          if (el.checked) {
            if (state.selected.size >= 3 && !state.selected.has(id)) {
              el.checked = false
              error('selection-error', 'You can choose up to three areas. Deselect one before adding another.')
              updateChoices()
              return
            }
            state.selected.add(id)
            state.open = id
          } else {
            state.selected.delete(id)
            if (state.open === id) state.open = null
          }
          updateChoices()
          error('selection-error', '')
        })
      )
      $('rank-box')?.addEventListener('click', e => {
        const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-move]')
        if (!btn || btn.disabled) return
        const order = [...state.selected]
        const from = order.indexOf(btn.dataset.move!)
        const to = from + Number(btn.dataset.dir)
        if (from < 0 || to < 0 || to >= order.length) return
        ;[order[from], order[to]] = [order[to], order[from]]
        state.selected = new Set(order)
        updateChoices()
        const again = document.querySelector<HTMLButtonElement>(`[data-move="${btn.dataset.move}"][data-dir="${btn.dataset.dir}"]`)
        ;(again && !again.disabled ? again : document.querySelector<HTMLButtonElement>(`[data-move="${btn.dataset.move}"]:not([disabled])`))?.focus()
      })
      document.querySelectorAll<HTMLElement>('[data-expand]').forEach(el =>
        el.addEventListener('click', () => {
          state.open = state.open === el.dataset.expand ? null : el.dataset.expand!
          updateChoices()
        })
      )
      $('interests-form')?.addEventListener('submit', e => {
        e.preventDefault()
        if (state.selected.size < 2 || state.selected.size > 3) {
          error('selection-error', 'Choose two or three areas where you would like to contribute, so the team has a 2nd choice for you.')
          document.querySelector<HTMLInputElement>('[data-choice]')!.focus()
          return
        }
        state.step = 3
        render()
      })
      document.querySelectorAll<HTMLTextAreaElement>('[data-answer]').forEach(el =>
        el.addEventListener('input', () => {
          state.answers[el.dataset.answer!] = el.value
          const count = countSentences(el.value)
          const node = $('count-' + el.dataset.answer)!
          node.textContent = count + ' sentences · Minimum 2'
          node.className = 'count ' + (count >= 2 ? 'valid' : '')
          error('error-' + el.dataset.answer, '', el.id)
        })
      )
      document.querySelectorAll<HTMLTextAreaElement>('[data-extra]').forEach(el =>
        el.addEventListener('input', () => {
          state.extras[el.dataset.extra!] = el.value
          error('xerror-' + el.dataset.extra!.replace(':', '-'), '', el.id)
        })
      )
      $('ideas-form')?.addEventListener('submit', async e => {
        e.preventDefault()
        if (state.submitting) return
        let first: string | null = null
        state.selected.forEach(id => {
          const valid = countSentences(state.answers[id] || '') >= 2
          error('error-' + id, valid ? '' : 'Please write at least 2 sentences about your plans for this area in Erode.', 'answer-' + id)
          if (!valid && !first) first = 'answer-' + id
        })
        state.selected.forEach(id =>
          (EOI_EXTRA_QUESTIONS[id] ?? []).forEach(q => {
            const ok = (state.extras[id + ':' + q.key] || '').trim().length > 0
            error(`xerror-${id}-${q.key}`, ok ? '' : 'Please answer this question.', `extra-${id}-${q.key}`)
            if (!ok && !first) first = `extra-${id}-${q.key}`
          })
        )
        if (first) {
          $(first)!.focus()
          return
        }
        state.submitting = true
        state.requestKey ||= crypto.randomUUID()
        const submit = document.querySelector<HTMLButtonElement>('#ideas-form button[type=submit]')!
        const label = submit.innerHTML
        submit.disabled = true
        submit.setAttribute('aria-busy', 'true')
        submit.innerHTML = 'Submitting…'
        error('submit-error', '')
        let result: Awaited<ReturnType<typeof submitEoi>>
        try {
          result = await submitEoi({
            requestKey: state.requestKey,
            name: state.name,
            phone: state.phone,
            ack: state.ack,
            // state.selected is a Set: it keeps tap order, so this is 1st, 2nd, 3rd choice.
            selections: [...state.selected].map(id => ({
              roleId: id,
              answer: state.answers[id] || '',
              extras: (EOI_EXTRA_QUESTIONS[id] ?? []).map(q => ({ key: q.key, answer: (state.extras[id + ':' + q.key] || '').trim() })),
            })),
            ranked: true,
            extrasAsked: true,
          })
        } catch {
          result = { ok: false, message: 'We could not save your EOI. Your answers are still here. Please check your connection and press Submit EOI again.' }
        }
        state.submitting = false
        if (result.ok) {
          state.receipt = { id: result.id, submittedAt: result.submittedAt }
          state.step = 4
          render()
          return
        }
        submit.disabled = false
        submit.removeAttribute('aria-busy')
        submit.innerHTML = label
        for (const [key, msg] of Object.entries(result.errors || {})) if (key.startsWith('answer-')) error('error-' + key.slice(7), msg, key)
        error('submit-error', result.message)
      })
      $('restart')?.addEventListener('click', () => {
        if (!window.confirm('Start another entry? Your submitted EOI is already saved.')) return
        Object.assign(state, fresh())
        render()
      })
      $('download')?.addEventListener('click', () => {
        const r = state.receipt!
        const text =
          `YI ERODE — EC 2027\nEXPRESSION OF INTEREST — SUBMITTED\nReference: ${shortRef(r.id)} (${r.id})\nSubmitted: ${ist(r.submittedAt)} IST\n\nName: ${state.name}\nContact: +91 ${state.phone}\nMandatory commitments: Acknowledged\n\n` +
          [...state.selected].map(id => verticals.find(v => v.id === id)!)
            .map(
              (v, i) =>
                `${RANK[i]} choice: ${v.category} / ${v.name}\n${(state.answers[v.id] || '').trim()}` +
                (EOI_EXTRA_QUESTIONS[v.id] ?? []).map(q => `\n\n${q.label}\n${(state.extras[v.id + ':' + q.key] || '').trim()}`).join('')
            )
            .join('\n\n')
        const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
        const a = document.createElement('a')
        a.href = url
        a.download = 'Yi-Erode-EC-2027-EOI.txt'
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      })
    }

    render(false)
  }, [roles, commitments, updateNote, needsPeople])

  return <div id="app" ref={appRef} />
}
