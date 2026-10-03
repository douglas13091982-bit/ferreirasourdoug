import { createFileRoute } from "@tanstack/react-router";

const title = "Cardápio – Ferreira Sourdough | Pães, Pizza e Charcutaria";
const description =
  "Cardápio mobile da Ferreira Sourdough: pães e pizzas de fermentação natural e charcutaria artesanal em Joinville - SC.";

export const Route = createFileRoute("/cardapio")({
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
  component: Cardapio,
});

function Cardapio() {
  return (
    <iframe
      src="/cardapio.html"
      title={title}
      className="h-screen w-screen border-0"
    />
  );
}
