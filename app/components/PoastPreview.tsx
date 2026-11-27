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
      <span className="server-status-pip server-status-pip--amber" aria-hidden="true" />
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
