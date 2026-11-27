import { Link } from "@tanstack/react-router";
import { formatPostDate } from "../data/postPreviews";

export type PostPath = "/just-do-the-thing" | "/rust-json-logging" | "/no-fun-allowed";

export type PoastPreviewProps = {
  title: string;
  previewText: string;
  dateTime: string;
  readingMinutes: number;
  link: PostPath;
};

export function PoastPreview({
  title,
  previewText,
  dateTime,
  readingMinutes,
  link,
}: PoastPreviewProps) {
  return (
    <Link to={link} preload="intent" className="post-row">
      <svg
        className="row-glyph"
        width="11"
        height="11"
        viewBox="0 0 11 11"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M2 1.5H6.8L9 3.7V9.5H2V1.5Z" stroke="currentColor" strokeWidth="1.1" fill="none" />
        <path d="M3.5 5.2H7.5M3.5 7.2H6.5" stroke="currentColor" strokeWidth="1" />
      </svg>
      <div className="post-row-main">
        <h3>{title}</h3>
        <p>{previewText}</p>
      </div>
      <span className="post-read-time">{readingMinutes} min</span>
      <time className="post-date" dateTime={dateTime}>
        {formatPostDate(dateTime)}
      </time>
    </Link>
  );
}
