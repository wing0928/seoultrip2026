export default function LinkButton({ href, children, variant = 'ghost', sameTab = false }) {
  if (!href) return <span className="muted">待補</span>;
  return (
    <a
      className={`link-button ${variant}`}
      href={href}
      {...(sameTab ? {} : { target: '_blank', rel: 'noreferrer' })}
    >
      {children}
    </a>
  );
}
