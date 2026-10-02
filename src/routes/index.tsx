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
    return () => {
      active = false;
    };
  }, []);

  function postCatalog() {
    if (iframeRef.current?.contentWindow) {
      const send = (delivery?: unknown) =>
        iframeRef.current?.contentWindow?.postMessage(
          {
            type: "FERREIRA_CATALOG",
            catalog,
            mapboxToken: import.meta.env["VITE_MAPBOX_TOKEN"] || "",
            delivery,
          },
          window.location.origin,
        );

      supabase
        .from("store_delivery_settings")
        .select("*")
        .eq("id", true)
        .maybeSingle()
        .then(({ data }) => send(data || undefined), () => send());
    }
  }

  useEffect(() => {
    postCatalog();
  }, [catalog]);

  useEffect(() => {
    const onMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin || !event.data) return;

      if (event.data.type === "FERREIRA_DELIVERY_REQUEST") {
        const { data } = await supabase
          .from("store_delivery_settings")
          .select("*")
          .eq("id", true)
          .maybeSingle();

        iframeRef.current?.contentWindow?.postMessage(
          {
            type: "FERREIRA_CATALOG",
            catalog,
            mapboxToken:
              data?.mapbox_token || import.meta.env["VITE_MAPBOX_TOKEN"] || "",
            delivery: data || undefined,
          },
          window.location.origin,
        );
        return;
      }

      if (event.data.type === "FERREIRA_DELIVERY_SAVE") {
        const settings = event.data.settings;
        if (!settings || typeof settings !== "object") return;

        const { data, error } = await supabase
          .from("store_delivery_settings")
          .upsert(settings)
          .select()
          .single();

        iframeRef.current?.contentWindow?.postMessage(
          {
            type: "FERREIRA_DELIVERY_SAVE_RESULT",
            delivery: data || undefined,
            error: error?.message || undefined,
          },
          window.location.origin,
        );
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [catalog]);

  return (
    <iframe
      ref={iframeRef}
      src="/menu-reference.html"
      title={title}
      onLoad={postCatalog}
      className="h-screen w-screen border-0"
    />
  );
}
