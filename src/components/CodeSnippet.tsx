type CodeSnippetProps = {
  children: React.ReactNode;
  className?: string;
};

export function CodeSnippet({ children, className = "" }: CodeSnippetProps) {
  return (
    <code
      className={`bg-slate-200 text-slate-900 px-2 py-1 rounded text-sm font-mono border border-slate-300 ${className}`}
    >
      {children}
    </code>
  );
}
