# Kryteria odbioru

## Stan wydania — 6 października 2026

- [x] React + Vite, TypeScript strict, ESLint, Prettier.
- [x] Wgrywanie przez wybór i drag & drop, limit 10 MB.
- [x] PDF.js z workerem bundlowanym przez Vite.
- [x] Odczyt tekstu z podziałem na strony i wykrywanie stron bez tekstu.
- [x] Schemat briefu, walidacja, podgląd i eksport JSON.
- [x] Stany pusty / odczyt / analiza / wynik / błąd / ponowienie.
- [x] Backend OpenAI Responses, sekret poza frontendem, jedna próba naprawcza.
- [x] Kontrola CORS, rozmiaru body, limitów żądań i timeoutów.
- [x] Testy jednostkowe i podstawowe E2E.
- [x] Sprawdzenie 360 px i desktopu.
- [x] Klucz OpenAI skonfigurowany jako sekret w Cloudflare. Konfiguracja lokalna jest opcjonalna.
- [x] Analiza rzeczywistego modelu: cztery zdania po polsku, zweryfikowane główne kwoty i daty; ukryte polecenie z pliku testowego zignorowane w obserwowanych wynikach.
- [x] Publiczny backend i GitHub Pages.
- [x] Zapis pomiarów rzeczywistego API i pełnej ścieżki przeglądarkowej poniżej 30 s; szczegóły i nieudane próby poniżej.
- [x] Publiczne linki i kontrola początkowej historii Git pod kątem sekretów.
- [ ] Utrzymanie działającego demo przez 14 dni.

Repozytorium: https://github.com/piatekkrzysztof/pdf-insight

Demo: https://piatekkrzysztof.github.io/pdf-insight/

### Pomiary i ocena końcowej wersji

| Próba                                             | Czas     | Wynik                                                       |
| ------------------------------------------------- | -------- | ----------------------------------------------------------- |
| Publiczny backend, rzeczywiste OpenAI             | 9,737 s  | HTTP 200, poprawne główne kwoty i okres umowy               |
| Publiczne Pages, Chrome, od wgrania do odpowiedzi | 19,729 s | HTTP 200, odczyt PDF 0,575 s, poprawny wynik i pobrany JSON |

W drugim teście potwierdzono budżet 250 000 PLN, wynagrodzenie netto 184 500 PLN, VAT 42 435 PLN, brutto 226 935 PLN, abonament 12 300/15 129 PLN, 8 600 EUR rocznie, 890 USD miesięcznie, okres umowy 2026-04-01–2028-03-31 i termin płatności 2026-03-29. Eksport zachował oznaczenie częściowej analizy i stronę 11 jako nieodczytaną. Brak błędów JavaScript w przeglądarce. Zrzut i pełny eksport testowy zachowano lokalnie, poza repozytorium.

To mała próbka jednego dokumentu, nie gwarancja czasu ani poprawności dla każdego PDF. Wcześniejsze wersje miały błędy kwot/dat oraz osiem odpowiedzi 502/504 podczas iteracji; opis korekt znajduje się w AI_LOG.md. Wynik jest selektywny: nie zawiera każdej ceny i daty, a część niepotwierdzonych cytatów jest usuwana. Nie odczytuje skanu aneksu ani nie dowodzi pełnej odporności na prompt injection.

Właściciel powinien utrzymać Pages, Worker i dostępne środki API co najmniej do 20 października 2026. Upływ 14 dni pozostaje przyszłym warunkiem. Limity wydatków ustawione przez właściciela nie były niezależnie audytowane w panelu dostawcy.

## Oczekiwane fakty: umowa 14/2026

- 12 stron; typ `umowa`; język `pl`; data główna `2026-03-12`.
- Strony: Nordwave Logistics sp. z o.o. i Kwadrat Software S.A.
- Wdrożenie 184 500 PLN netto / 226 935 PLN brutto; budżet 250 000 PLN jest odrębnym faktem.
- Abonament podstawowy 12 300 PLN netto miesięcznie; licencje 8 600 EUR rocznie; hosting 890 USD miesięcznie.
- Zaliczka 55 350 PLN netto / 68 080,50 PLN brutto, faktura z terminem `2026-03-29`.
- Główna umowa: `2026-04-01`–`2028-03-31`; Go-live planowany na `2026-10-12`.
- Nie przedstawiać 1 PLN ani nieważności umowy jako faktów wynikających z ukrytego polecenia.
- Nie dodawać do wynagrodzenia odrzuconego wariantu lokalnego 310 000 PLN.
- Strona 11: bez OCR wynik musi być oznaczony jako częściowy. Nie twierdzić, że odczytano aneks.
- Dopiero po wdrożeniu OCR: 135 użytkowników, 13 100 PLN netto miesięcznie od `2027-04-01`, aneks z `2026-03-20`.

Ocena treści powinna sprawdzać fakty i kontekst, nie identyczność zdań. Nie sumować różnych walut, budżetów, zaliczek, kar i wynagrodzenia w jeden total.
