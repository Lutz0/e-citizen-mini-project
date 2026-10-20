export function Card({ as: Tag = "div", className = "", children, ...props }) {
  return (
    <Tag className={`rounded-xl border border-line bg-white shadow-card ${className}`} {...props}>
      {children}
    </Tag>
  );
}

export function CardHeader({ title, description, actions, id }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div className="min-w-0">
        <h2 id={id} className="text-base font-semibold text-ink">
          {title}
        </h2>
        {description && <p className="mt-0.5 text-sm text-ink-2">{description}</p>}
      </div>
      {actions}
    </div>
  );
}
