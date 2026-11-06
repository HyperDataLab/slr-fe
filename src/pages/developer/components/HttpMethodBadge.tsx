export default function HttpMethodBadge({ method }: { method: string }) {
  return <span className={`devdocs-method devdocs-method--${method.toLowerCase()}`}>{method}</span>;
}
