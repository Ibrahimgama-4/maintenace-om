import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { BookOpen } from "lucide-react";
import Link from "next/link";
import { KBSearchForm } from "./KBSearchForm";

export default async function KnowledgeBasePage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const supabase = createClient();
  const q = searchParams.q?.trim() ?? "";

  let cases: { id: string; problem_summary: string; solution_summary: string; breakdown_id: string | null; created_at: string }[] = [];

  if (q) {
    const { data } = await supabase
      .from("ai_knowledge_cases")
      .select("id, problem_summary, solution_summary, breakdown_id, created_at")
      .or(`problem_summary.ilike.%${q}%,solution_summary.ilike.%${q}%`)
      .order("created_at", { ascending: false })
      .limit(30);
    cases = data ?? [];
  } else {
    const { data } = await supabase
      .from("ai_knowledge_cases")
      .select("id, problem_summary, solution_summary, breakdown_id, created_at")
      .order("created_at", { ascending: false })
      .limit(10);
    cases = data ?? [];
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-brand-600" />
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Knowledge Base</h1>
          <p className="text-sm text-gray-500">Search resolved breakdowns for similar past cases</p>
        </div>
      </div>

      <Card>
        <KBSearchForm initialQuery={q} />
      </Card>

      {cases.length === 0 ? (
        <Card className="p-8 text-center text-sm text-gray-400">
          {q
            ? `No past cases matched "${q}".`
            : "No cases logged yet. Close out a breakdown and use \"Save to Knowledge Base\" to start building this up."}
        </Card>
      ) : (
        <div className="space-y-3">
          {cases.map((c) => (
            <Card key={c.id}>
              <p className="text-sm font-medium text-gray-900">{c.problem_summary}</p>
              <p className="mt-1 text-sm text-gray-600">{c.solution_summary}</p>
              <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                <span>{new Date(c.created_at).toLocaleDateString()}</span>
                {c.breakdown_id && (
                  <Link href={`/breakdowns/${c.breakdown_id}`} className="text-brand-600 hover:underline">
                    View original breakdown
                  </Link>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
