import { EOI_COMMITMENTS, EOI_ROLES, EOI_ROLE_UPDATE_NOTE } from '@/lib/ec-eoi/catalog'
import { isFormOpen } from '@/lib/ec-eoi/server/data'
import { hasAdminSession } from '@/lib/ec-eoi/server/admin-session'
import { EoiHeader } from './EoiHeader'
import { MemberApp } from './MemberApp'

export const dynamic = 'force-dynamic'

const STEPS = ['Your details', 'Your commitment', 'Your interests', 'Your ideas']

export default async function EcEoiMemberPage() {
  const [open, admin] = await Promise.all([isFormOpen(), hasAdminSession()])
  const showForm = open || admin
  return (
    <>
      <EoiHeader />
      <div id="member-view">
        <main className="layout">
          <aside className="story">
            <div className="eyebrow">
              <span /> AN INVITATION TO LEAD
            </div>
            <h1>
              Big change. <br />
              Local roots.
              <br />
              <em>Your next step.</em>
            </h1>
            <p className="story-copy">Bring your ideas, your energy, and your commitment. Help shape what Yi Erode does next.</p>
            <nav aria-label="Form progress">
              <ol id="progress">
                {STEPS.map((s, i) => (
                  <li key={s}>
                    <span className="step-number">{String(i + 1).padStart(2, '0')}</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </nav>
            <div className="story-bottom">
              <span className="place-mark">↗</span>
              <div>
                <strong>For Erode. For India.</strong>
                <p>Nation building begins with us.</p>
              </div>
            </div>
            <div className="rings" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
          </aside>
          <section className="form-side">
            {open ? (
              <div className="sample-banner">
                <span className="sample-dot" />
                <strong>EXPRESSION OF INTEREST</strong>
                <span>Your answers go only to the Yi Erode leadership team.</span>
              </div>
            ) : (
              <div className="sample-banner">
                <span className="sample-dot" />
                <strong>{admin ? 'LEADERSHIP PREVIEW' : 'NOT OPEN YET'}</strong>
                <span>
                  {admin
                    ? 'The form is not open to members yet. Entries you submit here are saved and appear in the admin desk.'
                    : 'The leadership team will share the link when the form opens.'}
                </span>
              </div>
            )}
            {showForm ? (
              <MemberApp roles={EOI_ROLES} commitments={EOI_COMMITMENTS} updateNote={EOI_ROLE_UPDATE_NOTE} />
            ) : (
              <div id="app">
                <div className="card success">
                  <div className="step-label">COMING SOON</div>
                  <h2>
                    The EC 2027 Expression of Interest
                    <br />
                    <em>is not open yet.</em>
                  </h2>
                  <p>The Yi Erode leadership team will share the link with members when it opens.</p>
                </div>
              </div>
            )}
            <div className="help-note">
              YOUNG INDIANS · ERODE <span>We can. We will.</span>
            </div>
          </section>
        </main>
        <footer>
          <span>
            A shared purpose. A stronger Erode. &nbsp; <a href="/ec-2027/admin">Admin login</a>
          </span>
          <span>
            Expression of Interest <b> / </b> EC 2027
          </span>
        </footer>
      </div>
    </>
  )
}
