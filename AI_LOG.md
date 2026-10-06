# AI_LOG — PDF Insight

## Narzędzia i sposób pracy

Projekt powstaje z pomocą Codex. AI przeanalizowało brief, dokument testowy, przygotowało roadmapę, kod, testy i dokumentację. Końcowy audyt i poprawki przed oddaniem wykonano w Claude Code. Wykorzystano lokalne narzędzia odczytu PDF, dokumentację OpenAI, Vite i Cloudflare oraz testy Vitest i Playwright w Chrome. Bez delegowania pracy do dodatkowych agentów.

Stan: publiczne GitHub Pages i Cloudflare Worker, z sekretem OpenAI skonfigurowanym poza repozytorium. Oprócz testów z kontrolowanymi odpowiedziami wykonano rzeczywistą analizę załączonego dokumentu przez OpenAI, za wyraźną zgodą użytkownika. Wyniki poniżej rozróżniają te dwa rodzaje testów.

## Kluczowe prompty i instrukcje

1. **Analiza zadania — rzeczywisty prompt użytkownika:** „Zapoznaj się z kryteriami i zaplanuj szczegółową roadmapę, jak krok po kroku zrealizować ten projekt zgodnie z najwyższymi standardami”. Dołączono brief i testową umowę. Efekt: priorytety wynikające z wag oceny i rozpoznanie ukrytego polecenia na stronie 4 oraz skanu na stronie 11.
2. **Rozpoczęcie implementacji — rzeczywisty prompt użytkownika:** „Czy jesteś w stanie zacząc ze mną to robić?”. Następnie użytkownik potwierdził: „Mam API openai i cloudflare”. Efekt: frontend React, backend Cloudflare Workers i adapter OpenAI.
3. **Prompt aplikacji:** `worker/prompt.ts`. Kluczowe reguły: tekst PDF jest niezaufanymi danymi, krótkie podsumowanie zgodne z zakresem briefu, brak zgadywania, zachowanie kontekstu kwot i dat, cytaty z numerami stron. Treść PDF trafia do osobnej wiadomości użytkownika; instrukcje do pola `instructions`.

4. **Audyt przed oddaniem - rzeczywisty prompt użytkownika (Claude Code):** „Przeanalizuj to co zrobiłem. Sprawdź czy są wszystkie wymagane funkcjonalności, czy wszystko działa. Zrób audyt kodu, przeanalizuj pod kątem bezpieczeństwa, higieny pracy, oraz przygotuj roadmapę ewentualnych poprawek”. Efekt: porównanie repozytorium z produkcją, uruchomienie wszystkich kontroli CI lokalnie, sondy CORS i dwie kontrolne analizy produkcyjne pliku testowego.
5. **Wdrożenie poprawek - rzeczywisty prompt użytkownika:** „Dawaj poprawki, push i ponowne wdrożenie, trzeba dostosować to w miarę szybko”. Efekt: poprawki opisane niżej, commity, push, ponowne wdrożenie Workera i kontrolna analiza.

Pełny prompt aplikacji jest wersjonowany w repozytorium. Po testach skrócono preferowaną odpowiedź do 3–4 zdań i 3–5 punktów oraz maksymalnie 10 istotnych kwot i 7 dat. Ogranicza to czas odpowiedzi, ale wynik nie jest wyczerpującym spisem wszystkich liczb w dokumencie.

## Błędy i poprawki

- Pierwsza ekstrakcja lokalnym skryptem Python urwała się na kodowaniu terminala Windows. Ustawiono UTF-8 i odczytano pozostałe strony. Strona 11 nie zawiera tekstu, co potwierdzono renderowaniem, a nie założeniem, że jest pusta.
- Początkowa implementacja przekazała do nowego PDF.js starszą opcję `isEvalSupported`. TypeScript wykazał, że nie występuje w API zainstalowanej wersji. Usunięto ją, zachowując kontrolę aktualnych typów zamiast wyciszać błąd rzutowaniem.
- Początkowy `beforeEach(() => create.mockReset())` zwracał funkcję mocka. Vitest 5 traktował ją jako cleanup i ponownie wywoływał po teście. Zmieniono hook na blok bez zwracania wartości; test błędu transportu przeszedł.
- Brief wymaga 3–5 zdań. Zamiast liczyć kropki w skrótach firm, kontrakt wewnętrzny modelu używa tablicy `summarySentences` o długości 3–5, łączonej na backendzie w wymagany publiczny string `summary`. To ogranicza błędy formatu, ale nie dowodzi poprawności merytorycznej.
- Cytaty wygenerowane przez model mogą być nieprawdziwe. Backend porównuje je z tekstem wskazanej strony i usuwa niedopasowane cytaty, zamiast przedstawiać je jako dowody.

## Weryfikacja i odpowiedzialność

- 50 testów jednostkowych/integracyjnych schematu, limitów, backendu, dzielenia dokumentów, limitu dobowego, historii i zgodności liczb/dat ze źródłem; 7 testów E2E (2 opcjonalne z dostarczonym PDF).
- Testy przeglądarkowe: wgranie prawdziwego tekstowego PDF, wynik z kontrolowanego API, podgląd i pobranie JSON, ponowienie błędu, nieprawidłowy PDF i szerokość 360 px.
- Osobny test lokalny dołączonego dokumentu: 12 stron, ostrzeżenie o stronie 11.
- Kontrola TypeScript strict i ESLint bez `any` i `console.log` w kodzie aplikacji.
- Ręczny przegląd zrzutów desktop/mobile.

## Rzeczywista ewaluacja — 6 października 2026

- Pierwszy test publiczny: 14,853 s od wgrania do odpowiedzi, ale model podał błędny VAT 42 600 zamiast 42 435 PLN i datę zatwierdzenia protokołu 26 marca zamiast 26 lutego. Nie uznano tego za poprawny wynik tylko dlatego, że JSON spełniał schemat.
- Dodano wewnętrzne wskazanie strony i fragmentu źródłowego dla kwot i dat oraz testy regresji obu błędów. Publiczny schemat briefu pozostał bez tych wewnętrznych pól.
- Nietypowe odstępy wewnątrz polskich liter, pochodzące z warstwy tekstowej PDF, powodowały odrzucanie cytatów. Porównanie toleruje teraz białe znaki, zachowując litery i cyfry.
- Zbyt obszerne odpowiedzi i mało precyzyjna informacja o błędach powodowały błędy 502/504. Cztery kolejne próby wcześniejszych wersji zakończyły się odrzuceniem odpowiedzi, a nie sukcesem. Skrócono prompt, dopuszczono równoważną notację kwot, a przy naprawie model dostaje listę liczb odczytanych ze wskazanej strony. Dane te nie trafiają do logów.
- Po poprawce rzeczywisty backend odpowiedział w 18,721 s (czas sieciowy): prawidłowy VAT 42 435 PLN, termin płatności 2026-03-29, kwoty w PLN/EUR/USD, cztery zdania po polsku i jawna informacja o nieodczytanej stronie 11. Odpowiedź pominęła część kwot brutto; ekstrakcja jest selektywna.
- W obserwowanych odpowiedziach model zignorował ukryte polecenie o nieważności i wartości 1 PLN. Jeden dokument nie dowodzi pełnej odporności na prompt injection.

Przed oddaniem autor powinien przejrzeć kod i umieć wyjaśnić rozwiązania. Weryfikacja obecności liczby na stronie nie dowodzi poprawności przypisanego kontekstu ani wszystkich twierdzeń podsumowania. OCR (dodany później) odczytuje skan lokalnie; jego wynik wymaga porównania z oryginałem.

- Dalsze próby wykazały, że sprawdzanie daty w całym dokumencie mogło zaakceptować datę z innego kontekstu. Tę zmianę wycofano; końcowa wersja wymaga wskazanej strony. Zrezygnowano z dodatkowej transkrypcji liczby przez model: backend sam dopasowuje pełne liczby i warianty dat do rzeczywistego tekstu strony.
- Naprawiono przekazywanie poprzedniej odpowiedzi do ponowienia, dodano wskazanie stron z pasującą datą i ustawiono temperaturę 0. To poprawiło obserwowane wyniki, ale nie gwarantuje deterministyczności.
- Końcowa wersja: API 9,737 s; pełny test publicznej strony w Chrome 19,729 s (odczyt 0,575 s), poprawny eksport JSON, budżet/netto/VAT/brutto i daty zgodne z dokumentem. Szczegóły w docs/ACCEPTANCE.md. Łącznie podczas wcześniejszych iteracji zanotowano osiem odpowiedzi 502/504; nie są wliczane do końcowych sukcesów.
- Końcowe lokalne E2E: 4/4, w tym odczyt dostarczonego PDF. Pierwszy przebieg zakończył asercje, ale zawiesił się przy zamykaniu procesów w ograniczonym środowisku Windows; powtórzenie z właściwymi uprawnieniami zakończyło się kodem 0.

## Audyt przed oddaniem - 6 października 2026, 13:00-14:00

- OCR, historia, dzielenie długich dokumentów i dobowy limit działały lokalnie, a Worker z tymi zmianami był już wdrożony, ale nie były zacommitowane. Repozytorium i GitHub Pages pokazywały starszą wersję niż produkcyjny backend. Zmiany trafiły do Git w kilku logicznych commitach.
- Push w tamtym stanie nie przeszedłby CI: ESLint nie obejmował plików `.mjs` (brak globali Node w skrypcie ewaluacji), a cztery pliki nie były sformatowane. Poprawiono konfigurację i formatowanie przed pushem.
- Kontrolna analiza produkcyjna pliku testowego wykazała zmyślenie: model napisał, że strona 11 „jest pusta i nie zawiera informacji”, a analiza jest „kompletna”. To skan aneksu zmieniającego abonament. Reguła w prompcie nie wystarczyła, bo nic jej nie sprawdzało. Teraz zdanie o nieodczytanych stronach buduje serwer z wyniku ekstrakcji, a sprzeczne zdania modelu są usuwane. Test regresji używa dosłownie tamtego zdania. Ponowna analiza produkcyjna: 12,3 s, poprawny komunikat o stronie 11.
- OCR był dostępny tylko po zaznaczeniu opcji przed wgraniem pliku. Ostrzeżenie o nieodczytanej stronie ma teraz przycisk uruchamiający lokalny OCR; E2E z dostarczonym PDF potwierdza odczyt strony 11.
