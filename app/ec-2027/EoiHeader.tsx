/* eslint-disable @next/next/no-img-element */
// Header from the agreed design: Yi logo left, ERODE CHAPTER, the EC 2027 title, CII logo right.
export function EoiHeader() {
  return (
    <>
      <div className="tricolour" aria-hidden="true" />
      <header className="header">
        <div className="brand">
          <img src="/ec-2027/yi-logo.png" alt="Yi — Young Indians, We Can We Will" className="yi-logo" />
          <span className="brand-divider" />
          <span className="chapter">
            ERODE <span>CHAPTER</span>
          </span>
        </div>
        <div className="edition" role="heading" aria-level={1}>
          Enablers of Change (EC) <strong>2027</strong>
        </div>
        <img className="cii-logo" src="/ec-2027/cii-logo.png" alt="Confederation of Indian Industry" />
      </header>
    </>
  )
}
