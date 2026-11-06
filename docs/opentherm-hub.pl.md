# Kotły OpenTherm w hubie (immergas_ot)

[English](opentherm-hub.md) · **Polski**

Powrót do [przeglądu protokołów](../README.pl.md).

> **Eksperymentalne – jeszcze nie testowane na kotle.** Napisane według specyfikacji OpenTherm 2.2 i tego, co
> [integracja Immergas Dominus](https://github.com/jotuera/immergas-dominus/blob/main/docs/opentherm.pl.md) ustaliła
> na kotłach Immergas. Kodek ramek jest przetestowany na PC (dokładny zegar, ±10 % prędkości, drgania, zakłócenia,
> parzystość).

Kotły Immergas bez Modbusa (VICTRIX ZEUS, EXA, TERA, OMNIA, HERCULES Condensing …) rozmawiają po OpenTherm ze swoim
pilotem (CAR V2, Super Amico) albo z modułem Dominus. Komponent `immergas_ot` pozwala hubowi zająć to miejsce – albo
stanąć pośrodku.

## Dwa tryby

| Tryb | Podłączenie | Co się dzieje |
|---|---|---|
| **master** (domyślny) | adapter master → kocioł | hub **zastępuje** CAR V2 / Super Amico / Dominusa: wysyła status (Data-ID 0) z zezwoleniem CO / CWU, nastawę zasilania CO (1) co cykl, nastawę CWU (56), maks. CO (57) i maks. modulację (14) raz po raz, a resztę czyta po kolei |
| **gateway** (bramka) | adapter slave ← pilot, adapter master → kocioł | pilot **zostaje**: każde żądanie idzie do kotła, a odpowiedź z powrotem; hub widzi wszystko, może **nadpisać** wybrane zapisy (nastawa CO, nastawa CWU, maks. modulacja, zezwolenia CO / CWU), sam odpowiada na odczyty, których kocioł nie zna, i wykorzystuje te sloty na własne odczyty; gdy pilot milczy 8 s, hub sam prowadzi kocioł (**standalone**), aż pilot wróci |

## Sprzęt

OpenTherm to dwuprzewodowa pętla prądowo-napięciowa – **nie** RS485. Potrzebny jest **adapter master** OpenTherm (np.
OpenTherm Adapter, DIYLess Master OpenTherm Shield), a dla bramki dodatkowo **adapter slave** (DIYLess Slave Shield /
OpenTherm Slave Adapter), każdy na dwóch GPIO (wejście / wyjście). Domyślnie: master na porcie C (wejście GPIO6,
wyjście GPIO5), slave na porcie B (wejście GPIO8, wyjście GPIO7) AtomS3 + ATOMIC PortABC. Logika adapterów: wyjście
LOW = linia aktywna, wejście HIGH = linia aktywna (`out_active_low: true`, `in_active_low: false`); dla adaptera
działającego odwrotnie zmień je.

## Podłączenie

> ⚠️ **Najpierw sprawdź protokół – nie każda magistrala pilota Immergas to OpenTherm.** CAR V2 zna dwa protokoły i
> pokazuje w menu informacji, którego używa: **VER PI** = **IMG-BUS** (OpenTherm z drobnymi zmianami – działa) albo
> **VER PC** = **CAR-BUS** (starszy protokół Immergasa – **żaden master OpenTherm się z nim nie dogada**, niezależnie od
> adaptera i bajtu 0xCA). Bez CAR V2 zmierz zaciski pilota bez niczego podłączonego: **do ok. 18 V DC = IMG-BUS**,
> **ok. 24–35 V DC (np. 28 V) = CAR-BUS**. Zgłoszony kocioł z CAR-BUS: VICTRIX TT. W TERA kocioł może też czekać na CAR V2,
> dopóki nie ustawisz **P7 = 2** (pilot innej firmy) i nie wyłączysz i włączysz zasilania – jeszcze niepotwierdzone.
> Źródło: [OTGateway #284](https://github.com/Laxilef/OTGateway/issues/284), instrukcja CAR V2 1.038958 (dane techniczne).
>
> Kocioł IMG-BUS da się też obsłużyć po Modbusie przez interfejs Immergas **IU23** – patrz
> [Kotły gazowe po Modbus BMS](gas-boiler-bms.pl.md) (`gb_iu23`, hipoteza).

OpenTherm nie ma polaryzacji. Adapter master idzie na zaciski OpenTherm kotła (tam, gdzie był CAR V2 / Dominus),
adapter slave (bramka) na dwa przewody pilota.

| Rodzina kotłów | Zaciski OpenTherm | Bez pilota |
|---|---|---|
| VICTRIX ZEUS 25, EXA, TERA, OMNIA | 41 / 44 | zworka X40 z powrotem na 40-41, wyłącz i włącz zasilanie (E31); TERA: P7 = 2 dla mastera innej firmy |
| VICTRIX ZEUS Superior 26 / 32, HERCULES Condensing / Solar 26 | 42 / 43 | X40 z powrotem; M3 P33 = ON utrzymuje CO po E31 |

## Instalacja

> 📄 **Plik konfiguracji: [`examples/immergas-opentherm.yaml`](../examples/immergas-opentherm.yaml)**
> ([otwórz na GitHubie](https://github.com/jotuera/immergas-modbus-bms-nasa-opentherm-hub/blob/main/examples/immergas-opentherm.yaml) · [pobierz (raw)](https://raw.githubusercontent.com/jotuera/immergas-modbus-bms-nasa-opentherm-hub/main/examples/immergas-opentherm.yaml))

**Zanim przejdziesz na master** zdejmij pilota (CAR V2 / Super Amico) albo odłącz Dominusa od zacisków OpenTherm, załóż
zworkę X40 z powrotem na 40-41 i wyłącz i włącz zasilanie kotła (E31). W rodzinie HERCULES / ZEUS Superior 26 / 32
najpierw ustaw M3 P33 = ON – kocioł grzeje wtedy nawet po utracie OpenTherm.

1. **Skopiuj konfigurację.** Zapisz [`immergas-opentherm.yaml`](../examples/immergas-opentherm.yaml) w folderze ESPHome (w Home Assistant: *ESPHome →
   Nowe urządzenie → Kontynuuj → Pomiń*, a potem wklej treść do nowego pliku).
2. **Dodaj sekrety**, których używa, do `secrets.yaml`: `wifi_ssid`, `wifi_password`, `immergas_ot_api_key`, `immergas_ot_ota_password`.
3. **Wybierz, czego potrzebujesz** w bloku `packages:` na końcu pliku:

   ```yaml
   files:
     - packages/lang/ot_en.yaml        # albo ot_pl.yaml
     - packages/ot_core.yaml
     - packages/ot_sensors.yaml
     - packages/ot_control.yaml
     - packages/ot_regulator.yaml      # master: krzywa pogodowa + korekta pokojowa
     # - packages/ot_gateway.yaml      # bramka: pilot zostaje
   ```

   - **Master** (hub zastępuje pilota): zostaw `ot_regulator` i ustaw `ot_room_entity` na czujnik temperatury pokoju
     z Home Assistant (albo zostaw – regulator pracuje wtedy tylko z krzywej).
   - **Bramka** (pilot zostaje): odkomentuj `ot_gateway` i podstawienia `ot_room_in_pin` / `ot_room_out_pin`;
     `ot_regulator` jest opcjonalny (ustawia wartości, których hub używa, gdy pilot milczy).
4. **Sprawdź piny** (`substitutions:` na górze), jeśli twoja płytka to nie AtomS3 + ATOMIC PortABC.
5. **Wgraj** urządzenie (pierwszy raz przez USB, potem przez sieć) i **dodaj je w Home Assistant** (*Ustawienia →
   Urządzenia i usługi* – znajdzie się samo).
6. **Sprawdź połączenie:** *Immergas OT - Połączenie z kotłem* włącza się w kilka sekund, a *Temperatura zasilania* / *Płomień* idą za kotłem. *Brak odpowiedzi* rośnie bez *Ramki poprawne* = sprawdź podłączenie adaptera i poziomy `in_active_low` / `out_active_low`; w bramce *Połączenie z pilotem* pokazuje pilota.

## Pakiety

| Pakiet | Co daje |
|---|---|
| `ot_core` | komponent (master), połączenie z kotłem, liczniki ramek / błędów / braku odpowiedzi, `ot_status_low_byte` (domyślnie **0xCA**, „poprawka Immergas”), `ot_max_ch_follows_setpoint` (domyślnie **true**: 57 = nastawa CO), `ot_ch_off_setpoint` (domyślnie **10** °C, 0 = wył.), **mapa Data-ID** (które ID kocioł zna / nie zna, po 64 znaki hex) |
| `ot_sensors` | status (usterka, CO, CWU, płomień, diagnostyka), flagi i kod usterki (5), kod OEM (115), zasilanie, powrót, CWU, temp. zewnętrzna, spaliny, modulacja, ciśnienie, przepływ CWU, moc maks. / min. modulacja (15), nastawy używane przez kocioł (56 / 57), zakresy (48 / 49), starty / godziny palnika |
| `ot_stats` (opcjonalny) | starty palnika dziś, starty w ostatniej godzinie (taktowanie), czas palnika dziś – liczone w hubie z bitu płomienia każdej ramki statusu, zerowane o północy |
| `ot_control` | zezwolenie CO / CWU, nastawa zasilania CO, nastawa CWU, maks. nastawa CO, maks. modulacja |
| `ot_regulator` (master) | krzywa pogodowa (dwa punkty) + powolna korekta pokojowa z temperatury z Home Assistant, CO wł. / wył. z histerezą – regulator, którym byłby pilot / Dominus |
| `ot_gateway` | tryb bramki: połączenie z pilotem, standalone, co zapisuje pilot (nastawa CO, zadana i temperatura pokoju, nastawa CWU, jego zezwolenia CO / CWU), przełączniki nadpisywania |
| `lang/ot_en`, `lang/ot_pl` | nazwy encji (`ot_name_prefix`, domyślnie „Immergas OT”) |

Plik konfiguracji i kroki są w sekcji [Instalacja](#instalacja).

## Jak to działa

- **Ramki**: 1000 bit/s Manchester, 34 bity; wysyłane sprzętowym timerem (półbity), odbierane przerwaniem GPIO i
  dekodowane po czasie zboczy w połowie bitu (prędkość odchylona do ~20 % nadal się dekoduje, zakłócenia krótsze niż
  100 µs są pomijane).
- **Cykl mastera** (ok. 3 ramki na sekundę, co najmniej 100 ms odstępu): status → nastawa CO → maks. nastawa CO →
  zaległy zapis → odczyt. ID, na które kocioł odpowiada UNKNOWN-DATAID / DATA-INVALID, jest pomijane przez godzinę; jego czujnik
  pokazuje „nieznany”.
- **Zapisy się powtarzają** – każdy master OpenTherm wysyła swoje wartości raz po raz (dlatego wartość wpisana obok
  CAR V2 się nie utrzymuje); nastawa CO co cykl, nastawa CWU co 30 s, maks. CO / modulacja co minutę.
- **Maks. nastawa CO podąża za nastawą CO** (`ot_max_ch_follows_setpoint`, domyślnie włączone). Oryginalny pilot
  Immergas wysyła w kółko: status z młodszym bajtem **0xCA** → odczyt 48 → odczyt 49 → zapis **1** → zapis 56 →
  zapis **57** z tą samą wartością co 1. Część kotłów Immergas (EOLO Star, Mini EOLO) potwierdza Data-ID 1, a grzeje
  do Data-ID 57. Dlatego hub co cykl zapisuje 57 = nastawa CO (w granicach kotła, Data-ID 49); liczba „maks.
  nastawa CO” ogranicza wtedy nastawę CO. Bramka: zapis 57 od pilota niesie nastawę CO, którą pilot zapisał; pilot,
  który 57 nie zapisuje, dostaje go od huba zaraz po swojej wymianie (przy zmianie i co 10 s). `false` = zwykły
  OpenTherm (57 = własna wartość liczby).
- **CO wyłączone**: przy zdjętym zezwoleniu CO hub wysyła Data-ID 1 = `ot_ch_off_setpoint` (10 °C) – część kotłów
  dalej odpala palnik do ostatniej nastawy, gdy zdjęty jest tylko bit CO; 57 trzyma prawdziwą nastawę. 0 = wysyłaj
  zwykłą nastawę (kocioł, który niską wartość odrzuca jako błędną).
- **Modulacja (Data-ID 17)** czytana jako 8.8 bez znaku – w czasie CWU potrafi przekroczyć 100 %, a jako f8.8 ze
  znakiem zawinęłaby się do wartości ujemnej (`value_type: u88`).
- **Czasy bramki**: pilot czeka na odpowiedź do 800 ms; hub przekazuje żądanie od razu i porzuca starsze niż 650 ms.
  Kotły Immergas odpowiadają w kilkadziesiąt ms.

**Do potwierdzenia na kotle:** poziomy adapterów z hubem, bajt 0xCA w każdej rodzinie, jak CAR V2 reaguje na bramkę
(może używać ID specyficznych dla Immergasa) i E31 przy przejęciu przez hub.

## Baza wiedzy

- [Immergas Dominus – OpenTherm](https://github.com/jotuera/immergas-dominus/blob/main/docs/opentherm.pl.md): mapa
  Data-ID odczytana z kotłów Immergas, specyfika Immergasa (0xCA, E31, cykliczny zapis CWU, TSP i historia błędów),
  zastąpienie CAR V2, kotły i zaciski, profile menu pięciu rodzin kotłów.
- Specyfikacja OpenTherm 2.2 (warstwa fizyczna, ramka, Data-ID).
- Sekwencja oryginalnego pilota i bajt 0xCA: wątek arduino.ru „Термостат OpenTherm на ESP8266” (strona 16,
  EOLO Star 24 E) i wątek społeczności Home Assistant „OpenTherm component with Immergas EOLO Star 24 boiler”.
- Zgłoszenia użytkowników bramki OT-thing (wątek społeczności Home Assistant „OT-thing – an OpenTherm WiFi
  gateway”): nastawa CO przy wyłączonym CO i modulacja powyżej 100 %.
- Instrukcje instalatora kotłów na immergas.pl (zaciski, menu P / t / A / M, E31, P33, TERA P7).
