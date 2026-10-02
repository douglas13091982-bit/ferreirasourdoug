import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { loadRemoteCatalog } from "@/lib/catalog";
import { supabase } from "@/lib/supabase";

const title =
  "Ferreira Sourdough – Pães, Pizza e Charcutaria Artesanal em Joinville";
const description =
  "Pães e pizza de fermentação natural e charcutaria artesanal. 3ª geração de padeiros, forno a lenha, Joinville - SC.";

const minimalStyles = `
:root{
  --g:#171717!important;
  --g2:#222!important;
  --au:#171717!important;
  --cr:#fafafa!important;
  --ink:#171717!important;
  --mute:#737373!important;
  --card:#ffffff!important;
  --line:#e5e5e5!important;
  --gr:#171717!important;
}
html,body{background:#fafafa!important;color:#171717!important}
body{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;font-size:15px!important}
h1,h2,h3{font-family:Inter,ui-sans-serif,system-ui,sans-serif!important;font-weight:600!important;letter-spacing:-.025em!important}
.w{max-width:1180px!important;padding-left:20px!important;padding-right:20px!important}
header{position:sticky!important;background:rgba(250,250,250,.96)!important;color:#171717!important;border-bottom:1px solid #e5e5e5!important;backdrop-filter:blur(12px)!important}
header .w{height:64px!important}
.lg{color:#171717!important}
.lg span{font-family:Inter,ui-sans-serif,system-ui,sans-serif!important;font-size:20px!important;letter-spacing:-.02em!important}
.lg small{color:#737373!important;letter-spacing:.2em!important}
.lg img{height:42px!important;width:42px!important}
nav{gap:20px!important}
nav a{font-size:13px!important;color:#525252!important}
nav a:hover{color:#171717!important}
.btn{background:#171717!important;color:#fff!important;border-color:#171717!important;border-radius:7px!important;box-shadow:none!important}
.btn.o{background:transparent!important;color:#171717!important;border-color:#d4d4d4!important}
.hero{background:#171717!important;color:#fff!important}
.hero .w{min-height:300px!important;padding-top:36px!important;padding-bottom:40px!important}
.hero:after{opacity:.28!important;background-position:center!important}
.hero h1{font-size:clamp(34px,5vw,58px)!important;max-width:620px!important}
.hero p{font-size:15px!important;max-width:520px!important;color:#d4d4d4!important}
section{border-color:#e5e5e5!important}
.g,.g2,.g3,.g4{gap:18px!important}
.g4{grid-template-columns:repeat(4,minmax(0,1fr))!important}
article,.card,.prod,.pc,.cat,[class*="card"]{border-radius:10px!important;box-shadow:none!important}
img{border-radius:8px}
button{box-shadow:none!important}
input,select,textarea{border-radius:7px!important;border-color:#d4d4d4!important;box-shadow:none!important}
footer{background:#171717!important;color:#d4d4d4!important}
@media(max-width:760px){
  .w{padding-left:16px!important;padding-right:16px!important}
  header .w{height:58px!important}
  .lg img{height:38px!important;width:38px!important}
  .lg span{font-size:18px!important}
  .lg small{font-size:7px!important}
  nav{gap:4px!important}
  nav a{font-size:12px!important;padding:7px 5px!important}
  .hero{min-height:330px!important}
  .hero .w{min-height:330px!important;padding:175px 18px 28px!important}
  .hero h1{font-size:34px!important;line-height:1.05!important}
  .hero p{font-size:14px!important;line-height:1.5!important}
  .g4{grid-template-columns:repeat(2,minmax(0,1fr))!important}
  .g3,.g2{grid-template-columns:1fr!important}
}
@media(max-width:430px){
  .g4{grid-template-columns:1fr!important}
}
`;

function injectMinimalStyles(iframe: HTMLIFrameElement | null) {
  const doc = iframe?.contentDocument;
  if (!doc?.head) return;
  let style = doc.getElementById("ferreira-minimal-theme");
  if (!style) {
    style = doc.createElement("style");
    style.id = "ferreira-minimal-theme";
    doc.head.appendChild(style);
  }
  style.textContent = minimalStyles;
}

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
    injectMinimalStyles(iframeRef.current);
    if (iframeRef.current?.contentWindow) {
      const send = (delivery?: unknown) => {
        injectMinimalStyles(iframeRef.current);
        iframeRef.current?.contentWindow?.postMessage(
          {
            type: "FERREIRA_CATALOG",
            catalog,
            mapboxToken: import.meta.env["VITE_MAPBOX_TOKEN"] || "",
            delivery,
          },
          window.location.origin,
        );
      };
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
      src="/site.html"
      title={title}
      onLoad={postCatalog}
      className="h-screen w-screen border-0"
    />
  );
}
