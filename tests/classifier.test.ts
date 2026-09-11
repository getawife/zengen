import test from "node:test";
import assert from "node:assert/strict";
import { classify } from "../src/classifier/classifier.js";
import { adultPhrases, adultTerms } from "../src/classifier/lexicon.js";

test("blocks explicit English page content with multiple signals", () => {
  const result = classify({
    title: "Adult video gallery",
    text: "This page contains explicit content and porn video clips.",
    url: "https://example.com/adult-content",
  });

  assert.equal(result.blocked, true);
  assert.ok(result.score >= 80);
  assert.ok(result.signals.includes("EXPLICIT_PHRASE"));
  assert.ok(result.signals.includes("URL_MATCH"));
});

test("blocks corrected multilingual Chinese content", () => {
  const result = classify({
    title: "成人内容",
    text: "成人视频 色情 裸体",
    url: "https://example.com/xxx",
  });

  assert.equal(result.blocked, true);
  assert.ok(adultTerms.has("色情"));
  assert.ok(adultPhrases.includes("成人内容"));
});

test("blocks corrected multilingual Russian content", () => {
  const result = classify({
    title: "взрослый контент",
    text: "порно порнография эротика",
    url: "https://example.com/nsfw",
  });

  assert.equal(result.blocked, true);
  assert.ok(adultTerms.has("порно"));
  assert.ok(adultPhrases.includes("взрослый контент"));
});

test("detects obfuscated explicit terms", () => {
  const result = classify({
    title: "Gallery",
    text: "p 0 r n",
    url: "https://example.com/xxx",
  });

  assert.equal(result.blocked, true);
  assert.ok(result.signals.includes("OBFUSCATED_TERM"));
});

test("does not block weak safe educational context", () => {
  const result = classify({
    title: "Adult education course",
    text: "This school offers adult education classes in history and language.",
    url: "https://college.example/courses",
  });

  assert.equal(result.blocked, false);
  assert.ok(result.score < 80);
});
