import { Link } from "react-router";

export type PoastPreviewProps = {
  id: string;
  title: string;
  previewText: string;
  date: string;
  link: string;
};

export function PoastPreview({
  title,
  previewText,
  date,
  link,
}: PoastPreviewProps) {
  return (
    <Link to={link} prefetch="viewport">
      <div className="mx-auto max-w-7xl px-4 lg:px-8 overflow-hidden bg-white hover:bg-slate-50 rounded-lg py-6 mb-4 shadow-sm border border-slate-200">
        <h5 className="text-slate-900 text-3xl font-bold ">{title}</h5>
        <span className="text-xl mt-4 text-slate-500">{date}</span>
        <p className="text-slate-700 text-lg mt-4">{previewText}</p>
      </div>
    </Link>
  );
}
