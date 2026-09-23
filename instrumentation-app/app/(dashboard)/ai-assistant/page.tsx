"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function AIAssistantPage() {
  const [problem, setProblem] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch("/api/ai/troubleshoot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problem }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setResponse(data.suggestion);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold">AI Troubleshooting Assistant</h1>
        <p className="text-sm text-gray-500">
          Describe the symptom in plain language. Suggestions are AI-generated, not confirmed findings.
        </p>
      </div>

      <Card>
        <form onSubmit={handleAsk} className="space-y-3">
          <textarea
            rows={3}
            required
            placeholder="e.g. Packer 1 stopped feeding and the level pendulum is not responding."
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={problem}
            onChange={(e) => setProblem(e.target.value)}
          />
          <Button type="submit" disabled={loading}>
            {loading ? "Thinking..." : "Ask AI Assistant"}
          </Button>
        </form>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </Card>

      {response && (
        <Card className="border-blue-100 bg-blue-50">
          <p className="mb-2 text-xs font-semibold uppercase text-blue-700">
            AI Suggestion — verify before acting
          </p>
          <p className="whitespace-pre-wrap text-sm text-blue-900">{response}</p>
        </Card>
      )}
    </div>
  );
}
