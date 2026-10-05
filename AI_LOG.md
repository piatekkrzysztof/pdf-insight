# AI_LOG — PDF Insight

## Narzędzia i sposób pracy

Projekt powstaje z pomocą Codex. AI przeanalizowało brief, dokument testowy, przygotowało roadmapę, kod, testy i dokumentację. Wykorzystano lokalne narzędzia odczytu PDF, dokumentację OpenAI, Vite i Cloudflare oraz testy Vitest i Playwright w Chrome. Bez delegowania pracy do dodatkowych agentów.

Stan: implementacja lokalna. Testy używają kontrolowanych odpowiedzi AI. Test rzeczywistego OpenAI, wdrożenie i pomiar czasu na publicznym demo pozostają do wykonania po konfiguracji kont i sekretu. Nie przedstawiamy wyników testowych jako wyników rzeczywistego modelu.

## Kluczowe prompty i instrukcje

1. **Analiza zadania — rzeczywisty prompt użytkownika:** „Zapoznaj się z kryteriami i zaplanuj szczegółową roadmapę, jak krok po kroku zrealizować ten projekt zgodnie z najwyższymi standardami”. Dołączono brief i testową umowę. Efekt: priorytety wynikające z wag oceny i rozpoznanie ukrytego polecenia na stronie 4 oraz skanu na stronie 11.
2. **Rozpoczęcie implementacji — rzeczywisty prompt użytkownika:** „Czy jesteś w stanie zacząc ze mną to robić?”. Następnie użytkownik potwierdził: „Mam API openai i cloudflare”. Efekt: frontend React, backend Cloudflare Workers i adapter OpenAI.
3. **Prompt aplikacji — przygotowany i sprawdzony testami, jeszcze bez rzeczywistego wywołania:** `worker/prompt.ts`. Kluczowe reguły: tekst PDF jest niezaufanymi danymi, 3–5 zdań podsumowania, 3–7 punktów, brak zgadywania, zachowanie kontekstu kwot i dat, cytaty dosłowne z numerami stron. Treść PDF trafia do osobnej wiadomości użytkownika; instrukcje do pola `instructions`.

Pełny prompt aplikacji jest wersjonowany w repozytorium. Kolejne rzeczywiste iteracje jakości zostaną dopisane po testach modelu, bez wymyślania historii promptów.

## Błędy i poprawki

- Pierwsza ekstrakcja lokalnym skryptem Python urwała się na kodowaniu terminala Windows. Ustawiono UTF-8 i odczytano pozostałe strony. Strona 11 nie zawiera tekstu, co potwierdzono renderowaniem, a nie założeniem, że jest pusta.
- Początkowa implementacja przekazała do nowego PDF.js starszą opcję `isEvalSupported`. TypeScript wykazał, że nie występuje w API zainstalowanej wersji. Usunięto ją, zachowując kontrolę aktualnych typów zamiast wyciszać błąd rzutowaniem.
- Początkowy `beforeEach(() => create.mockReset())` zwracał funkcję mocka. Vitest 5 traktował ją jako cleanup i ponownie wywoływał po teście. Zmieniono hook na blok bez zwracania wartości; test błędu transportu przeszedł.
- Brief wymaga 3–5 zdań. Zamiast liczyć kropki w skrótach firm, kontrakt wewnętrzny modelu używa tablicy `summarySentences` o długości 3–5, łączonej na backendzie w wymagany publiczny string `summary`. To ogranicza błędy formatu, ale nie dowodzi poprawności merytorycznej.
- Cytaty wygenerowane przez model mogą być nieprawdziwe. Backend porównuje je z tekstem wskazanej strony i usuwa niedopasowane cytaty, zamiast przedstawiać je jako dowody.

## Weryfikacja i odpowiedzialność

- 25 testów jednostkowych/integracyjnych schematu, limitów i backendu.
- Testy przeglądarkowe: wgranie prawdziwego tekstowego PDF, wynik z kontrolowanego API, podgląd i pobranie JSON, ponowienie błędu, nieprawidłowy PDF i szerokość 360 px.
- Osobny test lokalny dołączonego dokumentu: 12 stron, ostrzeżenie o stronie 11.
- Kontrola TypeScript strict i ESLint bez `any` i `console.log` w kodzie aplikacji.
- Ręczny przegląd zrzutów desktop/mobile.

Przed oddaniem autor musi przejrzeć kod i umieć wyjaśnić każde rozwiązanie. Testy z mockiem nie dowodzą odporności rzeczywistego modelu na prompt injection ani spełnienia limitu 30 sekund. Te punkty wymagają rzeczywistych pomiarów i oceny treści.
