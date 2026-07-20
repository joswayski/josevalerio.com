type CodeSnippetProps = {
  children: React.ReactNode;
  className?: string;
};

export function CodeSnippet({ children, className = "" }: CodeSnippetProps) {
  return <code className={`inline-code ${className}`}>{children}</code>;
}
