import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { loadRemoteCatalog } from "@/lib/catalog";

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
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [catalog, setCatalog] = useState<unknown>(null);

  useEffect(() => {
    let active = true;
    loadRemoteCatalog().then((remote) => {
      if (active && remote) setCatalog(remote);
    });
    return () => { active = false; };
  }, []);

  function postCatalog() {
    if (catalog && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { type: "FERREIRA_CATALOG", catalog },
        window.location.origin,
      );
    }
  }

  useEffect(() => {
    postCatalog();
  }, [catalog]);

  return (
    <iframe
      ref={iframeRef}
      src="/site.html"
      title={title}
      onLoad={postCatalog}
      className="h-screen w-screen border-0"
    />
  );
}
