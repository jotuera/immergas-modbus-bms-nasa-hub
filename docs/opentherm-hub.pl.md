# Kotły OpenTherm w hubie (immergas_ot)

[English](opentherm-hub.md) · **Polski**

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

| Rodzina kotłów | Zaciski OpenTherm | Bez pilota |
|---|---|---|
| VICTRIX ZEUS 25, EXA, TERA, OMNIA | 41 / 44 | zworka X40 z powrotem na 40-41, wyłącz i włącz zasilanie (E31); TERA: P7 = 2 dla mastera innej firmy |
| VICTRIX ZEUS Superior 26 / 32, HERCULES Condensing / Solar 26 | 42 / 43 | X40 z powrotem; M3 P33 = ON utrzymuje CO po E31 |

## Pakiety

| Pakiet | Co daje |
|---|---|
| `ot_core` | komponent (master), połączenie z kotłem, liczniki ramek / błędów / braku odpowiedzi, `ot_status_low_byte` (domyślnie **0xCA**, „poprawka Immergas”) |
| `ot_sensors` | status (usterka, CO, CWU, płomień, diagnostyka), flagi i kod usterki (5), kod OEM (115), zasilanie, powrót, CWU, temp. zewnętrzna, spaliny, modulacja, ciśnienie, przepływ CWU, nastawy używane przez kocioł (56 / 57), zakresy (48 / 49), starty / godziny palnika |
| `ot_control` | zezwolenie CO / CWU, nastawa zasilania CO, nastawa CWU, maks. nastawa CO, maks. modulacja |
| `ot_regulator` (master) | krzywa pogodowa (dwa punkty) + powolna korekta pokojowa z temperatury z Home Assistant, CO wł. / wył. z histerezą – regulator, którym byłby pilot / Dominus |
| `ot_gateway` | tryb bramki: połączenie z pilotem, standalone, co zapisuje pilot (nastawa CO, zadana i temperatura pokoju, nastawa CWU, jego zezwolenia CO / CWU), przełączniki nadpisywania |
| `lang/ot_en`, `lang/ot_pl` | nazwy encji (`ot_name_prefix`, domyślnie „Immergas OT”) |

Przykład: [`examples/immergas-opentherm.yaml`](../examples/immergas-opentherm.yaml).

## Jak to działa

- **Ramki**: 1000 bit/s Manchester, 34 bity; wysyłane sprzętowym timerem (półbity), odbierane przerwaniem GPIO i
  dekodowane po czasie zboczy w połowie bitu (prędkość odchylona do ~20 % nadal się dekoduje, zakłócenia krótsze niż
  100 µs są pomijane).
- **Cykl mastera** (ok. 3 ramki na sekundę, co najmniej 100 ms odstępu): status → nastawa CO → zaległy zapis →
  odczyt. ID, na które kocioł odpowiada UNKNOWN-DATAID / DATA-INVALID, jest pomijane przez godzinę; jego czujnik
  pokazuje „nieznany”.
- **Zapisy się powtarzają** – każdy master OpenTherm wysyła swoje wartości raz po raz (dlatego wartość wpisana obok
  CAR V2 się nie utrzymuje); nastawa CO co cykl, nastawa CWU co 30 s, maks. CO / modulacja co minutę.
- **Czasy bramki**: pilot czeka na odpowiedź do 800 ms; hub przekazuje żądanie od razu i porzuca starsze niż 650 ms.
  Kotły Immergas odpowiadają w kilkadziesiąt ms.

**Do potwierdzenia na kotle:** poziomy adapterów z hubem, bajt 0xCA w każdej rodzinie, jak CAR V2 reaguje na bramkę
(może używać ID specyficznych dla Immergasa) i E31 przy przejęciu przez hub.
