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

export function PoastPreview({ title, previewText, dateTime, link }: PoastPreviewProps) {
  return (
    <Link to={link} preload="intent" className="post-row">
      <div className="post-row-top">
        <h3>{title}</h3>
        <span className="post-leader" aria-hidden="true" />
        <time className="post-date" dateTime={dateTime}>
          {formatPostDate(dateTime)}
        </time>
      </div>
      <p>{previewText}</p>
    </Link>
  );
}
