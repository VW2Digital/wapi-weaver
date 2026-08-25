import { describe, expect, test } from "@jest/globals";
import { buildInstagramGraphUrl } from "../../src/lib/instagram.functions";

describe("buildInstagramGraphUrl", () => {
  test("usa o Graph API do Facebook para Page Access Tokens", () => {
    expect(buildInstagramGraphUrl("17841400000000000", "messages", "v26.0")).toBe(
      "https://graph.facebook.com/v26.0/17841400000000000/messages",
    );
  });

  test("normaliza versão e barra do caminho", () => {
    expect(buildInstagramGraphUrl("ig id", "/messages", "26.0")).toBe(
      "https://graph.facebook.com/v26.0/ig%20id/messages",
    );
  });
});
