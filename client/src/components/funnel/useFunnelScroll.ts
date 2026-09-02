import { useCallback, useEffect, useState } from "react";

export interface FunnelSection {
  id: string;
  label: string;
}

export function useFunnelScroll(sections: FunnelSection[]) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const elements = sections
      .map((s) => document.getElementById(s.id))
      .filter(Boolean) as HTMLElement[];

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          const idx = sections.findIndex((s) => s.id === visible[0].target.id);
          if (idx >= 0) setActiveIndex(idx);
        }
      },
      { root: null, threshold: [0.35, 0.5, 0.65], rootMargin: "-10% 0px -10% 0px" },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sections]);

  const scrollToSection = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const scrollToNext = useCallback(() => {
    const next = sections[activeIndex + 1];
    if (next) scrollToSection(next.id);
  }, [activeIndex, sections, scrollToSection]);

  return { activeIndex, scrollToSection, scrollToNext };
}

export function getCampaignSource(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get("src") || params.get("utm_source") || "campaign_funnel";
}
