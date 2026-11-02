import { useState } from "react";
import { CommunityFeed } from "@/components/samflash/CommunityFeed";
import { MembersGrid, VideosGrid } from "@/components/samflash/CommunityLists";
import { MemberPublishForm } from "@/components/samflash/MemberPublishForm";
import { CommunityProfile } from "@/components/samflash/CommunityProfile";
import { CommunityComposer } from "@/components/samflash/CommunityComposer";

type Tab = "fil" | "videos" | "membres";

/** Communauté façon Facebook : zone « Quoi de neuf ? », fil, vidéos, membres. */
export function CommunityPage({ onSeeOffers }: { onSeeOffers: () => void }) {
  const [tab, setTab] = useState<Tab>("fil");
  const [profileId, setProfileId] = useState<string | null>(null);
  const onOpenProfile = (id: string) => setProfileId(id);
  const [publishing, setPublishing] = useState(false);
  const [reload, setReload] = useState(0);

  if (profileId) {
    return (
      <div className="bg-[#0f1011] pb-10">
        <CommunityProfile userId={profileId} onBack={() => setProfileId(null)} onSeeOffers={onSeeOffers} onOpenProfile={onOpenProfile} />
      </div>
    );
  }

  return (
    <div className="space-y-4 bg-[#0f1011] pb-10">
      {/* Zone de publication */}
      <section className="rounded-xl border border-white/10 bg-[#18191a] p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 font-bold">S</div>
          <button onClick={() => setPublishing(true)} className="flex-1 rounded-full bg-[#3a3b3c] px-4 py-2.5 text-left text-sm text-muted-foreground">Quoi de neuf ? Partagez une ressource…</button>
        </div>
      </section>

      {publishing && <CommunityComposer onClose={() => setPublishing(false)} onDone={() => setReload((n) => n + 1)} />}

      {/* Onglets */}
      <nav className="sticky top-0 z-10 grid grid-cols-3 rounded-xl border border-white/10 bg-[#18191a] text-sm font-semibold">
        {([
          ["fil", "Fil"],
          ["videos", "Vidéos"],
          ["membres", "Membres"],
        ] as [Tab, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`py-3 ${tab === id ? "border-b-2 border-blue-500 text-blue-400" : "text-muted-foreground"}`}>
            {label}
          </button>
        ))}
      </nav>

      {tab === "fil" && <CommunityFeed key={reload} onSeeOffers={onSeeOffers} onOpenProfile={onOpenProfile} />}
      {tab === "videos" && <VideosGrid onSeeOffers={onSeeOffers} />}
      {tab === "membres" && <MembersGrid onOpenProfile={onOpenProfile} />}
    </div>
  );
}
