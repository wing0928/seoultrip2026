export default function LinkButton({ href, children, variant = 'ghost' }) {
  if (!href) return <span className="muted">待補</span>;
  return (
    <a className={`link-button ${variant}`} href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}
