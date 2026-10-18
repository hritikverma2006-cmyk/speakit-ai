import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "@/lib/api";

const { getSupabase } = vi.hoisted(() => ({ getSupabase: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ getSupabase }));

describe("authenticated API helper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("explains when public authentication settings are missing", async () => {
    getSupabase.mockReturnValue(null);
    await expect(api("/api/me")).rejects.toThrow("Authentication is not configured");
  });

  it("attaches the current access token and surfaces API errors", async () => {
    getSupabase.mockReturnValue({
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "short-lived-test-token" } }, error: null }) },
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: vi.fn().mockResolvedValue({ detail: "Daily practice limit reached." }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const request = api("/api/realtime-session", { method: "POST", body: "{}" });
    await expect(request).rejects.toThrow("Daily practice limit reached.");
    await expect(request).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/realtime-session$/),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer short-lived-test-token" }) }),
    );
  });
});
