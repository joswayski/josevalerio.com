type ExternalLinkProps = {
  href: string;
  children: React.ReactNode;
  className?: string;
};

export function ExternalLink({
  href,
  children,
  className = "",
}: ExternalLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`text-blue-600 hover:text-blue-800 underline hover:no-underline transition-colors duration-100 ${className}`}
    >
      {children}
    </a>
  );
}
