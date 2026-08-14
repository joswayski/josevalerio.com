import { Link } from "@tanstack/react-router";

export type PostPath =
  | "/just-do-the-thing"
  | "/rust-json-logging"
  | "/no-fun-allowed";

export type PoastPreviewProps = {
  title: string;
  previewText: string;
  date: string;
  dateTime: string;
  link: PostPath;
};

export function PoastPreview({
  title,
  previewText,
  date,
  dateTime,
  link,
}: PoastPreviewProps) {
  return (
    <Link to={link} preload="intent" className="post-row">
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
