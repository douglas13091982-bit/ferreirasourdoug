import { createFileRoute } from "@tanstack/react-router";

const title =
  "Ferreira Sourdough – Pães, Pizza e Charcutaria Artesanal em Joinville";
const description =
  "Pães e pizza de fermentação natural e charcutaria artesanal. 3ª geração de padeiros, forno a lenha, Joinville - SC.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <iframe
      src="/site.html"
      title={title}
      className="h-screen w-screen border-0"
    />
  );
}
