interface JsonLdProps {
  data: Record<string, unknown> | Array<Record<string, unknown>>;
}

/** Server-safe JSON-LD script; `<` is escaped so content can never close the tag. */
export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
