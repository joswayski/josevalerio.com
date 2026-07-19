import { Link } from "react-router";

export type PoastPreviewProps = {
  title: string;
  previewText: string;
  date: string;
  dateTime: string;
  link: string;
};

export function PoastPreview({
  title,
  previewText,
  date,
  dateTime,
  link,
}: PoastPreviewProps) {
  return (
    <Link
      to={link}
      prefetch="viewport"
      viewTransition
      className="post-row"
    >
      <div className="post-copy">
        <h3>{title}</h3>
        <p>{previewText}</p>
      </div>
      <div className="post-meta">
        <time dateTime={dateTime}>{date}</time>
        <span className="post-arrow" aria-hidden="true">
          →
        </span>
      </div>
    </Link>
  );
}
