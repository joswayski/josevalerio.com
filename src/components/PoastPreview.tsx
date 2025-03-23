import { Link } from "@tanstack/react-router";

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
    <Link to={link}>
      <div className="mx-auto max-w-7xl px-4 lg:px-8 overflow-hidden hover:bg-slate-50 rounded-md py-6">
        <h5 className="text-slate-900 text-3xl font-bold ">{title}</h5>
        <span className="text-xl mt-4 text-slate-500">{date}</span>
        <p className="text-slate-700 text-lg mt-4">{previewText}</p>
      </div>
    </Link>
  );
}
