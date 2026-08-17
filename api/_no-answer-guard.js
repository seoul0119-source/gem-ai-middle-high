export function isSchoolEnglishNoAnswerRequest(messages) {
  if (!Array.isArray(messages)) return false;
  const latestUser = [...messages].reverse().find((message) => message?.role === "user");
  const text = String(latestUser?.content || "").trim();
  if (!text) return false;

  return /(?:정답|답)(?:을|은|는)?\s*(?:말|알려|가르쳐|공개)(?:\s*해)?\s*(?:주지\s*)?마(?:세요|라|십시오|줘|요)?/i.test(text)
    || /(?:정답|답)(?:을|은|는)?\s*(?:말하지|알려주지|가르쳐주지|공개하지)\s*마(?:세요|라|십시오|줘|요)?/i.test(text)
    || /(?:정답|답)\s*(?:말하지|알려주지|공개하지)/i.test(text)
    || /(?:don't|do not)\s+(?:tell|give|show)\s+(?:me\s+)?(?:the\s+)?answer/i.test(text);
}

export function schoolEnglishNoAnswerResponse() {
  return "알겠어요. 정답이나 힌트는 말하지 않을게요. 현재 문제를 직접 풀어 보세요.\n\n답: (________)";
}
