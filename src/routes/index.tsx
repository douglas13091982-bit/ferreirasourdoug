import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { loadRemoteCatalog } from "@/lib/catalog";
import { supabase } from "@/lib/supabase";

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
    if (iframeRef.current?.contentWindow) {
      const send = (delivery?: unknown) => iframeRef.current?.contentWindow?.postMessage(
        { type: "FERREIRA_CATALOG", catalog, mapboxToken: import.meta.env.VITE_MAPBOX_TOKEN || "", delivery },
        window.location.origin,
      );
      if (supabase) {
        supabase.from("store_delivery_settings").select("*").eq("id", true).maybeSingle()
          .then(({ data }) => send(data || undefined))
          .catch(() => send());
      } else {
        send();
      }
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
