/// <reference types="jest" />
import { InstagramProfileEnrichmentService } from "@/lib/messaging/services/instagram-profile-enrichment.service";

describe("InstagramProfileEnrichmentService", () => {
  const service = new InstagramProfileEnrichmentService("v26.0");
  const mockedFetch = jest.fn();

  beforeAll(() => {
    (global as any).fetch = mockedFetch;
  });

  beforeEach(() => {
    mockedFetch.mockClear();
  });

  describe("fetchProfile", () => {
    it("returns name, username and profile_pic from Meta response", async () => {
      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          name: "Maria Souza",
          username: "maria_souza",
          profile_pic: "https://fbcdn-profile-a.akamaihd.net/example.jpg",
        }),
      });

      const profile = await service.fetchProfile("1234567890", "VALID_PAGE_TOKEN");

      expect(profile).not.toBeNull();
      expect(profile?.name).toBe("Maria Souza");
      expect(profile?.username).toBe("maria_souza");
      expect(profile?.profilePic).toBe("https://fbcdn-profile-a.akamaihd.net/example.jpg");
      expect(mockedFetch).toHaveBeenCalledWith(
        expect.stringMatching(/graph\.facebook\.com\/v26\.0\/1234567890\?fields=name,username,profile_pic/),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer VALID_PAGE_TOKEN",
          }),
        }),
      );
    });

    it("falls back to username when name is missing", async () => {
      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          username: "maria_souza",
          profile_pic: "https://example.com/pic.jpg",
        }),
      });

      const profile = await service.fetchProfile("1234567890", "TOKEN");

      expect(profile?.name).toBe("maria_souza");
      expect(profile?.username).toBe("maria_souza");
      expect(profile?.profilePic).toBe("https://example.com/pic.jpg");
    });

    it("returns null on 401 without throwing", async () => {
      mockedFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: { code: 190 } }),
      });

      const profile = await service.fetchProfile("1234567890", "BAD_TOKEN");

      expect(profile).toBeNull();
    });

    it("returns null on 429 without throwing", async () => {
      mockedFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: { code: 4 } }),
      });

      const profile = await service.fetchProfile("1234567890", "TOKEN");

      expect(profile).toBeNull();
    });

    it("returns null on network error", async () => {
      mockedFetch.mockRejectedValueOnce(new Error("network failure"));

      const profile = await service.fetchProfile("1234567890", "TOKEN");

      expect(profile).toBeNull();
    });

    it("returns null when profile_pic is missing", async () => {
      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ name: "Maria" }),
      });

      const profile = await service.fetchProfile("1234567890", "TOKEN");

      expect(profile?.name).toBe("Maria");
      expect(profile?.profilePic).toBeNull();
    });

    it("returns null when IGSID is empty", async () => {
      const profile = await service.fetchProfile("", "TOKEN");
      expect(profile).toBeNull();
      expect(mockedFetch).not.toHaveBeenCalled();
    });

    it("returns null when token is empty", async () => {
      const profile = await service.fetchProfile("1234567890", "");
      expect(profile).toBeNull();
      expect(mockedFetch).not.toHaveBeenCalled();
    });
  });
});
