# IMMERGAS Modbus BMS NASA Hub — kopalnia wiedzy

[English](knowledge-base.md) · **Polski** · powrót do [README](../README.pl.md)

### Trzy magistrale pompy ciepła na jednym ESP32-S3 (ESPHome + Home Assistant)

<p align="center">
  <img src="https://img.shields.io/badge/ESPHome-2026.9%2B-41BDF5.svg" alt="ESPHome 2026.9+">
  <img src="https://img.shields.io/badge/platform-ESP32--S3-41BDF5.svg" alt="ESP32-S3">
</p>

Hub łączy z Home Assistantem **wszystko, co hybrydowa pompa ciepła Immergas Magis Pro / Combo V2 mówi po swoich
trzech magistralach**. Wystarczy jeden **M5Stack AtomS3 Lite** i trzy izolowane moduły RS485. Bez chmury, bez
oryginalnego sterownika Dominus, bez szablonów w HA.

| Magistrala | Rola huba | Co daje |
|---|---|---|
| **D+/D-** (Modbus RTU, master = kocioł) | **slave**: emulowany panel strefy (i opcjonalnie Dominus) | sterowanie kotłem: tryb, nastawy stref, CWU, harmonogramy, temperatura pokojowa z HA; błędy kotła z opisem; dane pompy z płytki MIM |
| **F1/F2** (Samsung NASA) | **słuchacz** + zapytania READ | jednostka zewnętrzna Samsunga: sprężarka, wentylator, EEV, odszranianie, moc i energia pobrana, napięcia, kody błędów, firmware, parametry FSV |
| **T-/T+** (Modbus BMS) | **master** (slave 11 = kocioł) | przepływ D14, stany D97/D98/D99, zawór 3-drogowy, integracja gaz/pompa (menu I), limity R, szacowane zużycie gazu |
| *(hub)* | liczy z trzech magistral naraz | **COP**, energia cieplna, stan pracy systemu, czas pracy i starty sprężarki, koszt ciepła pompa vs gaz, ostatni cykl CWU |

Ten dokument jest jednocześnie **instrukcją huba** i **bazą wiedzy** o magistralach Magisa. Wszystko, co tu jest,
zostało rozszyfrowane na żywej instalacji: podsłuchem, skanowaniem rejestrów, porównaniem trzech magistral między sobą
i z instrukcjami Immergasa i Samsunga. Immergas nie publikuje map rejestrów tych magistral.

> **Instalacja testowa:** Immergas **Magis Combo 9 Plus V2** (płyta fw 6.0) + jednostka zewnętrzna **Audax Pro 9 V2**
> (Samsung EHS, płytka MIM-B19N), jedna strefa, fizyczny Dominus. Część T-/T+ i D+/D- potwierdzona też przez
> użytkowników na **Magis Pro V2**. Na Magis Pro nie ma kotła gazowego, więc encje generatora gazowego nie mają tam
> wartości.

---

## Spis treści

1. [Szybki start](#1-szybki-start)
2. [Sprzęt i podłączenie](#2-sprzęt-i-podłączenie)
3. [Architektura configu](#3-architektura-configu)
4. [Encje huba (Immergas Hub)](#4-encje-huba-immergas-hub)
5. [Magistrala D+/D- (emulator panelu i Dominusa)](#5-magistrala-dd--emulator-panelu-i-dominusa)
6. [Magistrala T-/T+ (Modbus BMS)](#6-magistrala-t-t-modbus-bms)
7. [Magistrala F1/F2 (Samsung NASA)](#7-magistrala-f1f2-samsung-nasa)
8. [Jedna wielkość na trzech magistralach](#8-jedna-wielkość-na-trzech-magistralach)
9. [Wiedza o instalacji: tematy przekrojowe](#9-wiedza-o-instalacji-tematy-przekrojowe)
10. [Duplikaty encji: DD > TT > FF](#10-duplikaty-encji-dd--tt--ff)
11. [Konfiguracja (podstawienia)](#11-konfiguracja-podstawienia)
12. [Aktualizacje i wersje](#12-aktualizacje-i-wersje)
13. [Rozwiązywanie problemów](#13-rozwiązywanie-problemów)
14. [Nierozszyfrowane — pomoc mile widziana](#14-nierozszyfrowane--pomoc-mile-widziana)
15. [Dokumentacja szczegółowa](#15-dokumentacja-szczegółowa)
17. [Dashboard](#17-dashboard)

---

## 1. Szybki start

Instalacja krok po kroku jest w głównym [README](../README.pl.md#instalacja). Po wgraniu sprawdź w Home Assistant:

- *Immergas DD - Połączenie Modbus* = połączono, *Immergas DD - Połączenie Panel Strefy 1* = połączono;
- *Immergas FF - Ramki NASA RX* stale rosną, *Timeouty odczytu NASA* = 0;
- encje *Immergas TT - …* mają wartości, a na wyświetlaczu pieca świeci ikona BMS.

Na każdej magistrali zostaw tylko hub: odłącz stare sterowniki ESP, sniffery i inne mastery. Jeśli **nie** masz
fizycznego Dominusa na D+/D-, zamień ustawienia emulacji (rozdział [5.3](#53-emulacja-panel-czy-dominus)).

Nazwy encji w tym dokumencie są polskie (pliki językowe `packages/lang/*_pl.yaml`). Języki: `cs`, `de`, `en`, `es`, `fr`,
`hu`, `it`, `nl`, `pl`, `pt`, `sk` dla huba, DD i TT; F1/F2 ma `en` / `pl` – przy innych językach użyj `f1f2_en.yaml`.

---

## 2. Sprzęt i podłączenie

### 2.1 Lista części

| Część | Model | Uwagi |
|---|---|---|
| Mikrokontroler | **M5Stack AtomS3 Lite** (ESP32-S3) | 3 sprzętowe UART-y, natywne USB na logi |
| Baza z portami | **M5Stack ATOMIC PortABC Extension Base** (A130) | 3 gniazda Grove: A, B, C. Pasywna: na każdej linii tylko dioda TVS do masy |
| RS485 ×3 | **M5Stack Isolated RS485 Unit** (U094, CA-IS3082W) | izolacja galwaniczna, **automatyczny kierunek** (brak pinu DE); terminacja = rezystor 120 Ω w zaciskach A-B |

### 2.2 Gniazda i piny

| Gniazdo | Magistrala | RX ESP (biały) | TX ESP (żółty) | Ramka | Terminacja 120 Ω |
|---|---|---|---|---|---|
| PortABC **Port A** | D+/D- | G39 | G38 | 9600 8E1 | **ON** |
| PortABC **Port B** | F1/F2 | G8 | G7 | 9600 8E1 | OFF |
| PortABC **Port C** | T-/T+ | G6 | G5 | 9600, kocioł 8N2, hub 8N1 | OFF |
| dolne Grove AtomS3 (obok USB-C) | **wolne** | G1 | G2 | — | — |

### 2.3 Zasady, bez których nic nie działa

- **Biały przewód Grove = RX ESP.** Biały to wyjście danych modułu RS485 (zweryfikowane na wszystkich czterech
  gniazdach). Na naklejce PortABC dla ATOMS3 biały jest **drugim** pinem portu: A 39, B 8, C 6. Żółty jest pierwszym:
  A 38, B 7, C 5. Na dolnym Grove AtomS3 biały = G1, żółty = G2.
  - Objaw odwrotnej mapy: **0 odebranych ramek** albo **same śmieci** (tysiące błędów CRC), chociaż magistrala pracuje.
- **Napisy I2C / GPIO / UART przy portach PortABC to tylko domyślne role.** ESP32-S3 podepnie UART do dowolnych pinów.
- **Trzy UART-y, zero konfliktu.** Każda magistrala ma własny sprzętowy UART. Logger idzie po natywnym USB
  (`hardware_uart: USB_SERIAL_JTAG`), więc żadnego UART-u nie zabiera.
- **Bez pinu DE.** Izolowany moduł sam przełącza kierunek nadawania i odbioru. Pakiety DD i TT mają w sobie
  `flow_control_pin`, a hub go usuwa (`!remove`). Hub działa więc **tylko z izolowanymi modułami z auto-kierunkiem**.
  Moduł RS485 z pinem DE wymaga przywrócenia `flow_control_pin`.
- **T-/T+: hub na 1 bicie stopu.** Kocioł nadaje 8N2. Przy UART-cie huba ustawionym na 8N2 ESP32-S3 przekłamywał
  odpowiedź od drugiego bajtu, i to deterministycznie (zawsze `0B 20 00 20 D1` zamiast `0B 03 02 00 00 20 45`),
  niezależnie od terminacji i polaryzacji. Odbiornik 8N1 czyta ramki 8N2 poprawnie, bo drugi bit stopu to dla niego
  cisza, a kocioł przyjmuje ramki 8N1.
- **Terminacja 120 Ω tylko na końcach linii.** Na D+/D- kocioł daje polaryzację, a brakuje terminacji. Bez niej
  emulator „znika” z magistrali (E121). Na F1/F2 i T-/T+ hub siedzi w środku linii, więc terminacja OFF.
- **Polaryzacja A/B.** D+ → A, D- → B; F1 → A, F2 → B; T- → A, T+ → B. Jeśli magistrala milczy albo daje błędy CRC,
  zamień przewody. Na T-/T+ dobrą polaryzację potwierdza **ikona BMS** na wyświetlaczu kotła. Przy złej polaryzacji
  nie przychodzi ani jeden bajt.
- **Jedno urządzenie na magistralę i adres.** Dwa mastery na T-/T+ albo dwa urządzenia odpowiadające na ten sam
  adres D+/D- (np. emulacja Dominusa + fizyczny Dominus) dają kolizje: dziesiątki tysięcy błędów CRC, E121 / E142.

### 2.4 Gdzie podłączyć w Magisie

| Magistrala | Zaciski | Uwagi |
|---|---|---|
| D+/D- | zaciski zdalnego sterowania (Dominus / panel strefy) na płycie Immergasa | ten sam przewód co do panelu; hub jest kolejnym slave'em |
| F1/F2 | zaciski F1/F2 płytki **MIM-B19N** w skrzynce Magisa | **przełącznik obrotowy MIM musi stać na 1** (fabrycznie 0 = płytka milczy) |
| T+/T- | zaciski BMS T+/T- | slave 11, kocioł jest slave'em, hub masterem |

### 2.5 Wolne dolne Grove

Gniazdo obok USB-C jest celowo wolne na dodatkowy czujnik. Sensowne pomysły:

- **DS18B20 (1-Wire)** na rurach: zasilanie i powrót kotła gazowego (po stronie kotła żadna magistrala nie podaje
  przepływu), góra i dół zasobnika CWU. Rezystor podciągający 4,7 kΩ do 3,3 V.
- **Impulsy z gazomierza** (czujnik Halla / kontaktron pod ostatnim bębenkiem) dałyby prawdziwy pomiar gazu
  zamiast szacunku. Wymaga dojścia kablem do gazomierza.
- Czujnik Halla przy rurze gazowej **nic nie zmierzy**: gaz nie wytwarza pola magnetycznego.

Linie sygnałowe ESP32-S3 są 3,3 V, a gniazdo daje 5 V zasilania. Moduły M5 są do tego dostosowane.

---

## 3. Architektura configu

```
examples/immergas-hub.yaml
├── substitutions        piny, prefiksy nazw, źródła temperatury, waluta, ciepło z 1 m³ gazu
├── urządzenie           esp32-s3, logger (USB), api, ota, wifi, web_server
├── external_components  immergas_core, immergas_climate, f1f2_nasa   (components/ tego repo)
└── packages             (packages/ tego repo)
    ├── lang             hub_xx, dd_xx, tt_xx, f1f2_xx
    ├── D+/D-            dd_core, dd_engine, dd_zone1, dd_zones23, dd_dhw, dd_dominus, dd_schedules,
    │                    dd_heat_pump, dd_boiler_info, dd_diagnostics
    ├── T-/T+            tt_core, tt_status, tt_circuit, tt_heat_pump, tt_dhw, tt_heating, tt_integration,
    │                    tt_installer, tt_computed, tt_gas, tt_diagnostics        (tt_scanner opcjonalnie)
    ├── F1/F2            f1f2_core, f1f2_indoor, f1f2_outdoor, f1f2_info, f1f2_computed, f1f2_diagnostics,
    │                    f1f2_control, f1f2_outing_targets                        (f1f2_fsv, f1f2_ehs_extra opcjonalnie)
    └── hub              hub_diagnostics, hub_combined, hub_boiler_params, hw_atoms3_portabc
```

- Każda magistrala ma własny **prefiks** w nazwach plików, id i podstawieniach (`dd_`, `tt_`, `f1f2_`, `hub_`), więc
  nic się nie gryzie.
- **Komponenty C++:** `immergas_core` (uzgadnianie wartości między Home Assistantem a magistralą, opisy błędów w 11
  językach), `immergas_climate` (termostaty stref i CWU), `f1f2_nasa` (Samsung NASA).
- **Prefiksy nazw encji:** `dd_name_prefix: "Immergas DD"`, `tt_name_prefix: "Immergas TT"`,
  `f1f2_name_prefix: "Immergas FF - "`; wartości liczone z kilku magistral mają `hub_name_prefix: "Immergas Hub"`.
- `hub_combined` ukrywa encje, które dwie magistrale podają podwójnie (rozdział [10](#10-duplikaty-encji-dd--tt--ff)),
  `hw_atoms3_portabc` usuwa piny DE i ustawia 1 bit stopu na T-/T+ dla sprzętu AtomS3 + PortABC.

---

## 4. Encje huba (Immergas Hub)

Wszystkie są liczone w ESP. Działają też wtedy, gdy Home Assistant leży, i nie wymagają szablonów w HA.

### 4.1 COP pompy ciepła

| Encja | Jednostka | Jak liczona |
|---|---|---|
| **Moc cieplna pompy** | W | przepływ **D14** (T-/T+) × (**PC D20 TW2** − **PC D08 TW1**) (D+/D-) × 1,163 W/(l/h·K) |
| **Moc elektryczna pompy (magistrale)** | W | pobór jednostki zewnętrznej NASA **0x8413** (F1/F2); gdy brak: prąd 0x8217 × napięcie 0x82ED |
| **COP** | — | moc cieplna / elektryczna, średnia z 1 minuty (6 × 10 s) |
| **Energia cieplna dziś** | kWh | całka mocy cieplnej od północy (przetrwa restart) |
| **COP dziś** | — | energia cieplna dziś / *Immergas FF - Energia pobrana dziś* |
| **Delta T pompy** | K | TW2 − TW1 na wymienniku pompy |
| **Energia cieplna łącznie** | kWh | licznik rosnący do panelu Energia i statystyk długoterminowych |

- **Temperatury z czujników samej pompy** (TW1/TW2, które kocioł wysyła do jednostki zewnętrznej, bo ta nie ma
  własnych sond wody). Kocioł gazowy do nich nie dokłada, więc COP mierzy wyłącznie pompę, także przy pracy hybrydowej.
- **Przepływ tylko z T-/T+.** Samsung na Magisie nie zna przepływu (NASA 0x42E9 = brak czujnika), a D+/D- go nie niesie.
- **Bramki:** COP ma wartość tylko, gdy sprężarka pracuje (PC D71 > 0) i odczyty są sensowne: przepływ ≥ 100 l/h,
  ΔT 0–25 K, pobór ≥ 150 W, COP 0,5–10. Poza tym encja jest pusta. Moc cieplna poza pracą = 0 W, żeby energia nie
  rosła od samego krążenia wody.
- COP miesięczny i sezonowy licz w HA z *Energia cieplna łącznie* / *Immergas FF - Pobrana energia (łącznie)*.
- ⚠️ Patrz [9.5](#95-skala-mocy-elektrycznej-nasa-a-licznik-zewnętrzny): skala mocy elektrycznej NASA nie jest
  potwierdzona niezależnym licznikiem.

### 4.2 Stan pracy systemu

**Immergas Hub - Stan pracy:** `Odszranianie` · `Pompa ciepła: CO / CWU / chłodzenie` · `Kocioł gazowy: CO / CWU` ·
`Pompa + kocioł: …` · `Postój`.

| Składnik | Źródło |
|---|---|
| sprężarka pracuje | PC D71 > 0 Hz (D+/D-, `0x1E` I11) |
| kocioł gazowy pali | logika szacowania gazu z T-/T+ (D99 62, D98 215/236, D99 7, ΔT kocioł-pompa) |
| CWU / CO | **D99** (T-/T+): 61 CWU pompą, 62 gazem, 64 grzałką; zapasowo zawór **D22** (3028). Przy CWU pompą D22 zostaje 0 |
| chłodzenie | stan jednostki zewnętrznej (F1/F2) |
| odszranianie | F1/F2 (0x402E) |

### 4.3 Sprężarka

| Encja | Opis |
|---|---|
| **Czas pracy sprężarki dziś** | godziny pracy od północy (`duty_time`, przetrwa restart) |
| **Starty sprężarki dziś** | liczba włączeń od północy, czyli miara taktowania |

Przy małym obciążeniu (np. OAT ~17 °C) sprężarka 9 kW **taktuje w cyklach 1,3–3 min** i nie wychodzi ponad ~30 Hz,
bo jej minimalna moc przekracza zapotrzebowanie. Liczba startów to pokaże. Po restarcie huba w trakcie pracy
licznik może doliczyć jeden start. Oba liczniki zeruje o północy zegar z HA.

### 4.4 Koszt ciepła: pompa czy gaz

| Encja | Opis |
|---|---|
| **Cena prądu** (zł/kWh) | ustawiana w HA (konfiguracja), pamiętana; domyślnie 0,984 |
| **Cena gazu** (zł/m³) | jak wyżej; domyślnie 3,86 |
| **Koszt ciepła z pompy** | cena prądu / COP; liczony przy pracy sprężarki, w postoju pokazuje ostatnią wartość z pracy (przetrwa restart) |
| **Koszt ciepła z gazu** | cena gazu / 10,6 kWh ciepła z 1 m³ (wartość opałowa ~10,9 × sprawność ~0,97) |
| **Pompa tańsza od gazu** | wł., gdy koszt z pompy < koszt z gazu |

Przy cenach domyślnych próg opłacalności to **COP ≈ 2,7**. Te encje niczego nie przełączają. Pomagają dobrać próg
integracji **I10** w kotle (rozdział [9.2](#92-integracja-kocioł--pompa-menu-i)).

### 4.5 Ostatni cykl CWU

Cykl CWU zaczyna się przy D99 = 61 / 62 / 64 i trwa też przy 44 / 45 (koniec CWU, dobieg). Po jego końcu hub zapisuje
(przetrwa restart):

| Encja | Jak liczona |
|---|---|
| **CWU ostatni cykl: źródło** | pompa ciepła / kocioł gazowy / pompa + kocioł |
| **…: energia elektryczna** | przyrost *Immergas FF - Pobrana energia (łącznie)* |
| **…: ciepło (przepływ)** | przyrost *Energia cieplna łącznie* (D14 × ΔT pompy) |
| **…: ciepło (zasobnik)** | pojemność × 1,163 × (maks. D03 − D03 na starcie) / 1000 |
| **…: COP (przepływ / zasobnik)** | ciepło / energia elektryczna |
| **…: czas, koszt, koszt z gazu** | koszt prądu cyklu i koszt tego samego ciepła z gazu |
| **Pojemność zasobnika CWU** | konfiguracja w HA, domyślnie 286 L |

Pomiar z zasobnika nie widzi ciepła oddanego w trakcie (pobór wody), pomiar z przepływu tak. Prawda leży zwykle
pomiędzy.

### 4.6 Diagnostyka urządzenia

`Status`, `Restart`, `Czas pracy`, `Sygnał WiFi`, `Czas pętli`, `Wolna pamięć`, `Przyczyna restartu`, `Autor`,
`GitHub`, `Wersja projektu` (numer configu huba). Encje *Immergas DD - Autor / GitHub* z pakietu DD są usunięte i zastąpione encjami huba.

### Encje konfiguracyjne dla kart (pakiet `hub_boiler_params`)

Ustawienia, których nie ma na żadnej magistrali; ustaw je raz tak samo jak w menu pieca. Niczego nie zmieniają w piecu
– korzystają z nich karty: *U12 Start funkcji nocnej* / *U13 Koniec funkcji nocnej*, *P16 Godzina anty-legionelli*,
*P17 Dzień anty-legionelli*, *P13 Maks. czas anty-legionelli*, *Limit zasilania podłogi*, *Tania taryfa – godziny*
(np. `13:00-15:00,22:00-06:00`), *Porównanie od* i przycisk *Porównanie od teraz* (karta Kalibracja).

### Liczniki dzienne i błędy

*Starty palnika dziś*, *Czas pracy palnika dziś*, *Gaz dziś* (Magis Combo, zerowane o północy), obok liczników
sprężarki; *Błąd aktywny (wszystkie magistrale)* i *Aktywny błąd (opis)*: kod błędu pieca z D+/D- albo T-/T+ (obie
czytają 2100) i błąd jednostki zewnętrznej z F1/F2 w jednym miejscu.

---

## 5. Magistrala D+/D- (emulator panelu i Dominusa)

### 5.1 Fakty o magistrali

- **Modbus RTU, 9600 8E1**, 2 przewody, **wymagana terminacja 120 Ω**.
- **Kocioł jest masterem.** Cyklicznie czyta (func 03/04) i zapisuje (func 06/16) do urządzeń. Hub odpowiada jako
  slave, więc **musi odpowiadać szybko**. Za długie trzymanie nadajnika po odpowiedzi zawieszało emulację Dominusa,
  a krótki czas powrotu do odbioru to naprawił.

| Adres | Urządzenie | Brak urządzenia |
|---|---|---|
| **0x1E** (30) | płytka interfejsu jednostki zewnętrznej (**Samsung MIM**, „A22” na schemacie, status D62). **Prawdziwe urządzenie: hub tylko podsłuchuje, nigdy do niego nie nadaje** | — |
| **0x29** (41) | panel strefy 1 (fizyczny lub emulowany) | **E121** |
| **0x2A / 0x2B** (42/43) | panele stref 2 / 3 (tylko przy A13 > 1) | — |
| **0x33** (51) | **Dominus** (moduł Wi-Fi) | **E142** |

### 5.2 Co daje

- **Emulacja** panelu strefy 1–3 i/lub Dominusa: kocioł działa bez oryginalnych urządzeń.
- **Temperatura i wilgotność pokojowa z HA:** do 5 przełączalnych źródeł na strefę (Panel / Piwnica / Parter /
  Piętro / Dom). „Panel” to żywa wartość z fizycznego panelu, jeśli jest.
- **Sterowanie:** tryb pracy, nastawa CO strefy, offset (U03/U04/U16), Comfort/Eco grzania i chłodzenia, set-flow,
  wilgotność (U07/U08/U18), CWU.
- **Harmonogramy:** 4 wspólne kalendarze profili + przypisanie dzień → kalendarz dla każdej strefy i CWU. Przez
  2 minuty po starcie rejestry harmonogramu są uczone z magistrali (zob. [16](#16-historia-configu-huba), v17).
- **Ustawienia panelu:** programy czasowe Manual/Auto (2294), modulacja sondą pokojową (6105), korekta punktu rosy (6107).
- **Monitoring:** kod błędu + **114 opisów błędów** (oficjalne teksty Immergasa z aplikacji Dominus), fazy stref,
  połączenia urządzeń, firmware, zegar i data kotła, dryf zegara.
- **Dane pompy z płytki MIM (0x1E):** Hz, prąd, temperatury sprężarki, wentylator, EEV, flagi pracy, etap,
  firmware, **funkcja nocna U11** i limit mocy sprężarki.
- **Dane kotła:** D04 (wyliczona nastawa zasilania), zasilanie/powrót pompy i kotła gazowego, aktywna nastawa CWU,
  zasobnik CWU, liczba stref A13.

### 5.3 Emulacja: panel czy Dominus

Emulujesz **albo** Dominusa, **albo** panele. **Nigdy ten sam adres co fizyczne urządzenie.**

- `Emuluj Modbus`: nadrzędny włącznik całego RX/TX D+/D-.
- `Emuluj Dominus` (0x33) i `Emuluj Panel Strefy 1/2/3` (0x29/0x2A/0x2B) wzajemnie się wykluczają.
- **Bezpiecznik:** nie da się włączyć emulacji adresu, na którym w ostatnich 30 s odpowiadało fizyczne urządzenie.

| Instalacja | Ustawienie |
|---|---|
| **Jest fizyczny Dominus** (ta instalacja) | emuluj **Panel Strefy 1**, Dominus wyłączony |
| **Brak Dominusa** | emuluj **Dominusa** (przejmuje tryb i ustawienia) |

W hubie: `Emuluj Dominus` → `restore_mode: ALWAYS_OFF`, `Emuluj Panel Strefy 1` → `RESTORE_DEFAULT_ON`. Pakiet DD
domyślnie robi odwrotnie. Jego bezpiecznik działa dopiero po usłyszeniu fizycznego urządzenia, a zaraz po starcie hub
nikogo jeszcze nie słyszał. Domyślne ustawienie wpakowałoby więc emulację na fizycznego Dominusa: ~109 tys. błędów
CRC w 13 minut i E121.

> **„Połączenie Panel Strefy 1 = online” nie znaczy, że kocioł przyjął odpowiedzi.** To tylko informacja, że hub
> odpowiedział. Gdy jest E121, sprawdź *Połączenie Modbus* i licznik błędów CRC.

### 5.4 Najważniejsze rejestry

Temperatury ×0,1 °C. Kierunek: **W** = kocioł zapisuje do urządzenia, **R** = kocioł czyta z urządzenia, **I** =
rejestr wejściowy (func 04).

**Panel 0x29 i Dominus 0x33 (to, co widzi i ustawia panel):**

| Rej | Kod | Opis | Uwagi |
|---|---|---|---|
| 2000 | — | tryb pracy: 0 standby, 1 lato/CWU, 2 chłodzenie, 3 zima CO+CWU | RW |
| 2001 | D09 | flagi: bit0 żądanie CWU w oczekiwaniu (~9 min przed cyklem), bit2 aktywny błąd, bit3 moduł PC obecny | W |
| 2005 / 2006 | D41 | temperatura / wilgotność pokojowa (jedyne wartości z panelu do regulacji) | R |
| 2010 | — | faza strefy: bit2 ręczny, bit3 żądanie grzania, bit6 komfort, bit7 eko; 1 = odpowietrzanie U50 | W |
| 2015 / 2016 / 2017 | U03 | nastawa / maks. / offset strefy 1 | RW |
| 2090 | — | stan programu czasowego: 4 ręczny, 64 auto-komfort, 128 auto-eko | W |
| 2095 | D05 | nastawa CWU | RW |
| 2100 / 2101 | — | kod błędu (0 brak, np. 121, 142, 193) / reset | W |
| 2210–2216 | U07 | Comfort/Eco grzania i chłodzenia, wilgotność | RW |
| 2217 | — | **set-flow — czytany tylko z Dominusa (0x33)**, panel go nie zmieni | RW |
| 2294 / 6105 / 6107 | — | programy czasowe auto / modulacja sondą / korekta punktu rosy | R |
| 2300 | D140–D142 | zegar kotła [dzień 3 b][godzina 5 b][minuta 8 b], ustawiany U21–U26 | W |
| 2302 / 2303 | D143–D145 | data: dzień.miesiąc / rok | W |
| 2310–2347 | — | 4 kalendarze profili (4 przedziały, bajt wysoki = godzina, niski = minuta) | RW |
| 2410–2416 / 2490–2496 | — | dzień → kalendarz: strefa 1 / CWU (strefy 2, 3: 2420…, 2430…) | RW |
| 3002 | D06 | temperatura zewnętrzna **po korekcie P07** | W |
| 3003 | D04 | **wyliczona nastawa zasilania** (krzywa + U03; 0 bez żądania) | W |
| 3011 / 3012 | D20 / D08 | generator główny (pompa): zasilanie / powrót | W |
| 3013 / 3014 | D01 / — | generator dodatkowy (kocioł gazowy): zasilanie / powrót | W |
| 3015 | D05 | **aktywna** nastawa CWU (np. 60 °C w anty-legionelli) | W |
| 3016 | D03 | temperatura zasobnika CWU | W |
| 3031 / 3042 | D91 | firmware kotła (600 = 6.00) / panelu (201 = 2.01) | W / R |
| 4199 (0x33) | A13 | liczba stref | W |
| 6102 | A31 | termostat pokojowy strefy 1: RPT = 0, RP = 2. **Kocioł go nie czyta**, więc nie da się go ustawić z magistrali | W |
| 6150 | A11 | moduł pompy obecny (A11 = OFF → 0, kocioł przestaje pytać 0x1E) | W |

Gdy panel odpowie na rejestr harmonogramu -1 (0xFFFF, „nie ustawiono”, jak świeży panel), kocioł od razu zapisuje do
panelu swój zapamiętany harmonogram. Hub korzysta z tego po starcie, żeby poznać prawdziwy harmonogram zamiast
podsuwać swoje domyślne wartości.

**Płytka MIM 0x1E (pompa ciepła):**

| Rej | Kod | Opis |
|---|---|---|
| W0 | — | żądanie pracy pompy (0/1) |
| R1 / I10 | — | zadana temperatura wody dla pompy (= D04; 5,0 °C bez żądania; 65,0 przy CWU pompą) |
| **W2** (+ I12, R2) | **U11** | **funkcja nocna: 30 = limit mocy sprężarki 30 %**, 0 = brak; tylko w oknie U12–U13 |
| I3 / I4 / I5 / I6 | D73 / D74 / D79 / D72 | tłoczenie / parownik / sonda zewnętrzna jednostki (surowa, bez P07) / korpus sprężarki |
| I11 | D71 | częstotliwość sprężarki (Hz) |
| I13 / I14 / I16 | D75 / D76 / D77 | prąd sprężarki (×0,1 A) / zadane obroty wentylatora / EEV (0–2000) |
| I17 | — | zadana temperatura tłoczenia (61–70 przy CWU; do 80–90 przy CWU pompą) |
| I19 | D80? | etap: 1 postój, 2 start, 3 praca |
| I22–I29 | D120–D135 | firmware: płyta ODU, falownik, pamięć falownika, MIM |
| I36 / I38 / I40 | — | flagi: sprężarka pracuje / wentylator pracuje / zlecenie przyjęte |
| W20 / W21 / W22 | D08 / D20 / D24 | **TW1 powrót / TW2 zasilanie / czynnik ciekły** — kocioł wysyła je pompie (jednostka zewnętrzna nie ma sond wody) |

Na 0x1E **nie ma** rzeczywistych obrotów wentylatora, mocy ani napięcia szyny DC. Te są tylko na F1/F2.

Pełna mapa z pewnością każdego rejestru i kierunkami: [docs/dd-register-map.md](dd-register-map.md).

### 5.5 Krzywa grzewcza → D04 → zadana pompy

Zweryfikowane testem wymuszonym (zmiany U03):

```
D04 = R05 + (R03 − T_zewn) / (R03 − R02) × (R04 − R05) + U03,   przycięte do [R05, R04]
T_zewn = 0x1E I5 (sonda jednostki zewnętrznej)
```

Przykład: R02 = −12, R03 = 20, R05 = 24, R04 = 35, T_zewn = 15,5 °C → U03 = 0 daje **25,5 °C**, U03 = +4 daje **29,5**,
U03 = −2 daje 23,5 → przycięte do **24,0** (R05). **U03 przesuwa krzywą 1:1.** D04 trafia jako zadana wody do pompy
(0x1E R1/I10) i do Samsunga (NASA 0x4247).

### 5.6 Czego D+/D- nie przenosi

- Parametry integracji I01–I10, A05, A12, A18, P07–P24, T02–T23, U11 i menu serwisowe M **nie zmieniają rejestrów
  D+/D-**. Wyjątki: E193 w menu M (2001 bit2 + 2100 = 193) i 3002 po zmianie P07.
- **Anty-legionella P15** (P13 czas, P16 godzina, P17 dzień) nie jest transmitowana. Widać tylko skutek: aktywna
  nastawa CWU 3015 rośnie na czas cyklu. Emulator nie może jej przejmować jako nastawy użytkownika, bo zablokowałby
  CWU na 60 °C.
- Ustawienia lokalne panelu (temperatura przeciwzamrożeniowa, cykl antybakteryjny panelu, wyłączenie osuszania,
  minimalna nastawa chłodzenia, program urlopowy) nie trafiają na magistralę.

---

## 6. Magistrala T-/T+ (Modbus BMS)

### 6.1 Fakty o magistrali

- **Modbus RTU, slave 11, 9600 8N2** (instrukcja Immergasa). Odbiorniki 8N1 też działają, a hub **musi** odbierać 8N1
  (rozdział [2.3](#23-zasady-bez-których-nic-nie-działa)). Hub jest masterem.
- Kocioł odpowiada **wyłącznie na funkcję 0x03**. 0x01, 0x02 i 0x04 → wyjątek „illegal function”. Zapisy: 0x06.
- **Banki:** 2xxx konfiguracja/sterowanie, 3xxx czujniki, 4xxx pompa i czynnik, 6xxx parametry/statusy, 44xx menu
  I/T/P, 65xx odczyty menu D. Przeskanowano 0–19999: **dokładnie 60 rejestrów**, nic powyżej 6510.
- **Brak interfejsu BMS z Victrixa / Magis M TOP:** 256 i rejestry wejściowe nie istnieją, 512 jest tylko do odczytu,
  61440–61442 dają wyjątek. **Nie ma żądania ciepła BMS ani trybu cichego BMS.**
- PIN instalatora **nie odsłania** więcej rejestrów. Punktów krzywej (R02/R03) nie ma na tej magistrali.
- Wejście w menu **M** ustawia **E193** (tryb testowy) w 2100.
- Niezamontowane sondy czytają **−32768** (0x8000), np. 3029 na Magis Pro bez kotła. Encje mapują to na *unknown*.
- Magistrali **nie da się podsłuchać**: kocioł jest slave'em i milczy bez zapytań, więc mapę zrobiono skanerem.

### 6.2 Mapa rejestrów (komplet znanych)

| Rej | Kod | Opis | Skala |
|---|---|---|---|
| 512 | — | tylko odczyt na Magis V2 (zawsze 0) | — |
| 2000 | — | tryb pracy (0 standby, 1 lato/CWU, 2 chłodzenie, 3 zima) | RW |
| 2010 | — | termostat / żądanie grzania strefy 1 (bit0), zob. [6.4](#64-pułapki-t-t) | RW |
| 2095 | D05 | nastawa CWU | ×0,1 °C, RW |
| 2100 | — | kod błędu | R |
| 3000 | D20 | zasilanie systemu | ×0,1 °C |
| 3001 | D08 | powrót wody z pompy | ×0,1 °C |
| 3002 | D06 | temperatura zewnętrzna | ×0,1 °C |
| 3003 | D04 | wyliczona nastawa zasilania (0 = brak żądania) | ×0,1 °C |
| 3016 | D03 | zasobnik CWU | ×0,1 °C |
| 3027 | — | pompa wykluczona: 1 = grzeje tylko kocioł (temp. zewn. < I10, D99 7) | 0/1 |
| 3028 | D22 | zawór 3-drogowy (1 = CWU, 0 = CO) | 0/1 |
| 3029 | — | zasilanie generatora dodatkowego (kocioł gazowy); −32768 bez kotła | ×0,1 °C |
| 3054 | D14 | **przepływ pompy obiegowej** (0 gdy stoi) | l/h |
| 3056 | D24 | czynnik w obiegu chłodniczym | ×0,1 °C |
| 4011 | — | temperatura CWU z BMS (zapis, boost CWU) | RW |
| 4201 | R01 | sonda temperatury zewnętrznej: OFF (stała zadana) / OU (sonda jednostki zewn.) / IU | kod, RW |
| 4202 | A11 | model jednostki zewnętrznej (9 = 9 kW) | kod |
| 4350 / 4351 | R05 / R04 | min. / maks. CO strefy 1 | °C, RW |
| 4356 / 4357 | R13 / R12 | maks. / min. chłodzenia strefy 1 | °C, RW |
| 4402 | T02 | termostat CWU (różnica włączenia) | °C, RW |
| 4403 | P15 | anty-legionella | 0/1, RW |
| 4411 | T04 | nieopisany w instrukcjach | RW |
| 4451 | I05 | tryb aktywacji integracji (0 AU, 1 MA) | RW |
| 4452 | I10 | temperatura zewn. aktywacji integracji CO (poniżej grzeje tylko kocioł) | °C, bajt ze znakiem, RW |
| 4453 / 4454 | I02 / I01 | integracja CO / CWU (1 = AL, 0 = OFF) | 0/1, RW |
| 4455 | I09 | temperatura aktywacji CWU | °C, bajt ze znakiem (młodszy bajt), RW |
| 4468 / 4469 | I04 / I03 | maks. czas oczekiwania CO / CWU | min, RW |
| 4479 | I07 | pasmo aktywacji | °C, RW |
| 4551 | D74 | parownik (= NASA 0x8218) | ×0,1 °C ze znakiem |
| 4554 | D73 | tłoczenie (= NASA 0x820A) | ×0,1 °C |
| 4557 | D77 | EEV (2000 = otwarty w spoczynku) | 0–2000 |
| 4558 | D71 | częstotliwość sprężarki | Hz |
| 4585 | D72 | temperatura sprężarki (= NASA 0x8280) | ×0,1 °C |
| 4586 | — | stopień mocy sprężarki 0–6 (25 Hz = 1 … 61 = 6; przy CWU pompą widziano 7) | stopień |
| 4587 | D76 | obroty wentylatora (kandydat) | obr/min |
| 6000 | T05 | minutnik włączeń CO (minimalna przerwa między startami) | min, RW |
| 6002 | T07 | opóźnienie żądania z termostatu pokojowego (TA) | 1 = 10 s, RW |
| 6010 / 6011 | A03 / A04 | min. / maks. prędkość pompy obiegowej | %, RW |
| 6013 | A12 | odpowietrzanie przy włączeniu zasilania | 0/1, RW |
| 6500 / 6501 / 6502 | D97 / D98 / D99 | stany: pompa / generator / system — zob. niżej | kod |
| 6505 | D91 | firmware P.C.B. (60 = 6.0) | ×0,1 |
| 6506 / 6507 | D140 / D141 | godzina / minuta zegara (tylko odczyt) | — |
| 6510 | D61 | model systemu: 1 MP, 2 MCI, 3 MCP, 4 MPH, 5 MCH, 6 MCPH | kod |

Wszystkie RW z banków 44xx/60xx zweryfikowano w obie strony: zmiana na kotle rusza rejestr, zapis z HA zmienia
wartość na kotle.

### 6.3 Kody stanów D97 / D98 / D99

| Rejestr | Kody |
|---|---|
| **D97** stan żądania pompy | 300 standby · 332 / 390 grzanie · 352 grzanie (żądanie termostatu) · 322 CWU pompą (fw 4.3) · 342 żądanie chłodzenia · 336 pompa wykluczona progiem I10 (grzeje kocioł) |
| **D98** stan żądania kotła | 200 standby · 215 grzanie kotłem (cykl) · 232 grzanie · 252 grzanie (żądanie termostatu, **kocioł nie pali** — grzeje pompa) · 236 grzanie tylko kotłem |
| **D99** stan systemu | 0 / 82 standby · 1 żądanie chłodzenia · 6 żądanie grzania · 7 grzanie tylko kotłem (I10) · 8 cykl grzania · 41 dobieg pompy po CO (~3 min) · 44 koniec CWU pompą (~3 min) · 45 koniec CWU (~1 min) · **61 CWU pompą** · **62 CWU kotłem gazowym** · 64 CWU grzałką |

### 6.4 Pułapki T-/T+

- **Tryb pracy: wygrywa ten, kto go ciągle wymusza.** Emulowany panel na D+/D- stale wymusza swój tryb i cofa zapis
  2000 z T-/T+. Dlatego w hubie **tryb i CWU steruje tylko DD**, a encje TT są ukryte. Z *prawdziwym* Dominusem
  (fw 6.0) jest odwrotnie: kocioł trzyma tryb z BMS i cofa zmiany z klawiatury.
- **Termostat 40-1/41 wymaga panelu strefy 1 na D+/D-.** Na fw 6.0 przy działającym masterze BMS styk termostatu
  uruchamia grzanie tylko wtedy, gdy na D+/D- jest panel strefy 1 (fizyczny z A31 = RPT albo emulowany). Rejestr 2010
  w tym nie pomaga (fw 4.3 i 6.0). Zgłoszenia, że 2010 działa, pochodzą z fw 8.3+.
- **Ustawienia niewidoczne na T-/T+:** I08, P07 (ale D06 jest już po korekcie), P11, P13, P21, P23, P24, T09, T23,
  **U11**, A05, A18, A31, A41, menu M (M13, M15–M17).

### 6.5 Szacowane zużycie gazu

Kocioł nie raportuje zużycia gazu, więc pakiet `tt_gas` liczy **czas pracy kotła × średnie m³/h**, osobno dla CO i CWU.

- **Kiedy liczy:** D99 62 (CWU gazem), D98 215 / 236 albo D99 7 (CO kotłem). Przy D99 6/8 liczy też wtedy, gdy
  zasilanie kotła jest ≥ 8 K wyżej niż powrót pompy. Zwykłe grzanie pompą (D98 252) nie jest liczone.
- **Kalibracja:** odczytaj gazomierz na początku i końcu tygodnia, podziel realne m³ przez przyrost *Gaz szacowane
  zużycie* i przemnóż obie stawki przez ten współczynnik.
- *Gaz szacowane zużycie* to licznik `total_increasing` m³ do panelu Energia w HA.

---

## 7. Magistrala F1/F2 (Samsung NASA)

### 7.1 Fakty o magistrali

- **9600 8E1**, protokół **Samsung NASA**: broadcasty urządzeń + zapytania/odpowiedzi.
- **Przełącznik obrotowy na MIM-B19N musi stać na 1** (fabrycznie 0, wtedy płytka milczy).

| Adres | Urządzenie |
|---|---|
| `10.00.00` | jednostka zewnętrzna (Samsung EHS) |
| `20.00.01` | jednostka wewnętrzna = płytka MIM-B19N w Magisie (ostatni bajt = pozycja przełącznika) |
| `80.FF.00` | hub (wysyła tylko zapytania READ) |

Komponent sam wykrywa urządzenia na magistrali (encja *NASA urządzenia na magistrali*) i po 60 s ostrzega w logu,
jeśli adres w configu się nie zgadza.

### 7.2 Co daje

Temperatury (zasilanie, powrót, zadana wody, zewnętrzna, tłoczenie, głowica, wymiennik, czynnik, IPM) ·
sprężarka (Hz rzeczywiste / zlecone / docelowe, **limit częstotliwości**, etap startu, blokada restartu) · **prąd,
moc i energia pobrana**, napięcia sieci, szyny DC i pompy · wentylator (zadany i rzeczywisty), EEV, zawory 4-drogowy
i gorącego gazu, grzałka tacy, **odszranianie i jego etap** · tryby i stany jednostek · **funkcja nocna U11**
(0x428D, 0x80B1) i nocny limit wydajności w % · **kody błędów Samsunga z
opisem** · firmware ODU / EEPROM / falownika / MIM · opcjonalnie **94 parametry FSV** · nieznane PDU jako `RAW` +
sniffer.

Szczegóły: [docs/ff-nasa-pdu-map.md](ff-nasa-pdu-map.md) (wszystkie PDU),
[docs/ff-fsv-map.pl.md](ff-fsv-map.pl.md) (FSV), [docs/ff-samsung-error-codes.pl.md](ff-samsung-error-codes.pl.md).

### 7.3 Kto tu rządzi: Immergas, nie Samsung

Na F1/F2 **pętlę trzyma sterownik Immergasa**. Sam liczy zadaną wody ze swojej krzywej (R02–R05 + U03) i steruje
Samsungiem przez MIM. Immergas decyduje, **co i kiedy** pompa ma robić (nastawy, tryby, żądanie grzania, nawet tryb
cichy U11). Jednostka zewnętrzna decyduje, **jak** to zrobić (Hz, wentylator, EEV, odszranianie).

- Samsung na Magisie jest „ślepy” na zasobnik CWU (0x4237 = 0) i pompę obiegową (0x4089 = OFF mimo przepływu).
  Przepływu też nie zna (0x42E9 = brak czujnika), a moc i energia wyprodukowana (0x4426/0x4427) są puste.
- Większość FSV jest nadpisywana albo nieczynna. Krzywa wodna FSV przegrywa z krzywą Immergasa.
- **Sufit CWU pompą (~50 °C) trzyma Immergas.** FSV 3021 zapisany na 45 nie zatrzymał grzania, a FR nie ogranicza
  Hz przy CWU.

Podział rejestrów: [docs/ff-what-immergas-controls.pl.md](ff-what-immergas-controls.pl.md) i
[docs/ff-registers-outside-modbus.pl.md](ff-registers-outside-modbus.pl.md).

### 7.4 Sterowanie (opcjonalne) i model bezpieczeństwa

Hub ma pakiety `f1f2_control` i `f1f2_outing_targets`. Trzy bramki, każda wymaga poprzedniej:

1. **Połączenie NASA:** nadrzędny bezpiecznik. OFF = hub ignoruje magistralę, wszystkie encje FF niedostępne.
2. **Emuluj panel EHS:** aktywne zapytania READ (FSV). OFF = tylko pasywny odczyt.
3. **Aktywne sterowanie ODU:** uzbrojenie zapisu, **po restarcie zawsze wyłączone**.

Zapis wychodzi tylko przy trzech bramkach ON **i** rejestrze z whitelisty. **Twarda blokada** w kodzie odrzuca
rejestry sprężarki, EEV, ochrony, przepływu, wł./wył. jednostki i trybu pracy, cokolwiek byłoby w YAML-u.

| Dźwignia | Rejestr | Wynik na Magisie |
|---|---|---|
| **FR – ogranicz sprężarkę** | 0x40A7 | **działa:** stały fabryczny ~50 % (35 → 30 Hz pod obciążeniem), tylko przy CO > ~32 Hz |
| Własne ratio FR (FSV 5051) | 0x42F1 | odrzucone (zostaje 0xFFFF) |
| Tryb wyjazdowy + FSV 5011–5019 | 0x406D | zapis trzyma, ale Immergas może nadpisać; brak aktywatora |
| Maks. temp. zasilania (FSV 1031) | 0x424E | zapis trzyma, ale zadana Immergasa 0x4247 go nadpisuje |
| Tryb cichy | 0x428D | sterowany przez **U11 Immergasa**; zapis do ODU ignorowany |
| Power peak / Smart Grid | 0x40A4 / 0x411C | wymagają zewnętrznego sygnału; nic nie robią |

**Nigdy nie zapisuj:** częstotliwości sprężarki (0x8236–0x8239), EEV (0x8229), **czujnika przepływu 0x42E9** (karmi
ochronę przepływu; fałszywa wartość może puścić sprężarkę na sucho), zaworów, defrostu i rejestrów ochronnych ODU.

Wyniki testów: [docs/ff-control-results.pl.md](ff-control-results.pl.md).

---

## 8. Jedna wielkość na trzech magistralach

Te same pomiary pojawiają się na kilku magistralach. Ta tabela pozwala zweryfikować jedną magistralę drugą i wybrać
najlepsze źródło.

| Wielkość | Kod | D+/D- | T-/T+ | F1/F2 (NASA) |
|---|---|---|---|---|
| temperatura zewnętrzna | D06 / D79 | 3002 (po P07) / 0x1E I5 (surowa) | 3002 | 0x8204, 0x420C |
| zadana zasilania | D04 | 3003, 0x1E R1/I10 | 3003 | 0x4247 |
| zasilanie pompy (TW2) | D20 | 3011, 0x1E W21 | 3000 (system) | 0x4204, 0x4238 |
| powrót pompy (TW1) | D08 | 3012, 0x1E W20 | 3001 | 0x4236 |
| czynnik ciekły | D24 | 0x1E W22 | 3056 | 0x4205 |
| częstotliwość sprężarki | D71 | 0x1E I11 | 4558 | 0x8238 |
| temperatura sprężarki | D72 | 0x1E I6 | 4585 | 0x8280 |
| tłoczenie | D73 | 0x1E I3 | 4554 | 0x820A |
| parownik / wymiennik zewn. | D74 | 0x1E I4 | 4551 | 0x8218 |
| prąd sprężarki | D75 | 0x1E I13 | — | 0x8217 |
| obroty wentylatora | D76 | 0x1E I14 (zadane) | 4587 | 0x823D zadane / 0x82D9 rzeczywiste |
| EEV | D77 | 0x1E I16 | 4557 | 0x8229 |
| zasobnik CWU | D03 | 3016 | 3016 | 0x4237 = 0 (nie zna) |
| zawór 3-drogowy | D22 | — | 3028 | 0x4067 |
| przepływ | D14 | — | **3054** | 0x42E9 = brak |
| kod błędu kotła | — | 2100 | 2100 | — (osobne kody Samsunga 0x8235) |
| firmware płyty | D91 | 3031 | 6505 | — |
| zegar kotła | D140–D142 | 2300 | 6506/6507 | — |
| sprężarka pracuje | — | 0x1E I36 | 4586 > 0 | 0x8010 |
| funkcja nocna | U11 | 0x1E W2 = 30 | **niewidoczna** | 0x8239 = 19, 0x80B1, 0x428D |
| pobór mocy / energia | — | — | — | 0x8413 / 0x8414 |

---

## 9. Wiedza o instalacji: tematy przekrojowe

### 9.1 Funkcja nocna U11 (tryb cichy)

Złapana na trzech magistralach naraz:

- **D+/D-:** na początku okna U12 kocioł zapisuje do MIM **0x1E W2 = 30** (% limitu mocy), MIM potwierdza w I12 i R2.
  Na końcu okna albo przy U11 OFF: 0.
- **F1/F2:** NASA **0x8239** (górny limit Hz) spada **64 → 19** (30 % × 64). Do tego 0x428D 0 → 286 (nadaje MIM) i
  **0x80B1 = 1**, czyli „sprężarka pracuje pod nocnym limitem”. Limit wchodzi ~50 s po W2 przy pracy, a przy świeżym
  rozruchu dopiero ~6 min po starcie. Zdejmowany ~40 s po W2 = 0.
- **T-/T+:** żaden rejestr się nie zmienia, widać tylko skutek (D71 ~16–18 Hz).
- 0x8239 ma też naturalne wartości: **95** (postój/start) i **64** (normalna praca). Tylko **19** oznacza U11.
- Natywny tryb cichy Samsunga (0x4046) nigdy się nie włącza. **Tryb cichy steruje się przez U11 w kotle**, zapis
  na F1/F2 jest ignorowany.
- U12/U13 to pełne godziny według zegara kotła (U21/U22).
- Przy ~9–10 °C na zewnątrz sprężarka i tak pracuje na minimum, więc U11 nic nie zmienia w ogrzewaniu. Spowalnia tylko
  CWU pompą i przy mrozie może ograniczyć moc.

### 9.2 Integracja kocioł / pompa (menu I)

Parametry integracji są na T-/T+ (bank 44xx) i dają się zapisywać z HA: **I01** (integracja CWU), **I02** (integracja
CO), **I03/I04** (maks. czas oczekiwania CWU/CO), **I05** (AU/MA), **I07** (pasmo), **I09** (temperatura aktywacji CWU).
**I10** (próg temperatury zewnętrznej) to rejestr **4452** na T-/T+ (bajt ze znakiem).

Według instrukcji Magisa przy **I05 = MA**: poniżej **I10** grzeje tylko kocioł; od I10 do I10+5 pompa, a gaz
dołącza po I04; powyżej pompa, a gaz dołącza po 2×I04. Przykładowe ustawienia tej instalacji: I02 = AL, I04 = 60 min,
I05 = MA, I10 = −5 °C. Poniżej −5 °C pompa faktycznie stała (styczeń, −8…−10 °C).

**Dobór I10 z COP:** encje *Koszt ciepła z pompy / z gazu* i *Pompa tańsza od gazu* pokazują, przy jakim COP pompa
przestaje się opłacać (przy 0,984 zł/kWh i 3,86 zł/m³ to **COP ≈ 2,7**). Zestaw COP z temperaturą zewnętrzną z jednego
sezonu i ustaw I10 tam, gdzie COP spada poniżej progu.

- **CWU może grzać pompa** (D99 61, 0x1E W1 = 650, sprężarka do ~61 Hz, stopień mocy 7, tłoczenie do 90 °C). Sufit
  CWU pompą (~50 °C) trzyma Immergas. CWU gazem = D99 62. Na instalacji testowej CWU pompą miało COP ~1,3–2
  (zasobnik 45 → 54 °C, zadana wody 65 °C), więc przy tych cenach CWU z gazu było tańsze.
- **Tryb awaryjny „tylko gaz”:** A11 = OFF (model jednostki zewnętrznej = brak). CO i CWU idą wtedy z kotła, kocioł
  przestaje odpytywać 0x1E, a 6150 spada do 0.

### 9.3 Błędy kotła i Samsunga

- **Kocioł:** kod w 2100 (D+/D- i T-/T+). Hub pokazuje kod i opis (114 oficjalnych opisów Immergasa) na encjach DD.
  Częste przy magistralach: **E121** (brak panelu strefy 1), **E142** (brak Dominusa), **E193** (menu serwisowe M).
- **Samsung:** *Immergas FF - Kod błędu* / *Błąd systemu* (0x8235) z opisem. Lista:
  [docs/ff-samsung-error-codes.pl.md](ff-samsung-error-codes.pl.md).

### 9.4 COP: którą moc i które temperatury brać

| Składnik | W hubie | Dlaczego |
|---|---|---|
| przepływ | D14 z T-/T+ | jedyne źródło (Samsung nie zna przepływu) |
| ΔT | TW2 − TW1 (D+/D- 0x1E W21/W20) | czujniki na wymienniku pompy; kocioł gazowy nie zawyża |
| moc elektryczna | NASA 0x8413 | moc czynna z inwertera Samsunga; prąd × napięcie to moc pozorna |

Nie licz ciepła z D20/D08 *instalacji* (3000/3001 na T-/T+), bo przy pracy kotła gazowego zawierają też jego ciepło.

### 9.5 Skala mocy elektrycznej NASA a licznik zewnętrzny

Zimą 2025/26 energia z NASA (0x8414) wyszła **1,91 × większa** niż z zewnętrznego licznika Shelly EM na pompie
(korelacja r = 0,998, czyli stały współczynnik). Nie rozstrzygnięto, który pomiar jest prawdziwy. COP według NASA
(~1,9 przy −5 °C, ~2,85 przy +5 °C) wygląda fizycznie, a według Shelly (3,6–10) mało wiarygodnie, ale CT Shelly był
odwrócony. Dopóki nie ma porównania z licznikiem rozliczeniowym, traktuj bezwzględną wartość COP ostrożnie. Względne
porównania (COP vs temperatura, dzień do dnia) są wiarygodne.

Pomiar z października 2026 (ten sam Shelly, kanał pompy): energia NASA = **2,0 ×** Shelly w każdym okresie, ale Shelly
w postoju pokazuje **ujemną** moc i ma 760 kWh „oddanej” energii, a COP z jego mocy przy 15 Hz wychodzi 13,6 (ponad
granicę Carnota). Shelly mierzy więc źle (odwrócony przekładnik albo inna faza niż jego napięcie). Z drugiej strony przy
61 Hz NASA podaje 3,1 kW, a Shelly mierzy 9,3 A × 224 V = 2,1 kVA, więc NASA może zawyżać nawet ~1,5 ×. Rozstrzygnie
pomiar prądu miernikiem cęgowym na zasilaniu jednostki zewnętrznej.

---

## 10. Duplikaty encji: DD > TT > FF

Gdy ta sama wielkość przychodzi z kilku magistral, w Home Assistant zostaje **jedna** encja, według hierarchii
**DD > TT > FF**. Pozostałe dostają `internal: true`. Dalej działają w ESP i zasilają obliczenia (COP, gaz, stan
pracy), ale nie trafiają do HA.

| Ukryte z T-/T+ | Ukryte z F1/F2 |
|---|---|
| D06, D03, kod i opis błędu, błąd aktywny, D04, D20, D08, Delta T, zasilanie kotła 3029, D71, D72, D73, D74, D24, D77, D91, zegar, **tryb pracy (select)**, **CWU (water_heater)** | temperatura zewnętrzna (2×), temperatura i zadana CWU, zadana wody, TW2, zasilanie, powrót, ΔT, częstotliwość sprężarki, tłoczenie, głowica, wymiennik, czynnik, EEV, zadane obroty, prąd, zadane tłoczenie, sprężarka pracuje, wentylator, zawór 3-drogowy, firmware (4×), funkcja nocna U11 (0x80B1, 0x428D) |

- Lista jest na końcu YAML-a (`- id: !extend … internal: true`). Żeby przywrócić encję, usuń jej wpis.
- Widoczne zostały wielkości, które tylko wyglądają podobnie, np. *TT - Moc cieplna szacowana* (z temperatur
  instalacji) obok *Hub - Moc cieplna pompy* (z czujników pompy) albo *FF - Nocny limit wydajności* (%) obok *DD - PC
  U11 Funkcja nocna*.

---

## 11. Konfiguracja (podstawienia)

| Podstawienie | Domyślnie w hubie | Znaczenie |
|---|---|---|
| `hub_project_version` | `"1.2.0"` | wersja huba, widoczna jako *Immergas Hub - Wersja projektu* |
| `hub_name_prefix` | `Immergas Hub` | prefiks nazw encji huba |
| `device_name` / `friendly_name` | `immergas-hub` / `Immergas Hub` | nazwa urządzenia (zmiana = nowe urządzenie w HA) |
| `dd_name_prefix`, `tt_name_prefix`, `f1f2_name_prefix` | `Immergas DD`, `Immergas TT`, `Immergas FF - ` | prefiksy nazw encji |
| `dd_uart_rx_pin` / `dd_uart_tx_pin` | GPIO39 / GPIO38 | D+/D-, Port A |
| `f1f2_uart_rx_pin` / `f1f2_uart_tx_pin` | GPIO8 / GPIO7 | F1/F2, Port B |
| `tt_uart_rx_pin` / `tt_uart_tx_pin` | GPIO6 / GPIO5 | T-/T+, Port C |
| `dd_uart_de_pin`, `tt_uart_de_pin` | `brak` | tylko tekst (DE usunięte) |
| `f1f2_transmit` | `"true"` | zapytania READ na F1/F2 (FSV); `"false"` = czysty nasłuch |
| `dd_temp_src_2…5`, `dd_hum_src_2…5` | Twoje sensory HA | źródła temperatury/wilgotności strefy 1 (slot 1 = panel) |
| `dd_temp_src_z2_*`, `dd_temp_src_z3_*`, `…hum…` | Twoje sensory HA | strefy 2 i 3 |
| `dd_setpoint_step` | `0.5` | krok nastaw stref |
| `hub_gas_heat_kwh_per_m3` | `10.6` | ciepło użytkowe z 1 m³ gazu |
| `hub_currency` | `zł` | waluta w jednostkach cen i kosztów (karty używają tej samej) |

Każde podstawienie z pakietów (np. pojedynczą nazwę encji `n_dd_…`, `n_tt_…`) można nadpisać w pliku głównym.
Pliki językowe: `packages/lang/dd_xx`, `tt_xx`, `f1f2_xx`; DD, TT i hub (`packages/lang/hub_xx.yaml`) mają `_cs`, `_de`,
`_en`, `_es`, `_fr`, `_hu`, `_it`, `_nl`, `_pt`, `_sk`, F1/F2 tylko `_en` (przy innych językach użyj `f1f2_en.yaml`). **Zmiana języka
zmienia nazwy, więc HA utworzy nowe encje.** Encje huba biorą nazwy i teksty z `packages/lang/hub_xx.yaml` (11 języków)
Karty mówią w języku Home Assistanta.

---

## 12. Aktualizacje i wersje

- Przypnij pakiety i komponenty do tagu wydania tego repozytorium (`ref:` i `@vX.Y.Z` w przykładzie). Nowe wydanie
  zmienia je razem.
- **Identyfikatory encji w HA biorą się z nazwy** (a w HA 2026.6+ także z obszaru). Zmiana nazwy daje nową encję, a
  historia zostaje przy starej. Nazwy używane w szablonach HA są celowo stałe.
- **Zmiana języka zmienia nazwy**, więc HA tworzy nowe encje.

---

## 13. Rozwiązywanie problemów

| Objaw | Przyczyna | Rozwiązanie |
|---|---|---|
| 0 ramek albo same śmieci, rośnie licznik CRC | zamienione TX/RX | `*_rx_pin` = biały przewód (drugi pin portu na naklejce) |
| D+/D-: tysiące błędów CRC, E121 / E142 | dwa urządzenia na jednym adresie | jedna emulacja na adres, stare urządzenia odłączone |
| D+/D-: *Połączenie Panel Strefy 1* online, a E121 trwa | hub nie odbiera poprawnych ramek | sprawdź *Połączenie Modbus* i licznik CRC, potem piny |
| D+/D-: emulator znika z magistrali po odłączeniu innego modułu | brak terminacji 120 Ω | rezystor 120 Ω w zaciskach A-B modułu D+/D- |
| T-/T+: ikona BMS jest, odpowiedzi urwane po 5–6 bajtach | UART huba na 8N2 | `stop_bits: 1` (już w configu) |
| T-/T+: zero bajtów | odwrócona polaryzacja T+/T- albo zła mapa pinów | wróć do podłączenia z ikoną BMS; sprawdź biały = RX |
| T-/T+: zniekształcone odpowiedzi | drugi master na magistrali | odłącz stare urządzenie BMS |
| F1/F2: 0 ramek | zła mapa pinów, A/B, przełącznik MIM nie na 1 | sprawdź po kolei; encja *NASA urządzenia na magistrali* |
| OTA „udane”, a w logu stara data kompilacji | instalacja nie doszła do końca | sprawdź „compiled on” w logu, wgraj ponownie |
| COP pusty | sprężarka stoi albo odczyty poza bramkami | normalne poza pracą sprężarki |
| CWU grzeje w nocy, choć harmonogram CWU to Kal. 3 | świeży hub (≤ v16) podał piecowi domyślny Kal. 1 | użyj v17+ (DD v2.1.1) i ustaw harmonogram CWU ponownie |

**Podgląd surowych bajtów magistrali:** dodaj do UART-u blok `debug:` z `UARTDebug::log_hex` i ustaw logger na DEBUG.
Tak znaleziono problem z bitem stopu na T-/T+:

```yaml
uart:
  - id: !extend tt_uart
    debug:
      direction: BOTH
      dummy_receiver: false
      after:
        timeout: 10ms
      sequence:
        - lambda: UARTDebug::log_hex(direction, bytes, ' ');
```

Sniffery wbudowane w pakiety: *DD - Sniffer* (zmiany rejestrów D+/D-, tag `sniff`) i *FF - Sniffer NASA* (tag
`f1f2_sniff`), oba domyślnie wyłączone.

---

## 14. Nierozszyfrowane — pomoc mile widziana

| Magistrala | Rejestry |
|---|---|
| D+/D- 0x1E | I15, I20, I37, I44–46, W5 (zawsze 0), R2–R6, R15–R18 (5/30/10/30, może suszenie jastrychu T21–T24); flagi I18/I21/I41/I42 jako kandydaci na **D78** (zawór 4-drogowy) — potrzebne dane z chłodzenia lub odszraniania |
| D+/D- 0x29 / 0x33 | 0x29 R 0/1 (233/60), 2103; 0x33 W 2012; 2090: CO czy CWU |
| T-/T+ | zapisywalne 0/1: 2102, 4449, 4600; zawsze 0: 512, 3061, 4011, 4588, 6014, 6503, 6504 |
| F1/F2 | 0x0402, 0x0411–0x0415, 0x4006, 0x440A, 0x041B, 0x8201, 0x823F, 0x8243, 0x824B, 0x824C, 0x82E1, 0x8417, 0x4604 (jako `RAW` w diagnostyce); **0x840F** 4096 → 4224 (bit 7) na końcu pierwszego cyklu CWU pompą i zostaje — kandydat na flagę „CWU z pompy” |

Najcenniejsze nagrania: chłodzenie, odszranianie, mróz, instalacja wielostrefowa, inny firmware płyty.

---

## 15. Dokumentacja szczegółowa

| Plik | Zawartość |
|---|---|
| [docs/dd-register-map.md](dd-register-map.md) | D+/D-: pełna mapa 0x1E / 0x29 / 0x33 / 0x2A–0x2B z pewnością i kierunkiem (EN) |
| [docs/ff-nasa-pdu-map.md](ff-nasa-pdu-map.md) | F1/F2: wszystkie PDU NASA z dekodowaniem (EN) |
| [docs/ff-fsv-map.pl.md](ff-fsv-map.pl.md) | F1/F2: 94 parametry FSV i ich status na Magisie |
| [docs/ff-what-immergas-controls.pl.md](ff-what-immergas-controls.pl.md) | F1/F2: rejestry sterowane przez Immergasa |
| [docs/ff-registers-outside-modbus.pl.md](ff-registers-outside-modbus.pl.md) | F1/F2: rejestry poza zasięgiem Modbusa Immergasa |
| [docs/ff-control-results.pl.md](ff-control-results.pl.md) | F1/F2: testy zapisu, co działa, czego nie ruszać |
| [docs/ff-samsung-error-codes.pl.md](ff-samsung-error-codes.pl.md) | kody błędów Samsung EHS |

---

## 17. Dashboard

Karty huba budują cały pulpit (`strategy: type: custom:immergas-hub`): zobacz
[cards/README.pl.md](../cards/README.pl.md). W folderze [dashboard/](../dashboard/) jest też generator pulpitu
z samych wbudowanych kart: [dashboard/README.pl.md](../dashboard/README.pl.md).

---

## Zastrzeżenie

Projekt hobbystyczny, niezwiązany z Immergasem ani Samsungiem i przez nich nieautoryzowany. Mapy rejestrów to
reverse-engineering na potrzeby interoperacyjności i użytku prywatnego. Emulacja sterownika i zapisy do rejestrów
zmieniają zachowanie urządzenia grzewczego — **używasz na własną odpowiedzialność**. Nie zapisuj rejestrów spoza
opisanych tu bezpiecznych list.

## Licencja

Zobacz [LICENSE](../LICENSE) i [NOTICE](../NOTICE).
