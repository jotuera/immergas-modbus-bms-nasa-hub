# Karty huba Immergas

[English](README.md) · **Polski**

Karty Lovelace dla IMMERGAS Modbus BMS NASA OpenTherm HUB. Jeden plik JavaScript; karty pojawiają się w
**Dodaj kartę** jak wbudowane i same znajdują hub oraz jego encje — bez YAML-a i bez entity_id.

| Karta | Typ | Co pokazuje |
|---|---|---|
| Schemat | `custom:immergas-diagram-card` | animowany schemat instalacji: jednostka zewnętrzna (wentylator, Hz sprężarki, parownik, EEV), obieg czynnika, wymiennik płytowy, pompa obiegowa z przepływem, kocioł gazowy (Combo), zawór 3-drożny, bufor i dom, zasobnik CWU; aktywne obiegi świecą i płyną; kafle statystyk na górze. Opcje: `boiler: false` (Magis Pro), `buffer: false`; `stats: false` ukrywa kafelki nad schematem (tak robi strategia – te same dane są w karcie Teraz) |
| Wykresy | `custom:immergas-charts-card` | wykresy SVG w zakładkach: **Doba** (temperatury wody i zasobnika + Hz sprężarki na osobnym wykresie z zaznaczonymi okresami CWU), **Tydzień** (średnia godzinowa mocy cieplnej i poboru), **Miesiąc** (ciepło i prąd dziennie + COP dzienny); podpowiedzi z celownikiem, legenda z bieżącymi wartościami, paleta czytelna dla daltonistów (jasny/ciemny) |
| Teraz | `custom:immergas-now-card` | banery błędu i odszraniania, tryb pracy, Hz sprężarki, zasilanie/powrót, COP teraz/dziś, paski czasu (bieżąca faza na tle typowej długości z historii z szacowanym końcem, rytm CWU z następnym spodziewanym cyklem, tryb nocny: ile trwa i ile zostało albo odliczanie do startu, pasek ostatnich 6 h z cyklami sprężarki i kotła; ukrycie: `show_timers: false`, okno nocne z `night_start` / `night_stop` jak w karcie Tryb pracy, inaczej wyuczone z historii), kafle: na zewnątrz / Strefa 1 / zasobnik CWU / moc |
| Nastawy | `custom:immergas-setpoints-card` | dwa kafle: ogrzewanie Strefy 1 i ciepła woda – temperatura, stan (grzeje / czuwa), regulator nastawy −/+ (kilka dotknięć składa się w jeden zapis) i profile **EKO / KOMFORT**: dla CO to profile Komfort / Eko Strefy 1 z pieca (w trybie chłodzenia – chłodzenia), edytowane pod zębatką; dla CWU encje DD `Nastawa CWU Komfort` / `Nastawa CWU Eko` i przełącznik `CWU Komfort-Eko wg harmonogramu` (DD ≥ 2.4.0, pod zębatką), na starszym DD opcje `dhw_eco` / `dhw_comfort` – pomocnicy `input_number` albo liczby (domyślnie 45 / 55 °C); opcjonalnie wilgotność `humidity_entity` / `humidity_target` |
| Tryb pracy | `custom:immergas-mode-card` | przyciski trybu (2× dotknięcie), funkcja nocna U11 i nocny limit, tryb wyjazdowy i ograniczenie FR z F1/F2 (ukrycie: `show_f1f2: false`), przyciski programu czasowego Strefy 1 **AUTO / MANUAL** (2× dotknięcie), przełączniki modulacja z sondą pokojową / wymuszenie CWU / anty-legionella P15 / korekcja punktu rosy / auto-odpowietrzanie A12 (ustawienie przy włączeniu pieca) / odpowietrz teraz (jednorazowy cykl AP99, szeroki wiersz) (2× dotknięcie; ukrycie: `show_toggles: false`), stan pracy huba, starty i czas pracy sprężarki, limit wydajności (faza programu z pieca – Komfort / Eko – w podpisie AUTO / MANUAL), integracja z kotłem (pompa wykluczona, I10) i wiersz źródła ciepła CO **AUTO / Grzanie kotłem / Grzanie pompą** (wymuszenie kotła 4449 / I02 OFF; tylko Zima) oraz wiersz źródła CWU **AUTO / Grzanie kotłem / Grzanie pompą** (I01 AL + I03 = `dhw_auto_wait` min, domyślnie 15 / I01 AL + I03 = 1 / I01 OFF; Lato, Chłodzenie i Zima), nad trybem nocnym, 2× dotknięcie; ukrycie obu: `show_source: false` |
| Koszt ciepła | `custom:immergas-gas-card` | koszt 1 kWh ciepła z pompy, grzałki elektrycznej i (Combo) kotła gazowego, werdykt najtańszego źródła, ceny pod przyciskiem ⚙; widoki **Combo / Pro** przełączane w karcie (domyślnie z modelu systemu D61). Opcje: `variant: combo / pro`, `heater_efficiency` (domyślnie 1,0) |
| Krzywe | `custom:immergas-curve-card` | zakładki **Grzanie** (R04/R05 + offset U03) i **Chłodzenie** (R13/R12, pas punktu rosy); przełącznik **Wyjazd** zamienia obie na krzywe wyjazdowe (FSV 5011–5019); przeciągane punkty, temp. zewnętrzna, zadane D04 i faktyczne zasilanie |
| Krzywa pogodowa huba | `custom:immergas-hub-curve-card` | dwupunktowa krzywa liczona w hubie – `gb_curve` (kocioł po Modbus BMS) albo `ot_regulator` (OpenTherm, z korektą pokojową); przeciągane punkty (góra / dół = zasilanie, lewo / prawo = temp. zewnętrzna), CO min. / maks. kotła, nastawa i faktyczne zasilanie, wł. / wył. Encje znajdowane po nazwie; opcje `family: gb / ot`, `entities`, `room_entity` |
| Tryb pracy kotła w hubie | `custom:immergas-hub-mode-card` | tryb kotła z pakietów `gb_` / `ot_` jako Standby / Lato / Zima / Tylko CO (2× dotknięcie) – gb_: select trybu pracy, ot_: zezwolenia CO + CWU; kafle CO / CWU / płomień, żądanie grzania, maks. nastawa CO / modulacja albo limit mocy; bramka OpenTherm: kto ustawia zezwolenia (pilot czy nadpisanie z huba). Opcje `family: gb / ot`, `entities` |
| Obieg wodny | `custom:immergas-water-card` | zasilanie/powrót pompy i kotła, delta T, przepływ, lift termiczny, zawór 3-drożny |
| Obieg chłodniczy | `custom:immergas-refrigerant-card` | sprężarka, tłoczenie, parownik, EEV, wentylator, napięcia, stany i flagi jednostki (`flags: false` ukrywa flagi) |
| Stan urządzeń | `custom:immergas-states-card` | włączone / wyłączone elementy jednostki zewnętrznej w dwóch wierszach po pięć: sprężarka, wentylator, zlecenie pracy, odszranianie, zawór 4-drogowy, gorący gaz, pompa obiegowa, grzałka rezerwowa, grzałka CWU, grzałka tacy |
| Harmonogram | `custom:immergas-schedule-card` | zakładki **CO · Strefa 1** / **CWU** i dwa układy przełączane przyciskiem w karcie: **kalendarze** (jak w aplikacji Dominus: 4 kalendarze z zakresami i dniami tygodnia, dotknij dnia, aby go przenieść, ołówek otwiera zakresy) i **tydzień** (kalendarz 1–4 na każdy dzień, jeden kalendarz na wszystkie dni, edycja poniżej); zakresy ±15 min; nastawy komfort/eko albo CWU. Opcje: `target: co / cwu` (zakładka startowa), `layout: calendars / week` |
| Sterowanie F1/F2 | `custom:immergas-f1f2-card` | te same przełączniki trybu wyjazdowego i FR jako osobna karta (2× dotknięcie); od huba v23 zapis jest stale uzbrojony, na starszym hubie karta pokazuje przycisk Uzbrój |
| Kalibracja | `custom:immergas-calibration-card` | tabela w grupach (taktowanie, sposób pracy, ogrzewanie i krzywa, ciepła woda, pompa obiegowa, współpraca z kotłem, chłodzenie, pozostałe) obejmująca wszystkie parametry Atoma oraz diagnostykę (rozkład ciepła między piętrami wg pięter HA, ΔT zasilanie–powrót, COP dziś na tle modelu 45 % Carnota, COP CWU, tryb wyjazdowy wg urlopu, nocny limit wydajności): taktowanie (starty CO/h, długość cyklu, starty dziś, cykle CWU na dobę – model, pomiar, co zrobić) nastawa CO w pokojach (termostaty: model 21 °C, z 23 °C w dół do 22 °C, gdy pokoje są blisko, przycisk Ustaw zmienia termostaty o tej samej nastawie), FR – ograniczenie częstotliwości (wł. przy zapasie mocy, wył. gdy pokoje nie nadążają, praca CO > 70 % albo zimno), anty-legionella P15 (potrzebna przy CWU < 55 °C, termin w taniej taryfie), tryb nocny U11 (ostatnia noc: temp. zewn., spadek temperatur pokoi, udział pracy sprężarki – zostaw dla lepszego COP albo wyłącz w chłodne noce), harmonogram CO (MANUAL przy termostatach pokojowych, inaczej AUTO z Eko ≤ 1 K niżej) i CWU (kalendarz w tańszej taryfie – opcja `cheap_hours`, np. `"13:00-15:00,22:00-06:00"` dla G12), źródło ciepła CO i CWU (pompa / kocioł / AUTO z COP i cen: próg opłacalności = cena prądu ÷ koszt ciepła z gazu) i kluczowe parametry (R05, R04, U03, modulacja z sondą, nastawa Strefy 1, T05, T07, D05, T02, I10, limit podłogi, korekcja rosy) w trzech kolumnach: **wartość modelowa** dla pompy z podłogówką (z uzasadnieniem), **obecna** i **rekomendacja** liczona z ostatnich 24 h (starty i długość cykli CO, cykle CWU) oraz z termostatów pokojowych (opcja `rooms`, inaczej wykrywane), z przyciskiem **Ustaw** (2× dotknięcie); na końcu **skuteczność optymalizacji**: przed / po / zmiana % dla kosztu na stopniodzień, kosztu 1 kWh ciepła, prądu i gazu na stopniodzień, COP, startów/h i długości cyklu oraz ocena łączna (opcja `optimized_since` = data zmiany, inaczej ostatnie 7 dni wobec poprzednich 7) |
| Automatyzacje | `custom:immergas-automations-card` | automatyzacje pompy w grupach Sterowanie / Ostrzeżenia / Zabezpieczenia: przełącznik (`input_boolean`), opis, kiedy ostatnio zadziałała, stan na żywo (np. urlop aktywny, starty w tej godzinie) i próg z −/+; domyślnie automatyzacje `auto_pompa_*`, własna lista w opcji `items`; w strategii na dole, gdy są przełączniki `auto_pompa_*` albo opcja `automations.items` |
| Ustawienia | `custom:immergas-settings-card` | dyskretna, zwinięta karta: cena prądu i gazu, pojemność zasobnika CWU, czas wymuszenia CWU, kalibracja szacowania gazu, okno trybu nocnego U12/U13 (opcje `night_start` / `night_stop` = pomocnicy input_datetime), język opisów błędów; `expanded: true` otwiera ją domyślnie |
| Ostatni cykl CWU | `custom:immergas-dhw-card` | źródło, czas, prąd, ciepło (zasobnik i przepływ), COP i koszt w porównaniu z gazem |
| Kocioł OpenTherm | `custom:immergas-ot-boiler-card` | Immergas Dominus w trybie OpenTherm: co kocioł podaje (moc maks., min. modulacja, zakres CO / CWU, typ CWU ze skanu, spaliny, wentylator), starty palnika dziś / w ostatniej godzinie i czas pracy palnika (taktowanie na czerwono), flagi błędów (Data-ID 5) i historia błędów z opisami, **Reset kotła** (dwa dotknięcia) i przełącznik **Tylko odczyt (steruje pilot)** (Dominus ≥ 1.6.9) |
| Mapa Data-ID | `custom:immergas-ot-map-card` | Dominus OpenTherm: model kotła, **Skanuj Data-ID** (dwa dotknięcia), obsługiwane Data-ID, parametry kotła (TSP) i historia błędów ze skanu, **Przygotuj zgłoszenie** – link w powiadomieniach HA otwiera gotowe zgłoszenie na GitHubie |

Opcje krzywych: `r02` / `r03` (temp. zewnętrzna dla R04 / R05, domyślnie −12 / 20) i `r11` / `r10` (dla R13 / R12, domyślnie
25 / 35) — tych punktów nie ma na magistrali; `max_floor_entity` (maks. zasilanie podłogi, czerwony pas), `dew_point_entity`
(punkt rosy strefy, czerwony pas przy chłodzeniu), `tab` (`heat` / `cool` / `outing`, zakładka startowa).

Opcje trybu pracy: `night_start` / `night_stop` — encja (np. `input_datetime`) albo tekst `"21:00"` z oknem funkcji nocnej
U12 / U13 (nie ma go na magistrali); karta je pokazuje i ostrzega, gdy U11 się z nim nie zgadza. Tak samo `legionella_day`
(`input_select` albo tekst: `nd`, `pn`…, `1`–`7` = pn–nd, `codziennie`) i `legionella_time` (`input_datetime` albo `"02:00"`)
z terminem cyklu anty-legionelli P15 ustawionym na piecu oraz `legionella_hours` (P13 – maks. czas cyklu w godzinach, liczba
albo `input_number`, domyślnie 3): okienka DZIEŃ / START (P16) / STOP w wierszu legionelli (STOP = START + P13), odliczanie w karcie Teraz,
edycja w karcie Ustawienia. Te opcje wystarczy wpisać w jednej karcie pulpitu – pozostałe karty biorą je stamtąd. Bez nich karty biorą wartości z encji konfiguracyjnych huba (pakiet `hub_boiler_params`: U12/U13, P16/P17/P13, limit zasilania podłogi, godziny tańszej taryfy, data „Porównanie od”).

**Cały pulpit jednym krokiem (strategia):** utwórz pusty pulpit, otwórz surowy edytor konfiguracji i wpisz

```yaml
strategy:
  type: custom:immergas-hub
```

**Bez huba – Immergas Dominus:** z samą integracją [Immergas Dominus](https://github.com/jotuera/immergas-dominus)
(lokalne TCP do modułu Wi-Fi Dominus) użyj `type: custom:immergas-dominus` – okrojony dashboard z kartami Teraz,
Nastawy, Tryb pracy, Harmonogram i Łączność. Integracja ma te karty w sobie; karty znajdują jej encje po kluczach (bez
danych pompy ciepła, COP i sprężarki – do tego potrzebny jest hub).

## Jak karty znajdują encje

Karty szukają urządzenia z encją „Immergas Hub - Stan pracy” („Operating state”) i dopasowują każdą encję po
**oryginalnej nazwie z ESPHome** (w dowolnym z 11 języków pakietów, z rejestru encji; dopasowanie po części za prefiksem magistrali, więc działa też własny prefiks). Nazwa urządzenia, przedrostek obszaru w
entity_id (np. `kotlownia_…`) ani zmiana nazwy encji w HA nie mają znaczenia. Użytkownik bez uprawnień administratora
korzysta z nazw przyjaznych. Etykiety są w języku Home Assistanta: polski, angielski, czeski, niemiecki, hiszpański, francuski, węgierski, włoski, niderlandzki, portugalski albo słowacki (pozostałe – angielski). Teksty są w kodzie jako `this.t(polski, angielski)`; `tools/extract_strings.cjs` je zbiera, tłumaczenia są w `i18n/<język>.json`, a `tools/gen_i18n.py` buduje `src/i18n_data.ts`.

Kolory biorą zmienne palety Catppuccin, gdy taki motyw jest aktywny, a w innym przypadku wbudowane wartości Catppuccin
Mocha.

## Instalacja przez HACS (zalecana)

1. HACS → ⋮ → **Niestandardowe repozytoria** → repozytorium `https://github.com/jotuera/immergas-modbus-bms-nasa-opentherm-hub`,
   typ **Dashboard** → Dodaj.
2. Znajdź w HACS **Immergas Hub cards**, otwórz i naciśnij **Pobierz**. HACS sam doda zasób dashboardu i będzie
   pokazywał nowe wydania jako aktualizacje.
3. Odśwież przeglądarkę. Karty są w **Dodaj kartę → Niestandardowe: Immergas – …**.

## Instalacja (ręczna)

1. Pobierz `immergas-hub-cards.js` z najnowszego [wydania](https://github.com/jotuera/immergas-modbus-bms-nasa-opentherm-hub/releases/latest)
   (albo weź `dist/immergas-hub-cards.js` z tego folderu) i skopiuj do `/config/www/immergas-hub-cards/`.
2. Ustawienia → Pulpity → ⋮ → Zasoby → Dodaj zasób: `/local/immergas-hub-cards/immergas-hub-cards.js?v=1.0.1`, typ
   *Moduł JavaScript*. Po każdej aktualizacji podbij `?v=`.
3. Odśwież przeglądarkę. Karty są w **Dodaj kartę → Niestandardowe: Immergas – …**.

## Budowanie

```bash
npm install
npm run build
```

Źródła to TypeScript + Lit w `src/`; `src/names.ts` mapuje każdy klucz encji na nazwę we wszystkich 11 językach; plik generuje `tools/gen_names.py` z plików językowych pakietów.
