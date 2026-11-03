import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Lancer une modification Flash Edit. Le débit et le remboursement sont faits côté serveur. */
export const createFlashEdit = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        sourceUrl: z.string().url().max(2000),
        sourceSeconds: z.number().int().min(1).max(15),
        outputSeconds: z.number().int().min(2).max(30),
        resolution: z.enum(["480P", "720P", "1080P"]),
        prompt: z.string().trim().min(3).max(4000),
        audio: z.boolean(),
        rightsAccepted: z.literal(true),
      })
      .parse(input),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { startFlashEdit } = await import("@/lib/flash-edit.server");
    const r = await startFlashEdit({
      userId: context.userId,
      sourceUrl: data.sourceUrl,
      sourceSeconds: data.sourceSeconds,
      outputSeconds: data.outputSeconds,
      resolution: data.resolution,
      prompt: data.prompt,
      audio: data.audio,
    });
    return r.ok
      ? { ok: true as const, jobId: r.jobId, message: null }
      : { ok: false as const, jobId: null, message: r.message };
  });
