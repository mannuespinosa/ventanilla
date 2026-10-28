import { useEffect, useRef, useState } from "react";
import { AskInput, type SubmitQuestion } from "./AskInput";
import { Hero } from "./Hero";
import { HomeSections } from "./HomeSections";

export function Home({ onSubmit }: { onSubmit: SubmitQuestion }) {
  const [draft, setDraft] = useState("");
  const [showFixed, setShowFixed] = useState(false);
  const heroInputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = heroInputRef.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry) setShowFixed(!entry.isIntersecting && entry.boundingClientRect.bottom <= 0);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const focusHero = () => {
    const element = heroInputRef.current;
    if (!element) return;
    const input = Array.from(element.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea")).find((candidate) => candidate.getClientRects().length > 0);
    element.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "center" });
    input?.focus({ preventScroll: true });
  };

  return (
    <>
      <Hero onSubmit={onSubmit} value={draft} onValueChange={setDraft} inputRef={heroInputRef} />
      <HomeSections onAsk={focusHero} />
      {showFixed && <div data-testid="home-fixed-input" className="fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-background via-background to-transparent px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-8 sm:px-8">
        <div className="mx-auto max-w-[720px]"><AskInput onSubmit={onSubmit} value={draft} onValueChange={setDraft} /></div>
      </div>}
    </>
  );
}