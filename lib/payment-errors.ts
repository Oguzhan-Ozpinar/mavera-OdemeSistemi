const codeMessages: Record<string, string> = {
  CORE0302: "Islem basariyla tamamlandi.",
  "51": "Kart limitiniz veya bakiyeniz yetersiz. Lutfen baska bir kart deneyin.",
  "05": "Banka islemi onaylamadi. Lutfen bankanizla gorusun veya baska bir kart deneyin.",
  "54": "Kartinizin son kullanma tarihi gecmis gorunuyor.",
  "57": "Kartiniz bu islem turune izin vermiyor.",
  "91": "Banka sistemine ulasilamadi. Lutfen biraz sonra tekrar deneyin."
};

export function friendlyPaymentMessage(code?: string | null, rawMessage?: string | null) {
  if (code && codeMessages[code]) {
    return codeMessages[code];
  }

  const message = (rawMessage ?? "").toLocaleLowerCase("tr-TR");
  if (message.includes("yetersiz") || message.includes("insufficient")) {
    return codeMessages["51"];
  }
  if (message.includes("expired") || message.includes("son kullanma")) {
    return codeMessages["54"];
  }
  if (message.includes("declined") || message.includes("red")) {
    return codeMessages["05"];
  }

  return "Odeme su anda tamamlanamadi. Lutfen bilgileri kontrol edip tekrar deneyin.";
}
