import { PreviewRow } from "./PreviewRow";

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
    <PreviewRow
      variant="post"
      to={link}
      title={title}
      description={previewText}
      meta={<time dateTime={dateTime}>{date}</time>}
      arrow="→"
    />
  );
}
