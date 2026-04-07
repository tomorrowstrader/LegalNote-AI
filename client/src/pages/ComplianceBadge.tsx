import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Award, CheckCircle2, AlertCircle } from "lucide-react";

interface BadgeData {
  firmName: string;
  score: number;
  grade: string;
  lastUpdated: string;
}

export default function ComplianceBadge() {
  const params = useParams<{ slug: string }>();
  const { slug } = params;

  const { data, isLoading, error } = useQuery<BadgeData>({
    queryKey: ['/api/public/badge', slug],
    queryFn: async () => {
      const res = await fetch(`/api/public/badge/${slug}`);
      if (!res.ok) throw new Error('Badge not found');
      return res.json();
    },
    enabled: !!slug,
    retry: false,
  });

  const gradeColor = (g: string) => {
    if (g === 'A') return { text: '#16a34a', bg: '#f0fdf4', border: '#86efac' };
    if (g === 'B') return { text: '#2563eb', bg: '#eff6ff', border: '#93c5fd' };
    if (g === 'C') return { text: '#d97706', bg: '#fffbeb', border: '#fcd34d' };
    if (g === 'D') return { text: '#ea580c', bg: '#fff7ed', border: '#fdba74' };
    return { text: '#dc2626', bg: '#fef2f2', border: '#fca5a5' };
  };

  const gradeLabel = (g: string) => {
    if (g === 'A') return 'Excellent compliance';
    if (g === 'B') return 'Good compliance';
    if (g === 'C') return 'Satisfactory compliance';
    if (g === 'D') return 'Compliance attention needed';
    return 'Compliance review required';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-center max-w-sm px-6">
          <AlertCircle className="w-12 h-12 text-stone-300 mx-auto mb-4" />
          <h1 className="text-lg font-semibold text-stone-700 mb-2">Badge not found</h1>
          <p className="text-sm text-stone-500">This compliance badge is not available. The firm may have disabled public sharing.</p>
        </div>
      </div>
    );
  }

  const colors = gradeColor(data.grade);
  const pct = data.score;

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div
          className="rounded-xl border-2 p-8 text-center shadow-sm"
          style={{ backgroundColor: colors.bg, borderColor: colors.border }}
        >
          <div className="flex justify-center mb-4">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-4xl font-bold"
              style={{ backgroundColor: colors.text, color: '#fff' }}
              data-testid="badge-grade"
            >
              {data.grade}
            </div>
          </div>

          <div className="text-sm font-semibold uppercase tracking-wider mb-1" style={{ color: colors.text }}>
            {gradeLabel(data.grade)}
          </div>

          <h1 className="text-xl font-bold text-stone-800 mt-3 mb-1" data-testid="badge-firm-name">
            {data.firmName}
          </h1>

          <div className="text-sm text-stone-500 mb-5">
            Compliance score: <span className="font-semibold text-stone-700">{pct}/100</span>
          </div>

          <div className="w-full bg-stone-200 rounded-full h-2 mb-5">
            <div
              className="h-2 rounded-full transition-all"
              style={{ width: `${pct}%`, backgroundColor: colors.text }}
            />
          </div>

          <div className="flex items-center justify-center gap-1.5 text-xs text-stone-500">
            <CheckCircle2 className="w-3.5 h-3.5" style={{ color: colors.text }} />
            Verified by LegalNote
          </div>
        </div>

        <div className="mt-6 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-2">
            <Award className="w-4 h-4 text-stone-400" />
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">LegalNote Compliance Badge</span>
          </div>
          <p className="text-xs text-stone-400">
            This badge reflects {data.firmName}'s compliance posture across AML, consent, undertakings, and documentation,
            as measured by the LegalNote compliance platform. Last updated {new Date(data.lastUpdated).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.
          </p>
        </div>

        <div className="mt-8 text-center">
          <a
            href="https://legalnote.app"
            className="inline-flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-600 transition-colors"
          >
            Powered by LegalNote
          </a>
        </div>
      </div>
    </div>
  );
}
