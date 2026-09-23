import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const SYSTEM_PROMPT = `You are a troubleshooting assistant for an instrumentation department in a cement plant.
A technician will describe a symptom. Respond with:
1. Possible causes (most likely first)
2. Recommended inspection sequence
3. Safety checks before touching anything
4. Instruments/components to inspect
5. Measurements to verify
6. Possible corrective actions

Rules: Never claim a fault is confirmed. Never invent measurements, findings, or completed work.
Always frame output as suggestions for the technician to verify, not conclusions.
If similar past cases are provided below, reference them briefly where relevant, but still verify independently.`;

export async function POST(req: NextRequest) {
  const { problem } = await req.json();

  if (!problem || typeof problem !== "string") {
    return NextResponse.json({ error: "Missing 'problem' text" }, { status: 400 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GROQ_API_KEY not configured. Add it in your Vercel project's environment variables." },
      { status: 500 }
    );
  }

  // Pull similar past cases from the knowledge base (simple keyword search) to ground the suggestion.
  let similarCasesText = "";
  try {
    const supabase = createClient();
    const keywords = problem
      .split(/\s+/)
      .filter((w: string) => w.length > 3)
      .slice(0, 5);

    if (keywords.length > 0) {
      const orFilter = keywords.map((k: string) => `problem_summary.ilike.%${k}%`).join(",");
      const { data: cases } = await supabase
        .from("ai_knowledge_cases")
        .select("problem_summary, solution_summary")
        .or(orFilter)
        .limit(3);

      if (cases && cases.length > 0) {
        similarCasesText =
          "\n\nSimilar past cases from this department's history:\n" +
          cases.map((c, i) => `${i + 1}. Problem: ${c.problem_summary}\n   Resolution: ${c.solution_summary}`).join("\n");
      }
    }
  } catch {
    // If the knowledge base lookup fails for any reason, proceed without it.
  }

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-120b",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: problem + similarCasesText },
      ],
      max_tokens: 700,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: `AI provider error: ${text}` }, { status: 502 });
  }

  const data = await res.json();
  const suggestion = data.choices?.[0]?.message?.content ?? "No suggestion returned.";

  return NextResponse.json({ suggestion });
}
