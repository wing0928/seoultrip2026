export default function InfoCard({ title, children, action, className = '' }) {
  return (
    <section className={`card ${className}`}>
      <div className="card-head">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
