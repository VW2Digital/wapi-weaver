import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getTrackingTags } from "@/lib/admin.functions";

/**
 * Injeta tags personalizadas (Analytics, Pixel, etc.) cadastradas pelo admin
 * no <head> e no final do <body>. Executa só no cliente, sem bloquear render.
 */
export function TrackingTagsInjector() {
  const fetchTags = useServerFn(getTrackingTags);
  const { data } = useQuery({
    queryKey: ["tracking-tags"],
    queryFn: () => fetchTags(),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!data) return;

    const injected: Element[] = [];

    const injectInto = (parent: HTMLElement, html: string, marker: string) => {
      if (!html?.trim()) return;
      const container = document.createElement("div");
      container.innerHTML = html;
      Array.from(container.childNodes).forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as Element;
          // Recria <script> para que execute (innerHTML não executa scripts)
          if (el.tagName === "SCRIPT") {
            const s = document.createElement("script");
            for (const attr of Array.from(el.attributes)) s.setAttribute(attr.name, attr.value);
            s.text = el.textContent ?? "";
            s.setAttribute("data-injected", marker);
            parent.appendChild(s);
            injected.push(s);
          } else {
            (el as HTMLElement).setAttribute("data-injected", marker);
            parent.appendChild(el);
            injected.push(el);
          }
        }
      });
    };

    injectInto(document.head, data.head_tags ?? "", "head-tags");
    injectInto(document.body, data.body_tags ?? "", "body-tags");

    return () => {
      injected.forEach((el) => el.parentNode?.removeChild(el));
    };
  }, [data]);

  return null;
}
