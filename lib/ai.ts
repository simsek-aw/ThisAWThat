import Anthropic from "@anthropic-ai/sdk";
import { newQuestion, type Question } from "./game";

/** Erzeugt neue „This or That“-Fragen per Claude. Ohne ANTHROPIC_API_KEY: leere Liste. */
export async function generateQuestions(n: number, avoid: string[] = []): Promise<Question[]> {
  if (!process.env.ANTHROPIC_API_KEY) return [];
  const client = new Anthropic();

  const response = await client.beta.messages.create({
    model: "claude-opus-5-5",
    // bei einer Ablehnung übernimmt serverseitig automatisch ein anderes Modell
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    max_tokens: 2000,
    output_config: { effort: "low" },
    system:
      "Du erfindest lockere, büro-taugliche „This or That“-Fragen für ein Team-Vestaboard. " +
      "Jede Option höchstens 16 Zeichen, deutsch, ohne Emojis, nichts Politisches oder Verletzendes. " +
      'Antworte ausschließlich mit JSON: [{"a":"…","b":"…"}, …]',
    messages: [
      {
        role: "user",
        content:
          `Gib mir ${n} neue Fragen.` +
          (avoid.length ? `\nDiese gab es schon, bitte nicht wiederholen:\n${avoid.slice(0, 60).join("\n")}` : ""),
      },
    ],
  });

  if (response.stop_reason === "refusal") return [];
  const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  const json = text.slice(text.indexOf("["), text.lastIndexOf("]") + 1);
  try {
    const list = JSON.parse(json) as { a?: unknown; b?: unknown }[];
    return list
      .filter((x) => typeof x.a === "string" && typeof x.b === "string" && x.a && x.b)
      .slice(0, n)
      .map((x) => newQuestion(String(x.a).slice(0, 22), String(x.b).slice(0, 22)));
  } catch {
    console.error("KI-Antwort nicht lesbar:", text);
    return [];
  }
}
